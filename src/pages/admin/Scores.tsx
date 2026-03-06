import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { RotateCcw, Trash2 } from 'lucide-react';

import { useState } from 'react';

export default function AdminScores() {
  const queryClient = useQueryClient();
  const [selectedEvent, setSelectedEvent] = useState<string>('all');

  const { data: events } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const { data } = await supabase.from('events').select('*').order('event_name');
      return data || [];
    },
  });

  const { data: scores } = useQuery({
    queryKey: ['admin-scores', selectedEvent],
    queryFn: async () => {
      let q = supabase.from('scores').select('*, athletes(name, event_id), judges(name, judge_label, role)').order('created_at', { ascending: false });
      const { data } = await q;
      if (selectedEvent === 'all') return data || [];
      return (data || []).filter((s: any) => s.athletes?.event_id === selectedEvent);
    },
  });

  const undoSubmission = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('scores').update({ submitted: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-scores'] }); // Changed queryKey from 'scores' to 'admin-scores' to match existing pattern
      toast.success('Submission undone!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteScore = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('scores').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-scores'] });
      toast.success('Score undone');
    },
  });

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold">All Scores</h1>
            <p className="text-muted-foreground">View and manage all submitted scores</p>
          </div>
          <Select value={selectedEvent} onValueChange={setSelectedEvent}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Filter by event" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              {events?.map(e => <SelectItem key={e.id} value={e.id}>{e.event_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Card className="card-elevated overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Athlete</TableHead>
                  <TableHead>Judge</TableHead>
                  <TableHead>Asana</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Base</TableHead>
                  <TableHead>Final</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scores?.map((score: any) => (
                  <TableRow key={score.id}>
                    <TableCell className="font-medium">{score.athletes?.name}</TableCell>
                    <TableCell>{score.judges?.name} ({score.judges?.judge_label || score.judges?.role})</TableCell>
                    <TableCell className="font-mono">{score.asana_code}</TableCell>
                    <TableCell className="font-bold">{score.score}</TableCell>
                    <TableCell>{score.base_value}</TableCell>
                    <TableCell className="font-bold text-primary">{score.final_score}</TableCell>
                    <TableCell>
                      <Badge variant={score.submitted ? 'default' : 'outline'}>
                        {score.submitted ? 'Submitted' : 'Draft'}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <div className="flex gap-2">
                        {score.submitted && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => undoSubmission.mutate(score.id)}
                            disabled={undoSubmission.isPending}
                          >
                            Undo
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => deleteScore.mutate(score.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {scores?.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No scores submitted yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
