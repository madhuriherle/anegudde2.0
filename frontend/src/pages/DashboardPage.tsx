import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Paper,
  Typography,
  Box,
  Button,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Chip,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  ArrowForward,
  DashboardOutlined,
  Refresh,
} from '@mui/icons-material';
import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { showSuccess, showError, showConfirm } = useNotification();

  const { data: trendData, isLoading: trendLoading, refetch: refetchTrend } = useQuery({
    queryKey: ['dashboard-stock-trend'],
    queryFn: async () => (await api.get('/dashboard/stock-trend')).data,
  });

  const [isBackfilling, setIsBackfilling] = React.useState(false);

  const handleBackfill = async () => {
    const confirmed = await showConfirm(
      'Generate Historical Data',
      'Do you want to generate/backfill dashboard historical trend data now?'
    );
    if (!confirmed) return;
    setIsBackfilling(true);
    try {
      await api.post('/dashboard/backfill-trend');
      showSuccess('Historical trend data generated successfully');
      refetchTrend();
    } catch (err) {
      showError('Failed to generate trend data');
    } finally {
      setIsBackfilling(false);
    }
  };

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

  if (overviewLoading || todayLoading || lowStockLoading || activitiesLoading || trendLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!overview || !today || !Array.isArray(lowStock) || !Array.isArray(activities)) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">Failed to load dashboard data.</Typography>
      </Box>
    );
  }

  const trend = Array.isArray(trendData) ? trendData : [];
  const trendMax = trend.length ? Math.max(...trend.map((d: any) => Number(d.value) || 0), 1) : 1;

  const todayCards = [
    { title: "Today's Purchase", value: `\u20B9${inr.format(Number(today.purchase_amount || 0))}`, to: '/purchases', color: '#06b6d4' },
    { title: "Today's Consumption", value: today.consumption_entries, to: '/consumptions', color: '#8b5cf6' },
    { title: 'Wastage', value: today.wastage_entries, to: '/wastages', color: '#ef4444' },
    { title: 'Vendor Payments', value: `\u20B9${inr.format(Number(today.vendor_payment_amount || 0))}`, to: '/vendor-payments', color: '#14b8a6' },
  ];

  const summaryCards = [
    { title: 'Current Stock', value: `\u20B9${inr.format(Number(overview.total_stock_value || 0))}`, to: '/items', color: '#3b82f6' },
    { title: 'Financial Balance', value: `\u20B9${inr.format(Number(overview.total_outstanding_balance || 0))}`, to: '/vendors', color: '#10b981' },
    { title: 'Total Vendors', value: overview.total_vendors, to: '/vendors', color: '#2563eb' },
    { title: 'Total Items', value: overview.total_items, to: '/items', color: '#22c55e' },
  ];

  return (
    <Box
      sx={{
        px: { xs: 1, md: 3 },
        pt: { xs: 0.5, md: 1 },
        pb: { xs: 1, md: 3 },
        '& .MuiTypography-root': {
          fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
          fontWeight: 400,
        },
      }}
    >
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <DashboardOutlined sx={{ color: 'text.secondary' }} />
        <Typography variant="h5" sx={{ fontWeight: 500, color: 'text.primary' }}>
          Dashboard
        </Typography>
      </Box>

      <SectionTitle title="Today's Metrics" sx={{ mt: 0.5 }} />
      <CardGrid>
        {todayCards.map((card) => (
          <NavCard key={card.title} title={card.title} value={card.value} color={card.color} onClick={() => navigate(card.to)} />
        ))}
      </CardGrid>

      <SectionTitle title="Overall Summary" sx={{ mt: 3 }} />
      <CardGrid>
        {summaryCards.map((card) => (
          <NavCard key={card.title} title={card.title} value={card.value} color={card.color} onClick={() => navigate(card.to)} />
        ))}
      </CardGrid>

      <Paper elevation={0} sx={{ p: 4, mt: 4, borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ mb: 3, fontWeight: 800 }}>
          Stock Value Trend (Last 30 Days)
        </Typography>
        <Box sx={{ height: 220, display: 'flex', alignItems: 'flex-end', gap: 0.5, pt: 1 }}>
          {trend.map((d: any, i: number) => (
            <Tooltip key={i} title={`${d.date}: \u20B9${inr.format(Number(d.value) || 0)}`}>
              <Box
                sx={{
                  flex: 1,
                  minWidth: 8,
                  height: `${Math.max((Number(d.value || 0) / trendMax) * 100, 3)}%`,
                  borderRadius: '6px 6px 0 0',
                  bgcolor: 'primary.light',
                  transition: 'all 0.2s ease',
                  '&:hover': { bgcolor: 'primary.main' },
                }}
              />
            </Tooltip>
          ))}
          {trend.length === 0 && (
            <Box sx={{ width: '100%', textAlign: 'center', py: 6 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Not enough data to show trend.
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={isBackfilling ? <CircularProgress size={16} /> : <Refresh />}
                onClick={handleBackfill}
                disabled={isBackfilling}
                sx={{ borderRadius: 2, fontWeight: 'bold' }}
              >
                {isBackfilling ? 'Generating...' : 'Generate Historical Data'}
              </Button>
            </Box>
          )}
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>
            {trend[0]?.date || ''}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>
            {trend[trend.length - 1]?.date || ''}
          </Typography>
        </Box>
      </Paper>

      <Box sx={{ display: 'grid', gap: 4, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, mt: 4 }}>
        <Paper elevation={0} sx={{ p: 4, borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
          <SectionTitle title="Low Stock Alerts" compact actionLabel="View items" onAction={() => navigate('/items')} />
          <Divider sx={{ mb: 2 }} />
          <List disablePadding>
            {lowStock.length > 0 ? (
              lowStock.map((item: any) => (
                <ListItem key={item.item_id} sx={{ px: 0, py: 1.5, borderBottom: '1px dashed', borderColor: 'divider', '&:last-child': { border: 0 } }}>
                  <ListItemText
                    primary={<Typography sx={{ fontWeight: 700 }}>{item.item_name}</Typography>}
                    secondary={`Current: ${item.current_stock} | Min Alert: ${item.min_stock_level}`}
                  />
                  <Chip size="small" label="Low Stock" color="error" variant="filled" sx={{ fontWeight: 'bold' }} />
                </ListItem>
              ))
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                No low stock items. All good!
              </Typography>
            )}
          </List>
        </Paper>

        <Paper elevation={0} sx={{ p: 4, borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
          <SectionTitle title="Recent System Activity" compact />
          <Divider sx={{ mb: 2 }} />
          <List disablePadding>
            {activities.length > 0 ? (
              activities.map((act: any, idx: number) => (
                <ListItem key={idx} sx={{ px: 0, py: 1.5, alignItems: 'flex-start', borderBottom: '1px dashed', borderColor: 'divider', '&:last-child': { border: 0 } }}>
                  <ListItemText
                    primary={<Typography sx={{ fontWeight: 700 }}>{act.title}</Typography>}
                    secondary={
                      <Box component="span" sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mt: 0.5 }}>
                        <Typography component="span" variant="caption" color="text.secondary">
                          {act.description}
                        </Typography>
                        <Typography component="span" variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>
                          {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Typography>
                      </Box>
                    }
                  />
                  {act.amount ? (
                    <Typography
                      sx={{
                        ml: 2,
                        fontWeight: 800,
                        color: act.activity_type === 'payment' ? 'error.main' : 'success.main',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {act.activity_type === 'payment' ? '-' : '+'}\u20B9{inr.format(Number(act.amount))}
                    </Typography>
                  ) : null}
                </ListItem>
              ))
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                No recent activities logged today.
              </Typography>
            )}
          </List>
        </Paper>
      </Box>
    </Box>
  );
};

const CardGrid = ({ children }: { children: React.ReactNode }) => (
  <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' } }}>{children}</Box>
);

const SectionTitle = ({
  title,
  actionLabel,
  onAction,
  compact = false,
  sx = {},
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
  sx?: object;
}) => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: compact ? 1 : 2.5, ...sx }}>
    <Typography
      variant="body1"
      sx={{
        fontWeight: 400,
        letterSpacing: 0,
        fontSize: '1rem',
      }}
    >
      {title}
    </Typography>
    {actionLabel && onAction ? (
      <Box
        onClick={onAction}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          cursor: 'pointer',
          color: 'primary.main',
          fontWeight: 700,
          '&:hover': { textDecoration: 'underline' },
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {actionLabel}
        </Typography>
        <ArrowForward fontSize="small" />
      </Box>
    ) : null}
  </Box>
);

const NavCard = ({
  title,
  value,
  color,
  onClick,
}: {
  title: string;
  value: string | number;
  color: string;
  onClick: () => void;
}) => (
  <Paper
    elevation={0}
    onClick={onClick}
    sx={{
      p: 1.5,
      minHeight: 86,
      cursor: 'pointer',
      borderRadius: 2,
      border: '1px solid',
      borderColor: 'rgba(0,0,0,0.08)',
      transition: 'all 0.2s ease',
      bgcolor: color,
      '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 8px 18px rgba(0,0,0,0.16)' },
    }}
  >
    <Box>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 400,
          color: '#1f2937',
          textTransform: 'none',
          letterSpacing: 0,
          mb: 0.5,
          display: 'block',
          textAlign: 'center',
          fontSize: '0.95rem',
        }}
      >
        {title}
      </Typography>
      <Typography
        variant="body1"
        sx={{
          fontWeight: 400,
          color: '#0f172a',
          lineHeight: 1.1,
          textAlign: 'center',
          fontSize: '1.2rem',
        }}
      >
        {value}
      </Typography>
    </Box>
  </Paper>
);

export default DashboardPage;

