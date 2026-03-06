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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, Search } from 'lucide-react';

export default function AdminAsanas() {
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [form, setForm] = useState({
        asana_code: '',
        asana_name: '',
        image_url: '',
        base_value: 1.0,
        type: 'compulsory' as 'compulsory' | 'optional',
        event_type: 'individual' as 'individual' | 'pair'
    });


    const { data: asanas, isLoading } = useQuery({
        queryKey: ['asanas-all'],
        queryFn: async () => {
            const { data } = await supabase.from('asanas').select('*').order('asana_code');
            return data || [];
        },
    });

    const createAsana = useMutation({
        mutationFn: async () => {
            // Validate base value for optional asanas
            if (form.type === 'optional' && (form.base_value < 0.8 || form.base_value > 1.0)) {
                throw new Error('Optional asanas must have a base value between 0.80 and 1.00');
            }
            const { error } = await supabase.from('asanas').insert(form);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['asanas-all'] });
            setOpen(false);
            setForm({ asana_code: '', asana_name: '', image_url: '', base_value: 1.0, type: 'compulsory', event_type: 'individual' });
            toast.success('Asana added to library!');
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const deleteAsana = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('asanas').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['asanas-all'] });
            toast.success('Asana removed');
        },
    });

    const filteredAsanas = asanas?.filter(a =>
        a.asana_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.asana_code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <DashboardLayout>
            <div className="animate-fade-in space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl font-display font-bold">Asana Library</h1>
                        <p className="text-muted-foreground">Manage and configure all possible yoga poses</p>
                    </div>
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild>
                            <Button><Plus className="w-4 h-4 mr-2" /> Add Asana</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Add New Asana</DialogTitle></DialogHeader>
                            <form onSubmit={(e) => { e.preventDefault(); createAsana.mutate(); }} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Code</Label>
                                        <Input value={form.asana_code} onChange={(e) => setForm(f => ({ ...f, asana_code: e.target.value.toUpperCase() }))} placeholder="C1, O1..." required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Type</Label>
                                        <Select value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: v as any }))}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="compulsory">Compulsory</SelectItem>
                                                <SelectItem value="optional">Optional</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Name</Label>
                                    <Input value={form.asana_name} onChange={(e) => setForm(f => ({ ...f, asana_name: e.target.value }))} placeholder="Surya Namaskar..." required />
                                </div>
                                <div className="space-y-2">
                                    <Label>Image URL</Label>
                                    <div className="flex gap-2">
                                        <Input value={form.image_url} onChange={(e) => setForm(f => ({ ...f, image_url: e.target.value }))} placeholder="https://example.com/image.jpg" />
                                        {form.image_url && (
                                            <div className="w-10 h-10 rounded border overflow-hidden bg-muted">
                                                <img src={form.image_url} alt="Preview" className="w-full h-full object-cover" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Base Difficulty Value {form.type === 'optional' ? '(0.80 - 1.00)' : '(1.00)'}</Label>
                                    <Input
                                        type="number"
                                        step="0.05"
                                        min={form.type === 'optional' ? 0.8 : 1.0}
                                        max={1.0}
                                        value={form.base_value}
                                        onChange={(e) => setForm(f => ({ ...f, base_value: parseFloat(e.target.value) || 1.0 }))}
                                        disabled={form.type === 'compulsory'}
                                        required
                                    />
                                </div>
                                <Button type="submit" className="w-full" disabled={createAsana.isPending}>Add to Library</Button>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                <Card className="card-elevated">
                    <CardContent className="p-0">
                        <div className="p-4 border-b">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search asanas by name or code..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-16">Photo</TableHead>
                                        <TableHead>Code</TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Event</TableHead>
                                        <TableHead>Base Value</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredAsanas?.map((asana) => (
                                        <TableRow key={asana.id}>
                                            <TableCell>
                                                <div className="w-10 h-10 rounded border overflow-hidden bg-muted">
                                                    {asana.image_url ? (
                                                        <img src={asana.image_url} alt={asana.asana_name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">No Image</div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-mono font-bold">{asana.asana_code}</TableCell>
                                            <TableCell className="font-medium">{asana.asana_name}</TableCell>
                                            <TableCell>
                                                <Badge variant={asana.type === 'compulsory' ? 'default' : 'secondary'}>
                                                    {asana.type}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="capitalize">
                                                    {(asana as any).event_type}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-bold text-primary">×{asana.base_value}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm" onClick={() => deleteAsana.mutate(asana.id)}>
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {!isLoading && filteredAsanas?.length === 0 && (
                                        <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No asanas found</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
