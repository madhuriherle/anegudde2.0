import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,

  Calendar } from
'lucide-react';

import api from '../api/axios';

import { DataTable } from '../components/ui/DataTable';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Card, CardContent } from '../components/ui/Card';
import { formatDate } from '../utils/date';





















const PAGE_SIZE = 50;

const TokenDetailLedgerPage = () => {
  const { date: urlDate } = useParams();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  // Date state - Single date as requested
  const [selectedDate, setSelectedDate] = useState(urlDate || new Date().toISOString().split('T')[0]);

  const { data, isLoading } = useQuery({
    queryKey: ['token-ledger-details', selectedDate, page],
    queryFn: async () => {
      const params = {
        page,
        page_size: PAGE_SIZE,
        start_date: selectedDate || null,
        end_date: selectedDate || null
      };
      const res = await api.get('/tokens/get_token_history_ledger', { params });
      return res.data;
    }
  });

  const details = data?.items || [];
  const totalEntries = data?.total || 0;

  // Fallback calculation if backend total is 0 but items exist
  const totalDevotees = useMemo(() => {
    if (data?.total_tokens && data.total_tokens > 0) return data.total_tokens;
    return details.reduce((sum, item) => sum + Number(item.token_count || 0), 0);
  }, [data, details]);

  const totalPages = data?.total_pages || 0;

  const columns = useMemo(() => [
  {
    accessorKey: 'receipt_number',
    header: 'Receipt No',
    cell: (info) => <span className="font-bold text-primary">{info.getValue()}</span>
  },
  {
    accessorKey: 'created_at',
    header: 'Time',
    cell: (info) =>
    <span className="text-text-main font-medium">
          {info.getValue() ? new Date(info.getValue()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
        </span>

  },
  {
    accessorKey: 'token_count',
    header: () => <div className="text-center w-full">Devotees Count</div>,
    cell: (info) =>
    <div className="text-center">
          <span className="inline-flex items-center px-4 py-1 rounded-lg text-sm font-black text-primary">
            {info.getValue()}
          </span>
        </div>

  }],
  []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/reports/tokens')}
          className="group flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition-all">
          
          <ArrowLeft className="w-6 h-6 text-text-main group-hover:-translate-x-1 transition-transform" />
        </button>
        <h2 className="page-title mb-0">
          Token Details: {selectedDate && formatDate(selectedDate)}
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Date Filter Card */}
        <Card className="border-border-temple shadow-sm">
          <CardContent className="p-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-text-main">Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="pl-10 h-10 w-full text-sm bg-white" />
                
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Entries Card */}
        <Card className="border-border-temple shadow-sm">
          <CardContent className="p-6 flex items-center justify-center h-full">
            <div className="flex items-center gap-4">
              <span className="text-sm font-bold uppercase text-text-main tracking-widest whitespace-nowrap">Total Entries:</span>
              <span className="text-5xl font-black text-primary leading-none">{totalEntries}</span>
            </div>
          </CardContent>
        </Card>

        {/* Total Devotees Card */}
        <Card className="border-border-temple shadow-sm">
          <CardContent className="p-6 flex items-center justify-center h-full">
            <div className="flex items-center gap-4">
              <span className="text-sm font-bold uppercase text-text-main tracking-widest whitespace-nowrap">Total Devotees:</span>
              <span className="text-5xl font-black text-primary leading-none">{totalDevotees.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <DataTable
        columns={columns}
        data={details}
        loading={isLoading}
        manualPagination
        pageCount={totalPages}
        pageIndex={page - 1}
        pageSize={PAGE_SIZE}
        onPageChange={(p) => setPage(p)}
        totalCount={totalEntries} />
      
    </div>);

};

export default TokenDetailLedgerPage;
