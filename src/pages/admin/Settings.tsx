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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';

export default function AdminSettings() {
  const queryClient = useQueryClient();
  const [asanaOpen, setAsanaOpen] = useState(false);
  const [asanaForm, setAsanaForm] = useState({ asana_code: '', asana_name: '', base_value: '1.0', type: 'compulsory' as const, image_url: '' });

  const { data: asanas } = useQuery({
    queryKey: ['asanas'],
    queryFn: async () => {
      const { data } = await supabase.from('asanas').select('*').order('asana_code');
      return data || [];
    },
  });

  const createAsana = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('asanas').insert({
        asana_code: asanaForm.asana_code,
        asana_name: asanaForm.asana_name,
        base_value: parseFloat(asanaForm.base_value),
        type: asanaForm.type,
        image_url: asanaForm.image_url || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asanas'] });
      setAsanaOpen(false);
      setAsanaForm({ asana_code: '', asana_name: '', base_value: '1.0', type: 'compulsory', image_url: '' });
      toast.success('Asana added!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteAsana = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('asanas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asanas'] });
      toast.success('Asana removed');
    },
  });

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-6">
        <h1 className="text-2xl font-display font-bold">Settings</h1>

        <Card className="card-elevated">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Asana Library</CardTitle>
            <Dialog open={asanaOpen} onOpenChange={setAsanaOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="w-4 h-4 mr-2" /> Add Asana</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Asana</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); createAsana.mutate(); }} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Code</Label>
                      <Input value={asanaForm.asana_code} onChange={(e) => setAsanaForm(f => ({ ...f, asana_code: e.target.value }))} required placeholder="A001" />
                    </div>
                    <div className="space-y-2">
                      <Label>Base Value</Label>
                      <Input type="number" step="0.1" value={asanaForm.base_value} onChange={(e) => setAsanaForm(f => ({ ...f, base_value: e.target.value }))} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input value={asanaForm.asana_name} onChange={(e) => setAsanaForm(f => ({ ...f, asana_name: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={asanaForm.type} onValueChange={(v) => setAsanaForm(f => ({ ...f, type: v as any }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="compulsory">Compulsory</SelectItem>
                        <SelectItem value="optional">Optional</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Image URL (optional)</Label>
                    <Input value={asanaForm.image_url} onChange={(e) => setAsanaForm(f => ({ ...f, image_url: e.target.value }))} placeholder="https://..." />
                  </div>
                  <Button type="submit" className="w-full" disabled={createAsana.isPending}>Add Asana</Button>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Base Value</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {asanas?.map((asana) => (
                  <TableRow key={asana.id}>
                    <TableCell className="font-mono font-bold">{asana.asana_code}</TableCell>
                    <TableCell>{asana.asana_name}</TableCell>
                    <TableCell>{asana.base_value}</TableCell>
                    <TableCell><Badge variant={asana.type === 'optional' ? 'secondary' : 'outline'}>{asana.type}</Badge></TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => deleteAsana.mutate(asana.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
