import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { calculateFinalScore } from '@/lib/supabase-helpers';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award } from 'lucide-react';

export default function Leaderboard() {
  const queryClient = useQueryClient();
  const [selectedEvent, setSelectedEvent] = useState<string>('');

  const { data: events } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const { data } = await supabase.from('events').select('*').order('event_name');
      return data || [];
    },
  });

  useEffect(() => {
    if (events && events.length > 0 && !selectedEvent) {
      setSelectedEvent(events[0].id);
    }
  }, [events, selectedEvent]);

  const selectedEventData = events?.find(e => e.id === selectedEvent);

  const { data: athletes } = useQuery({
    queryKey: ['leaderboard-athletes', selectedEvent],
    queryFn: async () => {
      const { data } = await supabase.from('athletes').select('*').eq('event_id', selectedEvent).eq('status', 'completed');
      return data || [];
    },
    enabled: !!selectedEvent,
  });

  const { data: allScores } = useQuery({
    queryKey: ['leaderboard-scores', selectedEvent],
    queryFn: async () => {
      const athleteIds = athletes?.map(a => a.id) || [];
      if (athleteIds.length === 0) return [];
      const { data } = await supabase.from('scores').select('*, judges(role)').in('athlete_id', athleteIds).eq('submitted', true);
      return data || [];
    },
    enabled: !!athletes && athletes.length > 0,
  });

  const { data: allPenalties } = useQuery({
    queryKey: ['leaderboard-penalties', selectedEvent],
    queryFn: async () => {
      const { data } = await supabase.from('penalties').select('*').eq('event_id', selectedEvent).eq('approved', true);
      return data || [];
    },
    enabled: !!selectedEvent,
  });

  // Realtime
  useEffect(() => {
    const ch = supabase.channel('leaderboard').on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, () => {
      queryClient.invalidateQueries({ queryKey: ['leaderboard-scores'] });
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [queryClient]);

  // Calculate rankings
  const rankings = (athletes || []).map(athlete => {
    const athleteScores = allScores?.filter(s => s.athlete_id === athlete.id) || [];
    const dJudgeScores: Record<string, number[]> = {};
    let tTotal = 0;

    athleteScores.forEach((s: any) => {
      if (s.judges?.role === 'd_judge') {
        if (!dJudgeScores[s.judge_id]) dJudgeScores[s.judge_id] = [];
        dJudgeScores[s.judge_id].push(s.final_score);
      }
      if (s.judges?.role === 't_judge') {
        tTotal += s.final_score;
      }
    });

    const penaltiesValue = allPenalties?.filter(p => p.athlete_id === athlete.id).reduce((sum, p) => sum + Number(p.penalty_value), 0) || 0;
    const dArrays = Object.values(dJudgeScores);
    const result = dArrays.length > 0
      ? calculateFinalScore(dArrays, tTotal, selectedEventData?.no_of_asanas || 7, penaltiesValue)
      : { dAverage: 0, tAverage: 0, finalScore: 0 };

    return { ...athlete, ...result, penalties: penaltiesValue };

  }).sort((a, b) => b.finalScore - a.finalScore);

  const rankIcons = [Trophy, Medal, Award];
  const rankColors = ['text-secondary', 'text-muted-foreground', 'text-secondary/60'];

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold">Leaderboard</h1>
            <p className="text-muted-foreground">Event rankings by final score</p>
          </div>
          <Select value={selectedEvent} onValueChange={setSelectedEvent}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Select event" /></SelectTrigger>
            <SelectContent>
              {events?.map(e => <SelectItem key={e.id} value={e.id}>{e.event_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {rankings.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No completed performances yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rankings.map((athlete, index) => {
              const RankIcon = rankIcons[index] || null;
              const rankColor = rankColors[index] || 'text-muted-foreground';
              return (
                <Card key={athlete.id} className={`card-elevated ${index < 3 ? 'border-secondary/20' : ''}`}>
                  <CardContent className="py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-accent">
                        {RankIcon ? (
                          <RankIcon className={`w-6 h-6 ${rankColor}`} />
                        ) : (
                          <span className="text-lg font-display font-bold text-muted-foreground">{index + 1}</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-display font-bold text-lg">{athlete.name}</h3>
                        <p className="text-sm text-muted-foreground">{athlete.district}</p>
                      </div>
                      <div className="text-right space-y-1">
                        <p className="text-3xl font-display font-bold text-primary">{athlete.finalScore.toFixed(2)}</p>
                        <div className="flex gap-2 justify-end text-xs text-muted-foreground">
                          <span>D: {athlete.dAverage.toFixed(2)}</span>
                          <span>T: {athlete.tAverage.toFixed(2)}</span>
                          {athlete.penalties > 0 && <span className="text-destructive">P: -{athlete.penalties}</span>}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
