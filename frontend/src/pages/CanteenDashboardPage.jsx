import React, { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { formatCurrency } from '../utils/currency';
import { QtyDisplay } from '../components/ui/QtyDisplay';
import { cn } from '../utils/cn';
import { safeFormatTime } from '../utils/date';
import { RefreshCw } from 'lucide-react';
import { usePermission } from '../hooks/usePermission';

const DashboardPage = () => {
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const canReadItems = hasPermission('items.read');
  const canReadWastages = hasPermission('daily_usage.read');
  const canReadTokens = hasPermission('reports.tokens.read');
  const canReadUsage = hasPermission('daily_usage.read');
  const canReadPurchases = hasPermission('purchases.read');
  const [refreshCount, setRefreshCount] = useState(0);

  // 1. Fetch Today Summary
  const { data: today, isLoading: todayLoading, refetch: refetchToday, isFetching } = useQuery({
    queryKey: ['dashboard-today'],
    queryFn: async () => (await api.get('/dashboard/get_today_summary')).data
  });

  // Auto-refresh logic (3 times)
  useEffect(() => {
    if (refreshCount < 3) {
      const timer = setInterval(() => {
        setRefreshCount((prev) => prev + 1);
        refetchToday();
      }, 10000); // 10 seconds
      return () => clearInterval(timer);
    }
  }, [refreshCount, refetchToday]);

  const handleManualRefresh = () => {
    setRefreshCount(0);
    refetchToday();
  };

  // 2. Fetch Low Stock
  const { data: lowStock, isLoading: lowStockLoading } = useQuery({
    queryKey: ['dashboard-low-stock'],
    queryFn: async () => (await api.get('/dashboard/get_low_stock')).data
  });

  // 3. Fetch Weekly Top Menu Wastage
  const { data: weeklyWastage, isLoading: weeklyWastageLoading } = useQuery({
    queryKey: ['dashboard-weekly-menu-wastage'],
    queryFn: async () => (await api.get('/dashboard/get_weekly_menu_wastage')).data
  });

  const weeklyTopWastage = useMemo(() => {
    if (!weeklyWastage || !Array.isArray(weeklyWastage)) return [];
    const maxAmount = Math.max(...weeklyWastage.map((row) => Number(row.amount || 0)), 0);
    return weeklyWastage.map((row) => ({
      ...row,
      quantity: Number(row.quantity || 0),
      amount: Number(row.amount || 0),
      width: maxAmount > 0 ? Number(row.amount || 0) / maxAmount * 100 : 0
    }));
  }, [weeklyWastage]);

  if (todayLoading || lowStockLoading || weeklyWastageLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="relative">
          <div className="h-16 w-16 rounded-full border-4 border-primary/20 animate-pulse"></div>
          <div className="absolute top-0 left-0 h-16 w-16 rounded-full border-t-4 border-primary animate-spin"></div>
        </div>
        <p className="text-sm font-normal text-text-main/60 uppercase tracking-widest animate-pulse">Preparing insights...</p>
      </div>);

  }

  return (
    <div className="space-y-4 pb-4 max-w-[1600px] mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
        <div>
          <h1 className="text-2xl font-normal text-text-main tracking-tight font-temple text-left">Mahaprasad Dashboard</h1>
        </div>
      </div>

      {/* 3x2 Grid Layout */}
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3 text-left">
        
        {/* 1. Total Tokens (Token Issuance Activity) */}
        {canReadTokens && (
          <Card className="border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col bg-white text-left min-h-[360px]">
            <CardHeader className="bg-white border-b border-gray-100 px-5 py-3 h-[74px] flex flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 min-w-0">
                <CardTitle className="text-lg font-normal text-[#D05E2D] tracking-wide text-left truncate font-temple">Total Tokens</CardTitle>
                {refreshCount >= 3 &&
                <button
                  onClick={handleManualRefresh}
                  className="p-1.5 rounded-full hover:bg-orange-50 text-[#D05E2D] transition-all hover:scale-110 active:rotate-180 duration-300 flex-shrink-0"
                  title="Refresh Tokens">
                  
                    <RefreshCw size={16} className={cn(isFetching && "animate-spin")} />
                  </button>
                }
              </div>
              <div className="text-right flex-shrink-0">
                  <div
                  className="text-amber-700 tracking-tight leading-none"
                  style={{
                    fontSize: '24px',
                    fontWeight: '800',
                    display: 'block'
                  }}>
                  
                    {Number(today?.tokens_issued || 0).toLocaleString()}
                  </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
               <div className="h-[286px] overflow-y-auto">
                {today?.token_details?.length > 0 ?
                <div>
                    <div className="grid grid-cols-3 px-6 py-2 border-b border-gray-100 bg-gray-50/70 text-sm tracking-wide text-text-main/80 font-normal items-center">
                      <div className="text-left">Receipt No</div>
                      <div className="text-center">Time</div>
                      <div className="text-right pr-1">Token</div>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {today.token_details.slice(0, 5).map((row, idx) =>
                    <div key={idx} className="grid grid-cols-3 items-center px-6 py-3 hover:bg-[#FAF7F2] transition-colors group cursor-default">
                          <div className="text-left text-base text-text-main font-normal truncate pr-2">{row.receipt_no}</div>
                          <div className="text-center text-sm text-text-main/70 font-normal">
                            {safeFormatTime(row.issued_at, { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="text-right text-base font-normal text-amber-900 group-hover:text-amber-950 transition-colors pr-1">
                            {Number(row.token_count || 0).toLocaleString()}
                          </div>
                        </div>
                    )}
                    </div>
                  </div> :
  
                <div className="flex items-center justify-center h-full text-text-main/60 text-base font-normal tracking-wide">
                    No tokens today
                  </div>
                }
              </div>
            </CardContent>
          </Card>
        )}

        {/* 2. Low Stock (Critical Low Stock Section) */}
        {canReadItems && (
          <Card className="border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col bg-white min-h-[360px]">
            <CardHeader className="bg-white border-b border-gray-100 px-5 py-3 h-[74px] flex flex-row items-center justify-between text-left">
              <CardTitle className="text-lg font-normal text-[#D05E2D] tracking-wide font-temple">Low Stock</CardTitle>
              {canReadItems && (
                <Button
                  onClick={() => navigate('/items/rawitem')}
                  variant="outline"
                  className="text-[12px] bg-white text-primary font-normal tracking-wider border border-primary/60 hover:bg-primary hover:text-white hover:border-primary px-3 h-8 rounded shadow-md transition-all active:scale-95 leading-none">
                  Inventory
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              <div className="h-[286px] overflow-y-auto divide-y divide-gray-50">
                {lowStock && lowStock.length > 0 ?
                lowStock.map((item, idx) => {
                  const percent = Math.min(100, Number(item.current_stock) / Number(item.min_stock_level || 1) * 100);
                  return (
                    <div
                      key={idx}
                      className={cn(
                        "px-8 py-4 hover:bg-[#FAF7F2] transition-colors group text-left",
                        canReadItems ? "cursor-pointer" : "cursor-default"
                      )}
                      onClick={() => canReadItems && navigate('/items/rawitem')}
                    >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-base font-normal text-text-main group-hover:text-red-900 transition-colors">{item.item_name}</span>
                          <span className="text-sm font-normal text-red-700 tracking-wide">
                            {Number(item.current_stock).toFixed(2)} left
                          </span>
                        </div>
                        <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                          <div
                          className={cn("h-full transition-all duration-1000", percent < 30 ? "bg-red-700" : "bg-amber-600")}
                          style={{ width: `${percent}%` }} />
                        
                        </div>
                      </div>);
  
                }) :
  
                <div className="flex items-center justify-center h-full text-text-main/60 text-base font-normal tracking-wide">
                    No low stock today
                  </div>
                }
              </div>
            </CardContent>
          </Card>
        )}

        {/* 3. Usage Items List */}
        {canReadUsage && (
          <Card className="border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col bg-white min-h-[360px]">
            <CardHeader className="bg-white border-b border-gray-100 px-5 py-3 h-[74px] flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-normal text-[#D05E2D] tracking-wide font-temple">Usage Items</CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              <div className="h-[286px] overflow-y-auto">
                <div className="divide-y divide-gray-50 h-full">
                  {today?.consumption_details?.length > 0 ?
                  today.consumption_details.map((item, idx) =>
                  <div key={idx} className="flex items-center justify-between gap-4 px-6 py-3 hover:bg-[#FAF7F2] transition-colors group cursor-default text-left">
                        <div className="flex-1 min-w-0">
                          <div className="text-base font-normal text-text-main group-hover:text-primary transition-colors truncate leading-tight" title={item.item_name}>
                            {item.item_name}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                          <div className="text-sm font-normal text-text-main/80 whitespace-nowrap">
                            <QtyDisplay qty={item.quantity} unit={{ unit_name: item.unit_name }} />
                          </div>
                          <div className="text-base font-normal text-[#8B1E1E]">
                            {formatCurrency(item.amount)}
                          </div>
                        </div>
                      </div>
                  ) :
  
                  <div className="flex items-center justify-center h-full text-text-main/60 text-base font-normal tracking-wide">
                      No usage today
                    </div>
                  }
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 4. Purchase Items List */}
        {canReadPurchases && (
          <Card className="border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col bg-white min-h-[360px]">
            <CardHeader className="bg-white border-b border-gray-100 px-5 py-3 h-[74px] flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-normal text-[#D05E2D] tracking-wide font-temple">Purchase Items</CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              <div className="h-[286px] overflow-y-auto">
                <div className="divide-y divide-gray-50 h-full">
                  {today?.purchase_details?.length > 0 ?
                  today.purchase_details.map((item, idx) =>
                  <div key={idx} className="flex items-center justify-between gap-4 px-6 py-3 hover:bg-[#FAF7F2] transition-colors group cursor-default text-left">
                        <div className="flex-1 min-w-0">
                          <div className="text-base font-normal text-text-main group-hover:text-[#8B1E1E] transition-colors truncate leading-tight" title={item.item_name}>
                            {item.item_name}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                          <div className="text-sm font-normal text-text-main/80 whitespace-nowrap">
                            <QtyDisplay qty={item.quantity} unit={{ unit_name: item.unit_name }} />
                          </div>
                          <div className="text-base font-normal text-[#8B1E1E]">
                            {formatCurrency(item.amount)}
                          </div>
                        </div>
                      </div>
                  ) :
  
                  <div className="flex items-center justify-center h-full text-text-main/60 text-base font-normal tracking-wide">
                      No purchases today
                    </div>
                  }
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 5. Wastage Items List */}
        {canReadWastages && (
          <Card className="border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col bg-white min-h-[360px]">
            <CardHeader className="bg-white border-b border-gray-100 px-5 py-3 h-[74px] flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-normal text-[#D05E2D] tracking-wide font-temple">Wastage Items</CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              <div className="h-[286px] overflow-y-auto">
                <div className="divide-y divide-gray-50 h-full">
                  {today?.wastage_details?.length > 0 ?
                  today.wastage_details.map((item, idx) =>
                  <div key={idx} className="flex items-center justify-between gap-4 px-6 py-3 hover:bg-[#FAF7F2] transition-colors group cursor-default text-left">
                        <div className="flex-1 min-w-0">
                          <div className="text-base font-normal text-text-main group-hover:text-[#4A3728] transition-colors truncate leading-tight" title={item.menu_item_name}>
                            {item.menu_item_name}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                          <div className="text-sm font-normal text-text-main/80 whitespace-nowrap">
                            <QtyDisplay qty={item.quantity} unit={{ unit_name: item.unit_name }} />
                          </div>
                          <div className="text-base font-normal text-[#8B1E1E]">
                            {formatCurrency(item.amount)}
                          </div>
                        </div>
                      </div>
                  ) :
  
                  <div className="flex items-center justify-center h-full text-text-main/60 text-base font-normal tracking-wide">
                      No wastage today
                    </div>
                  }
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 6. Top 5 Menu Wastage (Weekly) */}
        {canReadWastages && (
          <Card className="border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 bg-white overflow-hidden min-h-[360px]">
            <CardHeader className="bg-white border-b border-gray-100 px-5 py-3 h-[74px] flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-normal text-[#D05E2D] tracking-wide font-temple">Top 5 Menu Wastage (Weekly)</CardTitle>
              {canReadWastages && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/wastages')}
                  className="text-[12px] bg-white text-primary font-normal tracking-wider border border-primary/60 hover:bg-primary hover:text-white hover:border-primary px-3 h-8 rounded shadow-md transition-all active:scale-95 leading-none">
                  Details
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0 h-[286px] overflow-y-auto">
              {weeklyTopWastage.length > 0 ?
              <div>
                  <div className="divide-y divide-gray-50">
                    {weeklyTopWastage.map((row, idx) =>
                  <div key={`${row.menu_item_name}-${idx}`} className="px-6 py-3 hover:bg-[#FAF7F2] transition-colors">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="text-base text-text-main font-normal truncate leading-tight" title={row.menu_item_name}>
                              {row.menu_item_name}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                            <div className="text-sm text-text-main/70 font-normal whitespace-nowrap">
                              <QtyDisplay qty={row.quantity} digits={3} unit={{ unit_name: row.unit_name }} />
                            </div>
                            <div className="text-base font-normal text-[#8B1E1E]">
                              {formatCurrency(row.amount)}
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-[#8B1E1E]/80 transition-all duration-500" style={{ width: `${row.width}%` }} />
                        </div>
                      </div>
                  )}
                  </div>
                </div> :
  
              <div className="py-20 text-center text-text-main/60 text-base font-normal tracking-wide">
                  No weekly wastage data
                </div>
              }
            </CardContent>
          </Card>
        )}
      </div>
    </div>);

};

export default DashboardPage;

