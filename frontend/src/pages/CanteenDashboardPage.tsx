import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  ShoppingBag, 
  Utensils, 
  Trash2, 
  Ticket, 
  AlertTriangle, 
  TrendingUp, 
  ArrowRight,
  Package,
  Clock
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import api from '../api/axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { formatCurrency } from '../utils/currency';
import { formatDate } from '../utils/date';
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

  // 3. Fetch Stock Trend (Last 30 days)
  const { data: trendData, isLoading: trendLoading } = useQuery({
    queryKey: ['dashboard-trend'],
    queryFn: async () => (await api.get('/dashboard/get_stock_trend')).data,
  });

  const formattedTrendData = useMemo(() => {
    if (!trendData || !Array.isArray(trendData)) return [];
    return trendData.map(item => ({
      date: formatDate(item.date).split(',')[0], // Simplified date
      value: Number(item.value)
    }));
  }, [trendData]);

  if (todayLoading || lowStockLoading || trendLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="relative">
          <div className="h-16 w-16 rounded-full border-4 border-primary/20 animate-pulse"></div>
          <div className="absolute top-0 left-0 h-16 w-16 rounded-full border-t-4 border-primary animate-spin"></div>
        </div>
        <p className="text-sm font-medium text-text-main/60 animate-pulse">Preparing your insights...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10 max-w-[1600px] mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
        <div>
          <h1 className="text-2xl font-black text-red-600">!!! IF YOU SEE THIS RED TEXT THE UI IS UPDATING !!!</h1>
          <h1 className="text-2xl font-black text-text-main tracking-tight font-temple">Canteen Dashboard</h1>
        </div>
      </div>

      {/* 3x2 Grid Layout */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        
        {/* 1. Purchase Items List */}
        <Card className="border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col bg-white text-left min-h-[420px]">
          <CardHeader className="bg-white border-b border-gray-100 px-5 py-3 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3 text-left">
              <div className="h-8 w-8 rounded-lg bg-[#8B1E1E]/10 flex items-center justify-center text-[#8B1E1E]">
                <ShoppingBag className="h-4 w-4" />
              </div>
              <CardTitle className="text-base font-black text-[#8B1E1E]">Purchase Items</CardTitle>
            </div>
            <div className="text-right">
                <p className="text-[11px] font-black text-[#8B1E1E] uppercase">{formatCurrency(today?.purchase_amount || 0)}</p>
                <p className="text-[8px] text-text-main/30 font-bold uppercase tracking-tighter">Total Value</p>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <div className="h-[350px] overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50/80 text-text-main/60 uppercase text-[9px] font-black tracking-widest sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 border-b border-gray-100">Item</th>
                    <th className="px-4 py-3 border-b border-gray-100 text-right">Qty</th>
                    <th className="px-4 py-3 border-b border-gray-100 text-right">Amt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {today?.purchase_details?.length > 0 ? (
                    today.purchase_details.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-gray-50/50 transition-colors group cursor-default">
                        <td className="px-4 py-3 font-bold text-text-main group-hover:text-[#8B1E1E] transition-colors">{item.item_name}</td>
                        <td className="px-4 py-3 text-right text-text-main/80 font-bold italic">
                          {Number(item.quantity).toLocaleString()} {item.unit_name}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-text-main">
                          {formatCurrency(item.amount)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-6 py-20 text-center text-text-main/30 italic">No purchases recorded today</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* 2. Usage Items List */}
        <Card className="border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col bg-white text-left min-h-[420px]">
          <CardHeader className="bg-white border-b border-gray-100 px-5 py-3 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3 text-left">
              <div className="h-8 w-8 rounded-lg bg-[#B8860B]/10 flex items-center justify-center text-[#B8860B]">
                <Utensils className="h-4 w-4" />
              </div>
              <CardTitle className="text-base font-black text-[#B8860B]">Usage Items</CardTitle>
            </div>
             <div className="text-right">
                <p className="text-[11px] font-black text-[#B8860B] uppercase">{formatCurrency(today?.consumption_value || 0)}</p>
                <p className="text-[8px] text-text-main/30 font-bold uppercase tracking-tighter">Consumed Value</p>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <div className="h-[350px] overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50/80 text-text-main/60 uppercase text-[9px] font-black tracking-widest sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 border-b border-gray-100">Item</th>
                    <th className="px-4 py-3 border-b border-gray-100 text-right">Qty</th>
                    <th className="px-4 py-3 border-b border-gray-100 text-right">Amt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {today?.consumption_details?.length > 0 ? (
                    today.consumption_details.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-gray-50/50 transition-colors group cursor-default">
                        <td className="px-4 py-3 font-bold text-text-main group-hover:text-[#B8860B] transition-colors">{item.item_name}</td>
                        <td className="px-4 py-3 text-right text-text-main/80 font-bold italic">
                          {Number(item.quantity).toLocaleString()} {item.unit_name}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-text-main">
                          {formatCurrency(item.amount)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-6 py-20 text-center text-text-main/30 italic">No usage recorded today</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* 3. Wastage Items List */}
        <Card className="border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col bg-white text-left min-h-[420px]">
          <CardHeader className="bg-white border-b border-gray-100 px-5 py-3 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3 text-left">
              <div className="h-8 w-8 rounded-lg bg-[#4A3728]/10 flex items-center justify-center text-[#4A3728]">
                <Trash2 className="h-4 w-4" />
              </div>
              <CardTitle className="text-base font-black text-[#4A3728]">Wastage Items</CardTitle>
            </div>
             <div className="text-right">
                <p className="text-[11px] font-black text-[#4A3728] uppercase">{formatCurrency(today?.wastage_value || 0)}</p>
                <p className="text-[8px] text-text-main/30 font-bold uppercase tracking-tighter">Estimated Loss</p>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <div className="h-[350px] overflow-y-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50/80 text-text-main/60 uppercase text-[9px] font-black tracking-widest sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 border-b border-gray-100">Dish Name</th>
                    <th className="px-4 py-3 border-b border-gray-100 text-right">Qty</th>
                    <th className="px-4 py-3 border-b border-gray-100 text-right">Amt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {today?.wastage_details?.length > 0 ? (
                    today.wastage_details.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-gray-50/50 transition-colors group cursor-default">
                        <td className="px-4 py-3 font-bold text-text-main group-hover:text-primary transition-colors">{item.menu_item_name}</td>
                        <td className="px-4 py-3 text-right text-text-main/80 font-bold italic">
                          {Number(item.quantity).toLocaleString()} {item.unit_name}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-text-main">
                          {formatCurrency(item.amount)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-6 py-20 text-center text-text-main/30 italic">No wastage recorded today</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* 4. Token Issuance Activity */}
        <Card className="border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col bg-white text-left min-h-[420px]">
          <CardHeader className="bg-white border-b border-gray-100 px-5 py-3 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3 text-left">
              <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                <Ticket className="h-4 w-4" />
              </div>
              <CardTitle className="text-base font-black text-text-main">Latest Tokens</CardTitle>
            </div>
            <div className="text-right">
                <p className="text-[11px] font-black text-amber-600 uppercase">{today?.tokens_issued || 0}</p>
                <p className="text-[8px] text-text-main/30 font-bold uppercase tracking-tighter text-nowrap">Devotees Served</p>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
             <div className="h-[350px] overflow-y-auto text-left">
              {today?.token_details?.length > 0 ? (
                <div className="divide-y divide-gray-50">
                  {today.token_details.slice(0, 20).map((row: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-amber-50 flex items-center justify-center border border-amber-100">
                          <Ticket className="h-3 w-3 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-text-main">#{row.receipt_no}</p>
                          <p className="text-[9px] font-bold text-text-main/40 uppercase flex items-center gap-1">
                            <Clock className="h-2 w-2" />
                            {new Date(row.issued_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-amber-700">
                          {row.token_count}
                        </p>
                        <p className="text-[9px] text-text-main/40 uppercase font-black tracking-widest italic">
                          {row.issued_by?.split(' ')[0] || 'Sys'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-text-main/30 p-20 italic text-center text-xs">
                  No tokens distributed yet today
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 5. Stock Value Trend Chart */}
        <Card className="border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 bg-white overflow-hidden text-left min-h-[420px]">
          <CardHeader className="flex flex-row items-center justify-between border-b border-gray-100 px-5 py-3">
            <div className="flex items-center gap-3 text-left">
               <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-primary" />
               </div>
               <CardTitle className="text-base font-black text-text-main">Stock Trend</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/reports')} className="text-[9px] text-primary font-black uppercase tracking-widest border border-primary/20 hover:bg-primary/5 px-2 h-6">
              Details
            </Button>
          </CardHeader>
          <CardContent className="p-4 h-[350px]">
            {formattedTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={formattedTrendData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B1E1E" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#8B1E1E" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 9, fill: '#6B7280', fontWeight: 700 }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 9, fill: '#6B7280', fontWeight: 700 }}
                    tickFormatter={(value) => `₹${value >= 1000 ? (value/1000).toFixed(0) + 'k' : value}`}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                    formatter={(value: any) => [formatCurrency(Number(value || 0)), "Value"]}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#8B1E1E" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorValue)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-text-main/40 gap-3 border-2 border-dashed border-gray-100 rounded-2xl text-center">
                <TrendingUp className="h-10 w-10 opacity-20" />
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">No trend data</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 6. Critical Low Stock Section */}
        <Card className="border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col bg-white text-left min-h-[420px]">
          <CardHeader className="flex flex-row items-center justify-between border-b border-gray-100 px-5 py-3">
            <div className="flex items-center gap-3 text-left">
               <div className="h-8 w-8 rounded-lg bg-red-50 flex items-center justify-center">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
               </div>
               <CardTitle className="text-base font-black text-red-900">Low Stock</CardTitle>
            </div>
            <Badge variant="error" className="h-5 px-2 text-[9px] font-black uppercase">
              {lowStock?.length || 0} Alerts
            </Badge>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <div className="h-[350px] overflow-y-auto divide-y divide-gray-50">
              {lowStock && lowStock.length > 0 ? (
                lowStock.map((item: any, idx: number) => {
                  const percent = Math.min(100, (Number(item.current_stock) / Number(item.min_stock_level || 1)) * 100);
                  return (
                    <div key={idx} className="p-5 hover:bg-red-50/30 transition-colors group cursor-pointer" onClick={() => navigate('/items')}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-text-main">{item.item_name}</span>
                        <span className="text-[10px] font-black text-red-600 uppercase">
                          {item.current_stock} left
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className={cn("h-full transition-all duration-1000", percent < 30 ? "bg-red-600" : "bg-amber-500")} 
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-text-main/30 p-10 text-center gap-3">
                  <Package className="h-8 w-8 opacity-10" />
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">All levels healthy</p>
                </div>
              )}
            </div>
          </CardContent>
          {lowStock?.length > 0 && (
            <div className="p-3 bg-gray-50/30 border-t border-gray-100">
              <Button variant="outline" size="sm" className="w-full text-[9px] font-black uppercase tracking-widest border-gray-200 text-text-main hover:bg-white h-7" onClick={() => navigate('/items')}>
                Inventory
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
