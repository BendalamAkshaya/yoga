import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { CheckCircle2, AlertTriangle, Send, User } from 'lucide-react';

export default function JudgeScoring() {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [scores, setScores] = useState<Record<string, number>>({});
  const [penaltyValue, setPenaltyValue] = useState('');
  const [penaltyReason, setPenaltyReason] = useState('');
  const [orderConfirmed, setOrderConfirmed] = useState(false);


  // Get the judge record for the current user
  const { data: judge } = useQuery({
    queryKey: ['my-judge', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('judges').select('*, events(*)').eq('user_id', user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // Get current performing athlete
  const { data: currentAthlete } = useQuery({
    queryKey: ['current-athlete', judge?.event_id],
    queryFn: async () => {
      const { data } = await supabase.from('athletes').select('*').eq('event_id', judge!.event_id).eq('status', 'performing').maybeSingle();
      return data;
    },
    enabled: !!judge?.event_id,
    refetchInterval: 3000,
  });

  // Get asanas filtered by event type
  const { data: asanas } = useQuery<any[]>({
    queryKey: ['asanas-for-scoring', judge?.events?.type],
    queryFn: async () => {
      if (!judge?.events?.type) return [];
      const { data } = await supabase
        .from('asanas')
        .select('*')
        .eq('event_type', judge.events.type)
        .order('asana_code');
      return (data || []) as any[];
    },
    enabled: !!judge?.events?.type,
  });


  // Get compulsory asanas for this event
  const { data: eventCompulsory } = useQuery({
    queryKey: ['event-compulsory', judge?.event_id],
    queryFn: async () => {
      const { data } = await supabase.from('event_asanas' as any).select('asana_code').eq('event_id', judge!.event_id);
      return (data as any[])?.map(d => d.asana_code) || [];
    },
    enabled: !!judge?.event_id,
  });



  // Get existing scores
  const { data: existingScores } = useQuery({
    queryKey: ['my-scores', judge?.id, currentAthlete?.id],
    queryFn: async () => {
      const { data } = await supabase.from('scores')
        .select('*')
        .eq('judge_id', judge!.id)
        .eq('athlete_id', currentAthlete!.id);
      return data || [];
    },
    enabled: !!judge?.id && !!currentAthlete?.id,
  });

  useEffect(() => {
    if (existingScores && existingScores.length > 0) {
      const existing: Record<string, number> = {};
      existingScores.forEach(s => { existing[s.asana_code] = s.score; });
      setScores(existing);
    }
  }, [existingScores]);

  // Realtime subscription for athlete changes
  useEffect(() => {
    if (!judge?.event_id) return;
    const channel = supabase
      .channel('athlete-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'athletes', filter: `event_id=eq.${judge.event_id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['current-athlete'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [judge?.event_id, queryClient]);

  const maxScore = hasRole('t_judge') ? 2 : 8;
  const isDJudge = hasRole('d_judge');
  const isTJudge = hasRole('t_judge');
  const isEJudge = hasRole('e_judge');

  const submitScores = useMutation({
    mutationFn: async () => {
      if (!judge || !currentAthlete) throw new Error('No active session');

      const asanaList = getAsanaList(); // Use the filtered asana list
      const scoreInserts = asanaList.map(asana => {
        const rawScore = scores[asana.asana_code] || 0;
        const baseValue = asana.type === 'optional' ? (asana.base_value || 1.0) : 1.0;
        const finalScore = rawScore * baseValue;

        return {
          athlete_id: currentAthlete.id,
          judge_id: judge.id,
          asana_code: asana.asana_code,
          score: rawScore,
          base_value: baseValue,
          final_score: finalScore,
          submitted: true,
        };
      });

      // Delete existing then insert
      await supabase.from('scores').delete().eq('judge_id', judge.id).eq('athlete_id', currentAthlete.id);
      const { error } = await supabase.from('scores').insert(scoreInserts);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Scores submitted successfully!');
      queryClient.invalidateQueries({ queryKey: ['my-scores'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitPenalty = useMutation({
    mutationFn: async () => {
      if (!currentAthlete || !judge) return;
      const { error } = await supabase.from('penalties').insert({
        athlete_id: currentAthlete.id,
        event_id: judge.event_id,
        penalty_value: parseFloat(penaltyValue),
        reason: penaltyReason,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setPenaltyValue('');
      setPenaltyReason('');
      toast.success('Penalty applied!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const getAsanaList = () => {
    if (!asanas || !currentAthlete) return [];

    // Compulsory codes from event_asanas
    const compulsoryCodes = eventCompulsory && eventCompulsory.length > 0
      ? eventCompulsory
      : asanas.filter(a => a.type === 'compulsory').slice(0, judge?.events?.no_of_asanas || 5).map(a => a.asana_code);

    const optionalCodes = [
      (currentAthlete as any).optional_asana1,
      (currentAthlete as any).optional_asana2,
      (currentAthlete as any).optional_asana3,
    ].filter(Boolean);

    const combinedCodes = [...compulsoryCodes, ...optionalCodes];
    return combinedCodes.map(code => asanas.find(a => a.asana_code === code)).filter(Boolean) as any[];
  };


  const asanaList = getAsanaList();
  const alreadySubmitted = existingScores && existingScores.length > 0 && existingScores[0]?.submitted;

  const totalScore = asanaList.reduce((sum, asana) => {
    const raw = scores[asana.asana_code] || 0;
    const base = asana.base_value || 1;
    return sum + raw * base;

  }, 0);



  if (!judge) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground text-lg">You are not assigned to any event as a judge.</p>
          <p className="text-sm text-muted-foreground mt-2">Please contact the TSR Admin.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold">
              {isDJudge && 'D Judge'}{isTJudge && 'T Judge'}{isEJudge && 'E Judge'} Scoring
            </h1>
            <p className="text-muted-foreground">{judge.events?.event_name} • {judge.judge_label || judge.role}</p>
          </div>
          {alreadySubmitted && (
            <Badge className="bg-success text-success-foreground"><CheckCircle2 className="w-3 h-3 mr-1" /> Submitted</Badge>
          )}
        </div>

        {/* Current Athlete */}
        {currentAthlete ? (
          <Card className="card-elevated border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl gradient-primary flex items-center justify-center">
                  <User className="w-7 h-7 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Now Performing</p>
                  <h2 className="text-xl font-display font-bold">{currentAthlete.name}</h2>
                  <p className="text-sm text-muted-foreground">{currentAthlete.district} • Age {currentAthlete.age}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="card-elevated">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground text-lg">Waiting for next athlete...</p>
              <p className="text-sm text-muted-foreground mt-1">The Stage Manager will start the next performance</p>
            </CardContent>
          </Card>
        )}

        {/* Scoring Grid - D Judge and T Judge */}
        {currentAthlete && (isDJudge || isTJudge) && (
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Asana Scores (max {maxScore} per asana)</span>
                <span className="text-2xl font-display text-primary">Total: {totalScore.toFixed(2)}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {asanaList.map((asana, index) => {
                  const isOptional = asana.type === 'optional';

                  return (
                    <div key={asana.asana_code} className="flex items-center gap-4 p-4 rounded-xl bg-accent/30 border border-border">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                        {index + 1}
                      </div>
                      <div className="flex items-start gap-4">
                        {asana.image_url && (
                          <div className="w-20 h-20 rounded-xl border overflow-hidden bg-muted flex-shrink-0">
                            <img src={asana.image_url} alt={asana.asana_name} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono font-bold text-primary">{asana.asana_code}</span>
                            <Badge variant={asana.type === 'compulsory' ? 'default' : 'secondary'}>{asana.type}</Badge>
                          </div>
                          <h3 className="text-lg font-bold leading-tight">{asana.asana_name}</h3>
                          {asana.type === 'optional' && (
                            <p className="text-xs text-muted-foreground mt-1">Base Value: <span className="font-bold text-primary">{asana.base_value}</span></p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            max={maxScore}
                            step={0.5}
                            value={scores[asana.asana_code] ?? ''}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val) && val >= 0 && val <= maxScore) {
                                setScores(s => ({ ...s, [asana.asana_code]: val }));
                              } else if (e.target.value === '') {
                                setScores(s => ({ ...s, [asana.asana_code]: 0 }));
                              }
                            }}
                            className="w-24 h-12 text-center text-xl font-bold border-2 border-primary/20"
                          />
                          <span className="text-sm font-medium text-muted-foreground mr-2">/ {maxScore}</span>
                        </div>
                        {/* Quick Score Buttons */}
                        <div className="flex flex-wrap justify-center gap-1 max-w-[200px]">
                          {[0, 2, 4, 6, 8].filter(v => v <= maxScore).map(val => (
                            <Button
                              key={val}
                              variant="outline"
                              size="sm"
                              className="h-8 w-10 text-xs font-bold"
                              onClick={() => setScores(s => ({ ...s, [asana.asana_code]: val }))}
                            >
                              {val}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>


              <div className="mt-6 flex justify-end">
                <Button size="lg" onClick={() => submitScores.mutate()} disabled={submitScores.isPending}>
                  <Send className="w-4 h-4 mr-2" />
                  {alreadySubmitted ? 'Update Scores' : 'Submit Scores'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* E Judge - Penalties */}
        {currentAthlete && isEJudge && (
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-warning" />
                Apply Penalty
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Penalty Value</Label>
                <Input
                  type="number"
                  step="0.5"
                  min={0}
                  value={penaltyValue}
                  onChange={(e) => setPenaltyValue(e.target.value)}
                  placeholder="0.5"
                />
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Textarea
                  value={penaltyReason}
                  onChange={(e) => setPenaltyReason(e.target.value)}
                  placeholder="Incorrect asana order, time violation..."
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Incorrect Order', val: 0.5 },
                  { label: 'Missing Asana', val: 1.0 },
                  { label: 'Time Violation (>30s)', val: 0.5 },
                  { label: 'Unsteadiness/Fall', val: 0.5 },
                  { label: 'Costune Violation', val: 0.5 },
                ].map(p => (
                  <Button
                    key={p.label}
                    variant="outline"
                    size="sm"
                    className="h-10 px-4"
                    onClick={() => {
                      setPenaltyValue(p.val.toString());
                      setPenaltyReason(p.label);
                    }}
                  >
                    {p.label} (-{p.val})
                  </Button>
                ))}
              </div>

              <div className="flex items-center space-x-2 pt-4 border-t">
                <input
                  type="checkbox"
                  id="confirm-order"
                  checked={orderConfirmed}
                  onChange={(e) => setOrderConfirmed(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <Label htmlFor="confirm-order" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  I confirm the athlete performed asanas in the declared order
                </Label>
              </div>


              <Button variant="warning" className="w-full" onClick={() => submitPenalty.mutate()} disabled={submitPenalty.isPending || !penaltyValue}>
                <AlertTriangle className="w-4 h-4 mr-2" /> Apply Penalty
              </Button>
            </CardContent>

          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
