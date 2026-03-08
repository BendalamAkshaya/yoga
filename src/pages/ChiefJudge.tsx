import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Eye, Calculator, RotateCcw } from 'lucide-react';
import { calculateFinalScore } from '@/lib/supabase-helpers';

export default function ChiefJudge() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedAthlete, setSelectedAthlete] = useState<string | null>(null);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('chief-judge-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scores' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['all-scores'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'athletes' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['event-athletes'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'penalties' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['penalties'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const { data: judge } = useQuery({
    queryKey: ['my-judge-cj', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('judges').select('*, events(*)').eq('user_id', user!.id).eq('role', 'chief_judge').maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: athletes } = useQuery({
    queryKey: ['event-athletes', judge?.event_id],
    queryFn: async () => {
      const { data } = await supabase.from('athletes').select('*').eq('event_id', judge!.event_id).order('sort_order');
      return data || [];
    },
    enabled: !!judge?.event_id,
  });

  const { data: allScores } = useQuery({
    queryKey: ['all-scores', judge?.event_id],
    queryFn: async () => {
      const athleteIds = athletes?.map(a => a.id) || [];
      if (athleteIds.length === 0) return [];
      const { data } = await supabase.from('scores').select('*, judges(name, judge_label, role)').in('athlete_id', athleteIds);
      return data || [];
    },
    enabled: !!athletes && athletes.length > 0,
    refetchInterval: 5000,
  });

  const { data: judges } = useQuery({
    queryKey: ['event-judges', judge?.event_id],
    queryFn: async () => {
      const { data } = await supabase.from('judges').select('*').eq('event_id', judge!.event_id);
      return data || [];
    },
    enabled: !!judge?.event_id,
  });

  const { data: penalties } = useQuery({
    queryKey: ['penalties', judge?.event_id],
    queryFn: async () => {
      const { data } = await supabase.from('penalties').select('*, athletes(name)').eq('event_id', judge!.event_id);
      return data || [];
    },
    enabled: !!judge?.event_id,
  });

  const approvePenalty = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('penalties').update({ approved: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['penalties'] });
      toast.success('Penalty approved');
    },
  });

  const restartMatch = useMutation({
    mutationFn: async (athleteId: string) => {
      // 1. Delete all scores for this athlete
      const { error: scoreErr } = await supabase.from('scores').delete().eq('athlete_id', athleteId);
      if (scoreErr) throw scoreErr;

      // 2. Delete all penalties for this athlete
      const { error: penErr } = await supabase.from('penalties').delete().eq('athlete_id', athleteId);
      if (penErr) throw penErr;

      // 3. Reset athlete status to 'waiting'
      const { error: athErr } = await supabase.from('athletes').update({ status: 'waiting' }).eq('id', athleteId);
      if (athErr) throw athErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-scores'] });
      queryClient.invalidateQueries({ queryKey: ['penalties'] });
      queryClient.invalidateQueries({ queryKey: ['event-athletes'] });
      toast.success('Match restarted successfully. All scores wiped.');
    },
    onError: (e: Error) => toast.error('Failed to restart: ' + e.message)
  });

  const selectedScores = allScores?.filter(s => s.athlete_id === selectedAthlete) || [];
  const currentAthlete = athletes?.find(a => a.status === 'performing');

  // Check submission status per judge per athlete
  const getJudgeSubmissionStatus = (athleteId: string) => {
    const athleteScores = allScores?.filter(s => s.athlete_id === athleteId && s.submitted) || [];
    const submittedJudgeIds = [...new Set(athleteScores.map(s => s.judge_id))];

    // Group D scores
    const dJudges = judges?.filter(j => j.role === 'd_judge') || [];
    const dScoresForAthlete: number[][] = dJudges.map(dj => {
      const judgeScores = athleteScores.filter(s => s.judge_id === dj.id);
      return judgeScores.map(s => s.final_score);
    }).filter(arr => arr.length > 0);

    // T Judge total
    const tJudge = judges?.find(j => j.role === 't_judge');
    const tScores = athleteScores.filter(s => s.judge_id === tJudge?.id);
    const tTotal = tScores.reduce((sum, s) => sum + s.final_score, 0);

    // Penalties
    const athletePenalties = penalties?.filter(p => p.athlete_id === athleteId && p.approved) || [];
    const totalPenalty = athletePenalties.reduce((sum, p) => sum + p.penalty_value, 0);

    const event = judge?.events;
    const { dAverage, tAverage, finalScore } = calculateFinalScore(
      dScoresForAthlete,
      tTotal,
      event?.no_of_asanas || 7,
      totalPenalty
    );

    return {
      judges: judges?.filter(j => (j.role as string) !== 'stage_manager' && (j.role as string) !== 'scorer').map(j => ({
        ...j,
        submitted: submittedJudgeIds.includes(j.id),
      })) || [],
      calculations: { dAverage, tAverage, finalScore, totalPenalty }
    };
  };


  if (!judge) {
    return (
      <DashboardLayout>
        <div className="text-center py-20 text-muted-foreground">Not assigned as Chief Judge.</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Chief Judge Review</h1>
          <p className="text-muted-foreground">{judge.events?.event_name}</p>
        </div>

        {/* Current athlete submission status */}
        {currentAthlete && (
          <Card className="card-elevated border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg">Now Performing: {currentAthlete.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-medium text-muted-foreground">Judge Submission Progress</span>
                  <span className="font-bold">{getJudgeSubmissionStatus(currentAthlete.id).judges.filter(j => j.submitted).length} / {getJudgeSubmissionStatus(currentAthlete.id).judges.length}</span>
                </div>
                <div className="w-full bg-accent rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-primary h-full transition-all duration-500 ease-out"
                    style={{ width: `${(getJudgeSubmissionStatus(currentAthlete.id).judges.filter(j => j.submitted).length / (getJudgeSubmissionStatus(currentAthlete.id).judges.length || 1)) * 100}%` }}
                  />
                </div>

                <div className="flex flex-wrap gap-3 mt-4">
                  {getJudgeSubmissionStatus(currentAthlete.id).judges.map(j => (
                    <div key={j.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${j.submitted ? 'bg-success/10 border-success/30' : 'bg-muted/50 border-border'
                      }`}>
                      {j.submitted ? (
                        <CheckCircle2 className="w-4 h-4 text-success" />
                      ) : (
                        <XCircle className="w-4 h-4 text-muted-foreground animate-pulse" />
                      )}
                      <span className={`text-sm font-medium ${j.submitted ? 'text-success-foreground' : 'text-muted-foreground'}`}>
                        {j.judge_label || j.name}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-6 p-4 rounded-xl gradient-primary text-primary-foreground flex justify-between items-center shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                      <Calculator className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-white/70 font-medium uppercase tracking-wider">Estimated Score</p>
                      <span className="font-bold">Based on current submissions</span>
                    </div>
                  </div>
                  <div className="text-3xl font-display font-black">
                    {getJudgeSubmissionStatus(currentAthlete.id).calculations.finalScore.toFixed(3)}
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t mt-4">
                  <Button
                    variant="outline"
                    className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => {
                      if (confirm(`Are you sure you want to RESTART the match for ${currentAthlete.name}? This will delete all current scores and send them back to the waiting list.`)) {
                        restartMatch.mutate(currentAthlete.id);
                      }
                    }}
                    disabled={restartMatch.isPending}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" /> Restart Match
                  </Button>
                </div>
              </div>
            </CardContent>

          </Card>
        )}

        {/* Athletes list */}
        <Card className="card-elevated">
          <CardHeader><CardTitle>Athletes & Submissions</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Athlete</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Judges</TableHead>
                  <TableHead>Current Score</TableHead>
                  <TableHead>Actions</TableHead>

                </TableRow>
              </TableHeader>
              <TableBody>
                {athletes?.map(athlete => {
                  const judgeStatuses = getJudgeSubmissionStatus(athlete.id);
                  const submittedCount = judgeStatuses.judges.filter(j => j.submitted).length;

                  return (
                    <TableRow key={athlete.id}>
                      <TableCell className="font-medium">{athlete.name}</TableCell>
                      <TableCell><Badge variant={athlete.status === 'performing' ? 'default' : 'secondary'}>{athlete.status}</Badge></TableCell>
                      <TableCell>{submittedCount}/{judgeStatuses.judges.length}</TableCell>
                      <TableCell className="font-bold text-primary">{judgeStatuses.calculations.finalScore}</TableCell>

                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedAthlete(athlete.id)}>
                          <Eye className="w-4 h-4 mr-1" /> Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Detailed scores view */}
        {selectedAthlete && (
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle>Detailed Scores - {athletes?.find(a => a.id === selectedAthlete)?.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Judge</TableHead>
                    <TableHead>Asana</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Base</TableHead>
                    <TableHead>Final</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedScores.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.judges?.name} ({s.judges?.judge_label || s.judges?.role})</TableCell>

                      <TableCell className="font-mono">{s.asana_code}</TableCell>
                      <TableCell className="font-bold">{s.score}</TableCell>
                      <TableCell>{s.base_value}</TableCell>
                      <TableCell className="font-bold text-primary">{s.final_score}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Penalties */}
        <Card className="card-elevated">
          <CardHeader><CardTitle>Penalties</CardTitle></CardHeader>
          <CardContent>
            {penalties?.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No penalties applied</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Athlete</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {penalties?.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.athletes?.name}</TableCell>
                      <TableCell className="font-bold text-destructive">-{p.penalty_value}</TableCell>
                      <TableCell>{p.reason}</TableCell>
                      <TableCell>
                        <Badge variant={p.approved ? 'default' : 'secondary'}>{p.approved ? 'Approved' : 'Pending'}</Badge>
                      </TableCell>
                      <TableCell>
                        {!p.approved && (
                          <Button size="sm" variant="success" onClick={() => approvePenalty.mutate(p.id)}>
                            <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
