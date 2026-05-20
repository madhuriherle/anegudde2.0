import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Download,
  FileText,
  Loader2,
  AlertTriangle,
  Search } from

'lucide-react';

import api from '../api/axios';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Card, CardContent } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';
import { Badge } from '../components/ui/Badge';
import { formatCurrency } from '../utils/currency';

const VendorOutstandingReportPage = () => {
  const [search, setSearch] = useState('');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const formatAmount = (value) => formatCurrency(value);

  const { data: vendorData, isLoading } = useQuery({
    queryKey: ['vendor-outstanding'],
    queryFn: async () => {
      const res = await api.get('/reports/get_vendor_outstanding');
      return res.data;
    }
  });

  const filteredData = useMemo(() => {
    if (!search || !vendorData) return vendorData || [];
    return vendorData.filter((v) =>
    v.vendor_name.toLowerCase().includes(search.toLowerCase()) ||
    v.vendor_code.toLowerCase().includes(search.toLowerCase())
    );
  }, [vendorData, search]);

  const handleExport = () => {
    if (!vendorData || vendorData.length === 0) {
      alert('No data available to export');
      return;
    }

    const headers = [
    'Vendor Code',
    'Vendor Name',
    'Contact',
    'Opening Balance',
    'Credit Limit'];


    const rows = vendorData.map((v) => [
    v.vendor_code,
    v.vendor_name,
    v.contact_number,
    v.current_balance,
    v.credit_limit || 'N/A']
    );

    const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.join(','))].
    join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `vendor_outstanding_report.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadPDF = async () => {
    if (!filteredData || filteredData.length === 0) {
      alert('No data available to export');
      return;
    }
    try {
      setIsExportingPdf(true);
      const response = await api.get('/reports/get_vendor_outstanding_pdf', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'vendor_outstanding_report.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const columns = useMemo(() => [
  {
    accessorKey: 'vendor_name',
    header: 'Vendor Name',
    cell: (info) => <span className="font-bold text-text-main">{info.getValue()}</span>
  },
  {
    accessorKey: 'vendor_code',
    header: 'Code',
    cell: (info) => <span className="text-text-main">{info.getValue()}</span>
  },
  {
    accessorKey: 'contact_number',
    header: 'Contact',
    cell: (info) => <span className="text-text-main">{info.getValue()}</span>
  },
  {
    accessorKey: 'current_balance',
    header: 'Opening Balance',
    cell: (info) =>
    <span className="font-black text-red-600">
          {formatAmount(info.getValue())}
        </span>

  },
  {
    accessorKey: 'credit_limit',
    header: 'Credit Limit',
    cell: (info) => {
      const val = info.getValue();
      return <span className="text-text-main">{val ? formatAmount(val) : 'No Limit'}</span>;
    }
  },
  {
    id: 'status',
    header: () => <div className="text-center px-4">Status</div>,
    cell: (info) => {
      const v = info.row.original;
      const isOverLimit = v.credit_limit && Number(v.current_balance) > Number(v.credit_limit);
      return (
        <div className="flex justify-center px-4">
            {isOverLimit ?
          <Badge className="bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded text-[10px] font-bold">
                <AlertTriangle className="w-3 h-3 mr-1" />
                OVER LIMIT
              </Badge> :

          <Badge className="bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded text-[10px] font-bold">
                ACTIVE
              </Badge>
          }
          </div>);

    }
  }],
  []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="page-title">Vendor Outstanding & Aging</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExport}
            className="text-text-main font-bold">
            
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={handleDownloadPDF}
            disabled={isExportingPdf}
            className="text-text-main font-bold">
            
            {isExportingPdf ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
            Download PDF
          </Button>
        </div>
      </div>

      <Card className="border-border-temple">
        <CardContent className="p-4 sm:p-6">
          <div className="max-w-md">
            <Label className="text-text-main font-medium">Quick Search</Label>
            <div className="relative mt-1.5">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input

                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 text-text-main" />

            </div>
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={filteredData || []}
        loading={isLoading} />
      
    </div>);

};

export default VendorOutstandingReportPage;
