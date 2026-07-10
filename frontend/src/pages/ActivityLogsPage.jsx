import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Search, Filter, Clock, User, Globe, AlertCircle, 
  CheckCircle2, XCircle, Info, Calendar, ChevronDown,
  Activity, ArrowRight, Eye, Plus, Edit3, Trash2, Key, CreditCard, Box, MoreHorizontal
} from 'lucide-react';
import api from '../api/axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Label } from '../components/ui/Label';
import { DataTable } from '../components/ui/DataTable';
import { cn } from '../utils/cn';
import { usePermission } from '../hooks/usePermission';
import { safeFormatDate, safeFormatTime } from '../utils/date';
import { format, startOfToday, endOfToday, startOfYesterday, endOfYesterday, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';

const ActivityLogsPage = () => {
  const { hasPermission } = usePermission();
  const canListUsers = hasPermission('users.management.read');
  const [page, setPage] = useState(1);
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState('');
  const [activityType, setActivityType] = useState('important');
  const [clientType, setClientType] = useState('');
  const [pageSize, setPageSize] = useState(50);
  const [dateRangeType, setDateRangeType] = useState('today'); // 'today', 'yesterday', 'this_week', 'this_month', 'custom'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showNavigation, setShowNavigation] = useState(false);

  // Calculate dates based on range type
  const dates = useMemo(() => {
    const today = new Date();
    switch (dateRangeType) {
      case 'today':
        return { start: format(startOfToday(), 'yyyy-MM-dd'), end: format(endOfToday(), 'yyyy-MM-dd') };
      case 'yesterday':
        return { start: format(startOfYesterday(), 'yyyy-MM-dd'), end: format(endOfYesterday(), 'yyyy-MM-dd') };
      case 'this_week':
        return { start: format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'), end: format(endOfToday(), 'yyyy-MM-dd') };
      case 'this_month':
        return { start: format(startOfMonth(today), 'yyyy-MM-dd'), end: format(endOfToday(), 'yyyy-MM-dd') };
      case 'custom':
        return { start: customStartDate, end: customEndDate };
      default:
        return { start: '', end: '' };
    }
  }, [dateRangeType, customStartDate, customEndDate]);

  const { data: usersData } = useQuery({
    queryKey: ['active-users'],
    queryFn: async () => (await api.get('/users/list_users', { params: { page_size: 100 } })).data,
    enabled: canListUsers,
  });

  const users = usersData?.items || [];

  // Summary counts query
  const { data: summaryData } = useQuery({
    queryKey: ['activity-summary', dates, username],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dates.start) params.append('start_date', dates.start);
      if (dates.end) params.append('end_date', dates.end);
      if (username) params.append('username', username);
      const res = await api.get(`/audit/summary?${params.toString()}`);
      return res.data;
    }
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['activity-logs', page, pageSize, username, status, activityType, clientType, dates, showNavigation],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString(),
      });
      if (username) params.append('username', username);
      if (status) params.append('status', status);
      if (clientType) params.append('client_type', clientType);
      
      // Handle activity type filter
      const finalType = showNavigation ? 'all' : activityType;
      if (finalType) params.append('activity_type', finalType);
      
      if (dates.start) params.append('start_date', dates.start);
      if (dates.end) params.append('end_date', dates.end);
      
      const res = await api.get(`/audit/list_activity_logs?${params.toString()}`);
      return res.data;
    }
  });

  const getActionIcon = (method, endpoint) => {
    if (endpoint.includes('/auth/login')) return <Key className="w-4 h-4 text-amber-500" />;
    if (method === 'POST') return <Plus className="w-4 h-4 text-green-500" />;
    if (method === 'PUT') return <Edit3 className="w-4 h-4 text-blue-500" />;
    if (method === 'DELETE') return <Trash2 className="w-4 h-4 text-red-500" />;
    return <Eye className="w-4 h-4 text-gray-400" />;
  };

  const getActivityModule = (endpoint) => {
    if (!endpoint) return 'System';
    const lowerEndpoint = endpoint.toLowerCase();
    
    if (lowerEndpoint.includes('/donations/')) return 'Donations';
    if (lowerEndpoint.includes('/donation-types/')) return 'Donation Types';
    if (lowerEndpoint.includes('/tokens/')) return 'Tokens';
    if (lowerEndpoint.includes('/purchases/')) return 'Purchases';
    if (lowerEndpoint.includes('/items/')) return 'Items';
    if (lowerEndpoint.includes('/item-categories/')) return 'Item Categories';
    if (lowerEndpoint.includes('/item-types/')) return 'Item Types';
    if (lowerEndpoint.includes('/units/')) return 'Units';
    if (lowerEndpoint.includes('/vendors/')) return 'Vendors';
    if (lowerEndpoint.includes('/users/')) return 'Users';
    if (lowerEndpoint.includes('/daily-usage/')) return 'Stock';
    if (lowerEndpoint.includes('/wastages/')) return 'Stock';
    if (lowerEndpoint.includes('/stock-adjustments/')) return 'Stock';
    if (lowerEndpoint.includes('/menu-items/')) return 'Mahaprasadam';
    if (lowerEndpoint.includes('/dashboard/')) return 'Dashboard';
    if (lowerEndpoint.includes('/reports/')) return 'Reports';
    if (lowerEndpoint.includes('/settings/')) return 'Settings';
    if (lowerEndpoint.includes('/auth/')) return 'Auth';
    if (lowerEndpoint.includes('/audit/')) return 'Audit Logs';
    
    return 'System';
  };

  const getActivityDescription = (log) => {
    const actorName = log.meta?.actor_name || log.username || 'System';
    const method = log.method;
    const endpoint = log.endpoint || '';
    const meta = log.meta || {};
    
    let verb = '';
    if (method === 'POST') verb = 'created';
    else if (method === 'PUT') verb = 'updated';
    else if (method === 'DELETE') verb = 'deleted';
    else if (method === 'GET') verb = 'viewed';
    else verb = method.toLowerCase();

    let sentence = '';

    const cleanPath = (p) => p.replace('/api/', '').split('?')[0].replace(/\/$/, '');

    if (endpoint.includes('/auth/login')) sentence = `logged into the system`;
    else if (endpoint.includes('/auth/logout')) sentence = `logged out of the system`;
    else if (endpoint.includes('/dashboard/')) {
      if (endpoint.includes('canteen_summary')) sentence = `viewed the mahaprasadam performance summary`;
      else if (endpoint.includes('today')) sentence = `viewed today's overall activity summary`;
      else if (endpoint.includes('stock_trend')) sentence = `viewed the stock usage trends`;
      else if (endpoint.includes('low_stock')) sentence = `checked for low stock alerts`;
      else sentence = `viewed the main dashboard`;
    }
    else if (endpoint.includes('/donation-types/')) {
      sentence = `${verb} donation types list`;
    }
    else if (endpoint.includes('/menu-items/')) {
      sentence = `${verb} mahaprasadam menu item: ${meta.dish_name || 'record'}`;
    }
    else if (endpoint.includes('/donations/')) {
      if (endpoint.includes('devotee')) sentence = `${verb} devotee ${meta.devotee_name || 'record'}`;
      else {
        const receipt = meta.receipt_display_number ? `(${meta.receipt_display_number})` : 'record';
        const forUser = meta.devotee_name ? ` for ${meta.devotee_name}` : '';
        sentence = `${verb} donation ${receipt}${forUser}`;
      }
    }
    else if (endpoint.includes('/purchases/')) {
      const bill = meta.bill_no ? ` Bill No. ${meta.bill_no}` : 'record';
      const vendor = meta.vendor_name ? ` from ${meta.vendor_name}` : '';
      sentence = `${verb} purchase ${bill}${vendor}`;
    }
    else if (endpoint.includes('/items/')) {
      sentence = `${verb} item ${meta.item_name || 'record'}`;
    }
    else if (endpoint.includes('/daily-usage/')) {
      const date = meta.usage_date ? ` for ${safeFormatDate(meta.usage_date)}` : 'record';
      sentence = `${verb} daily usage entry ${date}`;
    }
    else if (endpoint.includes('/tokens/')) {
      const receipt = meta.receipt_display_number ? ` ${meta.receipt_display_number}` : '';
      sentence = `${verb} token receipt ${receipt}`;
    }
    else if (endpoint.includes('/users/')) {
      const roleName = meta.role_name ? `'${meta.role_name}'` : '';
      const userName = meta.target_full_name ? `'${meta.target_full_name}'` : '';
      if (endpoint.includes('/create_role')) sentence = `created role ${roleName}`;
      else if (endpoint.includes('/update_role_privileges')) sentence = `updated role privileges for ${roleName}`;
      else if (endpoint.includes('/update_role')) sentence = `updated role ${roleName}`;
      else if (endpoint.includes('/delete_role')) sentence = `deleted role ${roleName}`;
      else if (endpoint.includes('/create_user')) sentence = `created user ${userName}`;
      else if (endpoint.includes('/update_user')) {
        if (meta.password_updated) {
          sentence = `reset password for user ${userName}`;
        } else {
          sentence = `updated user ${userName}`;
        }
      }
      else if (endpoint.includes('/delete_user')) sentence = `deleted user ${userName}`;
      else {
        const rawPath = cleanPath(endpoint);
        const parts = rawPath.split('/');
        let lastPart = parts.reverse().find(p => !/^\d+$/.test(p)) || '';
        lastPart = lastPart.replace(/^(create_|update_|delete_|list_)/, '');
        const target = lastPart.replace(/_/g, ' ').replace(/-/g, ' ') || 'system';
        sentence = `${verb} ${target}`;
      }
    }
    else {
      const rawPath = cleanPath(endpoint);
      const parts = rawPath.split('/');
      let lastPart = parts.reverse().find(p => !/^\d+$/.test(p)) || '';
      lastPart = lastPart.replace(/^(create_|update_|delete_|list_)/, '');
      const target = lastPart.replace(/_/g, ' ').replace(/-/g, ' ') || 'system';
      sentence = `${verb} ${target}`;
    }

    return (
      <div className="text-sm text-text-main leading-relaxed">
        <span className="text-text-main"> {sentence}</span>
      </div>
    );
  };

  const columns = [
    {
      accessorKey: 'description',
      header: 'Activity Description',
      cell: (info) => (
        <div className="flex items-center gap-3">
          <div className="shrink-0">
            {getActionIcon(info.row.original.method, info.row.original.endpoint)}
          </div>
          {getActivityDescription(info.row.original)}
        </div>
      )
    },
    {
      accessorKey: 'username',
      header: 'User',
      cell: (info) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary border border-primary/20">
            {(info.getValue() || 'S').charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-medium text-text-main">{info.row.original.meta?.actor_name || info.getValue()}</span>
        </div>
      )
    },
    {
      accessorKey: 'module',
      header: 'Module',
      cell: (info) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-secondary/10 text-secondary-dark border border-secondary/20">
          {getActivityModule(info.row.original.endpoint)}
        </span>
      )
    },
    {
      accessorKey: 'activity_status',
      header: 'Status',
      cell: (info) => (
        <div className="flex items-center gap-1.5">
          {info.getValue() === 'SUCCESS' ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
          ) : (
            <XCircle className="w-3.5 h-3.5 text-error" />
          )}
          <span className={cn(
            "text-[11px] font-bold",
            info.getValue() === 'SUCCESS' ? "text-green-600" : "text-error"
          )}>
            {info.getValue()}
          </span>
        </div>
      )
    },
    {
      accessorKey: 'activity_at',
      header: () => <div className="text-right">Date & Time</div>,
      cell: (info) => {
        const date = new Date(info.getValue());
        return (
          <div className="flex flex-col items-end py-1">
            <span className="text-sm font-bold text-text-main">{safeFormatDate(date)}</span>
            <span className="text-[11px] font-medium text-text-main/50 tabular-nums">{safeFormatTime(date)}</span>
          </div>
        );
      }
    }
  ];

  const dateRangePresets = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'this_week', label: 'This Week' },
    { id: 'this_month', label: 'This Month' },
    { id: 'custom', label: 'Custom' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="page-title !mb-0">User Activity Logs</h2>
        <div className="flex gap-2">
          {dateRangePresets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => { setDateRangeType(preset.id); setPage(1); }}
              className={cn(
                "px-4 py-1.5 text-sm font-medium rounded-full transition-all border",
                dateRangeType === preset.id 
                  ? "bg-primary text-white border-primary shadow-sm" 
                  : "bg-white text-text-main border-border-temple hover:bg-gray-50"
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Logs', value: summaryData?.total || 0, icon: Activity, color: 'text-primary', bg: 'bg-primary/5' },
          { label: 'Success', value: summaryData?.success || 0, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Failed', value: summaryData?.failed || 0, icon: XCircle, color: 'text-error', bg: 'bg-error/5' },
          { label: 'Important', value: summaryData?.important || 0, icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map((stat, i) => (
          <Card key={i} className="border-border-temple/40 overflow-hidden">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-text-main/60 uppercase tracking-wider">{stat.label}</p>
                <h3 className={cn("text-2xl font-black mt-1", stat.color)}>{stat.value.toLocaleString()}</h3>
              </div>
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", stat.bg)}>
                <stat.icon className={cn("w-6 h-6", stat.color)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border-temple shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            {dateRangeType === 'custom' && (
              <>
                <div className="w-full sm:w-40 space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-text-main/60">From Date</Label>
                  <Input 
                    type="date" 
                    value={customStartDate} 
                    onChange={(e) => { setCustomStartDate(e.target.value); setPage(1); }}
                    className="h-10 border-border-temple/40"
                  />
                </div>
                <div className="w-full sm:w-40 space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-text-main/60">To Date</Label>
                  <Input 
                    type="date" 
                    value={customEndDate} 
                    onChange={(e) => { setCustomEndDate(e.target.value); setPage(1); }}
                    className="h-10 border-border-temple/40"
                  />
                </div>
              </>
            )}

            <div className="w-full sm:w-48 space-y-1.5">
              <Label className="text-xs font-bold uppercase text-text-main/60">User</Label>
              <select
                value={username}
                onChange={(e) => { setUsername(e.target.value); setPage(1); }}
                className="w-full h-10 px-3 py-2 bg-white border border-border-temple/40 rounded-md text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">All Users</option>
                {users.map(u => (
                  <option key={u.id} value={u.username}>{u.full_name || u.username}</option>
                ))}
              </select>
            </div>

            <div className="w-full sm:w-48 space-y-1.5">
              <Label className="text-xs font-bold uppercase text-text-main/60">Activity Type</Label>
              <select
                value={activityType}
                onChange={(e) => { setActivityType(e.target.value); setPage(1); }}
                className="w-full h-10 px-3 py-2 bg-white border border-border-temple/40 rounded-md text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="important">Important Actions</option>
                <option value="login">Login / Logout</option>
                <option value="create">Add Only</option>
                <option value="edit">Edit Only</option>
                <option value="delete">Delete Only</option>
                <option value="payment">Payments (Donations/Tokens)</option>
                <option value="stock">Stock / Purchases</option>
                <option value="">Everything</option>
              </select>
            </div>

            <div className="w-full sm:w-48 space-y-1.5">
              <Label className="text-xs font-bold uppercase text-text-main/60">Status</Label>
              <select
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                className="w-full h-10 px-3 py-2 bg-white border border-border-temple/40 rounded-md text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">All Status</option>
                <option value="SUCCESS">Success Only</option>
                <option value="FAILED">Failed Only</option>
              </select>
            </div>

            <div className="w-full sm:w-36 space-y-1.5">
              <Label className="text-xs font-bold uppercase text-text-main/60">Client</Label>
              <select
                value={clientType}
                onChange={(e) => { setClientType(e.target.value); setPage(1); }}
                className="w-full h-10 px-3 py-2 bg-white border border-border-temple/40 rounded-md text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">All Clients</option>
                <option value="web">Web</option>
                <option value="desktop">Desktop App</option>
              </select>
            </div>

            <div className="flex items-center gap-2 mb-2 ml-auto">
              <input 
                type="checkbox" 
                id="showNav"
                checked={showNavigation}
                onChange={(e) => setShowNavigation(e.target.checked)}
                className="w-4 h-4 rounded border-border-temple text-primary focus:ring-primary"
              />
              <Label htmlFor="showNav" className="text-xs font-bold text-text-main cursor-pointer">
                Show Navigation Activity
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-xl border border-border-temple overflow-hidden bg-white shadow-sm">
        <DataTable
          columns={columns}
          data={data?.items || []}
          loading={isLoading}
          manualPagination
          pageCount={data?.total_pages || 0}
          pageIndex={page - 1}
          pageSize={pageSize}
          onPageChange={(p) => setPage(p)}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          totalCount={data?.total || 0}
        />
      </div>
    </div>
  );
};

export default ActivityLogsPage;
