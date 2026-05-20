import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Search, Printer, Loader2 } from 'lucide-react';
import api from '../api/axios';
import { Input } from '../components/ui/Input';
import { Card, CardContent } from '../components/ui/Card';
import { Label } from '../components/ui/Label';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { formatDate } from '../utils/date';
import { formatQuantityWithUnit } from '../utils/quantity';
import { useAuth } from '../context/AuthContext';
import { cn } from '../utils/cn';

const toDateInputValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const DonationReportPage = () => {
  const { user } = useAuth();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const { data: donations, isLoading } = useQuery({
    queryKey: ['detailed-donations-report', fromDate, toDate, searchTerm, selectedItemId],
    queryFn: async () => {
      const params = {};
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      if (searchTerm) params.q = searchTerm;
      if (selectedItemId) params.item_id = selectedItemId;
      const res = await api.get('/reports/get_detailed_donations_report', { params });
      return res.data;
    }
  });

  const reportData = useMemo(() => {
    return donations || [];
  }, [donations]);

  const { data: itemsData } = useQuery({
    queryKey: ['items-list-all'],
    queryFn: async () => (await api.get('/items/list_items', { params: { page_size: 1000 } })).data
  });

  const { data: donationTypesData } = useQuery({
    queryKey: ['donation-types'],
    queryFn: async () => (await api.get('/donation-types/list_donation_types', { params: { status: null, page_size: 1000 } })).data
  });

  const items = useMemo(() => itemsData?.items || [], [itemsData]);
  const donationTypeNameById = useMemo(() => {
    const map = new Map();
    (donationTypesData?.items || []).forEach((type) => map.set(Number(type.id), type.type_name));
    return map;
  }, [donationTypesData]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!reportData || reportData.length === 0) return;
    try {
      setIsExporting(true);
      const params = {};
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      if (searchTerm) params.q = searchTerm;
      if (selectedItemId) params.item_id = selectedItemId;
      const response = await api.get('/reports/get_detailed_donations_report_pdf', {
        params,
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'donation_report.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  const activeFinancialYear = user?.active_financial_year?.name || (() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    return month >= 3 ?
    `${year}-${(year + 1).toString().slice(-2)}` :
    `${year - 1}-${year.toString().slice(-2)}`;
  })();

  return (
    <div className="space-y-6 donation-report-print">
      <style>{`
        @media print {
          @page { 
            size: A4 landscape; 
            margin: 8mm; 
          }
          header, aside, footer, .print\\:hidden { 
            display: none !important; 
          }
          main { 
            padding: 0 !important; 
            margin: 0 !important; 
          }
          .lg\\:pl-64 { 
            padding-left: 0 !important; 
          }
          body { 
            background: white !important; 
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .donation-report-print { 
            padding: 0 !important; 
            margin: 0 !important; 
            width: 100% !important;
          }
          .donation-report-print .rounded-xl { 
            border: none !important; 
            border-radius: 0 !important; 
            box-shadow: none !important;
          }
          .donation-report-print table { 
            width: 100% !important; 
            table-layout: fixed !important;
            border-collapse: collapse !important;
            border: 1px solid #ead9c9 !important;
          }
          .donation-report-print th, .donation-report-print td { 
            border: 1px solid #ead9c9 !important; 
            padding: 6px 4px !important;
            font-size: 10px !important;
          }
          .donation-report-print th {
            background-color: #f8efe5 !important;
            font-weight: bold !important;
          }
          .donation-report-print .print-financial-year {
            display: none !important;
          }
          }
          `}</style>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
          <h2 className="page-title text-2xl font-black text-text-main">Donation Report</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleDownloadPDF} disabled={isExporting || !reportData?.length} className="border-primary text-primary hover:bg-primary hover:!text-white">
              {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
              Download PDF
            </Button>
            <Button variant="outline" onClick={handlePrint} className="border-primary text-primary hover:bg-primary hover:!text-white">
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
          </div>
          </div>

          <Card className="border-border-temple shadow-sm bg-white/50 print:hidden">
          {/* ... CardContent remains same ... */}
          <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[180px_180px_minmax(220px,320px)_245px] gap-4 items-end">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase text-text-main">From Date</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-10 bg-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase text-text-main">To Date</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-10 bg-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase text-text-main">Search Devotee / Phone</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-main/40" />
                <Input
                  placeholder="Name or Phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-10 bg-white" />

              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase text-text-main">Item Filter</Label>
              <Select value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)} className="h-10 bg-white">
                <option value="">All Items</option>
                {items.map((i) =>
                <option key={i.id} value={i.id}>{i.item_name}</option>
                )}
              </Select>
            </div>
          </div>
          </CardContent>
          </Card>

          <div className="overflow-hidden rounded-xl border border-border-temple bg-white shadow-sm print:border-none print:shadow-none">
          <div className="border-b border-border-temple bg-white px-5 pb-7 pt-5">
          <div className="relative text-center">
            <div className="absolute right-0 top-0 hidden print:block bg-[#F8E6D1] border border-[#B08968] px-3 py-1.5 rounded-md print-financial-year">
               <span className="text-[11px] font-bold text-[#5C2E1F] whitespace-nowrap">
                  Financial Year : {activeFinancialYear}
               </span>
            </div>

            <h1 className="font-temple text-xl font-bold text-text-main">
              ಆನೆಗುಡ್ಡೆ ಶ್ರೀ ವಿನಾಯಕ ದೇವಸ್ಥಾನ, ಕುಂಭಾಶಿ
            </h1>
            <p className="mt-1 text-sm font-bold uppercase text-text-main">
              {fromDate && toDate && fromDate === toDate ?
              <>Report of : <span className="font-extrabold">{formatDate(fromDate)}</span></> :
              fromDate && toDate ?
              <>Donation Report From Date : <span className="font-extrabold">{formatDate(fromDate)}</span>
                {' '}To Date : <span className="font-extrabold">{formatDate(toDate)}</span></> :
              fromDate ?
              <>Report of : <span className="font-extrabold">{formatDate(fromDate)}</span></> :
              toDate ?
              <>Report up to : <span className="font-extrabold">{formatDate(toDate)}</span></> :

              <>Donation Report</>
              }
            </p>
          </div>
          </div>

          <div className="overflow-x-auto pt-3 print:overflow-visible">
          <table className="min-w-[700px] w-full table-fixed text-left text-sm print:min-w-full">
            <colgroup>
              <col className="w-[11%]" />
              <col className="w-[13%]" />
              <col className="w-[10%]" />
              <col className="w-[15%]" />
              <col className="w-[11%]" />
              <col className="w-[28%]" />
              <col className="w-[12%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-[#ead9c9] bg-[#f8efe5] text-xs font-bold uppercase tracking-wider text-text-main print:bg-gray-100">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Receipt No</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Devotee</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-3 py-3">Donated Item & Quantity</th>
                <th className="px-4 py-3">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0e5da]">
              {isLoading ?
              <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm font-medium text-text-light">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading donation report...
                    </div>
                  </td>
                </tr> :
              reportData.length ?
              reportData.map((row, index) =>
              <tr key={`${row.donation_date}-${row.id}-${index}`} className="transition-colors hover:bg-[#fffaf4] align-top text-text-main print:break-inside-avoid">
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-normal print:px-2">
                      {formatDate(row.donation_date)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-bold print:px-2">
                      {row.receipt_display_number || '-'}
                    </td>
                    <td className="px-4 py-4 text-sm font-bold uppercase print:px-2">
                      <span className={cn(
                        "inline-block rounded-full px-2.5 py-1 text-sm font-bold uppercase leading-tight",
                        Number(row.donation_type) === 2 ? "bg-emerald-100 text-emerald-700" :
                        Number(row.donation_type) === 3 ? "bg-amber-100 text-amber-700" :
                        Number(row.donation_type) === 4 ? "bg-purple-100 text-purple-700" :
                        "bg-blue-100 text-blue-700"
                      )}>
                        {donationTypeNameById.get(Number(row.donation_type)) || 'General Donation'}
                      </span>
                    </td>
                    <td className="px-4 py-4 print:px-2">
                      <div className="font-normal truncate print:whitespace-normal print:overflow-visible">{row.devotee_name || '-'}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 font-normal print:px-2">
                      {row.phone_number || '-'}
                    </td>
                    <td className="px-3 py-4 print:px-2">
                      <div className="space-y-1.5">
                        {(row.items || []).map((it, idx) =>
                    <div key={idx} className="flex flex-col leading-tight">
                            <span className="text-sm font-normal text-text-main print:text-black">
                              {it.item?.item_name || '-'} - <span className="font-bold text-red-700 print:text-red-700">{formatQuantityWithUnit(it.quantity, it.item?.unit)}</span>
                            </span>
                          </div>
                    )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm font-normal print:px-2">
                      <span className="block" title={row.remarks || '-'}>
                        {row.remarks || '-'}
                      </span>
                    </td>
                  </tr>
              ) :

              <tr>
                  <td colSpan={7} className="px-5 py-12 text-center font-bold text-text-main">
                    No donations found
                  </td>
                </tr>
              }
            </tbody>
          </table>
          </div>
      </div>
    </div>);

};

export default DonationReportPage;
