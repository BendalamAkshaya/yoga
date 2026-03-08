import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Play, CheckCircle2, XCircle, SkipForward, User } from 'lucide-react';
import { useEffect } from 'react';

export default function StageManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('stage-manager-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'athletes' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['stage-athletes'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const { data: judge } = useQuery({
    queryKey: ['my-judge-sm', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('judges').select('*, events(*)').eq('user_id', user!.id).eq('role', 'stage_manager').maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: athletes } = useQuery({
    queryKey: ['stage-athletes', judge?.event_id],
    queryFn: async () => {
      const { data } = await supabase.from('athletes').select('*').eq('event_id', judge!.event_id).order('sort_order');
      return data || [];
    },
    enabled: !!judge?.event_id,
    refetchInterval: 3000,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('athletes').update({ status: status as any }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stage-athletes'] });
      toast.success('Status updated');
    },
  });

  const currentAthlete = athletes?.find(a => a.status === 'performing');
  const waitingAthletes = athletes?.filter(a => a.status === 'waiting') || [];
  const completedAthletes = athletes?.filter(a => a.status === 'completed' || a.status === 'absent') || [];
  const nextAthlete = waitingAthletes[0];

  const statusColors: Record<string, string> = {
    waiting: 'bg-muted text-muted-foreground',
    performing: 'bg-warning text-warning-foreground',
    completed: 'bg-success text-success-foreground',
    absent: 'bg-destructive text-destructive-foreground',
  };

  if (!judge) {
    return (
      <DashboardLayout>
        <div className="text-center py-20 text-muted-foreground">Not assigned as Stage Manager.</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-6 max-w-3xl mx-auto">
        <div>
          <h1 className="text-2xl font-display font-bold">Stage Control</h1>
          <p className="text-muted-foreground">{judge.events?.event_name}</p>
        </div>

        {/* Current Performing */}
        <Card className="card-elevated border-2 border-warning/30">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider">Currently Performing</CardTitle>
          </CardHeader>
          <CardContent>
            {currentAthlete ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl gradient-gold flex items-center justify-center">
                    <User className="w-7 h-7 text-warning-foreground" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-display font-bold">{currentAthlete.name}</h2>
                    <p className="text-muted-foreground">{currentAthlete.district}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="success" size="lg" onClick={() => updateStatus.mutate({ id: currentAthlete.id, status: 'completed' })}>
                    <CheckCircle2 className="w-5 h-5 mr-2" /> Complete
                  </Button>
                  <Button variant="destructive" size="lg" onClick={() => updateStatus.mutate({ id: currentAthlete.id, status: 'absent' })}>
                    <XCircle className="w-5 h-5 mr-2" /> Absent
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">No athlete performing</p>
            )}
          </CardContent>
        </Card>

        {/* Next Up */}
        {nextAthlete && !currentAthlete && (
          <Card className="card-elevated border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <SkipForward className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Next Athlete</p>
                    <h3 className="text-xl font-bold">{nextAthlete.name}</h3>
                    <p className="text-sm text-muted-foreground">{nextAthlete.district}</p>
                  </div>
                </div>
                <Button size="xl" onClick={() => updateStatus.mutate({ id: nextAthlete.id, status: 'performing' })}>
                  <Play className="w-5 h-5 mr-2" /> Start Performance
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Queue */}
        <Card className="card-elevated">
          <CardHeader><CardTitle>Athlete Queue ({waitingAthletes.length} waiting)</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {waitingAthletes.map((athlete, i) => (
                <div key={athlete.id} className="flex items-center justify-between p-3 rounded-lg bg-accent/30">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">{i + 1}</span>
                    <div>
                      <p className="font-medium">{athlete.name}</p>
                      <p className="text-xs text-muted-foreground">{athlete.district}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!currentAthlete && i === 0 && (
                      <Button size="sm" onClick={() => updateStatus.mutate({ id: athlete.id, status: 'performing' })}>
                        <Play className="w-3 h-3 mr-1" /> Start
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => updateStatus.mutate({ id: athlete.id, status: 'absent' })}>
                      <XCircle className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
              {waitingAthletes.length === 0 && (
                <p className="text-center py-4 text-muted-foreground">No athletes waiting</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Completed */}
        {completedAthletes.length > 0 && (
          <Card className="card-elevated">
            <CardHeader><CardTitle>Completed ({completedAthletes.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {completedAthletes.map(athlete => (
                  <div key={athlete.id} className="flex items-center justify-between p-3 rounded-lg bg-accent/20">
                    <span className="font-medium">{athlete.name}</span>
                    <Badge className={statusColors[athlete.status]}>{athlete.status}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
