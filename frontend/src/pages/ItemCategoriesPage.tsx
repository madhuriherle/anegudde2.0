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
      if (isEditMode && !id) {
        throw new Error('Missing category ID for update');
      }
      if (id) {
        return api.put(`/item-categories/update_category/${id}`, data);
      }
      return api.post('/item-categories/create_category', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-categories'] });
      showSuccess(editingCategory ? 'Category updated' : 'Category added');
      handleCancel();
    },
    onError: (err: any) => showError(err.response?.data?.detail || 'Operation failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/item-categories/delete_category/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-categories'] });
      showSuccess('Category deleted');
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

  const onSubmit = async (data: CategoryFormValues) => {
    mutation.mutate({ ...data, id: editingCategory?.id, isEditMode: Boolean(editingCategory) });
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
          <button
            onClick={async () => {
              const confirmed = await showConfirm('Delete Category', `Are you sure?`);
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

  const sortedCategories = useMemo(() => {
    const categoryList = categories?.items || [];
    return [...categoryList].sort((a, b) => {
      // First sort by status: Active (1) before Disabled (0)
      if (a.status !== b.status) {
        return b.status - a.status;
      }
      // Then sort by category_name (A-Z)
      return a.category_name.localeCompare(b.category_name);
    });
  }, [categories]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="page-title">Manage Item Categories</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Form (30%) */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="border-border-temple sticky top-6">
            <CardContent className="p-6">
              <div className="flex flex-col space-y-1.5 bg-[#F6EEDF] border-b border-[#E2D2B8] px-6 py-4 -mx-6 -mt-6 mb-6 select-none rounded-t-lg">
                <h3 className="text-[18px] font-bold leading-[1.25] text-[#2F1F14] m-0">
                  {editingCategory ? 'Edit Category' : 'Add New Category'}
                </h3>
              </div>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-text-main font-medium">Category Name *</Label>
                  <Input 
                    {...register('category_name')} 
                    placeholder="e.g. Vegetables, Grains..." 
                    className="border-border-temple/50 focus:border-primary"
                  />
                  {errors.category_name && <p className="text-xs text-red-500 font-medium">{errors.category_name.message}</p>}
                </div>

                <div className="flex gap-3 pt-2">
                  <Button 
                    type="submit" 
                    disabled={mutation.isPending}
                    className={editingCategory ? 'flex-1 h-10 text-text-main font-bold' : 'w-full h-10 text-text-main font-bold'}
                  >
                    {mutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                      
                        {editingCategory ? 'Save' : 'Save'}
                      </>
                    )}
                  </Button>
                  
                  {editingCategory && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      onClick={handleCancel}
                      className="flex-1 h-10 bg-white border border-[#D9C8AF] text-text-main hover:bg-[#FAF7F2]"
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: List (70%) */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="border-border-temple shadow-sm overflow-hidden">
            <div className="bg-white">
              <DataTable 
                columns={columns} 
                data={sortedCategories} 
                loading={isLoading} 
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ItemCategoriesPage;

