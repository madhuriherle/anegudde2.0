import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Home,
  UtensilsCrossed,
  Briefcase,
  Users,
  BarChart3,
  Settings,
  Package,
  ShoppingCart,
  LogOut,
  Menu as MenuIcon,
  User,
  Heart,
  ChevronDown,
  ChevronRight,
  ArrowLeft } from
'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Avatar from '@radix-ui/react-avatar';
import { useAuth } from '../context/AuthContext';
import { usePermission } from '../hooks/usePermission';
import { cn } from '../utils/cn';
import { getDefaultPath, hasCanteenAccess, hasMainAccess } from '../utils/navigation';
import Footer from '../components/Footer';

const templeLogoSrc = '/temple-logo-permanent.png';

const MainLayout = () => {
  const { user, logout } = useAuth();
  const { hasPermission } = usePermission();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeModule, setActiveModule] = useState('main');
  const [expandedMenus, setExpandedMenus] = useState({});
  const canAccessMain = hasMainAccess(user);
  const canAccessCanteen = hasCanteenAccess(user);

  useEffect(() => {
    const path = location.pathname;
    const canteenPaths = [
    '/canteen',
    '/purchases',
    '/daily-usage',
    '/wastages',
    '/donations',
    '/items',
      '/vendors',
      '/settings/categories',
      '/settings/menu-items',
      '/reports'];

    if (
      path === '/settings' ||
      path.startsWith('/settings/temple') ||
      path.startsWith('/settings/receipt') ||
      path.startsWith('/settings/cleanup') ||
      path.startsWith('/settings/donation-types')
    ) {
      setActiveModule('main');
    } else if (canteenPaths.some((p) => path.startsWith(p))) {
      setActiveModule('canteen');
    } else if (path === '/') {
      setActiveModule(canAccessMain ? 'main' : 'canteen');
    }
  }, [location.pathname, canAccessMain]);

  useEffect(() => {
    if (location.pathname === '/' && !canAccessMain) {
      navigate(getDefaultPath(user), { replace: true });
    }
  }, [location.pathname, navigate, user, canAccessMain]);

  const toggleExpand = (key) => {
    setExpandedMenus((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const mainMenuItems = [
  { text: 'Home', icon: Home, path: '/', action: () => setActiveModule('main'), hidden: !canAccessMain },
  { 
    text: 'Canteen', 
    icon: UtensilsCrossed, 
    path: '/canteen', 
    action: () => setActiveModule('canteen'),
    hidden: !canAccessCanteen
  },
  { 
    text: 'Office', 
    icon: Briefcase, 
    path: '/office',
    hidden: !hasPermission('donations.read') && !hasPermission('vendors.read')
  },
  { 
    text: 'Users', 
    icon: Users, 
    children: [
      { text: 'User Management', path: '/users', hidden: !hasPermission('users.read') },
      { text: 'User Privileges', path: '/users/privileges', hidden: !hasPermission('users.write') },
      // { text: 'User Activity', path: '/users/activity', hidden: !hasPermission('activity_logs.read') }
    ].filter(i => !i.hidden),
    hidden: !hasPermission('users.read') && !hasPermission('users.write')
  },
  { 
    text: 'Reports', 
    icon: BarChart3, 
    path: undefined,
    hidden: !hasPermission('reports.read')
  },
  {
    text: 'Master Settings',
    icon: Settings,
    children: [
      { text: 'System Settings', path: '/settings', hidden: !hasPermission('settings.read') },
      { text: 'Donation Type', path: '/settings/donation-types', hidden: !hasPermission('donation_types.read') }
    ].filter(i => !i.hidden),
    hidden: !hasPermission('settings.read') && !hasPermission('donation_types.read')
  }
].filter(i => !i.hidden);


  const canteenMenuItems = [
  { text: 'Home', icon: Home, path: '/', action: () => setActiveModule('main'), hidden: !canAccessMain },
  { 
    text: 'Dashboard', 
    icon: UtensilsCrossed, 
    path: '/canteen',
    hidden: !hasPermission('dashboard.read')
  },
  {
    text: 'Purchase',
    icon: ShoppingCart,
    children: [
      { text: 'Purchase Entry', path: '/purchases', hidden: !hasPermission('purchases.read') },
      { text: 'Purchase Returns', path: '/purchases/returns', hidden: !hasPermission('purchase_returns.read') }
    ].filter(i => !i.hidden),
    hidden: !hasPermission('purchases.read') && !hasPermission('purchase_returns.read')
  },
  {
    text: 'Daily Usage Entry',
    icon: Package,
    path: '/daily-usage',
    hidden: !hasPermission('consumptions.read')
  },
  {
    text: 'Donations',
    icon: Heart,
    path: '/donations',
    hidden: !hasPermission('donations.read')
  },
  { 
    text: 'Vendors', 
    icon: Users, 
    path: '/vendors',
    hidden: !hasPermission('vendors.read')
  },
  {
    text: 'Items',
    icon: Package,
    children: [
      { text: 'Category', path: '/settings/categories', hidden: !hasPermission('item_categories.read') },
      { text: 'Raw Item', path: '/items', hidden: !hasPermission('items.read') },
      { text: 'Menu Item', path: '/settings/menu-items', hidden: !hasPermission('menu_items.read') }
    ].filter(i => !i.hidden),
    hidden: !hasPermission('item_categories.read') && !hasPermission('items.read') && !hasPermission('menu_items.read')
  },
  {
    text: 'Reports',
    icon: BarChart3,
    children: [
      { text: 'Stock Summary', path: '/reports/stock-summary', hidden: !hasPermission('reports.read') },
      { text: 'Canteen Summary', path: '/reports/canteen-summary', hidden: !hasPermission('reports.read') },
      { text: 'Manpower Report', path: '/reports/manpower', hidden: !hasPermission('reports.read') },
      { text: 'Donation Report', path: '/reports/donations', hidden: !hasPermission('reports.read') },
      { text: 'Token Issued Report', path: '/reports/tokens', hidden: !hasPermission('reports.read') }
    ].filter(i => !i.hidden),
    hidden: !hasPermission('reports.read')
  },
  { text: 'Back', icon: ArrowLeft, path: '/', action: () => setActiveModule('main'), hidden: !canAccessMain }
].filter(i => !i.hidden);


  const renderMenuItem = (item, depth = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedMenus[item.text];
    const isActive = item.path && location.pathname === item.path;
    const shouldHideSubmenusInMain = false;
    const canExpandChildren = hasChildren && !shouldHideSubmenusInMain;

    const content =
    <div
      className={cn(
        "group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
        item.path || item.action || canExpandChildren ? "cursor-pointer" : "cursor-default",
        isActive ?
        "bg-sidebar-active text-white shadow-sm" :
        "text-[#D7CCC8] hover:bg-sidebar-hover hover:text-white",
        depth > 0 && "ml-4 py-1.5"
      )}
      onClick={() => {
        if (canExpandChildren) {
          toggleExpand(item.text);
        } else {
          if (item.action) item.action();
          if (item.path) {
            navigate(item.path);
            setIsSidebarOpen(false);
          }
        }
      }}>
      
        {item.icon && <item.icon className={cn("w-5 h-5", isActive ? "text-white" : "text-[#D7CCC8] group-hover:text-white")} />}
        <span className="flex-1">{item.text}</span>
        {canExpandChildren && (
      isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)
      }
      </div>;


    return (
      <div key={item.text} className="space-y-1">
        {content}
        {canExpandChildren && isExpanded &&
        <div className="space-y-1 mt-1">
            {item.children.map((child) => renderMenuItem(child, depth + 1))}
          </div>
        }
      </div>);

  };

  const SidebarContent = () =>
  <div className="flex flex-col h-full bg-secondary border-r border-secondary-dark/20">
      <div className="h-16 border-b border-white/5 flex items-center px-4">
        <div
        className="bg-white p-1 rounded-lg shadow-sm w-full">
        
          <img
          src={templeLogoSrc}
          alt="Logo"
          className="h-9 w-auto mx-auto object-contain" />
        
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto no-scrollbar py-4 px-3 space-y-1">
        <div className="pb-2 px-3">
          <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] font-serif">
            {activeModule === 'canteen' ? 'Canteen Module' : 'Main Menu'}
          </span>
        </div>
        {(activeModule === 'canteen' || !canAccessMain ? canteenMenuItems : mainMenuItems).map((item) => renderMenuItem(item))}
      </nav>
    </div>;


  return (
    <div className="min-h-dvh bg-bg-temple">
      {isSidebarOpen &&
      <div
        className="fixed inset-0 z-40 bg-secondary-dark/60 lg:hidden backdrop-blur-sm"
        onClick={() => setIsSidebarOpen(false)} />

      }

      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 lg:block shadow-xl">
        <SidebarContent />
      </aside>

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-300 transform lg:hidden shadow-2xl",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <SidebarContent />
      </aside>

      <div className="lg:pl-64 flex min-h-dvh flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 bg-bg-cream border-b border-border-temple sm:px-6 shadow-sm">
          <div className="flex items-center gap-4">
            <button
              className="p-2 text-secondary hover:bg-secondary/5 rounded-md transition-colors lg:hidden"
              onClick={() => setIsSidebarOpen(true)}>
              
              <MenuIcon className="w-6 h-6" />
            </button>
            <div className="bg-[#F8E6D1] border border-[#B08968] px-4 py-2 rounded-[10px] shadow-[0_2px_6px_rgba(90,46,31,0.08)]">
               <span className="text-base font-bold text-[#5C2E1F] leading-none block whitespace-nowrap">
                  Financial Year : {user?.active_financial_year?.name || (() => {
                  const now = new Date();
                  const year = now.getFullYear();
                  const month = now.getMonth();
                  return month >= 3 ?
                  `${year}-${(year + 1).toString().slice(-2)}` :
                  `${year - 1}-${year.toString().slice(-2)}`;
                })()}
               </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:block text-base font-medium text-gray-700 mr-2">
              {user?.full_name}
            </span>

            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="flex items-center gap-3 p-1 rounded-full hover:bg-black/5 transition-all focus:outline-none group">
                  <Avatar.Root className="inline-flex items-center justify-center align-middle overflow-hidden select-none w-9 h-9 rounded-full bg-secondary border-2 border-border-temple/30 group-hover:border-primary/50 transition-colors shadow-sm">
                    <Avatar.Fallback className="w-full h-full flex items-center justify-center bg-secondary text-white text-sm font-bold uppercase tracking-wider">
                      {user?.full_name?.[0]}
                    </Avatar.Fallback>
                  </Avatar.Root>
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="z-50 min-w-[180px] bg-white rounded-lg shadow-xl border border-gray-200 p-1 animate-in fade-in zoom-in duration-200"
                  align="end"
                  sideOffset={8}>
                  
                  <DropdownMenu.Item
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-50 outline-none cursor-pointer"
                    onClick={() => navigate('/profile')}>
                    
                    <User className="w-4 h-4" />
                    Profile
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator className="h-px bg-gray-100 my-1" />
                  <DropdownMenu.Item
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-error hover:bg-error/5 outline-none cursor-pointer font-medium"
                    onClick={handleLogout}>
                    
                    <LogOut className="w-4 h-4" />
                    Logout
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          <Outlet />
        </main>
        <div className="mt-auto">
          <Footer />
        </div>
      </div>
    </div>);

};

export default MainLayout;
