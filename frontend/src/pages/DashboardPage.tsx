import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Paper,
  Typography,
  Box,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Chip,
  Divider,
} from '@mui/material';
import {
  ArrowForward,
  DashboardOutlined,
} from '@mui/icons-material';
import api from '../api/axios';

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

  const todayCards = [
    { title: "Today's Purchase", value: `\u20B9${inr.format(Number(today.purchase_amount || 0))}`, to: '/purchases', color: '#e0f2fe' },
    { title: "Today's Consumption", value: today.consumption_entries, to: '/consumptions', color: '#ede9fe' },
    { title: 'Wastage', value: today.wastage_entries, to: '/wastages', color: '#fee2e2' },
    { title: 'Vendor Payments', value: `\u20B9${inr.format(Number(today.vendor_payment_amount || 0))}`, to: '/vendor-payments', color: '#ccfbf1' },
  ];

  const summaryCards = [
    { title: 'Current Stock', value: `\u20B9${inr.format(Number(overview.total_stock_value || 0))}`, to: '/items', color: '#dbeafe' },
    { title: 'Financial Balance', value: `\u20B9${inr.format(Number(overview.total_outstanding_balance || 0))}`, to: '/vendors', color: '#dcfce7' },
    { title: 'Total Vendors', value: overview.total_vendors, to: '/vendors', color: '#e0e7ff' },
    { title: 'Total Items', value: overview.total_items, to: '/items', color: '#dcfce7' },
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

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, mt: 3 }}>
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
          <SectionTitle title="Low Stock Alerts" compact actionLabel="View items" onAction={() => navigate('/items')} />
          <Box sx={{ mb: 1.5 }}>
            <Chip
              size="small"
              label={`${lowStock.length} item${lowStock.length === 1 ? '' : 's'} below threshold`}
              sx={{ bgcolor: '#fee2e2', color: '#991b1b', fontWeight: 600 }}
            />
          </Box>
          <Divider sx={{ mb: 2 }} />
          <List disablePadding>
            {lowStock.length > 0 ? (
              lowStock.map((item: any) => (
                <ListItem
                  key={item.item_id}
                  sx={{
                    px: 1.25,
                    py: 1.25,
                    mb: 1,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: '#fecaca',
                    backgroundColor: '#fff7f7',
                    '&:last-child': { mb: 0 },
                  }}
                >
                  <ListItemText
                    primary={<Typography sx={{ fontWeight: 600 }}>{item.item_name}</Typography>}
                    secondary={
                      <Box component="span" sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                        <Chip size="small" label={`Current: ${item.current_stock}`} sx={{ height: 22, fontWeight: 600, bgcolor: '#e2e8f0' }} />
                        <Chip size="small" label={`Min: ${item.min_stock_level}`} sx={{ height: 22, fontWeight: 600, bgcolor: '#fee2e2', color: '#991b1b' }} />
                      </Box>
                    }
                  />
                  <Chip size="small" label="Low" sx={{ fontWeight: 700, bgcolor: '#ef4444', color: '#fff' }} />
                </ListItem>
              ))
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                No low stock items. All good!
              </Typography>
            )}
          </List>
        </Paper>

        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
          <SectionTitle title="Recent System Activity" compact />
          <Box sx={{ mb: 1.5 }}>
            <Chip
              size="small"
              label={`${activities.length} recent event${activities.length === 1 ? '' : 's'}`}
              sx={{ bgcolor: '#e0e7ff', color: '#1e3a8a', fontWeight: 600 }}
            />
          </Box>
          <Divider sx={{ mb: 2 }} />
          <List disablePadding>
            {activities.length > 0 ? (
              activities.map((act: any, idx: number) => (
                <ListItem
                  key={idx}
                  sx={{
                    px: 1.25,
                    py: 1.1,
                    mb: 1,
                    alignItems: 'flex-start',
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: '#e5e7eb',
                    '&:last-child': { mb: 0 },
                  }}
                >
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: act.activity_type === 'payment' ? '#ef4444' : '#2563eb',
                      mt: 1,
                      mr: 1.25,
                      flexShrink: 0,
                    }}
                  />
                  <ListItemText
                    primary={<Typography sx={{ fontWeight: 600 }}>{act.title}</Typography>}
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
                        fontWeight: 700,
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

