import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { calculateFinalScore } from '@/lib/supabase-helpers';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, User, Trophy } from 'lucide-react';

export default function LiveDisplay() {
  const queryClient = useQueryClient();

  const { data: activeEvent } = useQuery({
    queryKey: ['active-event'],
    queryFn: async () => {
      const { data } = await supabase.from('events').select('*').eq('is_active', true).maybeSingle();
      return data;
    },
    refetchInterval: 5000,
  });

  const { data: athletes } = useQuery({
    queryKey: ['live-athletes', activeEvent?.id],
    queryFn: async () => {
      const { data } = await supabase.from('athletes').select('*').eq('event_id', activeEvent!.id).order('sort_order');
      return data || [];
    },
    enabled: !!activeEvent?.id,
  });

  const currentAthlete = athletes?.find(a => a.status === 'performing');
  const nextAthlete = athletes?.find(a => a.status === 'waiting');

  const { data: scores } = useQuery({
    queryKey: ['live-scores', currentAthlete?.id],
    queryFn: async () => {
      const { data } = await supabase.from('scores').select('*, judges(role, judge_label)').eq('athlete_id', currentAthlete!.id).eq('submitted', true);
      return data || [];
    },
    enabled: !!currentAthlete?.id,
    refetchInterval: 3000,
  });

  const { data: penalties } = useQuery({
    queryKey: ['live-penalties', currentAthlete?.id],
    queryFn: async () => {
      const { data } = await supabase.from('penalties').select('*').eq('athlete_id', currentAthlete!.id).eq('approved', true);
      return data || [];
    },
    enabled: !!currentAthlete?.id,
  });

  // Realtime
  useEffect(() => {
    const channels = [
      supabase.channel('live-scores').on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, () => {
        queryClient.invalidateQueries({ queryKey: ['live-scores'] });
      }).subscribe(),
      supabase.channel('live-athletes').on('postgres_changes', { event: '*', schema: 'public', table: 'athletes' }, () => {
        queryClient.invalidateQueries({ queryKey: ['live-athletes'] });
      }).subscribe(),
      supabase.channel('live-penalties').on('postgres_changes', { event: '*', schema: 'public', table: 'penalties' }, () => {
        queryClient.invalidateQueries({ queryKey: ['live-penalties'] });
      }).subscribe(),
    ];
    return () => { channels.forEach(ch => supabase.removeChannel(ch)); };
  }, [queryClient]);

  // Calculate scores
  const dJudgeScores: Record<string, number[]> = {};
  let tTotal = 0;
  scores?.forEach((s: any) => {
    if (s.judges?.role === 'd_judge') {
      const key = s.judge_id;
      if (!dJudgeScores[key]) dJudgeScores[key] = [];
      dJudgeScores[key].push(s.final_score);
    }
    if (s.judges?.role === 't_judge') {
      // For T judge, we sum the raw scores (max 2 per asana)
      tTotal += s.score;
    }
  });

  const totalPenalties = penalties?.reduce((sum, p) => sum + Number(p.penalty_value), 0) || 0;
  const dScoreArrays = Object.values(dJudgeScores);
  const result = dScoreArrays.length > 0
    ? calculateFinalScore(dScoreArrays, tTotal, activeEvent?.no_of_asanas || 7, totalPenalties)
    : null;

  const allDJudgesSubmitted = dScoreArrays.length >= 5;
  const tJudgeSubmitted = scores?.some((s: any) => s.judges?.role === 't_judge');


  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="gradient-dark text-primary-foreground py-6 px-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="w-8 h-8" />
            <div>
              <h1 className="text-2xl font-display font-bold">YogaScore Live</h1>
              <p className="text-sm opacity-70">{activeEvent?.event_name || 'No active event'}</p>
            </div>
          </div>
          <Badge className="bg-destructive text-destructive-foreground animate-pulse text-lg px-4 py-1">● LIVE</Badge>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-8 space-y-8">
        {!activeEvent ? (
          <div className="text-center py-32">
            <Activity className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-2xl font-display text-muted-foreground">No active event</p>
          </div>
        ) : !currentAthlete ? (
          <div className="text-center py-32">
            <User className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-2xl font-display text-muted-foreground">Waiting for next performance...</p>
            {nextAthlete && (
              <p className="text-lg text-primary mt-4">Next up: <strong>{nextAthlete.name}</strong> ({nextAthlete.district})</p>
            )}
          </div>
        ) : (
          <>
            {/* Current Athlete */}
            <Card className="card-elevated border-2 border-primary/20 overflow-hidden">
              <div className="gradient-primary p-6">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-2xl bg-primary-foreground/20 flex items-center justify-center">
                    <User className="w-10 h-10 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-primary-foreground/70 uppercase tracking-wider">Now Performing</p>
                    <h2 className="text-4xl font-display font-bold text-primary-foreground">{currentAthlete.name}</h2>
                    <p className="text-primary-foreground/80">{currentAthlete.district} • Age {currentAthlete.age}</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Score Display */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="card-elevated text-center">
                <CardContent className="pt-8 pb-6">
                  <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2">D Average</p>
                  <p className="text-5xl font-display font-bold text-primary">
                    {allDJudgesSubmitted ? result?.dAverage.toFixed(2) : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">{dScoreArrays.length}/5 D judges submitted</p>
                </CardContent>
              </Card>
              <Card className="card-elevated text-center">
                <CardContent className="pt-8 pb-6">
                  <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2">T Average</p>
                  <p className="text-5xl font-display font-bold text-info">
                    {tJudgeSubmitted ? result?.tAverage.toFixed(2) : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">{tJudgeSubmitted ? '✓' : '○'} T judge</p>
                </CardContent>
              </Card>
              <Card className="card-elevated text-center border-2 border-secondary/30">
                <CardContent className="pt-8 pb-6">
                  <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2">Final Score</p>
                  <p className="text-5xl font-display font-bold text-secondary animate-pulse-score">
                    {allDJudgesSubmitted && tJudgeSubmitted ? result?.finalScore.toFixed(2) : '—'}
                  </p>
                  {totalPenalties > 0 && (
                    <p className="text-xs text-destructive mt-2">Penalties: -{totalPenalties}</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Next Athlete */}
            {nextAthlete && (
              <div className="text-center py-4">
                <p className="text-muted-foreground">Next: <strong className="text-foreground">{nextAthlete.name}</strong> ({nextAthlete.district})</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
