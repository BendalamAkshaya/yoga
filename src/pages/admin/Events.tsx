import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, Power, CheckCircle2, Gavel } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { getSafeImageUrl } from '@/lib/supabase-helpers';

// ─────────────────────────────────────────────
// Constants — map internal keys to folder names & display labels
// ─────────────────────────────────────────────
const AGE_GROUPS = [
  { value: 'sub_junior', label: 'Sub Junior (10–14 Years)', folder: 'sub_junior' },
  { value: 'junior', label: 'Junior (14–18 Years)', folder: 'junior' },
  { value: 'senior', label: 'Senior (18–28 Years)', folder: 'senior' },
  { value: 'senior_a', label: 'Senior-A (28–35 Years)', folder: 'senior_a' },
  { value: 'senior_b', label: 'Senior-B (35–45 Years)', folder: 'senior_b' },
  { value: 'senior_c', label: 'Senior-C (45–55 Years)', folder: 'senior_c' },
] as const;

const EVENT_CATEGORIES = [
  { value: 'traditional', label: 'Traditional Yogasana' },
  { value: 'specialized_individual', label: 'Specialized Individual' },
  { value: 'pair', label: 'Pair Event' },
] as const;

const ROUNDS = [
  { value: 'semi', label: 'Semi-Final', folder: 'Semi-Final', compulsoryCount: 5, optionalCount: 2 },
  { value: 'final', label: 'Final', folder: 'Final', compulsoryCount: 4, optionalCount: 3 },
] as const;

// Derive compulsory image preview URLs for traditional events
const SUPABASE_STORAGE_BASE = 'https://odkguzwsusdwwvlccavv.supabase.co/storage/v1/object/public/asana-images';

function getCompulsoryImageUrls(round: string, ageGroup: string): string[] {
  const roundData = ROUNDS.find(r => r.value === round);
  const ageData = AGE_GROUPS.find(a => a.value === ageGroup);
  if (!roundData || !ageData) return [];
  const count = roundData.compulsoryCount;
  return Array.from({ length: count }, (_, i) =>
    `${SUPABASE_STORAGE_BASE}/compulsory-traditional/${roundData.folder.toLowerCase()}/${ageData.folder}/${i + 1}.png`
  );
}

type FormState = {
  event_name: string;
  event_category: string;
  age_group: string;
  round: 'semi' | 'final';
  no_of_asanas: number;
};

const defaultForm: FormState = {
  event_name: '',
  event_category: 'traditional',
  age_group: 'sub_junior',
  round: 'semi',
  no_of_asanas: 7,
};

