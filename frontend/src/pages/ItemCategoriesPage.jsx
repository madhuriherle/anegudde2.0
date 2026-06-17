import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { cn } from '../utils/cn';
import { DeletionWarningDialog } from '../components/ui/DeletionWarningDialog';
import { usePermission } from '../hooks/usePermission';

const categorySchema = z.object({
  category_name: z.string().min(1, 'Name is required'),
  status: z.coerce.number().default(1)
});



const ItemCategoriesPage = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError, showConfirm } = useNotification();
  const { hasPermission } = usePermission();
  const canWrite = hasPermission('item_categories.write');
  const canDelete = hasPermission('item_categories.delete');

  // Filter States
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState('');

  const [editingCategory, setEditingCategory] = useState(null);
  const [deleteWarningOpen, setDeleteWarningOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [usageDetails, setUsageDetails] = useState([]);

  // Fetch Data
  const { data: categories, isLoading } = useQuery({
    queryKey: ['item-categories', search, pageSize],
    queryFn: async () => {
      const params = { q: search, page_size: pageSize };
      const res = await api.get('/item-categories/list_categories', { params });
      return res.data;
    }
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      category_name: '',
      status: 1
    }
  });

  const mutation = useMutation({
    mutationFn: async (payload) => {
      const { id, isEditMode, ...data } = payload;
      if (isEditMode && id) return api.put(`/item-categories/update_category/${id}`, data);
      return api.post('/item-categories/create_category', data);
    },
    onSuccess: (_res, variables) => {
      queryClient.invalidateQueries({ queryKey: ['item-categories'] });
      showSuccess(variables?.isEditMode ? 'Category updated' : 'Category added');
      handleCancel();
    },
    onError: (err) => showError(err.response?.data?.detail || 'Operation failed')
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/item-categories/delete_category/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-categories'] });
      showSuccess('Category deleted');
      setDeleteWarningOpen(false);
    },
    onError: (err) => showError(err.response?.data?.detail || 'Delete failed')
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }) => api.put(`/item-categories/update_category/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-categories'] });
      showSuccess('Status updated');
    },
    onError: (err) => showError(err.response?.data?.detail || 'Status update failed')
  });

  const handleEdit = (category) => {
    setEditingCategory(category);
    reset({
      category_name: category.category_name,
      status: category.status
    });
  };

  const handleCancel = () => {
    setEditingCategory(null);
    reset({ category_name: '', status: 1 });
  };

  const handleDeleteClick = async (category) => {
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

  const onSubmit = async (data) => {
    const isEditMode = Boolean(editingCategory);
    const confirmed = await showConfirm(
      isEditMode ? 'Update Category' : 'Add Category',
      isEditMode ? 'Are you sure?' : 'Add this category?'
    );
    if (confirmed) mutation.mutate({ ...data, id: editingCategory?.id, isEditMode });
  };

  const columns = useMemo(() => [
  {
    accessorKey: 'category_name',
    header: 'Category Name',
    cell: (info) => <span className="text-text-main font-medium">{info.getValue()}</span>
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: (info) =>
    <InlineStatusSelect
      value={Number(info.getValue() ?? 1)}
      disabled={statusMutation.isPending || !canWrite}
      onChange={async (nextStatus) => {
        const confirmed = await showConfirm(
          'Update Status',
          `Are you sure you want to ${Number(nextStatus) === 1 ? 'activate' : 'deactivate'} "${info.row.original.category_name}"?`
        );
        if (confirmed) statusMutation.mutate({ id: info.row.original.id, status: nextStatus });
      }} />


  },
  {
    id: 'actions',
    header: () => <div className="text-center">Actions</div>,
    cell: (info) =>
    <div className="flex items-center justify-center gap-2">
          {canWrite && <button onClick={() => handleEdit(info.row.original)} className="action-btn-edit">Edit</button>}
          {canDelete && <button onClick={() => handleDeleteClick(info.row.original)} className="action-btn-delete">Delete</button>}
        </div>

  }],
  [statusMutation, showConfirm, canWrite, canDelete]);

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
        {canWrite && <div className="lg:col-span-4 space-y-6">
          <Card className="border-border-temple sticky top-6">
            <CardContent className="p-6">
              <div className="flex flex-col space-y-1.5 bg-[#F6EEDF] border-b border-[#E2D2B8] px-6 py-4 -mx-6 -mt-6 mb-6 select-none rounded-t-lg">
                <h3 className="text-[18px] font-bold text-[#2F1F14] m-0 font-temple">
                  {editingCategory ? 'Edit Category' : 'Add New Category'}
                </h3>
              </div>
              <form
                onSubmit={(e) => e.preventDefault()}
                className="space-y-5"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
                    e.preventDefault();
                  }
                }}
              >
                <div className="space-y-2">
                  <Label className="text-text-main font-medium">Category Name *</Label>
                  <Input {...register('category_name')} className="border-border-temple/50" />
                  {errors.category_name && <p className="text-xs text-red-500">{errors.category_name.message}</p>}
                </div>
                <div className="flex gap-3 pt-2">
                  {editingCategory &&
                  <Button type="button" variant="ghost" onClick={handleCancel} className="flex-1 bg-white border border-[#D9C8AF]">Cancel</Button>
                  }
                  <Button type="button" onClick={handleSubmit(onSubmit)} disabled={mutation.isPending} className="flex-1 font-bold">Save</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>}

        <div className={cn("lg:col-span-8", !canWrite && "lg:col-span-12")}>
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
        "This will not delete the items themselves, but will affect your reports."]
        } />
      
    </div>);

};

export default ItemCategoriesPage;
