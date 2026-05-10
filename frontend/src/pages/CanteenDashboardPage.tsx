import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight,
  ChevronRight
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
        <p className="text-sm font-black text-text-main/60 uppercase tracking-widest animate-pulse">Preparing insights...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10 max-w-[1600px] mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
        <div>
          <h1 className="text-2xl font-black text-text-main tracking-tight font-temple uppercase text-left">Canteen Dashboard</h1>
        </div>
      </div>

      {/* 3x2 Grid Layout */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 text-left font-black">
        
        {/* 1. Purchase Items List */}
        <Card className="border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col bg-white min-h-[420px]">
          <CardHeader className="bg-white border-b border-gray-100 px-6 py-5 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-black text-text-main uppercase tracking-wider">Purchase Items</CardTitle>
            <div className="text-right">
                <p className="text-xl font-black text-[#8B1E1E] uppercase tracking-tighter">{formatCurrency(today?.purchase_amount || 0)}</p>
                <p className="text-[10px] text-text-main/40 font-bold uppercase tracking-wider">Total Value</p>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <div className="h-[350px] overflow-y-auto">
              <div className="divide-y divide-gray-50">
                {today?.purchase_details?.length > 0 ? (
                  today.purchase_details.map((item: any, idx: number) => (
                    <div key={idx} className="grid grid-cols-12 items-center px-6 py-4 hover:bg-[#FAF7F2] transition-colors group cursor-default">
                      <div className="col-span-5 text-left text-sm font-black text-text-main group-hover:text-[#8B1E1E] transition-colors truncate pr-2">
                        {item.item_name}
                      </div>
                      <div className="col-span-4 text-center text-sm font-black text-text-main group-hover:text-text-main transition-colors uppercase whitespace-nowrap">
                        {Number(item.quantity).toLocaleString()} {item.unit_name}
                      </div>
                      <div className="col-span-3 text-right text-sm font-black text-text-main group-hover:text-[#8B1E1E] transition-colors">
                        {formatCurrency(item.amount)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-20 text-center text-text-main/30 italic text-sm font-black uppercase tracking-widest">No purchases today</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. Usage Items List */}
        <Card className="border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col bg-white min-h-[420px]">
          <CardHeader className="bg-white border-b border-gray-100 px-6 py-5 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-black text-text-main uppercase tracking-wider">Usage Items</CardTitle>
             <div className="text-right">
                <p className="text-xl font-black text-[#B8860B] uppercase tracking-tighter">{formatCurrency(today?.consumption_value || 0)}</p>
                <p className="text-[10px] text-text-main/40 font-bold uppercase tracking-wider">Consumed Value</p>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <div className="h-[350px] overflow-y-auto">
              <div className="divide-y divide-gray-50">
                {today?.consumption_details?.length > 0 ? (
                  today.consumption_details.map((item: any, idx: number) => (
                    <div key={idx} className="grid grid-cols-12 items-center px-6 py-4 hover:bg-[#FAF7F2] transition-colors group cursor-default">
                      <div className="col-span-5 text-left text-sm font-black text-text-main group-hover:text-[#B8860B] transition-colors truncate pr-2">
                        {item.item_name}
                      </div>
                      <div className="col-span-4 text-center text-sm font-black text-text-main group-hover:text-text-main transition-colors uppercase whitespace-nowrap">
                        {Number(item.quantity).toLocaleString()} {item.unit_name}
                      </div>
                      <div className="col-span-3 text-right text-sm font-black text-text-main group-hover:text-[#B8860B] transition-colors">
                        {formatCurrency(item.amount)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-20 text-center text-text-main/30 italic text-sm font-black uppercase tracking-widest">No usage today</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Wastage Items List */}
        <Card className="border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col bg-white min-h-[420px]">
          <CardHeader className="bg-white border-b border-gray-100 px-6 py-5 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-black text-text-main uppercase tracking-wider">Wastage Items</CardTitle>
             <div className="text-right">
                <p className="text-xl font-black text-[#4A3728] uppercase tracking-tighter">{formatCurrency(today?.wastage_value || 0)}</p>
                <p className="text-[10px] text-text-main/40 font-bold uppercase tracking-wider">Estimated Loss</p>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <div className="h-[350px] overflow-y-auto">
              <div className="divide-y divide-gray-50">
                {today?.wastage_details?.length > 0 ? (
                  today.wastage_details.map((item: any, idx: number) => (
                    <div key={idx} className="grid grid-cols-12 items-center px-6 py-4 hover:bg-[#FAF7F2] transition-colors group cursor-default">
                      <div className="col-span-5 text-left text-sm font-black text-text-main group-hover:text-[#4A3728] transition-colors truncate pr-2">
                        {item.menu_item_name}
                      </div>
                      <div className="col-span-4 text-center text-sm font-black text-text-main group-hover:text-text-main transition-colors uppercase whitespace-nowrap">
                        {Number(item.quantity).toLocaleString()} {item.unit_name}
                      </div>
                      <div className="col-span-3 text-right text-sm font-black text-text-main group-hover:text-[#4A3728] transition-colors">
                        {formatCurrency(item.amount)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-20 text-center text-text-main/30 italic text-sm font-black uppercase tracking-widest">No wastage today</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4. Token Issuance Activity */}
        <Card className="border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col bg-white text-left min-h-[420px]">
          <CardHeader className="bg-white border-b border-gray-100 px-6 py-4 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-black text-text-main uppercase tracking-wider text-left">Latest Tokens</CardTitle>
            <div className="text-right">
                <p className="text-xl font-black text-amber-600 uppercase tracking-tighter">{Number(today?.tokens_issued || 0).toLocaleString()}</p>
                <p className="text-[10px] text-text-main/40 font-bold uppercase tracking-wider text-nowrap">Devotees Served</p>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
             <div className="h-[350px] overflow-y-auto">
              {today?.token_details?.length > 0 ? (
                <div className="divide-y divide-gray-50">
                  {today.token_details.slice(0, 20).map((row: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between px-8 py-5 hover:bg-[#FAF7F2] transition-colors group cursor-default">
                      <div className="text-left">
                        <p className="text-sm font-black text-text-main group-hover:text-primary transition-colors">{row.receipt_no}</p>
                        <p className="text-[10px] font-black text-text-main/30 uppercase mt-0.5">
                          {new Date(row.issued_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-black text-amber-700 group-hover:text-amber-900 transition-colors">
                          {Number(row.token_count || 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-text-main/30 p-20 italic text-center text-sm font-black uppercase tracking-widest">
                  No tokens distributed yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 5. Stock Value Trend Chart */}
        <Card className="border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 bg-white overflow-hidden min-h-[420px]">
          <CardHeader className="flex flex-row items-center justify-between border-b border-gray-100 px-6 py-4">
            <CardTitle className="text-base font-black text-text-main uppercase tracking-wider">Stock Trend</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/reports')} className="text-[10px] text-primary font-black uppercase tracking-widest border border-primary/20 hover:bg-primary/5 px-3 h-7 rounded-lg">
              Details
            </Button>
          </CardHeader>
          <CardContent className="p-6 h-[350px]">
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
                    tick={{ fontSize: 9, fill: '#6B7280', fontWeight: 900 }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 9, fill: '#6B7280', fontWeight: 900 }}
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
              <div className="h-full flex flex-col items-center justify-center text-text-main/40 gap-3 border-2 border-dashed border-gray-100 rounded-2xl text-center font-black uppercase tracking-widest text-[10px]">
                <p>No trend data</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 6. Critical Low Stock Section */}
        <Card className="border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col bg-white min-h-[420px]">
          <CardHeader className="bg-white border-b border-gray-100 px-6 py-4 flex flex-row items-center justify-between text-left">
            <CardTitle className="text-base font-black text-text-main uppercase tracking-wider">Low Stock</CardTitle>
            <Button 
              onClick={() => navigate('/items')}
              variant="ghost"
              className="text-[9px] text-text-main font-black uppercase tracking-widest border border-gray-200 hover:bg-gray-50 px-3 h-7 rounded-lg"
            >
              Inventory
            </Button>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <div className="h-[350px] overflow-y-auto divide-y divide-gray-50">
              {lowStock && lowStock.length > 0 ? (
                lowStock.map((item: any, idx: number) => {
                  const percent = Math.min(100, (Number(item.current_stock) / Number(item.min_stock_level || 1)) * 100);
                  return (
                    <div key={idx} className="px-8 py-5 hover:bg-[#FAF7F2] transition-colors group cursor-pointer text-left" onClick={() => navigate('/items')}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-black text-text-main group-hover:text-red-700 transition-colors">{item.item_name}</span>
                        <span className="text-sm font-black text-red-600 uppercase tracking-wider">
                          {Number(item.current_stock).toFixed(2)} left
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
                <div className="flex flex-col items-center justify-center h-full text-text-main/30 p-10 text-center gap-3 font-black uppercase tracking-widest text-[10px]">
                  <p>All healthy</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
