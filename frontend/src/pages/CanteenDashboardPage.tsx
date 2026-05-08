import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { formatCurrency } from '../utils/currency';

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();

  const { data: today, isLoading: todayLoading } = useQuery({
    queryKey: ['dashboard-today'],
    queryFn: async () => (await api.get('/dashboard/get_today_summary')).data,
  });

  const { data: lowStock, isLoading: lowStockLoading } = useQuery({
    queryKey: ['dashboard-low-stock'],
    queryFn: async () => (await api.get('/dashboard/get_low_stock')).data,
  });

  if (todayLoading || lowStockLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!today || !Array.isArray(lowStock)) {
    return (
      <div className="p-8 text-center text-error font-medium">
        Failed to load dashboard data.
      </div>
    );
  }

  const todayCards = [
    { title: "Today's Purchase", value: formatCurrency(today.purchase_amount), to: '/purchases' },
    { title: "Today's Consumption", value: today.consumption_entries, to: '/consumptions' },
    { title: "Today's Wastage", value: today.wastage_entries, to: '/wastages' },
    { title: "Tokens Issued Today", value: today.tokens_issued, to: '/tokens' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="page-title">Canteen Dashboard</h2>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Today's Purchase Card */}
        <Card className="group border-border-temple flex flex-col h-full transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-primary/30">
          <CardHeader className="pb-2 border-b border-bg-temple bg-gray-50/50 transition-colors group-hover:bg-primary/5">
            <span className="text-text-main text-sm opacity-70 uppercase font-semibold">Today's Purchase</span>
            <CardTitle className="text-text-main text-2xl font-bold transition-transform duration-300 group-hover:scale-105 origin-left">{formatCurrency(today.purchase_amount)}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden">
            <div className="max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
              {today.purchase_details.length > 0 ? (
                <div className="divide-y divide-border-temple">
                  {today.purchase_details.map((item: any, idx: number) => (
                    <div key={idx} className="p-3 text-xs hover:bg-primary/5 transition-colors cursor-default">
                      <div className="flex justify-between font-medium text-text-main">
                        <span className="truncate mr-2">{item.item_name}</span>
                        <span className="text-primary font-bold">{formatCurrency(item.amount)}</span>
                      </div>
                      <div className="text-text-main opacity-60">
                        {Number(item.quantity).toLocaleString()} {item.unit_name}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-text-main opacity-40 italic text-xs">
                  No purchases today
                </div>
              )}
            </div>
          </CardContent>
          <div className="p-2 border-t border-border-temple bg-gray-50/30 text-center">
             <Button 
                variant="ghost" 
                size="sm" 
                className="w-full text-[10px] h-6 hover:bg-primary hover:text-white transition-all" 
                onClick={() => navigate('/purchases')}
              >
                View All
              </Button>
          </div>
        </Card>

        {/* Today's Consumption Card */}
        <Card className="group border-border-temple flex flex-col h-full transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-secondary/30">
          <CardHeader className="pb-2 border-b border-bg-temple bg-gray-50/50 transition-colors group-hover:bg-secondary/5">
            <span className="text-text-main text-sm opacity-70 uppercase font-semibold">Today's Consumption</span>
            <CardTitle className="text-text-main text-2xl font-bold transition-transform duration-300 group-hover:scale-105 origin-left">{today.consumption_entries}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden">
            <div className="max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
              {today.consumption_details.length > 0 ? (
                <div className="divide-y divide-border-temple">
                  {today.consumption_details.map((item: any, idx: number) => (
                    <div key={idx} className="p-3 text-xs hover:bg-secondary/5 transition-colors cursor-default">
                      <div className="flex justify-between font-medium text-text-main">
                        <span className="truncate mr-2">{item.item_name}</span>
                        <span className="text-secondary font-bold">{formatCurrency(item.amount)}</span>
                      </div>
                      <div className="text-text-main opacity-60">
                        {Number(item.quantity).toLocaleString()} {item.unit_name}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-text-main opacity-40 italic text-xs">
                  No consumption today
                </div>
              )}
            </div>
          </CardContent>
          <div className="p-2 border-t border-border-temple bg-gray-50/30 text-center">
             <Button 
                variant="ghost" 
                size="sm" 
                className="w-full text-[10px] h-6 hover:bg-secondary hover:text-white transition-all" 
                onClick={() => navigate('/consumptions')}
              >
                View All
              </Button>
          </div>
        </Card>

        {/* Today's Wastage Card */}
        <Card className="group border-border-temple flex flex-col h-full transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-error/30">
          <CardHeader className="pb-2 border-b border-bg-temple bg-gray-50/50 transition-colors group-hover:bg-error/5">
            <span className="text-text-main text-sm opacity-70 uppercase font-semibold">Today's Wastage</span>
            <CardTitle className="text-text-main text-2xl font-bold transition-transform duration-300 group-hover:scale-105 origin-left">{today.wastage_entries}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden">
            <div className="max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
              {today.wastage_details.length > 0 ? (
                <div className="divide-y divide-border-temple">
                  {today.wastage_details.map((item: any, idx: number) => (
                    <div key={idx} className="p-3 text-xs hover:bg-error/5 transition-colors cursor-default">
                      <div className="font-medium text-text-main truncate group-hover:text-error transition-colors">
                        {item.menu_item_name}
                      </div>
                      <div className="text-text-main opacity-60">
                        {Number(item.quantity).toLocaleString()} {item.unit_name}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-text-main opacity-40 italic text-xs">
                  No wastage today
                </div>
              )}
            </div>
          </CardContent>
          <div className="p-2 border-t border-border-temple bg-gray-50/30 text-center">
             <Button 
                variant="ghost" 
                size="sm" 
                className="w-full text-[10px] h-6 hover:bg-error hover:text-white transition-all" 
                onClick={() => navigate('/wastages')}
              >
                View All
              </Button>
          </div>
        </Card>

        {/* Tokens Issued Today Card */}
        <Card className="group border-border-temple flex flex-col h-full transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-primary/30">
          <CardHeader className="pb-2 border-b border-bg-temple bg-gray-50/50 transition-colors group-hover:bg-primary/5">
            <span className="text-text-main text-sm opacity-70 uppercase font-semibold">Tokens Issued</span>
            <CardTitle className="text-text-main text-2xl font-bold transition-transform duration-300 group-hover:scale-105 origin-left">{today.tokens_issued}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex items-center justify-center p-6 bg-white transition-colors group-hover:bg-gray-50/30">
            <div className="text-center space-y-2 transition-transform duration-500 group-hover:scale-110">
              <div className="text-4xl font-bold text-primary opacity-20 group-hover:opacity-40 transition-opacity">#</div>
              <p className="text-xs text-text-main opacity-60">Total tokens generated for today's distribution.</p>
            </div>
          </CardContent>
          <div className="p-2 border-t border-border-temple bg-gray-50/30 text-center">
             <Button 
                variant="ghost" 
                size="sm" 
                className="w-full text-[10px] h-6 hover:bg-primary hover:text-white transition-all" 
                onClick={() => navigate('/tokens')}
              >
                View History
              </Button>
          </div>
        </Card>
      </div>

      {/* Low Stock Alerts - Kept as a smaller footer section */}
      {lowStock.length > 0 && (
        <section className="mt-12">
           <div className="flex items-center justify-between mb-4">
              <h3 className="text-text-main font-semibold flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                 Low Stock Alerts
              </h3>
              <Button variant="link" size="sm" onClick={() => navigate('/items')} className="text-xs text-primary">View Inventory</Button>
           </div>
           <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {lowStock.slice(0, 4).map((item: any) => (
                <div key={item.item_id} className="p-3 bg-red-50 border border-red-100 rounded-lg flex justify-between items-center">
                   <span className="text-xs font-medium text-red-900">{item.item_name}</span>
                   <span className="text-[10px] bg-red-200 text-red-800 px-2 py-0.5 rounded-full font-bold">{item.current_stock} Left</span>
                </div>
              ))}
           </div>
        </section>
      )}
    </div>
  );
};

export default DashboardPage;



