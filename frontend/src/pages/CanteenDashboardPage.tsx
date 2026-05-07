import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: async () => (await api.get('/dashboard/overview')).data,
  });

  const { data: today, isLoading: todayLoading } = useQuery({
    queryKey: ['dashboard-today'],
    queryFn: async () => (await api.get('/dashboard/today')).data,
  });

  const { data: lowStock, isLoading: lowStockLoading } = useQuery({
    queryKey: ['dashboard-low-stock'],
    queryFn: async () => (await api.get('/dashboard/low-stock')).data,
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery({
    queryKey: ['dashboard-recent-activity'],
    queryFn: async () => (await api.get('/dashboard/recent-activity')).data,
  });

  if (overviewLoading || todayLoading || lowStockLoading || activitiesLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!overview || !today || !Array.isArray(lowStock) || !Array.isArray(activities)) {
    return (
      <div className="p-8 text-center text-error font-medium">
        Failed to load dashboard data.
      </div>
    );
  }

  const todayCards = [
    { title: "Today's Purchase", value: `\u20B9${inr.format(Number(today.purchase_amount || 0))}`, to: '/purchases' },
    { title: "Today's Consumption", value: today.consumption_entries, to: '/consumptions' },
    { title: 'Wastage', value: today.wastage_entries, to: '/wastages' },
  ];

  const summaryCards = [
    { title: 'Current Stock', value: `\u20B9${inr.format(Number(overview.total_stock_value || 0))}`, to: '/items' },
    { title: 'Financial Balance', value: `\u20B9${inr.format(Number(overview.total_outstanding_balance || 0))}`, to: '/vendors' },
    { title: 'Total Vendors', value: overview.total_vendors, to: '/vendors' },
    { title: 'Total Items', value: overview.total_items, to: '/items' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-text-main">Dashboard Overview</h2>
      </div>

      <section className="space-y-4">
        <h3 className="text-text-main">Today's Metrics</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {todayCards.map((card) => (
            <button
              key={card.title}
              onClick={() => navigate(card.to)}
              className="flex flex-col p-6 border border-border-temple bg-white text-left"
            >
              <span className="text-text-main mb-1">{card.title}</span>
              <span className="text-text-main">{card.value}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-text-main">Overall Summary</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {summaryCards.map((card) => (
            <button
              key={card.title}
              onClick={() => navigate(card.to)}
              className="flex flex-col p-6 border border-border-temple bg-white text-left"
            >
              <span className="text-text-main mb-1">{card.title}</span>
              <span className="text-text-main">{card.value}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Low Stock Alerts */}
        <Card className="flex flex-col border-border-temple">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-bg-temple">
            <div className="space-y-1">
              <CardTitle className="text-text-main">Low Stock Alerts</CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-text-main">
                  {lowStock.length} items below threshold
                </span>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/items')} className="text-text-main">
              View items
            </Button>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="space-y-3 mt-4">
              {lowStock.length > 0 ? (
                lowStock.map((item: any) => (
                  <div 
                    key={item.item_id}
                    className="flex items-center justify-between p-3 border border-border-temple"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-text-main">{item.item_name}</span>
                      <div className="flex items-center gap-2">
                         <span className="text-text-main">Current: {item.current_stock}</span>
                         <span className="text-text-main">Min: {item.min_stock_level}</span>
                      </div>
                    </div>
                    <span className="text-text-main">Low</span>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-text-main">
                  <p>No low stock items. All good!</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="flex flex-col border-border-temple">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-bg-temple">
            <div className="space-y-1">
              <CardTitle className="text-text-main">Recent System Activity</CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-text-main">
                  {activities.length} recent events
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
             <div className="space-y-3 mt-4">
              {activities.length > 0 ? (
                activities.map((act: any, idx: number) => (
                  <div 
                    key={idx}
                    className="flex items-start gap-4 p-3 border border-transparent"
                  >
                    <div className="w-2 h-2 mt-1.5 rounded-full flex-shrink-0 bg-text-main" />
                    <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                      <span className="text-text-main truncate">{act.title}</span>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-text-main truncate">{act.description}</span>
                        <span className="text-text-main whitespace-nowrap">
                          {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    {act.amount && (
                      <span className="text-text-main whitespace-nowrap">
                        {act.activity_type === 'payment' ? '-' : '+'}\u20B9{inr.format(Number(act.amount))}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-text-main">
                  <p>No recent activities logged today.</p>
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


