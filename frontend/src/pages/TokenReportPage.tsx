import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Eye,
  Loader2,
  Ticket,
  Clock,
  User as UserIcon,
  X
} from 'lucide-react';
import api from '../api/axios';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { formatDate, formatDateTime } from '../utils/date';

interface TokenGeneration {
  id: number;
  date: string;
  total_tokens: number;
  created_at: string;
}

interface TokenDetail {
  id: number;
  token_count: number;
  created_at: string;
  issued_by?: string;
  creator?: {
    id: number;
    full_name: string;
  };
}

const TokenReportPage: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch summary list
  const { data: generations, isLoading: isLoadingSummary } = useQuery({
    queryKey: ['token-generations'],
    queryFn: async () => {
      const res = await api.get('/tokens/list_generations', {
        params: { page: 1, page_size: 100 } // Get recent 100 days
      });
      return res.data.items as TokenGeneration[];
    },
  });

  // Fetch details for selected date
  const { data: details, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['token-details', selectedDate],
    queryFn: async () => {
      if (!selectedDate) return [];
      const res = await api.get(`/tokens/get_details_by_date/${selectedDate}`);
      return res.data.items as TokenDetail[];
    },
    enabled: !!selectedDate,
  });
  const detailRows = React.useMemo(() => {
    const raw = Array.isArray(details) ? details : [];
    return raw.map((d: any, idx: number) => ({
      id: d?.id ?? idx,
      token_count: d?.token_count ?? d?.tokens_issued ?? 0,
      created_at: d?.created_at ?? d?.time ?? d?.issued_at ?? '',
      issued_by: d?.issued_by ?? d?.issuedBy ?? d?.creator?.full_name ?? 'System',
      creator: d?.creator,
    })) as TokenDetail[];
  }, [details]);

  const handleViewDetails = (date: string) => {
    setSelectedDate(date);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="page-title">
            Token Issued Report
          </h2>
        </div>
      </div>

      <Card className="border-border-temple shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-primary text-white uppercase text-[11px] font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-4 border-b border-primary/20">Date</th>
                  <th className="px-6 py-4 border-b border-primary/20 text-center">Total Tokens</th>
                  <th className="px-6 py-4 border-b border-primary/20 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {isLoadingSummary ? (
                  <tr>
                    <td colSpan={3} className="py-20 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-text-main">Loading token data...</p>
                      </div>
                    </td>
                  </tr>
                ) : generations?.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-20 text-center text-text-main">
                      No token issuance records found.
                    </td>
                  </tr>
                ) : (
                  generations?.map((row) => (
                    <tr key={row.id} className="hover:bg-[#F8EFE3] transition-colors">
                      <td className="px-6 py-4 font-medium text-text-main">
                        {formatDate(row.date)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary">
                          {row.total_tokens}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleViewDetails(row.date)}
                          className="text-primary border-primary/20 hover:bg-[#472B20] hover:text-white"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Details Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-bg-cream">
              <h3 className="text-lg font-bold text-text-main">
                Token Details: {selectedDate && formatDate(selectedDate)}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {isLoadingDetails ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-gray-500">Fetching detailed logs...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider px-2">
                    <div>Time</div>
                    <div className="text-center">Tokens Issued</div>
                    <div className="text-right">Issued By</div>
                  </div>
                  <div className="space-y-2">
                    {detailRows.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
                        No token details found for this date.
                      </div>
                    ) : (
                      detailRows.map((detail) => (
                        <div 
                          key={detail.id} 
                          className="grid grid-cols-3 items-center p-3 rounded-lg border border-gray-100 hover:border-primary/20 hover:bg-primary/5 transition-all"
                        >
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <Clock className="w-4 h-4 text-gray-400" />
                            {detail.created_at ? new Date(detail.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                          </div>
                          <div className="text-center">
                            <span className="font-bold text-text-main">{detail.token_count}</span>
                          </div>
                          <div className="flex items-center justify-end gap-2 text-sm text-gray-600">
                            <UserIcon className="w-4 h-4 text-gray-400" />
                            {detail.issued_by || detail.creator?.full_name || 'System'}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
              <Button onClick={() => setIsModalOpen(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TokenReportPage;

