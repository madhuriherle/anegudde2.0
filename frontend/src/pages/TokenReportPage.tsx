import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Eye,
  Loader2,
  Ticket
} from 'lucide-react';
import api from '../api/axios';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { formatDate } from '../utils/date';

interface TokenGeneration {
  id: number;
  date: string;
  total_tokens: number;
  created_at: string;
}

const TokenReportPage: React.FC = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);

  // Fetch summary list
  const { data: generationsData, isLoading: isLoadingSummary } = useQuery({
    queryKey: ['token-generations', page, pageSize],
    queryFn: async () => {
      const res = await api.get('/tokens/list_generations', {
        params: { page, page_size: pageSize }
      });
      return res.data;
    },
  });

  const generations = useMemo(() => generationsData?.items ?? [], [generationsData]);

  const handleViewDetails = (date: string) => {
    navigate(`/reports/tokens/${date}`);
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

          {/* Pagination */}
          {!isLoadingSummary && (generationsData?.total_pages || 0) > 1 && (
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              <div className="text-xs text-text-main opacity-60 font-medium">
                Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, generationsData?.total || 0)} of {generationsData?.total} days
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <div className="text-xs font-bold text-text-main px-2">
                  Page {page} of {generationsData?.total_pages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(generationsData?.total_pages || 1, p + 1))}
                  disabled={page === generationsData?.total_pages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TokenReportPage;