export default function AdminEvents() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(defaultForm);

  const isTraditional = form.event_category === 'traditional';
  const compulsoryPreviews = isTraditional ? getCompulsoryImageUrls(form.round, form.age_group) : [];
  const roundData = ROUNDS.find(r => r.value === form.round);

  const { data: events, isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const { data, error } = await supabase.from('events').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createEvent = useMutation({
    mutationFn: async () => {
      // Determine event_type for existing DB column based on category
      const type = form.event_category === 'pair' ? 'pair' : 'individual';
      const { error } = await supabase.from('events').insert({
        event_name: form.event_name,
        type,
        round: form.round,
        no_of_asanas: form.no_of_asanas,
        age_group: isTraditional ? form.age_group : null,
        event_category: form.event_category,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setOpen(false);
      setForm(defaultForm);
      toast.success('Event created!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('events').update({ is_active: !is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  });

  const setupPanel = useMutation({
    mutationFn: async (eventId: string) => {
      // 1. Fetch generic judge users (10 total)
      const emails = [
        'cj@yoga.com',
        'd1@yoga.com', 'd2@yoga.com', 'd3@yoga.com', 'd4@yoga.com', 'd5@yoga.com',
        't1@yoga.com', 'e1@yoga.com',
        'sa1@yoga.com', 'sm1@yoga.com'
      ];
      const { data: users, error: userError } = await supabase.from('profiles').select('user_id, email, full_name').in('email', emails);
      if (userError) throw userError;
      if (!users || users.length === 0) throw new Error('Generic judge accounts not found. Please run the setup SQL script in Supabase first.');

      // 2. Prepare judge records
      const panel = users.map(u => {
        let role: string = 'd_judge';
        let label: string = '';

        if (u.email.startsWith('cj')) { role = 'chief_judge'; label = 'CJ'; }
        else if (u.email.startsWith('d')) { role = 'd_judge'; label = `D${u.email.match(/\d+/)?.[0]}`; }
        else if (u.email.startsWith('t')) { role = 't_judge'; label = 'T'; }
        else if (u.email.startsWith('e')) { role = 'e_judge'; label = 'E'; }
        else if (u.email.startsWith('sa')) { role = 'scorer'; label = 'S/A'; }
        else if (u.email.startsWith('sm')) { role = 'stage_manager'; label = 'SM'; }

        return {
          user_id: u.user_id,
          event_id: eventId,
          name: u.full_name,
          email: u.email,
          role: role as any,
          judge_label: label,
        };
      });

      // 3. Clear existing judges for this event first
      await supabase.from('judges').delete().eq('event_id', eventId);

      // 4. Insert new panel
      const { error: insertError } = await supabase.from('judges').insert(panel as any);
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['judges-count'] });
      toast.success('Standard judge panel assigned!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: judgesCounts } = useQuery({
    queryKey: ['judges-count'],
    queryFn: async () => {
      const { data } = await supabase.from('judges').select('event_id');
      const counts: Record<string, number> = {};
      data?.forEach(j => { counts[j.event_id] = (counts[j.event_id] || 0) + 1; });
      return counts;
    }
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

  const categoryLabel = (cat: string) =>
    EVENT_CATEGORIES.find(c => c.value === cat)?.label ?? cat;
  const ageLabel = (ag: string) =>
    AGE_GROUPS.find(a => a.value === ag)?.label ?? ag;

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
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Event</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createEvent.mutate(); }} className="space-y-4">

                {/* Event Name */}
                <div className="space-y-2">
                  <Label>Event Name</Label>
                  <Input value={form.event_name} onChange={(e) => setForm(f => ({ ...f, event_name: e.target.value }))} required placeholder="e.g. Sub Junior Traditional - Semi Final" />
                </div>

                {/* Event Category */}
                <div className="space-y-2">
                  <Label>Event Category</Label>
                  <Select value={form.event_category} onValueChange={(v) => setForm(f => ({ ...f, event_category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EVENT_CATEGORIES.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Age Group — only for Traditional */}
                {isTraditional && (
                  <div className="space-y-2">
                    <Label>Age Group</Label>
                    <Select value={form.age_group} onValueChange={(v) => setForm(f => ({ ...f, age_group: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {AGE_GROUPS.map(a => (
                          <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Round */}
                <div className="space-y-2">
                  <Label>Round</Label>
                  <Select value={form.round} onValueChange={(v) => setForm(f => ({ ...f, round: v as any }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROUNDS.map(r => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Total Asanas */}
                <div className="space-y-2">
                  <Label>Total Asanas per Athlete</Label>
                  <Input
                    type="number" min={1} max={10}
                    value={form.no_of_asanas}
                    onChange={(e) => setForm(f => ({ ...f, no_of_asanas: parseInt(e.target.value) || 7 }))}
                  />
                  {isTraditional && roundData && (
                    <p className="text-xs text-muted-foreground">
                      Recommended: {roundData.compulsoryCount} compulsory + {roundData.optionalCount} optional = {roundData.compulsoryCount + roundData.optionalCount} total
                    </p>
                  )}
                </div>

                {/* Compulsory Asana Preview — Traditional only */}
                {isTraditional && compulsoryPreviews.length > 0 && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-success" />
                      Compulsory Asanas — Auto-loaded ({compulsoryPreviews.length})
                    </Label>
                    <div className="grid grid-cols-5 gap-2 p-3 rounded-lg border bg-muted/30">
                      {compulsoryPreviews.map((url, idx) => (
                        <div key={idx} className="flex flex-col items-center gap-1">
                          <div className="w-full aspect-square rounded-md border overflow-hidden bg-muted">
                            <img
                              src={getSafeImageUrl(url)}
                              alt={`Compulsory ${idx + 1}`}
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-muted-foreground">{idx + 1}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">These asanas are automatically assigned based on Age Group and Round per the official rulebook.</p>
                  </div>
                )}

                {!isTraditional && (
                  <div className="p-3 rounded-lg border bg-muted/30 text-sm text-muted-foreground">
                    ℹ️ Specialized Individual and Pair events use only <strong>optional asanas</strong> chosen by each athlete. No compulsory asanas apply.
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={createEvent.isPending}>
                  Create Event
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : (
          <div className="grid gap-4">
            {events?.map((event: any) => (
              <Card key={event.id} className="card-elevated">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${event.is_active ? 'bg-success animate-pulse' : 'bg-muted-foreground/30'}`} />
                      <div>
                        <h3 className="font-semibold text-lg">{event.event_name}</h3>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <Badge variant="secondary">{categoryLabel(event.event_category) || event.type}</Badge>
                          {event.age_group && <Badge variant="outline">{ageLabel(event.age_group)}</Badge>}
                          <Badge variant="outline">{event.round === 'semi' ? 'Semi-Final' : 'Final'}</Badge>
                          <Badge variant="outline">{event.no_of_asanas} asanas</Badge>
                          <Badge variant="secondary" className="bg-info/10 text-info border-info/20">
                            {judgesCounts?.[event.id] || 0} Judges
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setupPanel.mutate(event.id)}
                        disabled={setupPanel.isPending}
                        className="hover:bg-info/10 hover:text-info"
                      >
                        <Gavel className="w-4 h-4 mr-1" />
                        Setup Judges
                      </Button>
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
