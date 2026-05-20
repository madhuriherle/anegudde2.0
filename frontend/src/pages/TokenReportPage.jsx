import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Eye,
  FileText,
  Loader2 } from
'lucide-react';
import api from '../api/axios';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Label } from '../components/ui/Label';
import { formatDate } from '../utils/date';










const toDateInputValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getPresetRange = (mode) => {
  const today = new Date();
  const start = new Date(today);
  const end = new Date(today);

  if (mode === 'yesterday') {
    start.setDate(today.getDate() - 1);
    end.setDate(today.getDate() - 1);
  }

  if (mode === 'weekly') {
    start.setDate(today.getDate() - 6);
  }

  return {
    startDate: toDateInputValue(start),
    endDate: toDateInputValue(end)
  };
};

const TokenReportPage = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [dateFilterMode, setDateFilterMode] = useState('weekly');
  const [customStartDate, setCustomStartDate] = useState(() => getPresetRange('weekly').startDate);
  const [customEndDate, setCustomEndDate] = useState(() => getPresetRange('weekly').endDate);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const activeDateRange = useMemo(() => {
    if (dateFilterMode === 'custom') {
      return {
        startDate: customStartDate,
        endDate: customEndDate
      };
    }
    return getPresetRange(dateFilterMode);
  }, [customEndDate, customStartDate, dateFilterMode]);

  const q = useMemo(() => `${activeDateRange.startDate}..${activeDateRange.endDate}`, [activeDateRange]);

  // Fetch summary list
  const { data: generationsData, isLoading: isLoadingSummary } = useQuery({
    queryKey: ['token-generations', page, pageSize, q],
    queryFn: async () => {
      const res = await api.get('/tokens/list_generations', {
        params: { page, page_size: pageSize, q }
      });
      return res.data;
    }
  });

  const generations = useMemo(() => generationsData?.items ?? [], [generationsData]);

  const handleViewDetails = (date) => {
    navigate(`/reports/tokens/${date}`);
  };

  const handleDownloadPDF = async () => {
    if (!generations || generations.length === 0) return;
    try {
      setIsExportingPdf(true);
      const response = await api.get('/reports/token-issued/pdf', {
        params: { from_date: activeDateRange.startDate, to_date: activeDateRange.endDate },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'token_issued_report.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDateFilterModeChange = (mode) => {
    setDateFilterMode(mode);
    setPage(1);
    if (mode !== 'custom') {
      const range = getPresetRange(mode);
      setCustomStartDate(range.startDate);
      setCustomEndDate(range.endDate);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="page-title">
            Token Issued Report
          </h2>
        </div>
        <Button variant="outline" onClick={handleDownloadPDF} disabled={isExportingPdf || generations.length === 0} className="text-text-main">
          {isExportingPdf ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
          Download PDF
        </Button>
      </div>

      <Card className="border-border-temple shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5 w-full sm:w-56">
              <Label className="text-text-main">Date Filter</Label>
              <Select
                value={dateFilterMode}
                onChange={(e) => handleDateFilterModeChange(e.target.value)}
                className="text-text-main">
                
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="weekly">Weekly</option>
                <option value="custom">Custom</option>
              </Select>
            </div>
            {dateFilterMode === 'custom' &&
            <>
                <div className="space-y-1.5 w-full sm:w-48">
                  <Label className="text-text-main">From Date</Label>
                  <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => {
                    setCustomStartDate(e.target.value);
                    setPage(1);
                  }}
                  className="text-text-main" />
                
                </div>
                <div className="space-y-1.5 w-full sm:w-48">
                  <Label className="text-text-main">To Date</Label>
                  <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => {
                    setCustomEndDate(e.target.value);
                    setPage(1);
                  }}
                  className="text-text-main" />
                
                </div>
              </>
            }
          </div>
        </CardContent>
      </Card>

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
                {isLoadingSummary ?
                <tr>
                    <td colSpan={3} className="py-20 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-text-main">Loading token data...</p>
                      </div>
                    </td>
                  </tr> :
                generations?.length === 0 ?
                <tr>
                    <td colSpan={3} className="py-20 text-center text-text-main">
                      No token issuance records found.
                    </td>
                  </tr> :

                generations?.map((row) =>
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
                      className="text-primary border-primary/20 hover:bg-[#472B20] hover:text-white">
                      
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </Button>
                      </td>
                    </tr>
                )
                }
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!isLoadingSummary && (generationsData?.total_pages || 0) > 1 &&
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              <div className="text-xs text-text-main opacity-60 font-medium">
                Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, generationsData?.total || 0)} of {generationsData?.total} days
              </div>
              <div className="flex items-center gap-2">
                <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}>
                
                  Previous
                </Button>
                <div className="text-xs font-bold text-text-main px-2">
                  Page {page} of {generationsData?.total_pages}
                </div>
                <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(generationsData?.total_pages || 1, p + 1))}
                disabled={page === generationsData?.total_pages}>
                
                  Next
                </Button>
              </div>
            </div>
          }
        </CardContent>
      </Card>
    </div>);

};

export default TokenReportPage;
