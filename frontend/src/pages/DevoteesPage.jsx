import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Search, Users, X } from 'lucide-react';
import api from '../api/axios';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/Dialog';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { formatDate } from '../utils/date';
import { formatQuantityWithUnit } from '../utils/quantity';

const DevoteesPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [selectedDevoteeId, setSelectedDevoteeId] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

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
    enabled: detailsOpen && selectedDevoteeId !== null
  });

  const handleView = (devotee) => {
    setSelectedDevoteeId(devotee.id);
    setDetailsOpen(true);
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
    accessorKey: 'email',
    header: 'Email',
    size: 220,
    cell: (info) => <span className="text-text-normal">{info.getValue() || '-'}</span>
  },
  {
    accessorKey: 'address',
    header: 'Address',
    cell: (info) =>
    <span className="block max-w-[260px] break-words text-text-normal" title={info.getValue() || '-'}>
          {info.getValue() || '-'}
        </span>

  },

  {
    accessorKey: 'city',
    header: 'City',
    size: 130,
    cell: (info) => <span className="text-text-normal">{info.getValue() || '-'}</span>
  },
  {
    accessorKey: 'state',
    header: 'State',
    size: 130,
    cell: (info) => <span className="text-text-normal">{info.getValue() || '-'}</span>
  },
  {
    accessorKey: 'pincode',
    header: 'Pincode',
    size: 110,
    cell: (info) => <span className="text-text-normal">{info.getValue() || '-'}</span>
  },
  {
    accessorKey: 'updated_at',
    header: 'Last Updated',
    size: 140,
    cell: (info) => <span className="text-text-normal">{formatDate(info.getValue())}</span>
  },
  {
    id: 'actions',
    header: () => <div className="text-center">Actions</div>,
    size: 120,
    cell: (info) =>
    <div className="flex justify-center">
          <button onClick={() => handleView(info.row.original)} className="action-btn-view">
            View
          </button>
        </div>

  }],
  []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="page-title">Devotees</h2>
        </div>
      </div>

      <Card className="border-border-temple shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-bold text-text-main">Devotee Directory</h3>
              </div>
              <p className="text-sm text-text-light">
                Contacts are created automatically from donation entries.
              </p>
            </div>

            <div className="w-full space-y-1.5 lg:max-w-[360px]">
              <Label className="text-text-main font-medium">Search Devotee</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-main/40" />
                <Input
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Name, phone, email, address, city or pincode..."
                  className="h-10 pl-10 text-text-main" />
                
              </div>
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
      

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-h-[88vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Devotee Details</DialogTitle>
            <DialogDescription>
              Contact information and donation history.
            </DialogDescription>
          </DialogHeader>

          {detailsLoading ?
          <div className="py-12 text-center text-sm font-medium text-text-light">
              Loading devotee details...
            </div> :
          devoteeDetails ?
          <div className="space-y-5 pt-3">
              <div className="grid grid-cols-1 gap-3 rounded-lg border border-border-temple bg-[#FFF8F0] p-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-bold uppercase text-text-light">Devotee Name</p>
                  <p className="mt-1 font-semibold text-text-main">{devoteeDetails.devotee_name || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-text-light">Phone Number</p>
                  <p className="mt-1 text-text-main">{devoteeDetails.phone_number || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-text-light">Email</p>
                  <p className="mt-1 text-text-main">{devoteeDetails.email || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-text-light">Last Updated</p>
                  <p className="mt-1 text-text-main">{formatDate(devoteeDetails.updated_at)}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs font-bold uppercase text-text-light">Address</p>
                  <p className="mt-1 text-text-main">{devoteeDetails.address || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-text-light">City</p>
                  <p className="mt-1 text-text-main">{devoteeDetails.city || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-text-light">State</p>
                  <p className="mt-1 text-text-main">{devoteeDetails.state || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-text-light">Pincode</p>
                  <p className="mt-1 text-text-main">{devoteeDetails.pincode || '-'}</p>
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-base font-bold text-text-main">Donation History</h3>
                <div className="overflow-hidden rounded-lg border border-border-temple">
                  <table className="w-full min-w-[760px] table-fixed text-left text-sm">
                    <colgroup>
                      <col className="w-[13%]" />
                      <col className="w-[34%]" />
                      <col className="w-[18%]" />
                      <col className="w-[20%]" />
                      <col className="w-[15%]" />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-border-temple bg-[#f8efe5] text-xs font-bold uppercase text-text-main">
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Items Donated</th>
                        <th className="px-4 py-3">Quantity</th>
                        <th className="px-4 py-3">Remarks</th>
                        <th className="px-4 py-3">Recorded By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0e5da]">
                      {devoteeDetails.donations?.length ?
                    devoteeDetails.donations.map((donation) =>
                    <tr key={donation.id} className="align-top">
                            <td className="px-4 py-3 text-text-main">{formatDate(donation.donation_date)}</td>
                            <td className="px-4 py-3">
                              <div className="space-y-1">
                                {(donation.items || []).map((item) =>
                          <div key={item.id} className="text-text-main">
                                    {item.item?.item_name || '-'}
                                  </div>
                          )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="space-y-1">
                                {(donation.items || []).map((item) =>
                          <div key={item.id} className="text-text-main">
                                    {formatQuantityWithUnit(item.quantity, item.item?.unit)}
                                  </div>
                          )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-text-normal">{donation.remarks || '-'}</td>
                            <td className="px-4 py-3 text-text-normal">{donation.user?.full_name || '-'}</td>
                          </tr>
                    ) :

                    <tr>
                          <td colSpan={5} className="px-4 py-10 text-center text-text-light">
                            No donation history found.
                          </td>
                        </tr>
                    }
                    </tbody>
                  </table>
                </div>
              </div>
            </div> :
          null}

          <DialogFooter className="!px-6 !py-4 border-t border-border-temple/40 flex justify-end shrink-0 bg-[#F3E8D4]">
            <Button onClick={() => setDetailsOpen(false)} className="px-6 h-10 rounded-lg bg-primary hover:bg-primary/90 text-white font-bold border-none shadow-md">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);

};

export default DevoteesPage;
