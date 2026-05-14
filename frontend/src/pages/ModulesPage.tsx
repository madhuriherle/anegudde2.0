import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/axios';
import { formatCurrency } from '../utils/currency';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { cn } from '../utils/cn';
import { UtensilsCrossed, TrendingUp, Calendar, Hash } from 'lucide-react';

const ModulesPage: React.FC = () => {
  const { data: canteenStats, isLoading } = useQuery({
    queryKey: ['canteen-summary-stats'],
    queryFn: async () => (await api.get('/dashboard/canteen_summary')).data,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  return (
    <div className="max-w-7xl mx-auto space-y-8 py-6 px-4">
      <div className="text-center space-y-2 mb-6">
        <h1 className="text-2xl font-bold text-secondary font-serif" style={{ fontSize: '24px' }}>Anegudde Inventory Management System (AIMS)</h1>
        <div className="w-20 h-1 bg-primary mx-auto rounded-full shadow-sm"></div>
      </div>

      {/* Token Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          { label: 'Today Tokens', value: canteenStats?.daily_tokens ?? 0, color: 'text-amber-600', icon: Hash, bg: 'bg-amber-50' },
          { label: 'Weekly Tokens', value: canteenStats?.weekly_tokens ?? 0, color: 'text-orange-600', icon: Calendar, bg: 'bg-orange-50' },
          { label: 'Monthly Tokens', value: canteenStats?.monthly_tokens ?? 0, color: 'text-red-600', icon: TrendingUp, bg: 'bg-red-50' },
        ].map((stat, i) => (
          <Card key={i} className="border-border-temple/60 shadow-md hover:shadow-lg transition-all duration-300 bg-white">
            <CardContent className="p-5 flex items-center gap-5">
              <div className={cn("p-3 rounded-xl", stat.bg)}>
                <stat.icon className={cn("w-6 h-6", stat.color)} />
              </div>
              <div className="space-y-0.5 text-left">
                <span className="text-[10px] font-black text-text-light uppercase tracking-wider block">{stat.label}</span>
                <div className={cn("font-black font-serif", stat.color)} style={{ fontSize: '32px', lineHeight: '1', fontWeight: 800 }}>
                  {isLoading ? '...' : Number(stat.value).toLocaleString()}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Wastage Details Section */}
      <Card className="border-border-temple/60 shadow-lg bg-white overflow-hidden">
        <CardHeader className="bg-[#FAF7F2] border-b border-border-temple/40 py-4 px-6 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-brown-700" />
            <CardTitle className="text-lg font-bold text-secondary font-serif uppercase tracking-wide">Today's Wastage Breakdown</CardTitle>
          </div>
          <div className="text-right">
            <span className="text-[9px] font-bold text-text-light uppercase tracking-widest mb-0.5 block">Total Loss Today</span>
            <div className="font-black text-red-700 font-serif" style={{ fontSize: '20px', lineHeight: '1', fontWeight: 800 }}>
              {isLoading ? '...' : formatCurrency(canteenStats?.wastage_today ?? 0)}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/80 border-b border-border-temple/20 text-[11px] uppercase tracking-widest font-black text-text-light">
                  <th className="px-8 py-4">Menu Item</th>
                  <th className="px-8 py-4 text-center">Quantity Wasted</th>
                  <th className="px-8 py-4 text-right">Approx. Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={3} className="px-8 py-20 text-center text-text-light font-bold animate-pulse uppercase tracking-widest">
                      Loading wastage details...
                    </td>
                  </tr>
                ) : canteenStats?.wastage_items?.length > 0 ? (
                  canteenStats.wastage_items.map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-[#FAF7F2]/50 transition-colors group">
                      <td className="px-8 py-5 text-sm font-bold text-secondary group-hover:text-primary transition-colors font-serif">
                        {item.item_name}
                      </td>
                      <td className="px-8 py-5 text-center text-sm font-black text-text-main">
                        {Number(item.quantity).toFixed(3)} <span className="text-[10px] text-text-light uppercase font-bold">{item.unit_name}</span>
                      </td>
                      <td className="px-8 py-5 text-right text-sm font-black text-red-700/80">
                        {formatCurrency(item.amount)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-8 py-20 text-center text-text-light/60 font-bold uppercase tracking-widest">
                      No wastage recorded today
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ModulesPage;
