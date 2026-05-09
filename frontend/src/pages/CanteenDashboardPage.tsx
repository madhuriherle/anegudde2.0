import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { Card, CardContent } from '../components/ui/Card';
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

  const summaryCardClass =
    'min-h-[150px] border-amber-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-amber-300 hover:shadow-md';

  const detailCardClass =
    'flex h-[360px] flex-col overflow-hidden border-amber-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-amber-300 hover:shadow-md';

  const SectionTitle = ({
    title,
    actionLabel,
    onClick,
  }: {
    title: string;
    actionLabel: string;
    onClick: () => void;
  }) => (
    <div className="flex items-center justify-between gap-3 border-b border-amber-100 px-4 py-3">
      <h3 className="text-sm font-semibold text-[#4B2E13]">{title}</h3>

      <Button
        variant="ghost"
        size="sm"
        onClick={onClick}
        className="h-7 px-3 text-xs font-medium text-[#8A5A12] hover:bg-amber-50"
      >
        {actionLabel}
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="page-title">Canteen Dashboard</h2>
      </div>

      {/* Top Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className={summaryCardClass}>
          <CardContent className="p-6">
            <p className="text-base font-bold text-[#7A5A2A]">Today's Purchase</p>
            <p className="mt-3 text-4xl font-extrabold text-[#3B2A16]">
              {formatCurrency(today.purchase_amount)}
            </p>
          </CardContent>
        </Card>

        <Card className={summaryCardClass}>
          <CardContent className="p-6">
            <p className="text-base font-bold text-[#7A5A2A]">Usage Entries</p>
            <p className="mt-3 text-4xl font-extrabold text-[#3B2A16]">
              {today.consumption_entries}
            </p>
          </CardContent>
        </Card>

        <Card className={summaryCardClass}>
          <CardContent className="p-6">
            <p className="text-base font-bold text-[#7A5A2A]">Wastage Entries</p>
            <p className="mt-3 text-4xl font-extrabold text-[#8B1E1E]">
              {today.wastage_entries}
            </p>
          </CardContent>
        </Card>

        <Card className={summaryCardClass}>
          <CardContent className="p-6">
            <p className="text-base font-bold text-[#7A5A2A]">Tokens Issued</p>
            <p className="mt-3 text-4xl font-extrabold text-[#3B2A16]">
              {today.tokens_issued}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detail Cards */}
      <div className="grid gap-5 xl:grid-cols-2">
        {/* Purchase Details */}
        <Card className={detailCardClass}>
          <SectionTitle
            title="Today's Purchase Details"
            actionLabel="View All"
            onClick={() => navigate('/purchases')}
          />

          <CardContent className="flex-1 p-0 overflow-hidden">
            <div className="h-full overflow-y-auto">
              {today.purchase_details.length > 0 ? (
                <div className="divide-y divide-amber-50">
                  {today.purchase_details.map((item: any, idx: number) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-amber-50/60"
                    >
                      <div className="col-span-6 min-w-0">
                        <p className="truncate font-medium text-[#3B2A16]">
                          {item.item_name}
                        </p>
                      </div>

                      <div className="col-span-3 text-right text-xs text-[#6B5A45]">
                        {Number(item.quantity).toLocaleString()} {item.unit_name}
                      </div>

                      <div className="col-span-3 text-right text-sm font-semibold text-[#8A5A12]">
                        {formatCurrency(item.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-8 text-center text-sm text-[#9A8A75]">
                  No purchases today
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Usage Details */}
        <Card className={detailCardClass}>
          <SectionTitle
            title="Today's Usage Details"
            actionLabel="View All"
            onClick={() => navigate('/daily-usage')}
          />

          <CardContent className="flex-1 p-0 overflow-hidden">
            <div className="h-full overflow-y-auto">
              {today.consumption_details.length > 0 ? (
                <div className="divide-y divide-amber-50">
                  {today.consumption_details.map((item: any, idx: number) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-amber-50/60"
                    >
                      <div className="col-span-6 min-w-0">
                        <p className="truncate font-medium text-[#3B2A16]">
                          {item.item_name}
                        </p>
                      </div>

                      <div className="col-span-3 text-right text-xs text-[#6B5A45]">
                        {Number(item.quantity).toLocaleString()} {item.unit_name}
                      </div>

                      <div className="col-span-3 text-right text-sm font-semibold text-[#8A5A12]">
                        {formatCurrency(item.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-8 text-center text-sm text-[#9A8A75]">
                  No usage today
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Wastage Details */}
        <Card className={detailCardClass}>
          <SectionTitle
            title="Today's Wastage Details"
            actionLabel="View All"
            onClick={() => navigate('/wastages')}
          />

          <CardContent className="flex-1 p-0 overflow-hidden">
            <div className="h-full overflow-y-auto">
              {today.wastage_details.length > 0 ? (
                <div className="divide-y divide-amber-50">
                  {today.wastage_details.map((item: any, idx: number) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-red-50/50"
                    >
                      <div className="col-span-6 min-w-0">
                        <p className="truncate font-medium text-[#3B2A16]">
                          {item.menu_item_name}
                        </p>
                      </div>

                      <div className="col-span-3 text-right text-xs text-[#6B5A45]">
                        {Number(item.quantity).toLocaleString()} {item.unit_name}
                      </div>

                      <div className="col-span-3 text-right text-sm font-semibold text-[#8B1E1E]">
                        {item.amount !== undefined && item.amount !== null
                          ? formatCurrency(item.amount)
                          : '-'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-8 text-center text-sm text-[#9A8A75]">
                  No wastage today
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Token Details */}
        <Card className={detailCardClass}>
          <SectionTitle
            title="Today's Token Details"
            actionLabel="View History"
            onClick={() => navigate('/reports/tokens')}
          />

          <CardContent className="flex-1 p-0 overflow-hidden">
            <div className="h-full overflow-y-auto">
              {today.token_details?.length > 0 ? (
                <div className="divide-y divide-amber-50">
                  {today.token_details.map((row: any, idx: number) => (
                    <div
                      key={`${row.receipt_no}-${idx}`}
                      className="grid grid-cols-12 items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-amber-50/60"
                    >
                      <div className="col-span-6 min-w-0">
                        <p className="truncate font-medium text-[#3B2A16]">
                          Receipt #{row.receipt_no}
                        </p>
                      </div>

                      <div className="col-span-3 text-right text-xs text-[#6B5A45]">
                        {Number(row.token_count || 0).toLocaleString()} Qty
                      </div>

                      <div className="col-span-3 text-right text-sm font-semibold text-[#8A5A12]">
                        {row.amount !== undefined && row.amount !== null
                          ? formatCurrency(row.amount)
                          : '-'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-8 text-center text-sm text-[#9A8A75]">
                  No tokens issued today
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Alerts */}
      {lowStock.length > 0 && (
        <section className="rounded-xl border border-red-100 bg-white p-4 shadow-sm transition-all duration-300 hover:shadow-md">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[#4B2E13]">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Low Stock Alerts
            </h3>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/items')}
              className="h-7 px-3 text-xs font-medium text-[#8A5A12] hover:bg-amber-50"
            >
              View Inventory
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {lowStock.slice(0, 4).map((item: any) => (
              <div
                key={item.item_id}
                className="flex items-center justify-between gap-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm"
              >
                <span className="truncate text-xs font-medium text-red-900">
                  {item.item_name}
                </span>

                <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                  {item.current_stock} left
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default DashboardPage;
