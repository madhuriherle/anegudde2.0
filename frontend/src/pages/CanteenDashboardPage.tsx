import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { formatCurrency } from '../utils/currency';
import { cn } from '../utils/cn';

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();

  // 1. Fetch Today Summary
  const { data: today, isLoading: todayLoading } = useQuery({
    queryKey: ['dashboard-today'],
    queryFn: async () => (await api.get('/dashboard/get_today_summary')).data,
  });

  // 2. Fetch Low Stock
  const { data: lowStock, isLoading: lowStockLoading } = useQuery({
    queryKey: ['dashboard-low-stock'],
    queryFn: async () => (await api.get('/dashboard/get_low_stock')).data,
  });

  // 3. Fetch Weekly Top Menu Wastage
  const { data: weeklyWastage, isLoading: weeklyWastageLoading } = useQuery({
    queryKey: ['dashboard-weekly-menu-wastage'],
    queryFn: async () => (await api.get('/dashboard/get_weekly_menu_wastage')).data,
  });

  const weeklyTopWastage = useMemo(() => {
    if (!weeklyWastage || !Array.isArray(weeklyWastage)) return [];
    const maxAmount = Math.max(...weeklyWastage.map((row: any) => Number(row.amount || 0)), 0);
    return weeklyWastage.map((row: any) => ({
      ...row,
      quantity: Number(row.quantity || 0),
      amount: Number(row.amount || 0),
      width: maxAmount > 0 ? (Number(row.amount || 0) / maxAmount) * 100 : 0,
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
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10 max-w-[1600px] mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
        <div>
          <h1 className="text-xl font-bold text-text-main tracking-tight font-temple uppercase text-left">Canteen Dashboard</h1>
        </div>
      </div>

      {/* 3x2 Grid Layout */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 text-left">
        
        {/* 1. Total Tokens (Token Issuance Activity) */}
        <Card className="border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col bg-white text-left min-h-[400px]">
          <CardHeader className="bg-white border-b border-gray-100 px-6 py-3.5 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-extrabold text-[#D05E2D] uppercase tracking-wider text-left">Total Tokens</CardTitle>
            <div className="text-right">
                <div 
                  className="text-amber-700 tracking-tight leading-none"
                  style={{ 
                    fontSize: '34px', 
                    fontWeight: '800',
                    display: 'block',
                  }}
                >
                  {Number(today?.tokens_issued || 0).toLocaleString()}
                </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
             <div className="h-[340px] overflow-y-auto">
              {today?.token_details?.length > 0 ? (
                <div>
                  <div className="grid grid-cols-12 px-8 py-2.5 border-b border-gray-100 bg-gray-50/70 text-[11px] uppercase tracking-wider text-text-main/80 font-bold">
                    <div className="col-span-4">Receipt No</div>
                    <div className="col-span-4 text-center">Time</div>
                    <div className="col-span-4 text-right">Token</div>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {today.token_details.slice(0, 20).map((row: any, idx: number) => (
                      <div key={idx} className="grid grid-cols-12 items-center px-8 py-3.5 hover:bg-[#FAF7F2] transition-colors group cursor-default">
                        <div className="col-span-4 text-[13px] text-text-main font-bold">{row.receipt_no}</div>
                        <div className="col-span-4 text-center text-[11px] text-text-main/70 font-bold">
                          {new Date(row.issued_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="col-span-4 text-right text-sm font-black text-amber-900 group-hover:text-amber-950 transition-colors">
                          {Number(row.token_count || 0).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-text-main/60 p-20 text-center text-[11px] font-bold uppercase tracking-widest">
                  No tokens distributed yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 2. Low Stock (Critical Low Stock Section) */}
        <Card className="border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col bg-white min-h-[400px]">
          <CardHeader className="bg-white border-b border-gray-100 px-6 py-3.5 flex flex-row items-center justify-between text-left">
            <CardTitle className="text-sm font-extrabold text-[#D05E2D] uppercase tracking-wider">Low Stock</CardTitle>
            <Button 
              onClick={() => navigate('/items')}
              variant="ghost"
              className="text-[9px] text-text-main font-bold uppercase tracking-widest border border-gray-200 hover:bg-gray-50 px-2.5 h-6 rounded-lg"
            >
              Inventory
            </Button>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <div className="h-[340px] overflow-y-auto divide-y divide-gray-50">
              {lowStock && lowStock.length > 0 ? (
                lowStock.map((item: any, idx: number) => {
                  const percent = Math.min(100, (Number(item.current_stock) / Number(item.min_stock_level || 1)) * 100);
                  return (
                    <div key={idx} className="px-8 py-4 hover:bg-[#FAF7F2] transition-colors group cursor-pointer text-left" onClick={() => navigate('/items')}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[13px] font-bold text-text-main group-hover:text-red-900 transition-colors">{item.item_name}</span>
                        <span className="text-[12px] font-black text-red-700 uppercase tracking-wider">
                          {Number(item.current_stock).toFixed(2)} left
                        </span>
                      </div>
                      <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className={cn("h-full transition-all duration-1000", percent < 30 ? "bg-red-700" : "bg-amber-600")} 
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-text-main/60 p-10 text-center gap-3 font-bold uppercase tracking-widest text-[11px]">
                  <p>No Low Stock Items</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 3. Usage Items List */}
        <Card className="border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col bg-white min-h-[400px]">
          <CardHeader className="bg-white border-b border-gray-100 px-6 py-4 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-extrabold text-[#D05E2D] uppercase tracking-wider">Usage Items</CardTitle>
             <div className="text-right">
                <p className="text-base font-black text-[#D05E2D] tracking-tight">{formatCurrency(today?.consumption_value || 0)}</p>
                <span className="text-[10px] text-text-main/60 font-bold uppercase tracking-normal">Consumed Value</span>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <div className="h-[340px] overflow-y-auto">
              <div className="divide-y divide-gray-50">
                {today?.consumption_details?.length > 0 ? (
                  today.consumption_details.map((item: any, idx: number) => (
                    <div key={idx} className="grid grid-cols-12 items-center px-6 py-3.5 hover:bg-[#FAF7F2] transition-colors group cursor-default">
                      <div className="col-span-5 text-left text-[13px] font-bold text-text-main group-hover:text-[#B8860B] transition-colors pr-2 break-words leading-5">
                        {item.item_name}
                      </div>
                      <div className="col-span-4 text-center text-[11px] font-bold text-text-main/80 group-hover:text-text-main/70 transition-colors uppercase whitespace-nowrap">
                        {Number(item.quantity).toLocaleString()} {item.unit_name}
                      </div>
                      <div className="col-span-3 text-right text-[13px] font-bold text-text-main group-hover:text-[#B8860B]/80 transition-colors">
                        {formatCurrency(item.amount)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-20 text-center text-text-main/60 text-[11px] font-bold uppercase tracking-widest">No usage today</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4. Purchase Items List */}
        <Card className="border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col bg-white min-h-[400px]">
          <CardHeader className="bg-white border-b border-gray-100 px-6 py-4 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-extrabold text-[#D05E2D] uppercase tracking-wider">Purchase Items</CardTitle>
            <div className="text-right">
                <p className="text-base font-bold text-[#D05E2D] tracking-tight">{formatCurrency(today?.purchase_amount || 0)}</p>
                <span className="text-[10px] text-text-main/60 font-bold uppercase tracking-normal">Total Value</span>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <div className="h-[340px] overflow-y-auto">
              <div className="divide-y divide-gray-50">
                {today?.purchase_details?.length > 0 ? (
                  today.purchase_details.map((item: any, idx: number) => (
                    <div key={idx} className="grid grid-cols-12 items-center px-6 py-3.5 hover:bg-[#FAF7F2] transition-colors group cursor-default">
                      <div className="col-span-5 text-left text-[13px] font-bold text-text-main group-hover:text-[#8B1E1E] transition-colors pr-2 break-words leading-5">
                        {item.item_name}
                      </div>
                      <div className="col-span-4 text-center text-[11px] font-bold text-text-main/80 group-hover:text-text-main transition-colors uppercase whitespace-nowrap">
                        {Number(item.quantity).toLocaleString()} {item.unit_name}
                      </div>
                      <div className="col-span-3 text-right text-[13px] font-bold text-text-main group-hover:text-[#8B1E1E] transition-colors">
                        {formatCurrency(item.amount)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-20 text-center text-text-main/60 text-[11px] font-bold uppercase tracking-widest">No purchases today</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 5. Wastage Items List */}
        <Card className="border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col bg-white min-h-[400px]">
          <CardHeader className="bg-white border-b border-gray-100 px-6 py-4 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-extrabold text-[#D05E2D] uppercase tracking-wider">Wastage Items</CardTitle>
             <div className="text-right">
                <p className="text-base font-bold text-[#D05E2D] tracking-tight">{formatCurrency(today?.wastage_value || 0)}</p>
                <span className="text-[10px] text-text-main/60 font-bold uppercase tracking-normal">Estimated Loss</span>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <div className="h-[340px] overflow-y-auto">
              <div className="divide-y divide-gray-50">
                {today?.wastage_details?.length > 0 ? (
                  today.wastage_details.map((item: any, idx: number) => (
                    <div key={idx} className="grid grid-cols-12 items-center px-6 py-3.5 hover:bg-[#FAF7F2] transition-colors group cursor-default">
                      <div className="col-span-5 text-left text-[13px] font-bold text-text-main group-hover:text-[#4A3728] transition-colors pr-2 break-words leading-5">
                        {item.menu_item_name}
                      </div>
                      <div className="col-span-4 text-center text-[11px] font-bold text-text-main/80 group-hover:text-text-main transition-colors uppercase whitespace-nowrap">
                        {Number(item.quantity).toLocaleString()} {item.unit_name}
                      </div>
                      <div className="col-span-3 text-right text-[13px] font-bold text-text-main group-hover:text-[#4A3728]/80 transition-colors">
                        {formatCurrency(item.amount)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-20 text-center text-text-main/60 text-[11px] font-bold uppercase tracking-widest">No wastage today</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 6. Top 5 Menu Wastage (Weekly) */}
        <Card className="border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 bg-white overflow-hidden min-h-[400px]">
          <CardHeader className="flex flex-row items-center justify-between border-b border-gray-100 px-6 py-3.5">
            <CardTitle className="text-sm font-extrabold text-[#D05E2D] uppercase tracking-wider">Top 5 Menu Wastage (Weekly)</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/wastages')} className="text-[9px] text-primary font-bold uppercase tracking-widest border border-primary/20 hover:bg-primary/5 px-2.5 h-6 rounded-lg">
              Details
            </Button>
          </CardHeader>
          <CardContent className="p-0 h-[340px] overflow-y-auto">
            {weeklyTopWastage.length > 0 ? (
              <div>
                <div className="grid grid-cols-12 px-6 py-2.5 border-b border-gray-100 bg-gray-50/70 text-[11px] uppercase tracking-wider text-text-main/80 font-bold">
                  <div className="col-span-6">Menu Item</div>
                  <div className="col-span-3 text-right">Qty</div>
                  <div className="col-span-3 text-right">Loss</div>
                </div>
                <div className="divide-y divide-gray-50">
                  {weeklyTopWastage.map((row: any, idx: number) => (
                    <div key={`${row.menu_item_name}-${idx}`} className="px-6 py-3.5 hover:bg-[#FAF7F2] transition-colors">
                      <div className="grid grid-cols-12 items-center gap-2">
                        <div className="col-span-6 text-[13px] text-text-main font-bold break-words leading-5">{row.menu_item_name}</div>
                        <div className="col-span-3 text-right text-[11px] text-text-main/70 font-bold">{row.quantity.toFixed(3)} {row.unit_name}</div>
                        <div className="col-span-3 text-right text-[13px] font-bold text-[#8B1E1E]">{formatCurrency(row.amount)}</div>
                      </div>
                      <div className="mt-1.5 h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#8B1E1E]/80 transition-all duration-500" style={{ width: `${row.width}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-text-main/60 gap-3 border-2 border-dashed border-gray-100 rounded-2xl text-center font-bold uppercase tracking-widest text-[11px]">
                <p>No weekly wastage data</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
