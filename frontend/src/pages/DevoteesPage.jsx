import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNotification } from '../context/NotificationContext';
import { usePermission } from '../hooks/usePermission';
import { DeletionWarningDialog } from '../components/ui/DeletionWarningDialog';

import { Search, Users, X, Loader2, AlertCircle } from 'lucide-react';
import api from '../api/axios';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/Dialog';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { formatDate } from '../utils/date';
import { formatQuantityWithUnit } from '../utils/quantity';
import { cn } from '../utils/cn';

const DevoteesPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [selectedDevoteeId, setSelectedDevoteeId] = useState(null);

  const [profileOpen, setProfileOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const { hasPermission } = usePermission();
  const canDelete = hasPermission('donations.delete');
  const queryClient = useQueryClient();
  const { showConfirm, showError, showSuccess } = useNotification();

  const [deleteWarningOpen, setDeleteWarningOpen] = useState(false);
  const [devoteeToDelete, setDevoteeToDelete] = useState(null);
  const [usageDetails, setUsageDetails] = useState([]);

  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/donations/delete_devotee/${id}`),
    onSuccess: () => {
      showSuccess('Devotee deleted successfully');
      setDeleteWarningOpen(false);
      queryClient.invalidateQueries({ queryKey: ['devotees'] });
    },
    onError: (err) => showError(err.response?.data?.detail || 'Delete failed')
  });

  const handleDeleteClick = async (devotee) => {
    try {
      const res = await api.get('/system/check_usage', {
        params: { entity_type: 'devotee', entity_id: devotee.id }
      });

      if (res.data.has_usage) {
        setUsageDetails(res.data.details);
        setDevoteeToDelete(devotee);
        setDeleteWarningOpen(true);
      } else {
        const confirmed = await showConfirm('Delete Devotee', `Are you sure you want to delete "${devotee.devotee_name}"?`);
        if (confirmed) {
          deleteMutation.mutate(devotee.id);
        }
      }
    } catch {
      showError('Failed to check devotee usage');
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ['devotees', searchTerm, page, pageSize],
    queryFn: async () => {
      const params = { page, page_size: pageSize };
      if (searchTerm) params.q = searchTerm;
      return (await api.get('/donations/list_devotees', { params })).data;
    }
  });

  const { data: devoteeDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ['devotee-details', selectedDevoteeId],
    queryFn: async () => (await api.get(`/donations/get_devotee/${selectedDevoteeId}`)).data,
    enabled: (profileOpen || historyOpen) && selectedDevoteeId !== null
  });

  const handleViewProfile = (devotee) => {
    setSelectedDevoteeId(devotee.id);
    setProfileOpen(true);
  };

  const handleViewHistory = (devotee) => {
    setSelectedDevoteeId(devotee.id);
    setHistoryOpen(true);
  };

  const columns = useMemo(() => [
    {
      accessorKey: 'devotee_name',
      header: 'Devotee Name',
      size: 220,
      cell: (info) =>
        <span className="font-semibold text-text-main">{info.getValue()}</span>
    },
    {
      accessorKey: 'phone_number',
      header: 'Phone Number',
      size: 150,
      cell: (info) => <span className="text-text-main">{info.getValue()}</span>
    },
    {
      id: 'address',
      header: 'Address',
      cell: (info) => {
        const row = info.row.original;
        const parts = [row.address, row.city, row.state, row.pincode].filter(Boolean);
        const full = parts.join(', ') || '-';
        return (
          <span className="block max-w-[460px] break-words text-text-normal line-clamp-1" title={full}>
            {full}
          </span>
        );
      }
    },
    {
      id: 'actions',
      header: () => <div className="text-center">Actions</div>,
      size: 260,
      cell: (info) =>
        <div className="flex justify-center gap-2">
          <button onClick={() => handleViewProfile(info.row.original)} className="action-btn-view">
            Profile
          </button>
          <button onClick={() => handleViewHistory(info.row.original)} className="action-btn-edit !px-4">
            History
          </button>
          {canDelete && (
            <button onClick={() => handleDeleteClick(info.row.original)} className="action-btn-delete">
              Delete
            </button>
          )}
        </div>
    }],
    [canDelete]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="page-title">Devotees</h2>
        </div>
      </div>

      <Card className="border-border-temple shadow-sm bg-white">
        <CardContent className="p-4 sm:p-5">
          <div className="max-w-md">
            <Label className="text-xs font-black uppercase tracking-widest text-secondary/60 mb-2 block">Search Devotee</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="h-11 pl-10 text-text-main rounded-xl" />
            </div>
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={isLoading}
        manualPagination
        pageCount={data?.total_pages || 0}
        pageIndex={page - 1}
        pageSize={pageSize}
        onPageChange={setPage}
        totalCount={data?.total || 0} />


      {/* 1. PROFILE DIALOG (CLEAN LIST STYLE LIKE VENDOR) */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-xl !flex !flex-col !p-0 border-border-temple shadow-2xl bg-white overflow-hidden">
          <DialogHeader className="!m-0 border-b border-border-temple/40 !px-8 !py-6 shrink-0 bg-[#F3E8D4]">
            <DialogTitle className="text-xl text-text-main font-temple">Devotee Profile</DialogTitle>
            <DialogDescription className="sr-only">Detailed profile information for the selected devotee.</DialogDescription>
          </DialogHeader>

          <div className="flex-1 px-8 py-8 overflow-y-auto custom-scrollbar">
            {detailsLoading ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : devoteeDetails ? (
              <div className="space-y-6">
                 <div className="grid grid-cols-[140px_20px_1fr] text-[15px]">
                    <div className="font-bold text-secondary">Devotee Name</div>
                    <div className="text-text-main font-bold text-center">:</div>
                    <div className="text-text-main font-medium">{devoteeDetails.devotee_name}</div>
                 </div>

                 <div className="grid grid-cols-[140px_20px_1fr] text-[15px]">
                    <div className="font-bold text-secondary">Phone Number</div>
                    <div className="text-text-main font-bold text-center">:</div>
                    <div className="text-text-main font-medium">{devoteeDetails.phone_number}</div>
                 </div>

                 <div className="grid grid-cols-[140px_20px_1fr] text-[15px]">
                    <div className="font-bold text-secondary">Email Address</div>
                    <div className="text-text-main font-bold text-center">:</div>
                    <div className="text-text-main font-medium">{devoteeDetails.email || '-'}</div>
                 </div>

                 <div className="grid grid-cols-[140px_20px_1fr] text-[15px]">
                    <div className="font-bold text-secondary">Last Transaction</div>
                    <div className="text-text-main font-bold text-center">:</div>
                    <div className="text-text-main font-medium">{formatDate(devoteeDetails.updated_at)}</div>
                 </div>

                 <div className="grid grid-cols-[140px_20px_1fr] text-[15px]">
                    <div className="font-bold text-secondary pt-0.5">Address</div>
                    <div className="text-text-main font-bold text-center pt-0.5">:</div>
                    <div className="text-text-main font-medium leading-relaxed">
                      {[
                          devoteeDetails.address,
                          devoteeDetails.city,
                          devoteeDetails.state,
                          devoteeDetails.pincode
                      ].filter(Boolean).join(', ') || '-'}
                    </div>
                 </div>
              </div>
            ) : null}
          </div>

          <DialogFooter className="!px-6 !py-4 !m-0 border-t border-border-temple/40 flex justify-end shrink-0 bg-[#F3E8D4]">
            <Button onClick={() => setProfileOpen(false)} className="bg-primary text-white font-bold h-10 px-10 hover:bg-primary-dark shadow-md">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. HISTORY DIALOG (WIDE TABLE STYLE) */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-h-[90vh] max-w-7xl !flex !flex-col !p-0 overflow-hidden border-border-temple shadow-2xl bg-white">
          <DialogHeader className="!m-0 border-b border-border-temple/40 !px-8 !py-6 shrink-0 bg-[#F3E8D4]">
            <DialogTitle className="text-xl text-text-main font-temple">Donation History</DialogTitle>
            <DialogDescription className="font-bold text-text-main mt-1">
                {devoteeDetails ? (
                    <>Showing records for: <span className="text-primary">{devoteeDetails.devotee_name}</span></>
                ) : (
                    "Loading records..."
                )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            {detailsLoading ? (
              <div className="h-full flex items-center justify-center py-20">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              </div>
            ) : devoteeDetails ? (
              <div className="min-h-full">
                  <div className="overflow-x-auto rounded-2xl border border-border-temple/60 shadow-sm bg-white">
                    <table className="w-full min-w-[1000px] table-fixed text-left text-sm">
                    <colgroup>
                      <col className="w-[10%]" />
                      <col className="w-[12%]" />
                      <col className="w-[15%]" />
                      <col className="w-[28%]" />
                      <col className="w-[15%]" />
                      <col className="w-[10%]" />
                      <col className="w-[10%]" />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-border-temple/40 bg-[#FBF9F6] text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Receipt</th>
                        <th className="px-6 py-4">Type</th>
                        <th className="px-6 py-4">Donation Details</th>
                        <th className="px-6 py-4 text-center">Qty / Amt</th>
                        <th className="px-6 py-4">Remarks</th>
                        <th className="px-6 py-4 text-right">User</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F5F0E9]">
                      {devoteeDetails.donations?.length ?
                    devoteeDetails.donations.map((donation) =>
                    <tr key={donation.id} className="group align-top hover:bg-[#FFFAF3] transition-colors">
                            <td className="px-6 py-4 text-text-main whitespace-nowrap">{formatDate(donation.donation_date)}</td>
                            <td className="px-6 py-4">
                                <span className="font-mono text-text-main">
                                    {donation.receipt_display_number || '-'}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                <span className="text-text-main">
                                    {donation.donation_type_master?.type_name || 'General'}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                              {donation.donation_mode === 1 ? (
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                      <span className={cn(
                                          "px-1.5 py-0.5 rounded text-xs uppercase",
                                          donation.amount_donation_type === 'SPECIFIC' ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                                      )}>
                                          {donation.amount_donation_type || 'Custom'}
                                      </span>
                                      <span className="text-text-main">
                                          {donation.donation_amount_master?.title || 'Amount Donation'}
                                      </span>
                                  </div>
                                  {donation.amount_note && <span className="text-sm text-gray-500 italic ml-10 border-l-2 border-gray-100 pl-2">{donation.amount_note}</span>}
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  {(donation.items || []).map((item) =>
                                    <div key={item.id} className="text-text-main flex items-center gap-1.5">
                                      <div className="h-1 w-1 rounded-full bg-primary/40" />
                                      {item.item?.item_name || '-'}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {donation.donation_mode === 1 ? (
                                <span className="text-text-main">
                                  ₹{Number(donation.total_gross_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                              ) : (
                                <div className="space-y-1">
                                  {(donation.items || []).map((item) =>
                                    <div key={item.id} className="text-text-main">
                                      {formatQuantityWithUnit(item.quantity, item.item?.unit)}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4">
                                <p className="text-sm text-gray-500 leading-relaxed italic line-clamp-2">
                                    {donation.remarks || '-'}
                                </p>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <span className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500" title={donation.user?.full_name}>
                                    {donation.user?.username || donation.user?.full_name || '-'}
                                </span>
                            </td>
                          </tr>
                    ) :

                    <tr>
                          <td colSpan={7} className="px-6 py-20 text-center text-text-light font-bold italic">
                            <div className="flex flex-col items-center gap-2">
                                <AlertCircle size={32} className="text-gray-200" />
                                <span>No history found.</span>
                            </div>
                          </td>
                        </tr>
                    }
                    </tbody>
                  </table>
                </div>
            </div>
          ) : null}
          </div>

          <DialogFooter className="!px-6 !py-4 !m-0 border-t border-border-temple/40 flex justify-end shrink-0 bg-[#F3E8D4]">
            <Button onClick={() => setHistoryOpen(false)} className="bg-primary text-white font-bold h-10 px-10 hover:bg-primary-dark shadow-md">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeletionWarningDialog
        open={deleteWarningOpen}
        onOpenChange={setDeleteWarningOpen}
        onConfirm={() => deleteMutation.mutate(devoteeToDelete?.id)}
        isPending={deleteMutation.isPending}
        title="Delete Devotee with History?"
        description={`"${devoteeToDelete?.devotee_name}" has existing records in the system.`}
        consequences={[
          ...usageDetails,
          "Historical donation and receipt records will remain intact in reports, but this devotee will be archived.",
          "Soft-deleting this devotee prevents them from showing up in active lookup searches while keeping reports valid."
        ]}
      />
    </div>);
};

export default DevoteesPage;
