import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar,
} from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';
import api from '../api/axios';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Label } from '../components/ui/Label';
import { Card, CardContent } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';

const TokenHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  
  // States
  const [pageSize, setPageSize] = useState(50);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Fetch Data
  const { data: history, isLoading } = useQuery({
    queryKey: ['token-history', pageSize, startDate, endDate],
    queryFn: async () => {
      const params: any = { page_size: pageSize };
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      
      const res = await api.get('/tokens/view_history_ledger', { params });
      return res.data;
    },
  });

  const columns = useMemo<ColumnDef<any>[]>(() => [
    { 
      accessorKey: 'id', 
      header: 'ID',
    },
    { 
      accessorKey: 'created_at', 
      header: 'Date & Time', 
      cell: info => {
        const val = info.getValue() as string;
        if (!val) return '-';
        const date = new Date(val);
        return (
          <span className="text-text-main">
            {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        );
      }
    },
    { 
      accessorKey: 'token_count', 
      header: 'Tokens Issued', 
      cell: info => (
        <span className="font-bold text-primary">
          {info.getValue() as number}
        </span>
      )
    },
    { 
      accessorKey: 'creator', 
      header: 'Issued By', 
      cell: info => {
        const creator = info.getValue() as any;
        return (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[10px] text-white">
              {creator?.full_name?.[0]}
            </div>
            <span className="text-text-main">
              {creator?.full_name || '-'}
            </span>
          </div>
        );
      }
    },
  ], []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center text-sm text-gray-500 gap-2">
          <button 
            onClick={() => navigate('/tokens')}
            className="hover:text-primary transition-colors"
          >
            Token Management
          </button>
          <span>/</span>
          <span className="text-text-main font-medium">Detailed History</span>
        </div>
        
        <div className="flex items-center gap-4">
          <h2 className="text-text-main">Token Issuance Ledger</h2>
        </div>
      </div>

      <Card className="border-border-temple">
        <CardContent className="p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-3 items-end">
            <div className="space-y-1.5">
              <Label className="text-text-main">Rows</Label>
              <Select value={pageSize.toString()} onChange={(e) => setPageSize(Number(e.target.value))}>
                {[10, 20, 50, 100].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-text-main">Start Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="pl-10 text-text-main"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-text-main">End Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="pl-10 text-text-main"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={history || []}
        loading={isLoading}
      />
    </div>
  );
};

export default TokenHistoryPage;

