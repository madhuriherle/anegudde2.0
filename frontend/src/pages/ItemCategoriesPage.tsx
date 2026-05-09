import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Save,
  Loader2
} from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';
import { InlineStatusSelect } from '../components/ui/InlineStatusSelect';
import { Label } from '../components/ui/Label';
import { DeletionWarningDialog } from '../components/ui/DeletionWarningDialog';

const categorySchema = z.object({
  category_name: z.string().min(1, 'Name is required'),
  status: z.coerce.number().default(1),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

const ItemCategoriesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError, showConfirm } = useNotification();
  
  // Filter States
  const [pageSize, setPageSize] = useState(50);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [deleteWarningOpen, setDeleteWarningOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<any>(null);
  const [usageDetails, setUsageDetails] = useState<string[]>([]);

  // Fetch Data
  const { data: categories, isLoading } = useQuery({
    queryKey: ['item-categories', search, pageSize, statusFilter],
    queryFn: async () => {
      const params: any = { q: search, page_size: pageSize };
      if (statusFilter !== 'all') params.status = statusFilter === 'active' ? 1 : 0;
      const res = await api.get('/item-categories/list_categories', { params });
      return res.data;
    },
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema) as any,
  });

  const mutation = useMutation({
    mutationFn: async (payload: CategoryFormValues & { id?: number; isEditMode?: boolean }) => {
      const { id, isEditMode, ...data } = payload;
      if (isEditMode && id) return api.put(`/item-categories/update_category/${id}`, data);
      return api.post('/item-categories/create_category', data);
    },
    onSuccess: (_res, variables) => {
      queryClient.invalidateQueries({ queryKey: ['item-categories'] });
      showSuccess(variables?.isEditMode ? 'Category updated' : 'Category added');
      handleCancel();
    },
    onError: (err: any) => showError(err.response?.data?.detail || 'Operation failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/item-categories/delete_category/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-categories'] });
      showSuccess('Category deleted');
      setDeleteWarningOpen(false);
    },
    onError: (err: any) => showError(err.response?.data?.detail || 'Delete failed'),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: number }) => api.put(`/item-categories/update_category/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-categories'] });
      showSuccess('Status updated');
    },
    onError: (err: any) => showError(err.response?.data?.detail || 'Status update failed'),
  });

  const handleEdit = (category: any) => {
    setEditingCategory(category);
    reset({
      category_name: category.category_name,
      status: category.status,
    });
  };

  const handleCancel = () => {
    setEditingCategory(null);
    reset({ category_name: '', status: 1 });
  };

  const handleDeleteClick = async (category: any) => {
    try {
      const res = await api.get('/system/check_usage', {
        params: { entity_type: 'category', entity_id: category.id }
      });
      
      if (res.data.has_usage) {
        setUsageDetails(res.data.details);
        setCategoryToDelete(category);
        setDeleteWarningOpen(true);
      } else {
        const confirmed = await showConfirm(
          'Delete Category',
          `Are you sure you want to delete "${category.category_name}"?`
        );
        if (confirmed) {
          deleteMutation.mutate(category.id);
        }
      }
    } catch {
      showError('Failed to check category usage');
    }
  };

  const onSubmit = async (data: CategoryFormValues) => {
    const isEditMode = Boolean(editingCategory);
    const confirmed = await showConfirm(
      isEditMode ? 'Update Category' : 'Add Category',
      isEditMode ? 'Are you sure?' : 'Add this category?'
    );
    if (confirmed) mutation.mutate({ ...data, id: editingCategory?.id, isEditMode });
  };

  const columns = useMemo<ColumnDef<any>[]>(() => [
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
      header: () => <div className="text-center">Actions</div>,
      cell: info => (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => handleEdit(info.row.original)} className="action-btn-edit">Edit</button>
          <button onClick={() => handleDeleteClick(info.row.original)} className="action-btn-delete">Delete</button>
        </div>
      )
    }
  ], [statusMutation]);

  const sortedCategories = useMemo(() => {
    const categoryList = categories?.items || [];
    return [...categoryList].sort((a, b) => {
      if (a.status !== b.status) return b.status - a.status;
      return a.category_name.localeCompare(b.category_name);
    });
  }, [categories]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="page-title">Manage Item Categories</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-6">
          <Card className="border-border-temple sticky top-6">
            <CardContent className="p-6">
              <div className="flex flex-col space-y-1.5 bg-[#F6EEDF] border-b border-[#E2D2B8] px-6 py-4 -mx-6 -mt-6 mb-6 select-none rounded-t-lg">
                <h3 className="text-[18px] font-bold text-[#2F1F14] m-0">
                  {editingCategory ? 'Edit Category' : 'Add New Category'}
                </h3>
              </div>
              <form onSubmit={(e) => e.preventDefault()} className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-text-main font-medium">Category Name *</Label>
                  <Input {...register('category_name')} className="border-border-temple/50" />
                  {errors.category_name && <p className="text-xs text-red-500">{errors.category_name.message}</p>}
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="button" onClick={handleSubmit(onSubmit)} disabled={mutation.isPending} className="flex-1 font-bold">Save</Button>
                  {editingCategory && (
                    <Button type="button" variant="ghost" onClick={handleCancel} className="flex-1 bg-white border border-[#D9C8AF]">Cancel</Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-8">
          <Card className="border-border-temple shadow-sm overflow-hidden">
            <DataTable columns={columns} data={sortedCategories} loading={isLoading} />
          </Card>
        </div>
      </div>

      <DeletionWarningDialog 
        open={deleteWarningOpen}
        onOpenChange={setDeleteWarningOpen}
        onConfirm={() => deleteMutation.mutate(categoryToDelete?.id)}
        isPending={deleteMutation.isPending}
        title="Delete Category with Active Items?"
        description={`"${categoryToDelete?.category_name}" currently contains items.`}
        consequences={[
          ...usageDetails,
          "All items in this category will become uncategorized.",
          "This will not delete the items themselves, but will affect your reports."
        ]}
      />
    </div>
  );
};

export default ItemCategoriesPage;
