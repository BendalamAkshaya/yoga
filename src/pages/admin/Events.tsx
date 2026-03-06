import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, Power } from 'lucide-react';

export default function AdminEvents() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ event_name: string; type: 'individual' | 'pair'; round: 'semi' | 'final'; no_of_asanas: number }>({ event_name: '', type: 'individual', round: 'semi', no_of_asanas: 7 });


  const { data: events, isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const { data, error } = await supabase.from('events').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: asanas } = useQuery<any[]>({
    queryKey: ['asanas-compulsory', form.type],
    queryFn: async () => {
      const { data } = await supabase
        .from('asanas')
        .select('*')
        .eq('type', 'compulsory')
        .eq('event_type', form.type)
        .order('asana_code');
      return (data || []) as any[];
    },
  });



  const [selectedAsanas, setSelectedAsanas] = useState<string[]>([]);

  const createEvent = useMutation({
    mutationFn: async () => {
      const maxCompulsory = form.round === 'semi' ? 5 : 4;
      if (selectedAsanas.length !== maxCompulsory) {
        throw new Error(`You must select exactly ${maxCompulsory} compulsory asanas for ${form.round === 'semi' ? 'Semi-Final' : 'Final'} round`);
      }

      const { data, error } = await supabase.from('events').insert(form).select().single();

      if (error) throw error;

      if (selectedAsanas.length > 0) {
        const asanaInserts = selectedAsanas.map(code => ({
          event_id: data.id,
          asana_code: code
        }));
        const { error: asanaError } = await supabase.from('event_asanas' as any).insert(asanaInserts);
        if (asanaError) throw asanaError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setOpen(false);
      setForm({ event_name: '', type: 'individual', round: 'semi', no_of_asanas: 7 });
      setSelectedAsanas([]);
      toast.success('Event created with mandatory asanas!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleRoundChange = (v: 'semi' | 'final') => {
    setForm(f => ({ ...f, round: v, no_of_asanas: 7 })); // Always 7 total
    setSelectedAsanas([]);
  };

  const toggleAsana = (code: string) => {
    const max = form.round === 'semi' ? 5 : 4;
    if (selectedAsanas.includes(code)) {
      setSelectedAsanas(s => s.filter(c => c !== code));
    } else if (selectedAsanas.length < max) {
      setSelectedAsanas(s => [...s, code]);
    } else {
      toast.error(`Maximum ${max} compulsory asanas allowed for ${form.round} round`);
    }
  };


  const toggleActive = useMutation({

    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('events').update({ is_active: !is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  });

  const deleteEvent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event deleted');
    },
  });

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Events</h1>
            <p className="text-muted-foreground">Manage competition events</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> Create Event</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Event</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createEvent.mutate(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Event Name</Label>
                  <Input value={form.event_name} onChange={(e) => setForm(f => ({ ...f, event_name: e.target.value }))} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: v as any }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="individual">Individual</SelectItem>
                        <SelectItem value="pair">Pair</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Round</Label>
                    <Select value={form.round} onValueChange={(v) => handleRoundChange(v as any)}>

                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="semi">Semi-Final</SelectItem>
                        <SelectItem value="final">Final</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Select Compulsory Asanas ({selectedAsanas.length}/{form.round === 'semi' ? 5 : 4})</Label>

                  <div className="grid grid-cols-2 gap-2 h-48 overflow-y-auto p-2 border rounded-md">
                    {asanas?.map(asana => (
                      <div
                        key={asana.asana_code}
                        onClick={() => toggleAsana(asana.asana_code)}
                        className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${selectedAsanas.includes(asana.asana_code) ? 'bg-primary/20 border-primary shadow-sm' : 'hover:bg-accent'
                          } border`}
                      >
                        <div className={`w-4 h-4 rounded-sm border flex items-center justify-center flex-shrink-0 ${selectedAsanas.includes(asana.asana_code) ? 'bg-primary border-primary' : 'border-input'}`}>
                          {selectedAsanas.includes(asana.asana_code) && <div className="w-2 h-2 bg-white rounded-full" />}
                        </div>
                        <div className="w-10 h-10 rounded border overflow-hidden bg-muted flex-shrink-0">
                          {asana.image_url ? (
                            <img src={asana.image_url} alt={asana.asana_name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[8px] text-muted-foreground">N/A</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-primary truncate leading-none mb-1">{asana.asana_code}</p>
                          <p className="text-sm truncate leading-none">{asana.asana_name}</p>
                        </div>
                      </div>
                    ))}

                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Total Asanas per Athlete</Label>
                  <Input type="number" min={1} max={10} value={form.no_of_asanas} onChange={(e) => setForm(f => ({ ...f, no_of_asanas: parseInt(e.target.value) || 7 }))} />
                </div>


                <Button type="submit" className="w-full" disabled={createEvent.isPending}>Create Event</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : (
          <div className="grid gap-4">
            {events?.map((event) => (
              <Card key={event.id} className="card-elevated">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${event.is_active ? 'bg-success animate-pulse' : 'bg-muted-foreground/30'}`} />
                      <div>
                        <h3 className="font-semibold text-lg">{event.event_name}</h3>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="secondary">{event.type}</Badge>
                          <Badge variant="outline">{event.round}</Badge>
                          <Badge variant="outline">{event.no_of_asanas} asanas</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant={event.is_active ? 'destructive' : 'success'}
                        size="sm"
                        onClick={() => toggleActive.mutate({ id: event.id, is_active: event.is_active })}
                      >
                        <Power className="w-4 h-4 mr-1" />
                        {event.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteEvent.mutate(event.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {events?.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">No events yet. Create your first event!</div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
