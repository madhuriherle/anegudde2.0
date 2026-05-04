import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  Badge,
  Tooltip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  People,
  Inventory,
  ShoppingCart,
  Restaurant,
  DeleteOutlined,
  BarChart,
  Logout,
  Notifications,
  Circle,
  AdminPanelSettings,
  Category,
  Straighten,
  Person,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const drawerWidth = 240;
const templeLogoSrc = '/temple-logo.jpg';

const menuItems = [
  { text: 'Dashboard', icon: <Dashboard />, path: '/' },
  { text: 'Vendors', icon: <People />, path: '/vendors' },
  { text: 'Items', icon: <Inventory />, path: '/items' },
  { text: 'Purchases', icon: <ShoppingCart />, path: '/purchases' },
  { text: 'Consumption', icon: <Restaurant />, path: '/consumptions' },
  { text: 'Wastage', icon: <DeleteOutlined />, path: '/wastages' },
  { text: 'Reports', icon: <BarChart />, path: '/reports' },
];

const masterSettings = [
  { text: 'Chefs', icon: <Restaurant />, path: '/settings/chefs' },
  { text: 'Categories', icon: <Category />, path: '/settings/categories' },
  { text: 'Units', icon: <Straighten />, path: '/settings/units' },
  { text: 'Users', icon: <AdminPanelSettings />, path: '/users' },
];

const MainLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notifAnchorEl, setNotifAnchorEl] = useState<null | HTMLElement>(null);

  // Fetch Unread Notifications
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: async () => {
      const res = await api.get('/notifications', { params: { unread_only: true } });
      return res.data;
    },
    refetchInterval: 30000, // Poll every 30 seconds
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id: number) => api.post(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleNotifOpen = (event: React.MouseEvent<HTMLElement>) => {
    setNotifAnchorEl(event.currentTarget);
  };

  const handleNotifClose = () => {
    setNotifAnchorEl(null);
  };

  const handleNotificationClick = (notif: any) => {
    markAsReadMutation.mutate(notif.id);
    if (notif.link) navigate(notif.link);
    handleNotifClose();
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const drawer = (
    <div>
      <Toolbar>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
          <Box
            component="img"
            src={templeLogoSrc}
            alt="Anegudde Temple Logo"
            onError={(e: any) => { e.currentTarget.src = '/favicon.svg'; }}
            sx={{ width: 34, height: 34, borderRadius: 1, objectFit: 'cover' }}
          />
          <Box>
            <Typography variant="subtitle1" noWrap color="primary" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
              Anegudde Temple
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.1 }}>
              Inventory System
            </Typography>
          </Box>
        </Box>
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              onClick={() => navigate(item.path)}
              selected={location.pathname === item.path}
              sx={{
                '&.Mui-selected': {
                  backgroundColor: 'primary.light',
                  color: 'primary.contrastText',
                  '& .MuiListItemIcon-root': {
                    color: 'primary.contrastText',
                  },
                },
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider />
      <List>
        <ListItem sx={{ py: 0.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold', textTransform: 'uppercase', ml: 1 }}>
            Master Settings
          </Typography>
        </ListItem>
        {masterSettings.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              onClick={() => navigate(item.path)}
              selected={location.pathname === item.path}
              sx={{
                '&.Mui-selected': {
                  backgroundColor: 'secondary.light',
                  color: 'secondary.contrastText',
                  '& .MuiListItemIcon-root': {
                    color: 'secondary.contrastText',
                  },
                },
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          boxShadow: 'none',
          backgroundColor: '#ffffff',
          color: 'text.primary',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
            <Box
              component="img"
              src={templeLogoSrc}
              alt="Anegudde Temple Logo"
              onError={(e: any) => { e.currentTarget.src = '/favicon.svg'; }}
              sx={{ width: 32, height: 32, borderRadius: 1, objectFit: 'cover' }}
            />
            <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'primary.main', lineHeight: 1.1 }}>
                Anegudde Temple Inventory
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.1 }}>
                Shree Vinayaka Devasthana
              </Typography>
            </Box>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            
            {/* Notification Bell */}
            <Tooltip title="Notifications">
              <IconButton onClick={handleNotifOpen} color="inherit">
                <Badge badgeContent={notifications.length} color="error">
                  <Notifications />
                </Badge>
              </IconButton>
            </Tooltip>

            <Menu
              anchorEl={notifAnchorEl}
              open={Boolean(notifAnchorEl)}
              onClose={handleNotifClose}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              slotProps={{
                paper: {
                  sx: { width: 320, maxHeight: 400, mt: 1.5 }
                }
              }}
            >
              <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>Notifications</Typography>
                {notifications.length > 0 && (
                  <Typography 
                    variant="caption" 
                    color="primary" 
                    sx={{ cursor: 'pointer' }}
                    onClick={() => {
                      api.post('/notifications/read-all').then(() => {
                        queryClient.invalidateQueries({ queryKey: ['notifications'] });
                      });
                    }}
                  >
                    Mark all as read
                  </Typography>
                )}
              </Box>
              <Divider />
              {notifications.length === 0 ? (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">No new notifications</Typography>
                </Box>
              ) : (
                notifications.map((notif: any) => (
                  <MenuItem 
                    key={notif.id} 
                    onClick={() => handleNotificationClick(notif)}
                    sx={{ py: 1.5, whiteSpace: 'normal', alignItems: 'flex-start' }}
                  >
                    <ListItemIcon sx={{ mt: 0.5 }}>
                      <Circle sx={{ fontSize: 10, color: notif.notification_type === 'warning' ? 'warning.main' : 'info.main' }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={<Typography variant="body2" sx={{ fontWeight: 'bold' }}>{notif.title}</Typography>}
                      secondary={<Typography variant="caption">{notif.message}</Typography>}
                    />                  </MenuItem>
                ))
              )}
            </Menu>

            <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' }, ml: 1 }}>
              {user?.full_name}
            </Typography>
            <IconButton onClick={handleMenuOpen} size="small">
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
                {user?.full_name?.[0]}
              </Avatar>
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
              <MenuItem onClick={() => { handleMenuClose(); navigate('/profile'); }}>
                <ListItemIcon>
                  <Person fontSize="small" />
                </ListItemIcon>
                Profile
              </MenuItem>
              <MenuItem onClick={handleLogout}>
                <ListItemIcon>
                  <Logout fontSize="small" />
                </ListItemIcon>
                Logout
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
        aria-label="mailbox folders"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              backgroundColor: '#ffffff',
              borderRight: '1px solid #e6e6e6',
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              backgroundColor: '#ffffff',
              borderRight: '1px solid #e6e6e6',
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          px: 3,
          pt: 1,
          pb: 3,
          minHeight: '100vh',
          backgroundColor: '#ffffff',
          minWidth: 0, // Critical for flex items to prevent them from expanding beyond viewport
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
};

export default MainLayout;
