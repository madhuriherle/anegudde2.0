import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/axios';
import { formatCurrency } from '../utils/currency';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { cn } from '../utils/cn';
import { UtensilsCrossed, TrendingUp, Calendar, Hash, Loader2, Heart } from 'lucide-react';

const ModulesPage = () => {
  const { data: canteenStats, isLoading } = useQuery({
    queryKey: ['canteen-summary-stats'],
    queryFn: async () => (await api.get('/dashboard/get_canteen_summary')).data,
    refetchInterval: 30000
  });

  return (
    <div className="max-w-7xl mx-auto space-y-10 py-8 px-4 sm:px-6 lg:px-8">
      {/* Header Section */}
      <div className="relative text-center pb-8 border-b border-border-temple/20">
        <h1 className="text-2xl font-black text-[#3E2723] font-temple uppercase tracking-wider mb-2">
          Anegudde Inventory Management System
        </h1>
        <div className="flex items-center justify-center gap-4">
          <div className="h-[1px] w-24 bg-gradient-to-r from-transparent to-primary/40"></div>
          <span className="text-xs font-black text-primary uppercase tracking-[0.3em]">Dashboard Overview</span>
          <div className="h-[1px] w-24 bg-gradient-to-l from-transparent to-primary/40"></div>
        </div>
      </div>

      {/* Token Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
        {[
        {
          label: 'Today Tokens',
          value: canteenStats?.daily_tokens ?? 0,
          color: 'from-amber-500 to-amber-600',
          icon: Hash,
          bg: 'bg-amber-50/50',
          borderColor: 'border-amber-100'
        },
        {
          label: 'Weekly Tokens',
          value: canteenStats?.weekly_tokens ?? 0,
          color: 'from-orange-500 to-orange-600',
          icon: Calendar,
          bg: 'bg-orange-50/50',
          borderColor: 'border-orange-100'
        },
        {
          label: 'Monthly Tokens',
          value: canteenStats?.monthly_tokens ?? 0,
          color: 'from-orange-700 to-orange-800',
          icon: TrendingUp,
          bg: 'bg-orange-50/50',
          borderColor: 'border-orange-200'
        }].
        map((stat, i) =>
        <div key={i} className={cn(
          "relative group overflow-hidden bg-white p-6 rounded-3xl border border-border-temple/30 shadow-sm transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.12)] hover:-translate-y-2 hover:scale-[1.01]",
          stat.borderColor
        )}>
            <div className="relative flex items-center gap-6">              <div className={cn("p-4 rounded-2xl bg-gradient-to-br shadow-lg shadow-black/5 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3", stat.color)}>
                <stat.icon className="w-8 h-8 text-white" />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-black text-text-light/80 uppercase tracking-widest block">
                  {stat.label}
                </span>
                <div className="text-4xl font-black text-secondary font-temple leading-none">
                  {isLoading ? '...' : Number(stat.value).toLocaleString()}
                </div>
              </div>
            </div>
            
            {/* Subtle Inner Glow */}
            <div className={cn("absolute inset-0 opacity-0 group-hover:opacity-[0.03] transition-opacity duration-500 bg-gradient-to-br pointer-events-none", stat.color)}></div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Donation Summary Section */}
        {/* 
        <div className="lg:col-span-12">
          <Card className="border-border-temple/40 shadow-2xl bg-white rounded-3xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-[#FAF7F2] to-white border-b border-border-temple/20 py-6 px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-100 rounded-2xl">
                  <Heart className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-secondary font-temple tracking-wide">Kind Donations Today</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {(canteenStats?.donation_summary || []).map((summary, idx) =>
                <div key={idx} className="relative p-6 rounded-2xl bg-[#FAF7F2]/50 border border-border-temple/10 hover:border-emerald-200 hover:bg-white transition-all group">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-text-light uppercase tracking-widest">{summary.type_name}</span>
                        <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity">
                          <TrendingUp size={14} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-2xl font-black text-secondary font-temple leading-none">
                          {isLoading ? '...' : formatCurrency(summary.total_value)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        */}

        <div className="lg:col-span-12">
          <Card className="border-border-temple/40 shadow-2xl bg-white rounded-3xl overflow-hidden">
            <CardHeader className="bg-[#FAF7F2]/80 backdrop-blur-sm border-b border-border-temple/20 py-6 px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-2xl">
                  <UtensilsCrossed className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-secondary font-temple tracking-wide">Wastage Analysis</CardTitle>
                </div>
              </div>
              
              <div className="flex items-center gap-4 bg-white/60 p-3 pr-5 rounded-2xl border border-border-temple/10">
                <div className="h-10 w-1 bg-orange-600 rounded-full"></div>
                <div>
                  <span className="text-[10px] font-black text-text-light uppercase tracking-widest block mb-1">Total Daily Loss</span>
                  <div className="text-2xl font-black text-orange-700 font-temple leading-none">
                    {isLoading ? '...' : formatCurrency(canteenStats?.wastage_today ?? 0)}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-bg-temple/20 border-b border-border-temple/10 text-[10px] uppercase tracking-[0.2em] font-black text-text-light/80">
                      <th className="px-10 py-5">Item Information</th>
                      <th className="px-10 py-5 text-center">Volume Recorded</th>
                      <th className="px-10 py-5 text-right">Estimated Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-temple/10">
                    {isLoading ?
                    <tr>
                        <td colSpan={3} className="px-10 py-24 text-center">
                          <div className="flex flex-col items-center gap-4">
                            <Loader2 className="w-10 h-10 animate-spin text-primary" />
                            <span className="text-xs font-black text-text-light animate-pulse uppercase tracking-[0.3em]">Compiling Data...</span>
                          </div>
                        </td>
                      </tr> :
                    canteenStats?.wastage_items?.length > 0 ?
                    canteenStats.wastage_items.map((item, idx) =>
                    <tr key={idx} className="hover:bg-bg-temple/10 transition-all duration-200 group">
                          <td className="px-10 py-6">
                            <div className="flex items-center gap-4">
                              <div className="w-2 h-2 rounded-full bg-primary/40 group-hover:scale-150 transition-transform"></div>
                              <span className="text-base font-bold text-secondary group-hover:text-primary transition-colors">
                                {item.item_name}
                              </span>
                            </div>
                          </td>
                          <td className="px-10 py-6 text-center">
                            <div className="inline-flex items-baseline gap-1.5 px-4 py-1.5 rounded-full bg-gray-50 border border-gray-100 group-hover:border-primary/20 group-hover:bg-white transition-all">
                              <span className="text-base font-black text-secondary">
                                {Number(item.quantity).toFixed(3)}
                              </span>
                              <span className="text-[10px] text-text-light uppercase font-black tracking-wider">
                                {item.unit_name}
                              </span>
                            </div>
                          </td>
                          <td className="px-10 py-6 text-right">
                            <span className="text-base font-black text-red-600 font-temple">
                              {formatCurrency(item.amount)}
                            </span>
                          </td>
                        </tr>
                    ) :

                    <tr>
                        <td colSpan={3} className="px-10 py-32 text-center">
                          <div className="flex flex-col items-center gap-4 opacity-40">
                            <UtensilsCrossed size={64} className="text-text-light" />
                            <p className="text-xs font-black text-text-light uppercase tracking-[0.4em]">Zero Wastage Recorded Today</p>
                          </div>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>);

};

export default ModulesPage;
