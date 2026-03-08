import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';

const roleOptions = [
  { value: 'chief_judge', label: 'Chief Judge' },
  { value: 'd_judge', label: 'D Judge' },
  { value: 't_judge', label: 'T Judge' },
  { value: 'e_judge', label: 'E Judge' },
  { value: 'stage_manager', label: 'Stage Manager' },
  { value: 'scorer', label: 'Scorer' },
];

export default function AdminJudges() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'd_judge', judge_label: '', event_id: '' });

  const { data: events } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const { data } = await supabase.from('events').select('*').order('event_name');
      return data || [];
    },
  });

  const { data: judges, isLoading } = useQuery({
    queryKey: ['judges'],
    queryFn: async () => {
      const { data } = await supabase.from('judges').select('*, events(event_name)').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const createJudge = useMutation({
    mutationFn: async () => {
      // First create the auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { full_name: form.name } },
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user');

      // Assign role
      const { error: roleError } = await supabase.from('user_roles').insert({
        user_id: authData.user.id,
        role: form.role as any,
      });
      if (roleError) throw roleError;

      // Create judge record
      const { error: judgeError } = await supabase.from('judges').insert({
        user_id: authData.user.id,
        name: form.name,
        email: form.email,
        role: form.role as any,
        judge_label: form.judge_label || null,
        event_id: form.event_id,
      });
      if (judgeError) throw judgeError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judges'] });
      setOpen(false);
      setForm({ name: '', email: '', password: '', role: 'd_judge', judge_label: '', event_id: '' });
      toast.success('Judge created and assigned!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteJudge = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('judges').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judges'] });
      toast.success('Judge removed');
    },
  });

  const roleBadgeColors: Record<string, string> = {
    chief_judge: 'bg-secondary text-secondary-foreground',
    d_judge: 'bg-primary text-primary-foreground',
    t_judge: 'bg-info text-info-foreground',
    e_judge: 'bg-warning text-warning-foreground',
    stage_manager: 'bg-accent text-accent-foreground',
    scorer: 'bg-muted text-muted-foreground',
  };

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Judges</h1>
            <p className="text-muted-foreground">Manage and assign judges</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> Add Judge</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Judge</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createJudge.mutate(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input type="password" value={form.password} onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))} required minLength={6} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={form.role} onValueChange={(v) => setForm(f => ({ ...f, role: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {roleOptions.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Label (e.g. D1)</Label>
                    <Input value={form.judge_label} onChange={(e) => setForm(f => ({ ...f, judge_label: e.target.value }))} placeholder="D1, D2..." />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Event</Label>
                  <Select value={form.event_id} onValueChange={(v) => setForm(f => ({ ...f, event_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select event" /></SelectTrigger>
                    <SelectContent>
                      {events?.map(e => <SelectItem key={e.id} value={e.id}>{e.event_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={createJudge.isPending}>Create Judge</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-1 p-6 bg-primary/5 border-primary/20 h-fit">
            <h2 className="font-display font-semibold flex items-center gap-2 mb-4">
              <Plus className="w-4 h-4 text-primary" />
              Standard Panel Info
            </h2>
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">Standard login for all judges:</p>
              <div className="p-3 bg-background rounded border font-mono space-y-1 text-[11px]">
                <div className="flex justify-between"><span>CJ:</span> <span>cj@yoga.com</span></div>
                <div className="flex justify-between"><span>D1-D5:</span> <span>d1@yoga.com...d5@yoga.com</span></div>
                <div className="flex justify-between"><span>T:</span> <span>t1@yoga.com</span></div>
                <div className="flex justify-between"><span>E:</span> <span>e1@yoga.com</span></div>
                <div className="flex justify-between"><span>S/A:</span> <span>sa1@yoga.com</span></div>
                <div className="flex justify-between"><span>SM:</span> <span>sm1@yoga.com</span></div>
                <div className="pt-2 border-t mt-2 flex justify-between">
                  <span className="text-primary font-bold">Pass:</span>
                  <span className="text-primary font-bold">Judge@123</span>
                </div>
              </div>
              <p className="text-[10px] italic text-muted-foreground">Note: These accounts must be created in Supabase first using the provided SQL script.</p>
            </div>
          </Card>

          <Card className="md:col-span-2 card-elevated overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {judges?.map((judge: any) => (
                    <TableRow key={judge.id}>
                      <TableCell className="font-medium">
                        <div>
                          <div>{judge.name}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{judge.email || '-'}</TableCell>
                      <TableCell>
                        <Badge className={roleBadgeColors[judge.role] || ''}>{roleOptions.find(r => r.value === judge.role)?.label || judge.role}</Badge>
                      </TableCell>
                      <TableCell className="font-mono">{judge.judge_label || '-'}</TableCell>
                      <TableCell>{judge.events?.event_name}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => deleteJudge.mutate(judge.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && judges?.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No judges assigned yet</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
