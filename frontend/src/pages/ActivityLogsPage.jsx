import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, Clock, User, Globe, AlertCircle } from 'lucide-react';
import api from '../api/axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

const ActivityLogsPage = () => {
  const [page, setPage] = useState(1);
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['activity-logs', page, username, status],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: '50',
      });
      if (username) params.append('username', username);
      if (status) params.append('status', status);
      
      const res = await api.get(`/audit/list_activity_logs?${params.toString()}`);
      return res.data;
    }
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'SUCCESS': return 'text-green-600 bg-green-50';
      case 'FAILED': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="page-title">User Activity Logs</h2>
          <p className="text-sm text-gray-500 mt-1">Monitor real-time system actions and user behavior</p>
        </div>
      </div>

      <Card className="border-border-temple">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Filter by Username..."
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-full sm:w-48">
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="w-full h-10 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#C47A3A]/20"
              >
                <option value="">All Statuses</option>
                <option value="SUCCESS">Success</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border-temple overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-[#FAF7F2] text-text-main border-b border-border-temple/40">
                <tr>
                  <th className="px-6 py-4 font-bold">Time</th>
                  <th className="px-6 py-4 font-bold">User</th>
                  <th className="px-6 py-4 font-bold">Action</th>
                  <th className="px-6 py-4 font-bold">Endpoint</th>
                  <th className="px-6 py-4 font-bold text-center">Status</th>
                  <th className="px-6 py-4 font-bold text-right">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan="6" className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-full"></div></td>
                    </tr>
                  ))
                ) : isError ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-10 text-center text-red-500">
                      <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      Failed to load activity logs
                    </td>
                  </tr>
                ) : data?.items?.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-10 text-center text-gray-500">
                      No activity logs found
                    </td>
                  </tr>
                ) : (
                  data?.items.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 opacity-40" />
                          {formatDate(log.activity_at)}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-text-main">
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 opacity-40" />
                          {log.username || 'System'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-[#C47A3A]">{log.method}</span>
                        <span className="ml-2 text-gray-700">{log.action.split(' ').slice(1).join(' ')}</span>
                      </td>
                      <td className="px-6 py-4 text-gray-500 font-mono text-[11px]">
                        {log.endpoint}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${getStatusColor(log.activity_status)}`}>
                          {log.activity_status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-gray-500">
                        {log.duration_ms}ms
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {data?.total_pages > 1 && (
        <div className="flex justify-center gap-2 pb-10">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="flex items-center px-4 text-sm font-medium text-gray-600">
            Page {page} of {data.total_pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(data.total_pages, p + 1))}
            disabled={page === data.total_pages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
};

export default ActivityLogsPage;
