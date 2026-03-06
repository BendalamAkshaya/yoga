import { ReactNode } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  Activity, LogOut, LayoutDashboard, Users, Gavel,
  Monitor, Trophy, ClipboardList, Settings, BookOpen
} from 'lucide-react';


const roleLabels: Record<string, string> = {
  tsr_admin: 'TSR Admin',
  chief_judge: 'Chief Judge',
  d_judge: 'D Judge',
  t_judge: 'T Judge',
  e_judge: 'E Judge',
  stage_manager: 'Stage Manager',
  scorer: 'Scorer',
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const navItems = getNavItems(roles);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col gradient-dark text-sidebar-foreground">
        <div className="p-6 border-b border-sidebar-border">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <Activity className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg text-sidebar-foreground">YogaScore</h1>
              <p className="text-xs text-sidebar-foreground/60">Competition System</p>
            </div>
          </Link>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                  }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-sidebar-border">
          <div className="mb-3 px-3">
            <p className="text-xs text-sidebar-foreground/50 truncate">{user?.email}</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {roles.map(r => (
                <span key={r} className="text-[10px] px-1.5 py-0.5 rounded bg-sidebar-accent text-sidebar-primary font-medium">
                  {roleLabels[r] || r}
                </span>
              ))}
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="flex-1 flex flex-col">
        <header className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card">
          <Link to="/dashboard" className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            <span className="font-display font-bold">YogaScore</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="w-4 h-4" />
          </Button>
        </header>

        {/* Mobile bottom nav */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
          <div className="flex justify-around py-2">
            {navItems.slice(0, 5).map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium ${isActive ? 'text-primary' : 'text-muted-foreground'
                    }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        <main className="flex-1 overflow-auto p-4 md:p-8 pb-20 md:pb-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function getNavItems(roles: string[]) {
  const items = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['tsr_admin', 'chief_judge', 'd_judge', 't_judge', 'e_judge', 'stage_manager', 'scorer'] },
  ];

  if (roles.includes('tsr_admin')) {
    items.push(
      { href: '/admin/events', label: 'Events', icon: ClipboardList, roles: ['tsr_admin'] },
      { href: '/admin/athletes', label: 'Athletes', icon: Users, roles: ['tsr_admin'] },
      { href: '/admin/judges', label: 'Judges', icon: Gavel, roles: ['tsr_admin'] },
      { href: '/admin/asanas', label: 'Asana Library', icon: BookOpen, roles: ['tsr_admin'] },
      { href: '/admin/scores', label: 'All Scores', icon: Trophy, roles: ['tsr_admin'] },
      { href: '/admin/settings', label: 'Settings', icon: Settings, roles: ['tsr_admin'] },

    );
  }
  if (roles.includes('d_judge') || roles.includes('t_judge') || roles.includes('e_judge')) {
    items.push({ href: '/judge/scoring', label: 'Scoring', icon: Gavel, roles: ['d_judge', 't_judge', 'e_judge'] });
  }
  if (roles.includes('chief_judge')) {
    items.push({ href: '/chief-judge', label: 'Review Scores', icon: Trophy, roles: ['chief_judge'] });
  }
  if (roles.includes('stage_manager')) {
    items.push({ href: '/stage-manager', label: 'Stage Control', icon: Monitor, roles: ['stage_manager'] });
  }
  if (roles.includes('scorer')) {
    items.push({ href: '/admin/scores', label: 'Manage Scores', icon: Trophy, roles: ['scorer'] });
  }
  items.push({ href: '/live', label: 'Live Scores', icon: Monitor, roles: ['tsr_admin', 'chief_judge', 'd_judge', 't_judge', 'e_judge', 'stage_manager', 'scorer'] });
  items.push({ href: '/leaderboard', label: 'Leaderboard', icon: Trophy, roles: ['tsr_admin', 'chief_judge', 'd_judge', 't_judge', 'e_judge', 'stage_manager', 'scorer'] });

  return items.filter(item => item.roles.some(r => roles.includes(r)));
}

