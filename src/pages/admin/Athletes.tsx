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
import { Plus, Trash2, Search, X } from 'lucide-react';
import { getSafeImageUrl } from '@/lib/supabase-helpers';

export default function AdminAthletes() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [asanaSearch, setAsanaSearch] = useState<Record<number, string>>({});
  const [selectedEvent, setSelectedEvent] = useState<string>('all');
  const [form, setForm] = useState({ name: '', age: '', gender: 'male', district: '', event_id: '', optional_asana1: '', optional_asana2: '', optional_asana3: '', optional_asana4: '', optional_asana5: '' });


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
      optional_asana3: '',
      optional_asana4: '',
      optional_asana5: ''
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
        optional_asana4: form.optional_asana4 === 'none' ? null : (form.optional_asana4 || null),
        optional_asana5: form.optional_asana5 === 'none' ? null : (form.optional_asana5 || null),
      });


      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athletes'] });
      setOpen(false);
      setForm({ name: '', age: '', gender: 'male', district: '', event_id: '', optional_asana1: '', optional_asana2: '', optional_asana3: '', optional_asana4: '', optional_asana5: '' });

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
                    {[1, 2, 3, 4, 5].map((num) => {
                      const currentEvent = events?.find(e => e.id === form.event_id);
                      const isTraditional = currentEvent?.event_name.toLowerCase().includes('traditional');
                      const isIndividual = currentEvent?.event_name.toLowerCase().includes('individual') && !isTraditional;
                      const isFinal = currentEvent?.round === 'final';

                      // Determine how many optional asanas to show based on event type
                      let maxOptional = 0;
                      if (isTraditional && isFinal) {
                        maxOptional = 3;
                      } else if (isTraditional && !isFinal) {
                        maxOptional = 2;
                      } else if (isIndividual) {
                        maxOptional = 5; // Specialized individual events have 5 optional asanas
                      } else {
                        // Default fallback (e.g. Artistic/Rhythmic might not use optional asanas this way, but we will fallback to 3)
                        maxOptional = 3;
                      }

                      const isVisible = num <= maxOptional;
                      const selectedCode = (form as any)[`optional_asana${num}`];
                      const selectedAsana = optionalAsanas?.find(a => a.asana_code === selectedCode);

                      if (!isVisible) return null;

                      const searchTerm = (asanaSearch[num] || '').toLowerCase();
                      const filtered = optionalAsanas?.filter(a =>
                        a.asana_code.toLowerCase().includes(searchTerm)
                      ) || [];

                      return (
                        <div key={num} className="space-y-2">
                          <Label>Optional Asana {num}</Label>

                          {/* Search input */}
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                            <Input
                              className="pl-7 h-8 text-sm"
                              placeholder="Search asana code..."
                              value={asanaSearch[num] || ''}
                              onChange={(e) => setAsanaSearch(s => ({ ...s, [num]: e.target.value }))}
                            />
                          </div>

                          {/* Scrollable asana list */}
                          <div className="h-40 overflow-y-auto border rounded-md bg-background space-y-0.5 p-1">
                            <button
                              type="button"
                              onClick={() => setForm(f => ({ ...f, [`optional_asana${num}`]: '' }))}
                              className={`w-full text-left text-sm px-2 py-1.5 rounded transition-colors ${!selectedCode ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:bg-accent'
                                }`}
                            >
                              — None —
                            </button>
                            {filtered.map(asana => (
                              <button
                                key={asana.asana_code}
                                type="button"
                                onClick={() => setForm(f => ({ ...f, [`optional_asana${num}`]: asana.asana_code }))}
                                className={`w-full flex items-center gap-2 text-left text-sm px-2 py-1.5 rounded transition-colors ${selectedCode === asana.asana_code
                                  ? 'bg-primary/15 text-primary font-semibold border border-primary/30'
                                  : 'hover:bg-accent'
                                  }`}
                              >
                                {asana.image_url && (
                                  <img src={getSafeImageUrl(asana.image_url)} alt={asana.asana_code} className="w-7 h-7 rounded object-cover flex-shrink-0 border" />
                                )}
                                <span className="font-mono">{asana.asana_code}</span>
                              </button>
                            ))}
                            {filtered.length === 0 && (
                              <p className="text-center text-xs text-muted-foreground py-4">No results</p>
                            )}
                          </div>

                          {/* Selected asana preview */}
                          {selectedAsana && (
                            <div className="flex items-center gap-2 p-2 bg-primary/5 border border-primary/20 rounded-lg">
                              {selectedAsana.image_url && (
                                <img src={getSafeImageUrl(selectedAsana.image_url)} alt={selectedAsana.asana_code} className="w-12 h-12 rounded object-cover border" />
                              )}
                              <div>
                                <p className="text-sm font-bold font-mono text-primary">{selectedAsana.asana_code}</p>
                                <p className="text-xs text-muted-foreground">Base value: {selectedAsana.base_value}</p>
                              </div>
                              <button
                                type="button"
                                className="ml-auto text-muted-foreground hover:text-destructive"
                                onClick={() => setForm(f => ({ ...f, [`optional_asana${num}`]: '' }))}
                              >
                                <X className="w-4 h-4" />
                              </button>
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
