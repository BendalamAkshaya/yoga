import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function DevRegister() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sqlSnippet, setSqlSnippet] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSqlSnippet(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (error) {
      toast.error(error.message);
      setIsLoading(false);
      return;
    }

    if (data.user) {
      toast.success('User created! Attempting to assign admin role...');
      
      // Attempt to assign tsr_admin role
      // This might fail if RLS is enabled and doesn't allow self-assignment
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ user_id: data.user.id, role: 'tsr_admin' });

      if (roleError) {
        console.error('Role assignment error:', roleError);
        toast.warning('Account created, but admin role assignment failed (expected due to RLS).');
        setSqlSnippet(`INSERT INTO public.user_roles (user_id, role) \nVALUES ('${data.user.id}', 'tsr_admin');`);
      } else {
        toast.success('Admin role assigned!');
        navigate('/dashboard');
      }
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-4">
          <Button variant="ghost" asChild size="sm">
            <Link to="/login"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Login</Link>
          </Button>
        </div>
        <Card className="card-elevated border-yellow-500/50">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="w-5 h-5 text-yellow-500" />
              <Badge variant="outline" className="text-yellow-500 border-yellow-500">Developer Mode</Badge>
            </div>
            <CardTitle className="text-xl">Create Admin Account</CardTitle>
            <CardDescription>Use this to create your first administrative user.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  placeholder="Admin User"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full bg-yellow-600 hover:bg-yellow-700" size="lg" disabled={isLoading}>
                {isLoading ? 'Creating...' : 'Register as Admin'}
              </Button>
            </form>

            {sqlSnippet && (
              <div className="mt-6 p-4 bg-muted rounded-lg border border-dashed text-xs space-y-2">
                <p className="font-bold text-yellow-600 dark:text-yellow-400">Action Required:</p>
                <p>Role assignment failed due to Supabase RLS. Please copy the SQL below and run it in your Supabase SQL Editor:</p>
                <pre className="p-2 bg-background rounded border overflow-x-auto select-all">
                  {sqlSnippet}
                </pre>
                <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => navigate('/login')}>
                  Done, go to Login
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Helper Badge component since I'm not sure if it's imported globally or needs local definition/shadcn
function Badge({ children, className, variant }: any) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}>
      {children}
    </span>
  );
}
