import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Printer, Loader2 } from 'lucide-react';
import api from '../api/axios';
import { Input } from '../components/ui/Input';
import { Card, CardContent } from '../components/ui/Card';
import { Label } from '../components/ui/Label';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { formatDate } from '../utils/date';
import { formatQuantityWithUnit } from '../utils/quantity';

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const DonationReportPage: React.FC = () => {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string>('');

  const { data: donations, isLoading } = useQuery({
    queryKey: ['detailed-donations-report', fromDate, toDate, searchTerm, selectedItemId],
    queryFn: async () => {
      const params: any = {};
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      if (searchTerm) params.q = searchTerm;
      if (selectedItemId) params.item_id = selectedItemId;
      const res = await api.get('/reports/get_detailed_donations_report', { params });
      return res.data;
    },
  });

  const reportData = useMemo(() => {
    return donations || [];
  }, [donations]);

  const { data: itemsData } = useQuery({
    queryKey: ['items-list-all'],
    queryFn: async () => (await api.get('/items/list_items', { params: { page_size: 1000 } })).data,
  });

  const items = useMemo(() => itemsData?.items || [], [itemsData]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 donation-report-print">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          header, aside, footer, .print\\:hidden { display: none !important; }
          main { padding: 0 !important; }
          .lg\\:pl-64 { padding-left: 0 !important; }
          .donation-report-print { padding-top: 0 !important; margin-top: 0 !important; }
          .donation-report-print table { border-collapse: collapse; }
          .donation-report-print th, .donation-report-print td { border: 1px solid #ead9c9 !important; }
        }
      `}</style>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <h2 className="page-title text-2xl font-black text-text-main">Donation Report</h2>
        <Button variant="outline" onClick={handlePrint} className="border-primary text-primary hover:bg-primary hover:!text-white">
          <Printer className="w-4 h-4 mr-2" />
          Print
        </Button>
      </div>

      <Card className="border-border-temple shadow-sm bg-white/50 print:hidden">
        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[180px_180px_minmax(220px,320px)_245px] gap-4 items-end">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase text-text-main">From Date</Label>
              <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="h-10 bg-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase text-text-main">To Date</Label>
              <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="h-10 bg-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase text-text-main">Search Devotee / Phone</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-main/40" />
                <Input 
                  placeholder="Name or Phone..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                  className="pl-10 h-10 bg-white"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase text-text-main">Item Filter</Label>
              <Select value={selectedItemId} onChange={e => setSelectedItemId(e.target.value)} className="h-10 bg-white">
                <option value="">All Items</option>
                {items.map((i: any) => (
                  <option key={i.id} value={i.id}>{i.item_name}</option>
                ))}
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-xl border border-border-temple bg-white shadow-sm print:border-none print:shadow-none">
        <div className="border-b border-border-temple bg-white px-5 pb-7 pt-5">
          <div className="text-center">
            <h1 className="font-temple text-xl font-bold text-text-main">
              ಆನೆಗುಡ್ಡೆ ಶ್ರೀ ವಿನಾಯಕ ದೇವಸ್ಥಾನ, ಕುಂಭಾಶಿ
            </h1>
            <p className="mt-1 text-sm font-bold uppercase text-text-main">
              {fromDate && toDate && fromDate === toDate ? (
                <>Report of : <span className="font-extrabold">{formatDate(fromDate)}</span></>
              ) : fromDate && toDate ? (
                <>Donation Report From Date : <span className="font-extrabold">{formatDate(fromDate)}</span>
                {' '}To Date : <span className="font-extrabold">{formatDate(toDate)}</span></>
              ) : fromDate ? (
                <>Report of : <span className="font-extrabold">{formatDate(fromDate)}</span></>
              ) : toDate ? (
                <>Report up to : <span className="font-extrabold">{formatDate(toDate)}</span></>
              ) : (
                <>Donation Report</>
              )}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto pt-3 print:overflow-visible">
          <table className="min-w-[700px] w-full table-fixed text-left text-sm print:min-w-full">
            <colgroup>
              <col className="w-[12%]" />
              <col className="w-[21%]" />
              <col className="w-[15%]" />
              <col className="w-[19%]" />
              <col className="w-[12%]" />
              <col className="w-[21%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-[#ead9c9] bg-[#f8efe5] text-xs font-bold uppercase tracking-wider text-text-main print:bg-gray-100">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Devotee</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-3 py-3">Donated Item</th>
                <th className="px-3 py-3 text-left">Quantity</th>
                <th className="px-4 py-3">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0e5da]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm font-medium text-text-light">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading donation report...
                    </div>
                  </td>
                </tr>
              ) : reportData.length ? (
                reportData.map((row: any, index: number) => (
                  <tr key={`${row.donation_date}-${row.id}-${index}`} className="transition-colors hover:bg-[#fffaf4] align-top text-text-main print:break-inside-avoid">
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-normal">
                      {formatDate(row.donation_date)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-normal">{row.devotee_name || '-'}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 font-normal">
                      {row.phone_number || '-'}
                    </td>
                    <td className="px-3 py-4">
                      <div className="space-y-2">
                        {(row.items || []).map((it: any, idx: number) => (
                          <div key={idx} className="flex flex-col">
                            <span className="text-sm font-normal text-primary print:text-black">
                              {it.item?.item_name || '-'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-4 text-left">
                      <div className="space-y-2">
                        {(row.items || []).map((it: any, idx: number) => (
                          <div key={idx} className="flex flex-col">
                            <span className="text-sm font-normal">
                              {formatQuantityWithUnit(it.quantity, it.item?.unit)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm font-normal">
                      <span className="block" title={row.remarks || '-'}>
                        {row.remarks || '-'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center font-bold text-text-main">
                    No donations found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DonationReportPage;
