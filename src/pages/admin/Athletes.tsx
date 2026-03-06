import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';

export default function AdminAthletes() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<string>('all');
  const [form, setForm] = useState({ name: '', age: '', gender: 'male', district: '', event_id: '', optional_asana1: '', optional_asana2: '', optional_asana3: '' });


  const { data: events } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const { data } = await supabase.from('events').select('*').order('event_name');
      return data || [];
    },
  });

  const currentEvent = events?.find(e => e.id === form.event_id);

  const { data: optionalAsanas } = useQuery<any[]>({
    queryKey: ['asanas-optional', currentEvent?.type],
    queryFn: async () => {
      if (!currentEvent?.type) return [];
      const { data } = await supabase
        .from('asanas')
        .select('*')
        .eq('type', 'optional')
        .eq('event_type', currentEvent.type)
        .order('asana_code');
      return (data || []) as any[];
    },
    enabled: !!currentEvent?.type,
  });



  const handleEventChange = (v: string) => {
    setForm(f => ({
      ...f,
      event_id: v,
      optional_asana1: '',
      optional_asana2: '',
      optional_asana3: ''
    }));
  };



  const { data: athletes, isLoading } = useQuery({
    queryKey: ['athletes', selectedEvent],
    queryFn: async () => {
      let q = supabase.from('athletes').select('*, events(event_name)').order('sort_order');
      if (selectedEvent !== 'all') q = q.eq('event_id', selectedEvent);
      const { data } = await q;
      return data || [];
    },
  });

  const createAthlete = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('athletes').insert({
        name: form.name,
        age: form.age ? parseInt(form.age) : null,
        gender: form.gender,
        district: form.district,
        event_id: form.event_id,
        optional_asana1: form.optional_asana1 === 'none' ? null : (form.optional_asana1 || null),
        optional_asana2: form.optional_asana2 === 'none' ? null : (form.optional_asana2 || null),
        optional_asana3: form.optional_asana3 === 'none' ? null : (form.optional_asana3 || null),
      });


      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athletes'] });
      setOpen(false);
      setForm({ name: '', age: '', gender: 'male', district: '', event_id: '', optional_asana1: '', optional_asana2: '', optional_asana3: '' });

      toast.success('Athlete registered!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteAthlete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('athletes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athletes'] });
      toast.success('Athlete removed');
    },
  });

  const statusColors: Record<string, string> = {
    waiting: 'bg-muted text-muted-foreground',
    performing: 'bg-warning text-warning-foreground',
    completed: 'bg-success text-success-foreground',
    absent: 'bg-destructive text-destructive-foreground',
  };

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold">Athletes</h1>
            <p className="text-muted-foreground">Manage competition athletes</p>
          </div>
          <div className="flex gap-2">
            <Select value={selectedEvent} onValueChange={setSelectedEvent}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Filter by event" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                {events?.map(e => <SelectItem key={e.id} value={e.id}>{e.event_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" /> Register</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Register Athlete</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); createAthlete.mutate(); }} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Age</Label>
                      <Input type="number" value={form.age} onChange={(e) => setForm(f => ({ ...f, age: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Gender</Label>
                      <Select value={form.gender} onValueChange={(v) => setForm(f => ({ ...f, gender: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>District</Label>
                    <Input value={form.district} onChange={(e) => setForm(f => ({ ...f, district: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Event</Label>
                    <Select value={form.event_id} onValueChange={handleEventChange}>
                      <SelectTrigger><SelectValue placeholder="Select event" /></SelectTrigger>

                      <SelectContent>
                        {events?.map(e => <SelectItem key={e.id} value={e.id}>{e.event_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[1, 2, 3].map((num) => {
                      const currentEvent = events?.find(e => e.id === form.event_id);
                      const isFinal = currentEvent?.round === 'final';
                      const isVisible = num <= (isFinal ? 3 : 2);
                      const selectedCode = (form as any)[`optional_asana${num}`];
                      const selectedAsana = optionalAsanas?.find(a => a.asana_code === selectedCode);

                      if (!isVisible) return null;

                      return (
                        <div key={num} className="space-y-2">
                          <Label>Optional Asana {num}</Label>
                          <Select
                            value={selectedCode || 'none'}
                            onValueChange={(v) => setForm(f => ({ ...f, [`optional_asana${num}`]: v }))}
                          >
                            <SelectTrigger className="h-10">
                              <SelectValue placeholder="Select asana" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {optionalAsanas?.map(asana => (
                                <SelectItem key={asana.asana_code} value={asana.asana_code}>
                                  {asana.asana_code} - {asana.asana_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {selectedAsana?.image_url && (
                            <div className="mt-2 w-full aspect-square rounded-lg border overflow-hidden bg-muted">
                              <img src={selectedAsana.image_url} alt={selectedAsana.asana_name} className="w-full h-full object-cover" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>



                  <Button type="submit" className="w-full" disabled={createAthlete.isPending}>Register</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="card-elevated overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>District</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {athletes?.map((athlete: any, i: number) => (
                  <TableRow key={athlete.id}>
                    <TableCell className="font-mono">{i + 1}</TableCell>
                    <TableCell className="font-medium">{athlete.name}</TableCell>
                    <TableCell>{athlete.district}</TableCell>
                    <TableCell>{athlete.events?.event_name}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[athlete.status]}>{athlete.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => deleteAthlete.mutate(athlete.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && athletes?.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No athletes registered yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
