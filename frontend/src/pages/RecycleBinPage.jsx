import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Trash2,
  RotateCcw,
  Search,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  DatabaseZap,
  CheckCircle2,
  Package,
  Utensils,
  Store,
  Tags,
  HeartHandshake,
  Coins,
  Shield,
  User as UserIcon,
  Layers,
  Info,
  ShoppingBag,
  Flame,
  Gift,
  Undo2
} from 'lucide-react';
import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent } from '../components/ui/Card';
import { cn } from '../utils/cn';
import { formatDateTime } from '../utils/date';

// Helper to map entity types to human labels and icons
const entityMeta = {
  item: { label: 'Item', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Package },
  menu_item: { label: 'Menu Item', color: 'bg-rose-100 text-rose-800 border-rose-200', icon: Utensils },
  vendor: { label: 'Vendor', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Store },
  item_category: { label: 'Item Category', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: Tags },
  donation_type: { label: 'Donation Type', color: 'bg-purple-100 text-purple-800 border-purple-200', icon: HeartHandshake },
  donation_amount_master: { label: 'Donation Amount', color: 'bg-teal-100 text-teal-800 border-teal-200', icon: Coins },
  role: { label: 'Role', color: 'bg-indigo-100 text-indigo-800 border-indigo-200', icon: Shield },
  user: { label: 'User', color: 'bg-sky-100 text-sky-800 border-sky-200', icon: UserIcon },
  unit: { label: 'Unit', color: 'bg-gray-100 text-gray-800 border-gray-200', icon: Layers },
  // Transactions
  purchase: { label: 'Purchase', color: 'bg-orange-100 text-orange-850 border-orange-205', icon: ShoppingBag },
  consumption: { label: 'Daily Usage', color: 'bg-cyan-100 text-cyan-850 border-cyan-205', icon: Utensils },
  wastage: { label: 'Wastage', color: 'bg-red-100 text-red-850 border-red-205', icon: Flame },
  donation: { label: 'Donation', color: 'bg-pink-100 text-pink-850 border-pink-205', icon: Gift },
  purchase_return: { label: 'Purchase Return', color: 'bg-violet-100 text-violet-850 border-violet-205', icon: Undo2 },
};

const RecycleBinPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showConfirm, showError, showSuccess } = useNotification();

  // Search & Filter States
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedKeys, setSelectedKeys] = useState(new Set()); // Contains "type:id" strings
  const [processing, setProcessing] = useState(false);
  
  // Modal State for Empty Trash summary
  const [emptySummary, setEmptySummary] = useState(null);

  // Fetch soft-deleted items
  const { data: trashItems, isLoading, refetch } = useQuery({
    queryKey: ['trash-items'],
    queryFn: async () => {
      const res = await api.get('/trash/');
      return res.data;
    }
  });

  // Filter items in memory for instant UX
  const filteredItems = useMemo(() => {
    return (trashItems || []).filter((item) => {
      const nameMatch = (item.name || '').toLowerCase().includes(search.toLowerCase());
      const labelMatch = (item.type_label || '').toLowerCase().includes(search.toLowerCase());
      const typeMatch = selectedType === 'all' || item.type === selectedType;
      return (nameMatch || labelMatch) && typeMatch;
    });
  }, [trashItems, search, selectedType]);

  // Determine if all filtered items are selected
  const isAllSelected = useMemo(() => {
    if (filteredItems.length === 0) return false;
    return filteredItems.every(item => selectedKeys.has(`${item.type}:${item.id}`));
  }, [filteredItems, selectedKeys]);

  // Actions
  const restoreMutation = useMutation({
    mutationFn: async ({ type, id }) => {
      return api.post('/trash/restore', { type, id });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['trash-items'] });
      showSuccess('Item restored successfully.');
      // Remove from selection if it was there
      setSelectedKeys(prev => {
        const next = new Set(prev);
        next.delete(`${variables.type}:${variables.id}`);
        return next;
      });
    },
    onError: (err) => {
      showError(err.response?.data?.detail || 'Failed to restore item.');
    }
  });

  const deletePermanentMutation = useMutation({
    mutationFn: async ({ type, id, force = false }) => {
      return api.post('/trash/delete_permanent', { type, id, force });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['trash-items'] });
      showSuccess('Item permanently deleted.');
      setSelectedKeys(prev => {
        const next = new Set(prev);
        next.delete(`${variables.type}:${variables.id}`);
        return next;
      });
    },
    onError: async (err, variables) => {
      const isConstraintError = err.response?.status === 400 && 
                               (err.response?.data?.detail || '').includes('depend on it');
      
      if (isConstraintError && !variables.force) {
        const forceConfirm = await showConfirm(
          'Force Delete anyway?',
          `This item is linked to other active records. Permanently deleting it will automatically unlink or delete the referencing records to prevent database errors. Proceed?`
        );
        if (forceConfirm) {
          deletePermanentMutation.mutate({ type: variables.type, id: variables.id, force: true });
          return;
        }
      }
      showError(err.response?.data?.detail || 'Failed to permanently delete item.');
    }
  });

  const handleRestore = async (item) => {
    const confirmed = await showConfirm(
      'Restore Record',
      `Are you sure you want to restore the ${entityMeta[item.type]?.label || item.type_label} "${item.name}"?`
    );
    if (confirmed) {
      restoreMutation.mutate({ type: item.type, id: item.id });
    }
  };

  const handleDeletePermanent = async (item) => {
    const confirmed = await showConfirm(
      'Permanently Delete',
      `Are you sure you want to permanently delete "${item.name}"? This action is irreversible and might fail if other active records reference it.`
    );
    if (confirmed) {
      deletePermanentMutation.mutate({ type: item.type, id: item.id });
    }
  };

  // Bulk operations
  const handleToggleSelect = (item) => {
    const key = `${item.type}:${item.id}`;
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSelectAllToggle = () => {
    if (isAllSelected) {
      // Deselect all filtered items
      setSelectedKeys(prev => {
        const next = new Set(prev);
        filteredItems.forEach(item => {
          next.delete(`${item.type}:${item.id}`);
        });
        return next;
      });
    } else {
      // Select all filtered items
      setSelectedKeys(prev => {
        const next = new Set(prev);
        filteredItems.forEach(item => {
          next.add(`${item.type}:${item.id}`);
        });
        return next;
      });
    }
  };

  const handleBulkRestore = async () => {
    const confirmed = await showConfirm(
      'Restore Selected',
      `Are you sure you want to restore the ${selectedKeys.size} selected items?`
    );
    if (!confirmed) return;

    setProcessing(true);
    let successCount = 0;
    let failCount = 0;

    const itemsToProcess = Array.from(selectedKeys).map(key => {
      const [type, id] = key.split(':');
      return { type, id: parseInt(id) };
    });

    for (const item of itemsToProcess) {
      try {
        await api.post('/trash/restore', { type: item.type, id: item.id });
        successCount++;
      } catch (e) {
        failCount++;
      }
    }

    setProcessing(false);
    setSelectedKeys(new Set());
    queryClient.invalidateQueries({ queryKey: ['trash-items'] });

    if (failCount === 0) {
      showSuccess(`Successfully restored ${successCount} items.`);
    } else {
      showError(`Restored ${successCount} items. Failed to restore ${failCount} items due to constraint violations.`);
    }
  };

  const handleBulkDelete = async () => {
    const confirmed = await showConfirm(
      'Permanently Delete Selected',
      `Are you sure you want to permanently delete the ${selectedKeys.size} selected items? This cannot be undone.`
    );
    if (!confirmed) return;

    setProcessing(true);
    let successCount = 0;
    let failedList = [];

    const itemsToProcess = Array.from(selectedKeys).map(key => {
      const [type, id] = key.split(':');
      const itemObj = trashItems.find(t => t.type === type && t.id === parseInt(id));
      return { type, id: parseInt(id), name: itemObj?.name || 'Unknown', label: itemObj?.type_label || type };
    });

    for (const item of itemsToProcess) {
      try {
        await api.post('/trash/delete_permanent', { type: item.type, id: item.id });
        successCount++;
      } catch (e) {
        failedList.push({
          id: item.id,
          type: item.type,
          name: item.name,
          type_label: item.label,
          reason: 'Referenced by active records.'
        });
      }
    }

    setProcessing(false);
    setSelectedKeys(new Set());
    queryClient.invalidateQueries({ queryKey: ['trash-items'] });

    if (failedList.length === 0) {
      showSuccess(`Permanently deleted ${successCount} items.`);
    } else {
      setEmptySummary({
        succeeded_count: successCount,
        failed_count: failedList.length,
        failed_items: failedList
      });
    }
  };

  const handleEmptyTrash = async () => {
    const confirmed = await showConfirm(
      'Empty Recycle Bin',
      'Are you sure you want to empty the Recycle Bin? This will permanently delete all soft-deleted records. Active references will be protected and skipped.'
    );
    if (!confirmed) return;

    setProcessing(true);
    try {
      const res = await api.post('/trash/empty');
      const result = res.data;
      
      queryClient.invalidateQueries({ queryKey: ['trash-items'] });
      setSelectedKeys(new Set());

      if (result.failed_count === 0 && result.succeeded_count > 0) {
        showSuccess(`Recycle bin cleared! ${result.succeeded_count} items permanently deleted.`);
      } else if (result.failed_count > 0) {
        setEmptySummary(result);
      } else {
        showSuccess('Recycle bin is empty.');
      }
    } catch (err) {
      showError('Failed to clear recycle bin.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1600px] px-4 pb-24 -m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 bg-[#F8F4EE] min-h-[calc(100vh-64px)] space-y-6">
      
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-[#E7D8CC] pb-6">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate('/settings')}
            className="h-9 w-9 rounded-full p-0 bg-white shadow-sm border border-[#E7D8CC]"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="page-title flex items-center gap-2 font-temple">
              Recycle Bin
              <span className="text-sm font-semibold font-sans bg-primary/15 text-primary border border-primary/20 px-2 py-0.5 rounded-full">
                Admin tool
              </span>
            </h2>
            <p className="text-sm text-text-light font-medium mt-0.5">
              View, restore, or permanently delete soft-deleted records.
            </p>
          </div>
        </div>

        {trashItems && trashItems.length > 0 && (
          <Button
            type="button"
            variant="error"
            disabled={processing || trashItems.length === 0}
            onClick={handleEmptyTrash}
            className="h-10 rounded-xl px-5 font-bold shrink-0 shadow-sm"
          >
            <DatabaseZap className="w-4 h-4 mr-2" />
            Empty Recycle Bin
          </Button>
        )}
      </div>

      {/* Main Panel */}
      <div className="space-y-4">
        {/* Search & Filters */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl border border-[#E7D8CC] shadow-sm">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-light" />
            <Input
              type="text"
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-10 border-[#D2B89B] bg-[#FAF8F5] focus:bg-white text-secondary-dark font-medium shadow-none rounded-lg"
            />
          </div>

          <div className="flex gap-2 w-full md:w-auto items-center justify-end">
            <label className="text-sm font-bold text-text-main hidden sm:inline shrink-0">Filter by Type:</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="h-10 border border-[#D2B89B] bg-white rounded-lg text-sm text-text-main font-semibold px-3 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Deleted Records</option>
              <optgroup label="Master Tables">
                <option value="item">Items</option>
                <option value="menu_item">Menu Items</option>
                <option value="vendor">Vendors</option>
                <option value="item_category">Item Categories</option>
                <option value="donation_type">Donation Types</option>
                <option value="donation_amount_master">Donation Amounts</option>
                <option value="role">Roles</option>
                <option value="user">Users</option>
                <option value="unit">Units</option>
              </optgroup>
              <optgroup label="Transactions">
                <option value="purchase">Purchases</option>
                <option value="consumption">Daily Usage</option>
                <option value="wastage">Wastages</option>
                <option value="donation">Donations</option>
                <option value="purchase_return">Purchase Returns</option>
              </optgroup>
            </select>
          </div>
        </div>

        {/* Bulk action bar */}
        {selectedKeys.size > 0 && (
          <div className="flex items-center justify-between bg-[#FFF4E5] border border-[#FBE3C5] px-5 py-3 rounded-xl shadow-sm animate-fade-in animate-duration-200">
            <div className="flex items-center gap-2 text-sm font-bold text-[#8B4513]">
              <Info className="w-5 h-5 text-primary" />
              <span>{selectedKeys.size} items selected</span>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkRestore}
                disabled={processing}
                className="bg-white border-[#D9C8AF] font-bold text-primary flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                Restore Selected
              </Button>
              <Button
                variant="error"
                size="sm"
                onClick={handleBulkDelete}
                disabled={processing}
                className="bg-error font-bold flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                Delete Permanently
              </Button>
            </div>
          </div>
        )}

        {/* Results Area */}
        <Card className="border-[#E7D8CC] shadow-sm overflow-hidden rounded-xl bg-white">
          <CardContent className="p-0 relative">
            {isLoading || processing ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p className="text-sm font-semibold text-text-light">
                  {processing ? 'Processing operations...' : 'Loading deleted records...'}
                </p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="rounded-full bg-[#FAF6F0] p-6 border border-[#E7D5C3] text-text-light/40 mb-4">
                  <Trash2 className="w-12 h-12" />
                </div>
                <h3 className="text-lg font-bold text-text-main font-temple">Recycle Bin is Empty</h3>
                <p className="text-sm text-text-light font-medium max-w-sm mt-1">
                  {search || selectedType !== 'all'
                    ? 'No deleted records match your active search filters.'
                    : 'Deleted master records and transactions from the system will appear here for restore or permanent removal.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse table-auto text-left text-[15px]">
                  <thead className="bg-[#FAF6F0] border-b border-[#E7D8CC] text-text-main font-bold uppercase tracking-wider text-[13px]">
                    <tr>
                      <th className="px-5 py-4 w-12 text-center align-middle">
                        <input
                          type="checkbox"
                          checked={isAllSelected}
                          onChange={handleSelectAllToggle}
                          className="h-4.5 w-4.5 accent-primary cursor-pointer"
                        />
                      </th>
                      <th className="px-5 py-4 align-middle">Record Name</th>
                      <th className="px-5 py-4 align-middle">Table / Type</th>
                      <th className="px-5 py-4 align-middle">Deleted At</th>
                      <th className="px-5 py-4 align-middle">Deleted By</th>
                      <th className="px-5 py-4 text-right align-middle">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3E8DE]">
                    {filteredItems.map((item) => {
                      const key = `${item.type}:${item.id}`;
                      const isSelected = selectedKeys.has(key);
                      const meta = entityMeta[item.type] || { label: item.type_label, color: 'bg-gray-150 text-gray-700', icon: Info };
                      const TypeIcon = meta.icon;

                      return (
                        <tr
                          key={key}
                          className={cn(
                            "hover:bg-[#FFFDFB] transition-all",
                            isSelected ? "bg-[#FFF9F3]" : ""
                          )}
                        >
                          <td className="px-5 py-4 text-center align-middle">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelect(item)}
                              className="h-4.5 w-4.5 accent-primary cursor-pointer"
                            />
                          </td>
                          <td className="px-5 py-4 align-middle">
                            <div className="flex items-center gap-2.5">
                              <div className="rounded-lg bg-gray-50 p-1.5 text-secondary border border-gray-100 shrink-0">
                                <TypeIcon className="w-4 h-4 text-secondary-light" />
                              </div>
                              <span className="font-bold text-text-main">{item.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4 align-middle">
                            <span className={cn("px-2.5 py-1 text-[12px] font-black border uppercase tracking-wider rounded-full shrink-0", meta.color)}>
                              {meta.label}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-text-normal font-medium align-middle">
                            {formatDateTime(item.deleted_at)}
                          </td>
                          <td className="px-5 py-4 text-text-normal font-medium align-middle">
                            {item.deleted_by || '-'}
                          </td>
                          <td className="px-5 py-4 align-middle">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRestore(item)}
                                className="h-8 px-2.5 bg-white border-[#A3E635] text-lime-700 hover:bg-[#FACC15] hover:text-white flex items-center gap-1 font-bold text-xs"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Restore
                              </Button>
                              <Button
                                variant="error"
                                size="sm"
                                onClick={() => handleDeletePermanent(item)}
                                className="h-8 px-2.5 bg-red-50 text-red-700 border-red-200 hover:bg-red-600 hover:text-white flex items-center gap-1 font-bold text-xs shadow-none"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Constraints Conflict / Empty Summary Modal */}
      {emptySummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-xl bg-white border border-[#E7D8CC] rounded-2xl shadow-xl overflow-hidden animate-scale-in">
            {/* Modal Header */}
            <div className="flex items-center gap-3 bg-[#FAF6F0] border-b border-[#E7D8CC] px-6 py-4">
              <div className="rounded-xl bg-[#FDECEC] p-2 text-[#C62828] border border-[#FEE2E2]">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text-main font-temple">Recycle Bin Cleanup Summary</h3>
                <p className="text-xs text-text-light font-medium">Some deleted items are locked and could not be removed.</p>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
                  <div className="text-2xl font-black text-emerald-700">{emptySummary.succeeded_count}</div>
                  <div className="text-xs font-semibold text-emerald-600 uppercase mt-0.5">Successfully Deleted</div>
                </div>
                <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 text-center">
                  <div className="text-2xl font-black text-rose-700">{emptySummary.failed_count}</div>
                  <div className="text-xs font-semibold text-rose-600 uppercase mt-0.5">Locked (Skipped)</div>
                </div>
              </div>

              {emptySummary.failed_items && emptySummary.failed_items.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-sm font-bold text-text-main">Details of locked records:</h4>
                  <div className="space-y-2">
                    {emptySummary.failed_items.map((fit, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-gray-50 border border-gray-100 p-3 rounded-lg text-xs gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-text-main truncate">{fit.name}</div>
                          <div className="text-[10px] font-bold text-[#8D6E63] uppercase mt-0.5 tracking-wider">{fit.type_label}</div>
                          <div className="text-[10px] text-error font-medium mt-0.5 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-[#DC2626] shrink-0" />
                            <span>{fit.reason}</span>
                          </div>
                        </div>
                        <Button
                          variant="error"
                          size="sm"
                          onClick={async () => {
                            const confirmed = await showConfirm(
                              'Force Delete?',
                              `Are you sure you want to force delete "${fit.name}"? This will automatically unlink or delete the referencing records to prevent database errors.`
                            );
                            if (confirmed) {
                              deletePermanentMutation.mutate({ type: fit.type, id: fit.id, force: true });
                              setEmptySummary(prev => {
                                if (!prev) return null;
                                const nextFailed = prev.failed_items.filter((_, i) => i !== idx);
                                return {
                                  ...prev,
                                  failed_count: nextFailed.length,
                                  failed_items: nextFailed
                                };
                              });
                            }
                          }}
                          className="h-7 px-2.5 bg-red-50 text-red-700 border-red-200 hover:bg-red-600 hover:text-white text-[10px] font-bold shrink-0 shadow-none"
                        >
                          Delete Anyway
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end border-t border-[#F3E8DE] px-6 py-4 bg-[#FFFDFB]">
              <Button
                type="button"
                onClick={() => setEmptySummary(null)}
                className="font-bold rounded-xl"
              >
                Close Summary
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecycleBinPage;
