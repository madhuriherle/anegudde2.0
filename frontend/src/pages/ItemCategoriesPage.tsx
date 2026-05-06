import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Eye,
} from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';
import { InlineStatusSelect } from '../components/ui/InlineStatusSelect';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
} from '../components/ui/Dialog';
import { Select } from '../components/ui/Select';
import { Switch } from '../components/ui/Switch';
import { Label } from '../components/ui/Label';
import { DetailItem } from '../components/ui/DetailItem';

const categorySchema = z.object({
  category_name: z.string().min(1, 'Name is required'),
  status: z.coerce.number().default(1),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

const ItemCategoriesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError, showConfirm } = useNotification();
  
  // Filter States
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState<string>('all');
  const [search, setSearch] = useState('');

  const [open, setOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingCategory, setViewingCategory] = useState<any>(null);

  // Fetch Data
  const { data: categories, isLoading } = useQuery({
    queryKey: ['item-categories', search, pageSize, status],
    queryFn: async () => {
      const params: any = { q: search, page_size: pageSize };
      if (status !== 'all') params.status = status === 'active' ? 1 : 0;
      const res = await api.get('/item-categories/list_categories', { params });
      return res.data;
    },
  });

  const { data: users } = useQuery({
    queryKey: ['users-list-minimal'],
    queryFn: async () => (await api.get('/users/list_users', { params: { page_size: 1000 } })).data,
  });

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema) as any,
  });

  const mutation = useMutation({
    mutationFn: async (data: CategoryFormValues) => {
      if (editingCategory) return api.put(`/item-categories/${editingCategory.id}`, data);
      return api.post('/item-categories', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-categories'] });
      showSuccess(editingCategory ? 'Category updated' : 'Category added');
      handleClose();
    },
    onError: (err: any) => showError(err.response?.data?.detail || 'Operation failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/item-categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-categories'] });
      showSuccess('Category deleted');
    },
    onError: (err: any) => showError(err.response?.data?.detail || 'Delete failed'),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: number }) => api.put(`/item-categories/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-categories'] });
      showSuccess('Status updated successfully');
    },
    onError: (err: any) => showError(err.response?.data?.detail || 'Status update failed'),
  });

  const handleOpen = (category: any = null) => {
    setEditingCategory(category);
    if (category) reset(category);
    else reset({ category_name: '', status: 1 });
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingCategory(null);
  };

  const handleView = (category: any) => {
    setViewingCategory(category);
    setViewDialogOpen(true);
  };

  const onSubmit = async (data: CategoryFormValues) => {
    const confirmed = await showConfirm(
      editingCategory ? "Confirm Update" : "Confirm Save",
      `Are you sure you want to ${editingCategory ? 'update' : 'save'} this category?`
    );

    if (confirmed) {
      mutation.mutate(data);
    }
  };

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: 'id',
      header: 'ID',
      cell: info => <span className="text-text-main">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'category_name',
      header: 'Category Name',
      cell: info => <span className="text-text-main font-medium">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: info => (
        <InlineStatusSelect
          value={Number(info.getValue() ?? 1)}
          disabled={statusMutation.isPending}
          onChange={(nextStatus) => statusMutation.mutate({ id: info.row.original.id, status: nextStatus })}
        />
      )
    },
    {
      id: 'actions',
      header: "Actions",
      cell: info => (
        <div className="flex items-center justify-end gap-2">
          <button onClick={() => handleView(info.row.original)} className="action-btn-view">View</button>
          <button onClick={() => handleOpen(info.row.original)} className="action-btn-edit">Edit</button>
          <button
            onClick={async () => {
              const confirmed = await showConfirm('Delete Category', `Are you sure you want to delete category "${info.row.original.category_name}"?`);
              if (confirmed) {
                deleteMutation.mutate(info.row.original.id);
              }
            }}
            className="action-btn-delete"
          >
            Delete
          </button>
        </div>
      )
    }
  ], [deleteMutation, showConfirm, statusMutation]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-text-main text-2xl font-semibold font-temple">Item Categories</h2>
        </div>
        <Button onClick={() => handleOpen()} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Category
        </Button>
      </div>

      <Card className="border-border-temple">
        <CardContent className="p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
             <div className="space-y-1.5">
              <Label className="text-text-main font-medium">Rows</Label>
              <Select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                {[10, 20, 50, 100].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-text-main font-medium">Status Filter</Label>
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </Select>
            </div>
            <div className="space-y-1.5 lg:col-span-2">
              <Label className="text-text-main font-medium">Quick Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-main/50" />
                <Input 
                  placeholder="Search categories..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-xl border border-border-temple overflow-hidden bg-white">
        <DataTable 
          columns={columns} 
          data={categories || []} 
          loading={isLoading} 
        />
      </div>

      {/* View Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-md border-border-temple">
          <DialogHeader className="border-b border-border-temple/40 pb-4">
            <DialogTitle className="text-text-main">Category Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 mt-4">
            <DetailItem label="Category Name" value={viewingCategory?.category_name} />
          </div>
          <DialogFooter className="mt-6 border-t border-border-temple/40 pt-4">
            <Button onClick={() => setViewDialogOpen(false)} className="bg-primary hover:bg-secondary text-white px-10">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
        <DialogContent className="max-w-md border-border-temple">
          <DialogHeader>
            <DialogTitle className="text-text-main font-temple">
              {editingCategory ? 'Edit Category' : 'New Category'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 py-4">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-text-main font-medium">Category Name *</Label>
                <Input {...register('category_name')} placeholder="Enter category name" />
                {errors.category_name && <p className="text-xs text-red-500 font-medium">{errors.category_name.message}</p>}
              </div>

              <div className="flex items-center justify-between p-3 bg-bg-temple/30 rounded-lg border border-border-temple/20">
                <Label className="text-text-main font-medium">Active Status</Label>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <Switch 
                      checked={field.value === 1} 
                      onCheckedChange={(checked) => field.onChange(checked ? 1 : 0)} 
                    />
                  )}
                />
              </div>
            </div>

            <DialogFooter className="gap-3">
              <Button type="button" variant="ghost" onClick={handleClose} className="w-28 h-10 bg-white border border-[#D9C8AF] text-text-main hover:bg-[#FAF7F2]">
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending} className="w-28 h-10 text-text-main">
                {mutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ItemCategoriesPage;




