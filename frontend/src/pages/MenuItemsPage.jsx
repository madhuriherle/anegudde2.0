import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Settings, Search } from 'lucide-react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/Dialog';
import { usePermission } from '../hooks/usePermission';

const menuItemSchema = z.object({
  dish_name: z.string().min(1, 'Dish name is required'),
  unit_id: z.coerce.number().min(1, 'Unit is required'),
  status: z.coerce.number().default(1),
  default_approx_amount: z.coerce.number().nullable().optional()
});

const MenuItemsPage = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError, showConfirm } = useNotification();
  const { hasPermission } = usePermission();
  const canWrite = hasPermission('menu_items.write');
  const canDelete = hasPermission('menu_items.delete');

  const [editingMenuItem, setEditingMenuItem] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [configAmounts, setConfigAmounts] = useState({});
  const [search, setSearch] = useState('');

  // Fetch Data
  const { data: menuItems, isLoading: menuItemsLoading } = useQuery({
    queryKey: ['menu-items', search],
    queryFn: async () => {
      const params = { page_size: 1000 };
      if (search) params.q = search;
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
      status: 1,
      default_approx_amount: null
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

  const saveConfigMutation = useMutation({
    mutationFn: async (updates) => {
      await Promise.all(updates.map(({ id, default_approx_amount }) =>
        api.put(`/menu-items/update_menu_item/${id}`, { default_approx_amount })
      ));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      showSuccess('Default amounts updated');
      setConfigOpen(false);
    },
    onError: (err) => {
      showError(err.response?.data?.detail || 'Failed to update');
    }
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
      status: item.status,
      default_approx_amount: item.default_approx_amount ?? null
    });
    setFormOpen(true);
  };

  const handleOpenConfig = useCallback(() => {
    const amounts = {};
    (Array.isArray(menuItems) ? menuItems : menuItems?.items ?? []).forEach((item) => {
      if (item.status === 1) amounts[item.id] = item.default_approx_amount ?? '';
    });
    setConfigAmounts(amounts);
    setConfigOpen(true);
  }, [menuItems]);

  const handleConfigSave = async () => {
    const changedItems = Object.entries(configAmounts)
      .filter(([id, val]) => val !== '' && Number(val) >= 0)
      .map(([id, val]) => ({ id: Number(id), default_approx_amount: Number(val) }));
    if (changedItems.length === 0) {
      setConfigOpen(false);
      return;
    }
    saveConfigMutation.mutate(changedItems);
  };

  const handleCancel = () => {
    setEditingMenuItem(null);
    setFormOpen(false);
    reset({
      dish_name: '',
      unit_id: '',
      status: 1,
      default_approx_amount: null
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
      header: () => <div className="text-primary font-bold uppercase tracking-wider text-xs">Dish Name</div>,
      cell: (info) => <span className="text-text-main font-medium">{info.getValue()}</span>
    },
    {
      accessorKey: 'unit_id',
      header: () => <div className="text-primary font-bold uppercase tracking-wider text-xs">Unit</div>,
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
      accessorKey: 'default_approx_amount',
      header: () => <div className="text-primary font-bold uppercase tracking-wider text-xs">Approx. Amt</div>,
      size: 120,
      cell: (info) => {
        const val = info.getValue();
        return <span className="text-text-main text-center block">{val != null ? Number(val).toFixed(2) : '-'}</span>;
      }
    },
    {
      accessorKey: 'status',
      header: () => <div className="text-primary font-bold uppercase tracking-wider text-xs">Status</div>,
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
      header: () => <div className="text-center text-primary font-bold uppercase tracking-wider text-xs">Actions</div>,
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
        <div className="flex items-center gap-2">
          {canWrite && (
            <Button
              type="button"
              variant="outline"
              onClick={handleOpenConfig}
              className="h-10 w-10 p-0"
              title="Configure default approx. amounts"
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
          {canWrite && (
            <Button
              type="button"
              onClick={() => { setEditingMenuItem(null); reset({ dish_name: '', unit_id: '', status: 1, default_approx_amount: null }); setFormOpen(true); }}
              className="h-10 px-5 bg-primary hover:bg-primary/90 text-white font-bold"
            >
              Add Menu Item
            </Button>
          )}
        </div>
      </div>

      <Card className="border-border-temple">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1.5 w-full sm:w-72">
              <Label className="text-text-main">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 text-text-main"
                  placeholder="Search menu items..." />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border-temple shadow-sm overflow-hidden">
        <div className="bg-white">
          <DataTable
            columns={columns}
            data={sortedMenuItems}
            loading={menuItemsLoading}
          />
        </div>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={(val) => { if (!val) handleCancel(); }}>
        <DialogContent className="w-[98vw] max-w-lg max-h-[92vh] !flex !flex-col !p-0 overflow-hidden border-border-temple shadow-2xl bg-white">
          <DialogHeader className="!m-0 border-b border-border-temple/40 !px-6 !py-4 bg-[#F6EEDF]">
            <DialogTitle className="text-xl text-text-main font-temple">
              {editingMenuItem ? 'Edit Menu Item' : 'Add New Menu Item'}
            </DialogTitle>
            <DialogDescription className="sr-only">Menu item details form</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="bg-white flex flex-col"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
                e.preventDefault();
              }
            }}
          >
            <div className="space-y-4 px-6 pt-4 pb-4 overflow-y-auto max-h-[60vh]">
            <div className="space-y-2">
              <Label className="text-text-main font-medium">Dish Name *</Label>
              <Input
                {...register('dish_name')}
                className="border-border-temple/50 focus:border-primary"
              />
              {errors.dish_name && <p className="text-xs text-red-500 font-medium">{errors.dish_name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-text-main font-medium">Default Approx. Amt (Wastage)</Label>
              <Input
                type="text"
                {...register('default_approx_amount')}
                className="border-border-temple/50 focus:border-primary"
                placeholder="e.g. 50"
              />
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
            </div>

            <DialogFooter className="!m-0 border-t border-border-temple/40 bg-[#F3E8D4] !px-6 !py-4 gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={handleCancel}
                className="w-28 h-10 bg-white border border-[#D9C8AF] text-text-main hover:bg-[#FAF7F2] font-bold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="w-32 h-10 bg-primary hover:bg-primary/90 text-white font-bold"
              >
                {mutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                ) : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {/* Default Amount Config Dialog */}
      <Dialog open={configOpen} onOpenChange={(val) => {
        if (!val && !saveConfigMutation.isPending) setConfigOpen(false);
      }}>
        <DialogContent className="w-[98vw] max-w-3xl max-h-[92vh] !flex !flex-col !p-0 overflow-hidden border-border-temple shadow-2xl bg-white">
          <DialogHeader className="!m-0 border-b border-border-temple/40 !px-6 !py-4 bg-[#F6EEDF]">
            <DialogTitle className="text-xl text-text-main font-temple">
              Default Approx. Amounts (Wastage)
            </DialogTitle>
            <DialogDescription className="sr-only">
              Set default approx. amount for each menu item used in wastage entry.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-6 py-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-temple/40">
                  <th className="text-left py-2 px-3 text-primary font-bold uppercase tracking-wider text-xs">Dish Name</th>
                  <th className="text-left py-2 px-3 text-primary font-bold uppercase tracking-wider text-xs">Unit</th>
                  <th className="text-center py-2 px-3 text-primary font-bold uppercase tracking-wider text-xs w-40">Approx. Amt</th>
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(menuItems) ? menuItems : menuItems?.items ?? [])
                  .filter((m) => m.status === 1)
                  .map((menu) => (
                    <tr key={menu.id} className="border-b border-border-temple/10 hover:bg-[#FAF7F2]">
                      <td className="py-2 px-3 text-text-main font-medium">{menu.dish_name}</td>
                      <td className="py-2 px-3 text-text-main">{menu.unit?.unit_code || ''}</td>
                      <td className="py-2 px-3 text-center">
                        <Input
                          type="text"
                          className="h-9 text-base text-center w-28 mx-auto"
                          value={configAmounts[menu.id] ?? ''}
                          onChange={(e) => setConfigAmounts((prev) => ({ ...prev, [menu.id]: e.target.value }))}
                        />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <DialogFooter className="!m-0 border-t border-border-temple/40 bg-[#F3E8D4] !px-6 !py-4 gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfigOpen(false)}
              className="w-28 h-10 bg-white border border-[#D9C8AF] text-text-main hover:bg-[#FAF7F2] font-bold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saveConfigMutation.isPending}
              onClick={handleConfigSave}
              className="w-32 h-10 bg-primary hover:bg-primary/90 text-white font-bold shadow-lg border-none"
            >
              {saveConfigMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
              ) : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MenuItemsPage;
