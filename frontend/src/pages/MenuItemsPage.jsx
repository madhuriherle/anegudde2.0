import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
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
import { Select } from '../components/ui/Select';
import { Label } from '../components/ui/Label';
import { cn } from '../utils/cn';
import { usePermission } from '../hooks/usePermission';

const menuItemSchema = z.object({
  dish_name: z.string().min(1, 'Dish name is required'),
  unit_id: z.coerce.number().min(1, 'Unit is required'),
  status: z.coerce.number().default(1)
});

const MenuItemsPage = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError, showConfirm } = useNotification();
  const { hasPermission } = usePermission();
  const canWrite = hasPermission('menu_items.write');
  const canDelete = hasPermission('menu_items.delete');

  const [editingMenuItem, setEditingMenuItem] = useState(null);

  // Fetch Data
  const { data: menuItems, isLoading: menuItemsLoading } = useQuery({
    queryKey: ['menu-items'],
    queryFn: async () => {
      const params = { page_size: 1000 };
      const res = await api.get('/menu-items/list_menu_items', { params });
      return res.data;
    }
  });

  const { data: units } = useQuery({
    queryKey: ['units-list'],
    queryFn: async () => (await api.get('/units/list_units', { params: { page_size: 1000 } })).data,
    enabled: canWrite
  });

  const unitOptions = useMemo(() => {
    const list = Array.isArray(units) ? units : units?.items ?? [];
    return [...list].sort((a, b) =>
      String(a.unit_name || '').localeCompare(String(b.unit_name || ''), undefined, { sensitivity: 'base' })
    );
  }, [units]);

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm({
    resolver: zodResolver(menuItemSchema),
    defaultValues: {
      dish_name: '',
      unit_id: '',
      status: 1
    }
  });

  // Mutations
  const mutation = useMutation({
    mutationFn: async (payload) => {
      const { id, isEditMode, ...data } = payload;
      if (isEditMode && !id) {
        throw new Error('Missing menu item ID for update');
      }
      if (id) return api.put(`/menu-items/update_menu_item/${id}`, data);
      return api.post('/menu-items/create_menu_item', data);
    },
    onSuccess: (_res, variables) => {
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      showSuccess(variables?.isEditMode ? 'Menu item updated' : 'Menu item added');
      handleCancel();
    },
    onError: (err) => {
      showError(err.response?.data?.detail || 'Operation failed');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/menu-items/delete_menu_item/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      showSuccess('Menu item deleted');
    },
    onError: (err) => showError(err.response?.data?.detail || 'Delete failed')
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }) => api.put(`/menu-items/update_menu_item/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      showSuccess('Status updated successfully');
    },
    onError: (err) => showError(err.response?.data?.detail || 'Status update failed')
  });

  const handleEdit = (item) => {
    setEditingMenuItem(item);
    reset({
      dish_name: item.dish_name,
      unit_id: item.unit_id,
      status: item.status
    });
  };

  const handleCancel = () => {
    setEditingMenuItem(null);
    reset({
      dish_name: '',
      unit_id: '',
      status: 1
    });
  };

  const onSubmit = async (data) => {
    const confirmed = await showConfirm(
      editingMenuItem ? "Confirm Update" : "Confirm Save",
      `Are you sure you want to ${editingMenuItem ? 'update' : 'save'} this menu item?`
    );

    if (confirmed) {
      mutation.mutate({ ...data, id: editingMenuItem?.id, isEditMode: Boolean(editingMenuItem) });
    }
  };

  const columns = useMemo(() => [
    {
      accessorKey: 'dish_name',
      header: 'Dish Name',
      cell: (info) => <span className="text-text-main font-medium">{info.getValue()}</span>
    },
    {
      accessorKey: 'unit_id',
      header: 'Unit',
      size: 150,
      cell: (info) => {
        const rowUnit = info.row.original?.unit;
        if (rowUnit?.unit_name) {
          return <span className="text-text-main">{rowUnit.unit_code ? `${rowUnit.unit_name} (${rowUnit.unit_code})` : rowUnit.unit_name}</span>;
        }
        const unit = unitOptions.find((u) => u.id === info.getValue());
        return <span className="text-text-main">{unit ? `${unit.unit_name} (${unit.unit_code})` : info.getValue()}</span>;
      }
    },
    {
      accessorKey: 'status',
      header: 'Status',
      size: 120,
      cell: (info) => (
        <InlineStatusSelect
          value={Number(info.getValue() ?? 1)}
          disabled={statusMutation.isPending || !canWrite}
          onChange={async (nextStatus) => {
            const confirmed = await showConfirm(
              'Update Status',
              `Are you sure you want to ${Number(nextStatus) === 1 ? 'activate' : 'deactivate'} "${info.row.original.dish_name}"?`
            );
            if (confirmed) statusMutation.mutate({ id: info.row.original.id, status: nextStatus });
          }}
        />
      )
    },
    {
      id: 'actions',
      header: () => <div className="text-center">Actions</div>,
      size: 150,
      cell: (info) => (
        <div className="flex items-center justify-center gap-2">
          {canWrite && <button onClick={() => handleEdit(info.row.original)} className="action-btn-edit">Edit</button>}
          {canDelete && (
            <button
              onClick={async () => {
                const confirmed = await showConfirm('Delete Menu Item', `Are you sure you want to delete this menu item?`);
                if (confirmed) {
                  deleteMutation.mutate(info.row.original.id);
                }
              }}
              className="action-btn-delete"
            >
              Delete
            </button>
          )}
        </div>
      )
    }
  ], [unitOptions, deleteMutation, showConfirm, statusMutation, canWrite, canDelete]);

  const sortedMenuItems = useMemo(() => {
    if (!menuItems) return [];
    const preferredOrder = ['Rice', 'Rasam', 'Huli', 'Palya', 'Chatni', 'Payasam', 'Buttermilk'];
    const rank = (dishName) => {
      const match = String(dishName || '').match(/\(([^)]+)\)/);
      const englishName = (match?.[1] || '').trim();
      const idx = preferredOrder.indexOf(englishName);
      return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
    };

    return [...(Array.isArray(menuItems) ? menuItems : menuItems?.items ?? [])].sort((a, b) => {
      if (a.status !== b.status) return b.status - a.status;
      const rankDiff = rank(a.dish_name) - rank(b.dish_name);
      if (rankDiff !== 0) return rankDiff;
      return a.dish_name.localeCompare(b.dish_name);
    });
  }, [menuItems]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="page-title">Menu Items</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Left Side: Form (30%) */}
        {canWrite && (
          <div className="lg:col-span-4 space-y-6">
            <Card className="border-border-temple sticky top-6">
              <CardContent className="p-6">
                <div className="flex flex-col space-y-1.5 bg-[#F6EEDF] border-b border-[#E2D2B8] px-6 py-4 -mx-6 -mt-6 mb-6 select-none rounded-t-lg">
                  <h3 className="text-[18px] font-bold leading-[1.25] text-[#2F1F14] m-0 font-temple">
                    {editingMenuItem ? 'Edit Menu Item' : 'Add New Menu Item'}
                  </h3>
                </div>

                <form
                  onSubmit={handleSubmit(onSubmit)}
                  className="space-y-5"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
                      e.preventDefault();
                    }
                  }}
                >
                  <div className="space-y-2">
                    <Label className="text-text-main font-medium">Dish Name *</Label>
                    <Input
                      {...register('dish_name')}
                      className="border-border-temple/50 focus:border-primary"
                    />
                    {errors.dish_name && <p className="text-xs text-red-500 font-medium">{errors.dish_name.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-text-main font-medium">Unit *</Label>
                    <Controller
                      name="unit_id"
                      control={control}
                      render={({ field }) => (
                        <Select {...field} className="w-full border-border-temple/50 focus:border-primary">
                          <option value="">Select Unit</option>
                          {unitOptions.map((u) => (
                            <option key={u.id} value={u.id}>{u.unit_name} ({u.unit_code})</option>
                          ))}
                        </Select>
                      )}
                    />
                    {errors.unit_id && <p className="text-xs text-red-500 font-medium">{errors.unit_id.message}</p>}
                  </div>

                  <div className="flex gap-3 pt-2">
                    {editingMenuItem && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleCancel}
                        className="flex-1 h-10 bg-white border border-[#D9C8AF] text-text-main hover:bg-[#FAF7F2]"
                      >
                        Cancel
                      </Button>
                    )}
                    <Button
                      type="submit"
                      disabled={mutation.isPending}
                      className="flex-1 h-10 bg-primary hover:bg-primary/90 text-white font-bold"
                    >
                      {mutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>{editingMenuItem ? 'Save' : 'Save'}</>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Right Side: List (70%) */}
        <div className={cn("lg:col-span-8 space-y-4", !canWrite && "lg:col-span-12")}>
          <Card className="border-border-temple shadow-sm overflow-hidden">
            <div className="bg-white">
              <DataTable
                columns={columns}
                data={sortedMenuItems}
                loading={menuItemsLoading}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default MenuItemsPage;
