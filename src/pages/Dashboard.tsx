import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, ClipboardList, Gavel, Trophy, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { roles, hasRole } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [events, athletes, judges, scores] = await Promise.all([
        supabase.from('events').select('id', { count: 'exact' }),
        supabase.from('athletes').select('id', { count: 'exact' }),
        supabase.from('judges').select('id', { count: 'exact' }),
        supabase.from('scores').select('id', { count: 'exact' }).eq('submitted', true),
      ]);
      return {
        events: events.count || 0,
        athletes: athletes.count || 0,
        judges: judges.count || 0,
        scores: scores.count || 0,
      };
    },
  });

  const roleLabels: Record<string, string> = {
    tsr_admin: 'TSR Admin',
    chief_judge: 'Chief Judge',
    d_judge: 'D Judge',
    t_judge: 'T Judge',
    e_judge: 'E Judge',
    stage_manager: 'Stage Manager',
  };

  const statCards = [
    { label: 'Events', value: stats?.events ?? 0, icon: ClipboardList, color: 'text-primary' },
    { label: 'Athletes', value: stats?.athletes ?? 0, icon: Users, color: 'text-secondary' },
    { label: 'Judges', value: stats?.judges ?? 0, icon: Gavel, color: 'text-info' },
    { label: 'Scores Submitted', value: stats?.scores ?? 0, icon: Trophy, color: 'text-success' },
  ];

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome! Your roles: {roles.map(r => roleLabels[r]).join(', ')}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((stat) => (
            <Card key={stat.label} className="card-elevated">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-3xl font-display font-bold mt-1">{stat.value}</p>
                  </div>
                  <stat.icon className={`w-8 h-8 ${stat.color} opacity-60`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-display font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {hasRole('tsr_admin') && (
              <>
                <QuickAction to="/admin/events" icon={ClipboardList} label="Manage Events" desc="Create and manage competition events" />
                <QuickAction to="/admin/athletes" icon={Users} label="Manage Athletes" desc="Register and assign athletes" />
                <QuickAction to="/admin/judges" icon={Gavel} label="Manage Judges" desc="Assign judges to events" />
              </>
            )}
            {(hasRole('d_judge') || hasRole('t_judge') || hasRole('e_judge')) && (
              <QuickAction to="/judge/scoring" icon={Activity} label="Start Scoring" desc="Score the current athlete" />
            )}
            {hasRole('chief_judge') && (
              <QuickAction to="/chief-judge" icon={Trophy} label="Review Scores" desc="Review all judge submissions" />
            )}
            {hasRole('stage_manager') && (
              <QuickAction to="/stage-manager" icon={Activity} label="Stage Control" desc="Manage athlete flow" />
            )}
            <QuickAction to="/live" icon={Activity} label="Live Display" desc="View live scoring screen" />
            <QuickAction to="/leaderboard" icon={Trophy} label="Leaderboard" desc="View event rankings" />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function QuickAction({ to, icon: Icon, label, desc }: { to: string; icon: any; label: string; desc: string }) {
  return (
    <Link to={to}>
      <Card className="card-elevated hover:border-primary/30 transition-all cursor-pointer group">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{label}</p>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
