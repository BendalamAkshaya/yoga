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
import { CheckCircle2, AlertTriangle, Send, User, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { getSafeImageUrl } from '@/lib/supabase-helpers';

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores', filter: `judge_id=eq.${judge.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['my-scores'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [judge?.event_id, judge?.id, queryClient]);

  const updateAsanaIndex = useMutation({
    mutationFn: async (newIndex: number) => {
      if (!currentAthlete) return;
      const { error } = await supabase.from('athletes').update({ current_asana_index: newIndex }).eq('id', currentAthlete.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-athlete'] });
      toast.success('Asana updated for all judges');
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
      toast.success('Score submitted!');
      queryClient.invalidateQueries({ queryKey: ['my-scores'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const applyPenalty = useMutation({
    mutationFn: async () => {
      if (!currentAthlete || !judge) return;
      const { error } = await supabase.from('penalties').insert({
        athlete_id: currentAthlete.id,
        event_id: judge.event_id,
        penalty_value: parseFloat(penaltyValue),
        reason: penaltyReason || (penaltyValue === '0' ? 'Confirmed: No violations' : ''),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setPenaltyValue('');
      setPenaltyReason('');
      toast.success(penaltyValue === '0' ? 'Asana confirmed with no penalties' : 'Penalty applied!');
      queryClient.invalidateQueries({ queryKey: ['penalties'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Map age_group DB value to folder name in the public directory
  const AGE_GROUP_FOLDERS: Record<string, string> = {
    sub_junior: 'sub_junior',
    junior: 'junior',
    senior: 'senior',
    senior_a: 'senior_a',
    senior_b: 'senior_b',
    senior_c: 'senior_c',
  };

  const getAsanaList = () => {
    if (!currentAthlete || !judge?.events) return [];

    const event = judge.events as any;
    const eventCategory: string = event.event_category ?? '';
    const isTraditional = eventCategory === 'traditional';

    let compulsoryAsanas: any[] = [];

    if (isTraditional) {
      const ageGroup: string = event.age_group ?? '';
      const ageFolder = AGE_GROUP_FOLDERS[ageGroup] ?? '';
      const roundFolder = event.round === 'final' ? 'Final' : 'Semi-Final';
      const numCompulsory = event.round === 'final' ? 4 : 5;

      for (let i = 1; i <= numCompulsory; i++) {
        compulsoryAsanas.push({
          asana_code: `COMP-${ageGroup}-${event.round}-${i}`,
          asana_name: `Compulsory Asana ${i}`,
          type: 'compulsory',
          base_value: 1.0,
          image_url: ageFolder
            ? `/compulsory-traditional/${roundFolder.toLowerCase()}/${ageFolder}/${i}.png`
            : null,
        });
      }
    }

    const optionalCodes = [
      (currentAthlete as any).optional_asana1,
      (currentAthlete as any).optional_asana2,
      (currentAthlete as any).optional_asana3,
      (currentAthlete as any).optional_asana4,
      (currentAthlete as any).optional_asana5,
    ].filter(Boolean);

    const optionalAsanas = asanas
      ? optionalCodes.map(code => (asanas as any[]).find(a => a.asana_code === code)).filter(Boolean)
      : [];

    const fullList = [...compulsoryAsanas, ...optionalAsanas];

    // Filter to only show the CURRENT asana index
    const currentIndex = (currentAthlete as any).current_asana_index || 0;
    return fullList.slice(currentIndex, currentIndex + 1);
  };

  const asanaList = getAsanaList();
  const currentActiveAsana = asanaList[0];
  const totalAsanasCount = (() => {
    if (!currentAthlete || !judge?.events) return 0;
    const event = judge.events as any;
    const isTraditional = event.event_category === 'traditional';
    const numCompulsory = isTraditional ? (event.round === 'final' ? 4 : 5) : 0;
    const optionalCodes = [
      (currentAthlete as any).optional_asana1,
      (currentAthlete as any).optional_asana2,
      (currentAthlete as any).optional_asana3,
      (currentAthlete as any).optional_asana4,
      (currentAthlete as any).optional_asana5
    ].filter(Boolean);
    return numCompulsory + optionalCodes.length;
  })();

  const isChiefJudge = hasRole('chief_judge');
  const alreadySubmittedActive = existingScores?.some(s => s.asana_code === currentActiveAsana?.asana_code && s.submitted);

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

  const athleteIdx = (currentAthlete as any)?.current_asana_index || 0;

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold">
              {isChiefJudge && 'Chief Judge'}{isDJudge && !isChiefJudge && 'D Judge'}{isTJudge && 'T Judge'}{isEJudge && 'E Judge'} Scoring
            </h1>
            <p className="text-muted-foreground">{judge.events?.event_name} • {judge.judge_label || judge.role}</p>
          </div>
          <div className="flex gap-2">
            {isChiefJudge && currentAthlete && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={athleteIdx <= 0}
                  onClick={() => updateAsanaIndex.mutate(athleteIdx - 1)}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Prev
                </Button>
                <div className="flex items-center px-3 bg-accent rounded-md text-sm font-bold">
                  Asana {athleteIdx + 1} / {totalAsanasCount}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={athleteIdx >= totalAsanasCount - 1}
                  onClick={() => updateAsanaIndex.mutate(athleteIdx + 1)}
                >
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </>
            )}
            {alreadySubmittedActive && !isChiefJudge && (
              <Badge className="bg-success text-success-foreground"><CheckCircle2 className="w-3 h-3 mr-1" /> Current Submitted</Badge>
            )}
          </div>
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

        {/* Scoring Card */}
        {currentAthlete && (isDJudge || isTJudge) && (
          <Card className="card-elevated relative overflow-hidden">
            {alreadySubmittedActive && !isChiefJudge && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
                <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-success" />
                </div>
                <h3 className="text-xl font-bold mb-2">Score Submitted!</h3>
                <p className="text-muted-foreground">Waiting for the Chief Judge to load the next asana...</p>
                <div className="mt-6 flex items-center gap-2 text-sm text-primary font-medium">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Staying synced...
                </div>
              </div>
            )}

            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{currentActiveAsana?.asana_name || 'Active Asana'}</span>
                {!isTJudge && currentActiveAsana && (
                  <Badge variant="outline" className="text-lg py-1 px-4 border-2">
                    Score: {scores[currentActiveAsana.asana_code] || 0}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {currentActiveAsana ? (
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row gap-6">
                    {currentActiveAsana.image_url && (
                      <div className="w-full md:w-1/3 aspect-square rounded-2xl border-2 border-primary/10 overflow-hidden bg-muted shadow-inner">
                        <img
                          src={getSafeImageUrl(currentActiveAsana.image_url)}
                          alt={currentActiveAsana.asana_name}
                          className="w-full h-full object-contain p-2"
                        />
                      </div>
                    )}
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-primary border-primary/20">
                          {currentActiveAsana.asana_code}
                        </Badge>
                        <Badge variant={currentActiveAsana.type === 'compulsory' ? 'default' : 'secondary'}>
                          {currentActiveAsana.type}
                        </Badge>
                      </div>

                      {currentActiveAsana.type === 'optional' && (
                        <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
                          <p className="text-sm text-muted-foreground">Base Value</p>
                          <p className="text-xl font-bold text-primary">{currentActiveAsana.base_value}</p>
                        </div>
                      )}

                      <div className="space-y-3">
                        <Label className="text-base">Enter Score (max {maxScore})</Label>
                        <div className="flex items-center gap-4">
                          {isTJudge ? (
                            <div className="flex-1">
                              <Input
                                type="number" min={0} max={60} step={1}
                                value={scores[currentActiveAsana.asana_code] !== undefined ? Math.round((scores[currentActiveAsana.asana_code] / 2) * 60) : ''}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  if (!isNaN(val) && val >= 0 && val <= 60) {
                                    setScores(s => ({ ...s, [currentActiveAsana.asana_code]: (val / 60) * 2 }));
                                  } else if (e.target.value === '') {
                                    setScores(s => ({ ...s, [currentActiveAsana.asana_code]: 0 }));
                                  }
                                }}
                                className="h-14 text-2xl font-bold text-center border-2 focus:border-primary"
                                placeholder="Seconds (0-60)"
                              />
                            </div>
                          ) : (
                            <div className="flex-1">
                              <Input
                                type="number" min={0} max={maxScore} step={0.5}
                                value={scores[currentActiveAsana.asana_code] ?? ''}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  if (!isNaN(val) && val >= 0 && val <= maxScore) {
                                    setScores(s => ({ ...s, [currentActiveAsana.asana_code]: val }));
                                  } else if (e.target.value === '') {
                                    setScores(s => ({ ...s, [currentActiveAsana.asana_code]: 0 }));
                                  }
                                }}
                                className="h-14 text-2xl font-bold text-center border-2 focus:border-primary"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Quick Score Buttons */}
                      <div className="grid grid-cols-5 gap-2">
                        {isDJudge && [0, 2, 4, 6, 8].filter(v => v <= maxScore).map(val => (
                          <Button
                            key={val} variant={scores[currentActiveAsana.asana_code] === val ? 'default' : 'outline'}
                            className="h-12 font-bold text-lg"
                            onClick={() => setScores(s => ({ ...s, [currentActiveAsana.asana_code]: val }))}
                          >
                            {val}
                          </Button>
                        ))}
                        {isTJudge && [15, 30, 45, 60].map(secs => (
                          <Button
                            key={secs} variant={Math.round((scores[currentActiveAsana.asana_code] || 0) / 2 * 60) === secs ? 'default' : 'outline'}
                            className="h-12 font-bold"
                            onClick={() => setScores(s => ({ ...s, [currentActiveAsana.asana_code]: (secs / 60) * 2 }))}
                          >
                            {secs}s
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t flex justify-between items-center">
                    <div className="text-sm text-muted-foreground italic">
                      {isChiefJudge ? 'Chief Judge can see all but scores as CJ' : 'Your score will be sent to the Scorer panel'}
                    </div>
                    <Button
                      size="lg"
                      className="px-10 h-14 text-lg font-bold shadow-lg shadow-primary/20"
                      onClick={() => submitScores.mutate()}
                      disabled={submitScores.isPending || scores[currentActiveAsana.asana_code] === undefined}
                    >
                      <Send className="w-5 h-5 mr-2" />
                      {alreadySubmittedActive ? 'Update Score' : 'Submit Score'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center text-muted-foreground">
                  No asana found at this index.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* E Judge - Penalties */}
        {currentAthlete && isEJudge && (
          <Card className="card-elevated overflow-hidden border-destructive/20 relative">
            {alreadySubmittedActive && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
                <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-success" />
                </div>
                <h3 className="text-xl font-bold mb-2">Penalty Submitted!</h3>
                <p className="text-muted-foreground">Waiting for the Chief Judge to load the next asana...</p>
                <div className="mt-6 flex items-center gap-2 text-sm text-primary font-medium">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Staying synced...
                </div>
              </div>
            )}

            <div className="gradient-destructive p-4 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <span className="font-bold">E-Judge</span>
                </div>
                <div>
                  <h3 className="font-bold text-lg">Penalty Assessment</h3>
                  <p className="text-white/80 text-sm">Asana: {currentActiveAsana?.asana_name || 'Active Asana'}</p>
                </div>
              </div>
            </div>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Asana Image */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Reference Asana</p>
                  {currentActiveAsana?.image_url ? (
                    <div className="aspect-square rounded-xl border bg-white flex items-center justify-center p-2 relative group overflow-hidden">
                      <img
                        src={getSafeImageUrl(currentActiveAsana.image_url)}
                        alt={currentActiveAsana.asana_name}
                        className="max-h-full max-w-full object-contain transition-transform group-hover:scale-110"
                      />
                    </div>
                  ) : (
                    <div className="aspect-square rounded-xl border bg-muted flex flex-col items-center justify-center p-4">
                      <p className="text-xs text-muted-foreground text-center">No reference image available</p>
                    </div>
                  )}
                </div>

                {/* Penalty Controls */}
                <div className="space-y-4">
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Violation Penalty</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'None (0)', val: 0 },
                        { label: 'Minor (0.5)', val: 0.5 },
                        { label: 'Major (1.0)', val: 1.0 },
                        { label: 'Severe (2.0)', val: 2.0 },
                      ].map((p) => (
                        <Button
                          key={p.val}
                          type="button"
                          variant={penaltyValue === p.val.toString() ? 'destructive' : 'outline'}
                          className="py-6 h-auto"
                          onClick={() => setPenaltyValue(p.val.toString())}
                        >
                          {p.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Reason</Label>
                    <Textarea
                      placeholder="e.g. Body touching floor, Balance..."
                      value={penaltyReason}
                      onChange={(e) => setPenaltyReason(e.target.value)}
                      className="bg-accent/30 min-h-[80px]"
                    />
                  </div>

                  <div className="pt-4 flex flex-col gap-2">
                    <Button
                      size="xl"
                      className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-lg h-16 text-lg font-bold"
                      onClick={() => applyPenalty.mutate()}
                      disabled={applyPenalty.isPending || !penaltyValue}
                    >
                      {applyPenalty.isPending ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Applying...
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-5 h-5 mr-2" />
                          {penaltyValue === '0' ? 'Confirm (No Penalty)' : 'Apply Penalty'}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="mt-8 pt-6 border-t space-y-3">
                <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Quick Presets</Label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Incorrect Order', val: 2.0 },
                    { label: 'Missing Category', val: 5.0 },
                    { label: 'Extra Asana', val: 5.0 },
                  ].map(p => (
                    <Button
                      key={p.label}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPenaltyValue(p.val.toString());
                        setPenaltyReason(p.label);
                      }}
                    >
                      {p.label} (-{p.val})
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout >
  );
}
