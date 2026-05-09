import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Eye, 
  History,
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
import { Label } from '../components/ui/Label';
import { DataTable } from '../components/ui/DataTable';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '../components/ui/Dialog';
import { formatDate, formatDateTime } from '../utils/date';

const tokenSchema = z.object({
  token_count: z.coerce.number().min(1, 'Token count must be at least 1'),
});

type TokenFormValues = z.infer<typeof tokenSchema>;

const TokensPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showSuccess, showError, showConfirm } = useNotification();
  
  // Filter States
  const [pageSize] = useState(50);
  const [open, setOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingDate, setViewingDate] = useState<string | null>(null);

  // Fetch Generations (Daily Summaries)
  const { data: generationsData, isLoading: generationsLoading } = useQuery({
    queryKey: ['token-generations', pageSize],
    queryFn: async () => {
      const res = await api.get('/tokens/list_generations', { params: { page_size: pageSize } });
      return res.data;
    },
  });
  const generations = useMemo(() => generationsData?.items || [], [generationsData]);

  // Fetch Details for a specific date
  const { data: detailsData, isLoading: detailsLoading } = useQuery({
    queryKey: ['token-details', viewingDate],
    queryFn: async () => {
      if (!viewingDate) return { items: [] };
      const res = await api.get(`/tokens/get_details_by_date/${viewingDate}`);
      return res.data;
    },
    enabled: !!viewingDate,
  });
  const details = useMemo(() => detailsData?.items || [], [detailsData]);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<TokenFormValues>({
    resolver: zodResolver(tokenSchema) as any,
    defaultValues: {
        token_count: 0
    }
  });

  // Mutation for creating tokens
  const createMutation = useMutation({
    mutationFn: async (data: TokenFormValues) => {
      return api.post('/tokens/create_token', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['token-generations'] });
      showSuccess('Tokens recorded successfully');
      handleClose();
    },
    onError: (err: any) => {
      showError(err.response?.data?.detail || 'Failed to record tokens');
    }
  });

  const handleOpen = () => {
    reset({ token_count: 0 });
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleViewDetails = (date: string) => {
    setViewingDate(date);
    setViewDialogOpen(true);
  };

  const onSubmit = async (data: TokenFormValues) => {
    const confirmed = await showConfirm(
      "Confirm Recording",
      `Are you sure you want to record ${data.token_count} tokens?`
    );

    if (confirmed) {
      createMutation.mutate(data);
    }
  };

  const columns = useMemo<ColumnDef<any>[]>(() => [
    { 
      accessorKey: 'date', 
      header: 'Date',
      cell: info => <span className="text-text-main">{formatDate(info.getValue())}</span>,
    },
    { 
      accessorKey: 'total_tokens', 
      header: 'Total Tokens Issued', 
      cell: info => (
        <span className="font-bold text-primary">
          {info.getValue() as number}
        </span>
      )
    },
    { 
      accessorKey: 'created_at', 
      header: 'First Token At', 
      cell: info => {
        const val = info.getValue() as string;
        return formatDateTime(val);
      }
    },
    {
      id: 'actions',
      header: () => <div className="text-center">Actions</div>,
      cell: info => (
        <div className="flex items-center justify-center gap-2">
          <Button 
            variant="outline"
            size="sm"
            onClick={() => handleViewDetails(info.row.original.date)}
            className="text-text-main h-8"
          >
            Details
          </Button>
        </div>
      )
    }
  ], []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="page-title">Token Management</h2>
          <button 
            onClick={() => navigate('/tokens/history')}
            className="text-sm text-primary hover:underline"
          >
            View Detailed Ledger
          </button>
        </div>
        <Button 
          onClick={handleOpen}
          className="text-text-main font-bold px-6"
        >
          
          Issue New Tokens
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={generations || []}
        loading={generationsLoading}
      />

      {/* Issue Tokens Dialog */}
      <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
        <DialogContent className="max-w-md border-border-temple">
          <DialogHeader>
            <DialogTitle className="text-text-main">Issue New Tokens</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-4 pb-0">
            <div className="space-y-4">
              <p className="text-sm text-text-main/70">
                Enter the number of tokens being issued right now. This will be added to today's total.
              </p>
              <div className="space-y-1.5">
                <Label className="text-text-main">Token Count *</Label>
                <div className="relative">
                  <Input
                    {...register('token_count')}
                    type="number"
                    autoFocus
                    className="text-text-main"
                    placeholder="e.g. 10"
                    onFocus={(e) => {
                      if (e.target.value === '0' || e.target.value === 0) {
                        setValue('token_count', '' as any);
                      }
                    }}
                  />
                </div>
                {errors.token_count && <p className="text-xs text-red-500">{errors.token_count.message}</p>}
              </div>
            </div>
            <DialogFooter className="gap-3">
              <Button type="button" variant="ghost" onClick={handleClose} className="w-28 h-10 bg-white border border-[#D9C8AF] text-text-main hover:bg-[#FAF7F2]">
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending}
                className="w-28 h-10 text-text-main"
              >
                {createMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-xl border-border-temple">
          <DialogHeader className="border-b border-border-temple/40 pb-4">
            <DialogTitle className="text-text-main">
              Token Details for {formatDate(viewingDate)}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <div className="rounded-md border border-border-temple overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-bg-temple text-text-main uppercase text-[11px] font-bold tracking-wider">
                  <tr>
                    <th className="px-4 py-3 border-b border-border-temple">Time</th>
                    <th className="px-4 py-3 border-b border-border-temple text-right">Tokens Issued</th>
                    <th className="px-4 py-3 border-b border-border-temple text-right">Issued By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-temple/40">
                  {detailsLoading ? (
                    <tr>
                      <td colSpan={3} className="py-10 text-center">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                      </td>
                    </tr>
                  ) : details?.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-10 text-center text-text-main">
                        No data found
                      </td>
                    </tr>
                  ) : (
                    details?.map((detail: any) => (
                      <tr key={detail.id} className="hover:bg-bg-temple/30">
                        <td className="px-4 py-3 text-text-main">
                          {formatDateTime(detail.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-primary">
                          {detail.token_count}
                        </td>
                        <td className="px-4 py-3 text-right text-text-main">
                          {detail.creator?.full_name || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <DialogFooter className="mt-6 border-t border-border-temple/40 pt-4">
            <Button onClick={() => setViewDialogOpen(false)} className="bg-primary hover:bg-secondary text-white px-10">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TokensPage;




