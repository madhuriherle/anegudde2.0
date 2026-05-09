import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Clock,
  User as UserIcon,
} from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';
import api from '../api/axios';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';
import { formatDate } from '../utils/date';

interface TokenDetail {
  id: number;
  receipt_number: number;
  token_count: number;
  created_at: string;
  creator?: {
    id: number;
    full_name: string;
  };
}

interface ApiResponse {
  items: TokenDetail[];
  total: number;
  total_tokens: number;
  page: number;
  page_size: number;
  total_pages: number;
}

const PAGE_SIZE = 50;

const TokenDetailLedgerPage: React.FC = () => {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['token-details', date, page],
    queryFn: async () => {
      if (!date) return null;
      const res = await api.get(`/tokens/get_details_by_date/${date}`, {
        params: { page, page_size: PAGE_SIZE }
      });
      return res.data as ApiResponse;
    },
    enabled: !!date,
  });

  const details = data?.items || [];
  const totalEntries = data?.total || 0;
  const totalDevotees = data?.total_tokens || 0;
  const totalPages = data?.total_pages || 0;
  const avgPerGroup = totalEntries > 0 ? Math.round(totalDevotees / totalEntries) : 0;

  const columns = useMemo<ColumnDef<TokenDetail>[]>(() => [
    {
      accessorKey: 'receipt_number',
      header: 'Receipt No',
      cell: info => <span className="font-bold text-primary">{info.getValue() as number}</span>,
    },
    {
      accessorKey: 'created_at',
      header: 'Time',
      cell: info => (
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400" />
          {info.getValue() ? new Date(info.getValue() as string).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
        </div>
      ),
    },
    {
      accessorKey: 'token_count',
      header: () => <div className="text-center w-full">Devotees Count</div>,
      cell: info => (
        <div className="text-center">
          <span className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-bold bg-bg-cream border border-primary/10 text-primary">
            {info.getValue() as number}
          </span>
        </div>
      ),
    },
    {
      id: 'issued_by',
      header: () => <div className="text-right w-full">Issued By</div>,
      cell: info => (
        <div className="flex items-center justify-end gap-2 text-text-main">
          <UserIcon className="w-4 h-4 text-gray-400" />
          <span className="truncate max-w-[150px]">
            {info.row.original.creator?.full_name || 'System Admin'}
          </span>
        </div>
      ),
    },
  ], []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate('/reports/tokens')}
          className="hover:bg-primary/10 text-primary"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="page-title mb-0">
          Token Details: {date && formatDate(date)}
        </h2>

        {/* Quick Summary Bar at Top */}
        {!isLoading && totalEntries > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-border-temple shadow-sm flex items-center justify-between">
              <span className="text-xs font-semibold text-text-main opacity-60 uppercase">Total Entries</span>
              <span className="text-xl font-bold text-primary">{totalEntries}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-border-temple shadow-sm flex items-center justify-between">
              <span className="text-xs font-semibold text-text-main opacity-60 uppercase">Total Devotees</span>
              <span className="text-xl font-bold text-primary">{totalDevotees}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-border-temple shadow-sm flex items-center justify-between">
              <span className="text-xs font-semibold text-text-main opacity-60 uppercase">Avg per Group</span>
              <span className="text-xl font-bold text-primary">{avgPerGroup}</span>
            </div>
          </div>
        )}
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
        totalCount={totalEntries}
      />
    </div>
  );
};

export default TokenDetailLedgerPage;
