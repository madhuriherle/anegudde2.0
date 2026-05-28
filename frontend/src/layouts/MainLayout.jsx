import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import * as Icons from 'lucide-react';
import {
  ChevronDown,
  ChevronRight,
  Menu as MenuIcon,
  User,
  LogOut,
  ArrowLeft,
  Home } from
'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Avatar from '@radix-ui/react-avatar';
import { useAuth } from '../context/AuthContext';
import { usePermission } from '../hooks/usePermission';
import { cn } from '../utils/cn';
import { getDefaultPath, hasCanteenAccess, hasMainAccess } from '../utils/navigation';
import Footer from '../components/Footer';
import api from '../api/axios';

const templeLogoSrc = '/temple-logo-permanent.png';

const DynamicIcon = ({ name, ...props }) => {
  const IconComponent = Icons[name] || Icons.HelpCircle;
  return <IconComponent {...props} />;
};

const MainLayout = () => {
  const { user, logout } = useAuth();
  const { hasPermission } = usePermission();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeModule, setActiveModule] = useState('main');
  const [expandedMenus, setExpandedMenus] = useState({});
  const [menuData, setMenuData] = useState([]);
  const canAccessMain = hasMainAccess(user);
  const canAccessCanteen = hasCanteenAccess(user);
  const privilegeKey = [
    user?.id,
    user?.is_all_access ? 'all' : 'limited',
    ...(user?.privileges || []),
  ].join('|');

  useEffect(() => {
    const fetchMenu = async () => {
      if (!user) {
        setMenuData([]);
        return;
      }

      try {
        const response = await api.get('/modules/menu');
        setMenuData(response.data);
      } catch (error) {
        console.error('Failed to fetch menu:', error);
      }
    };

    fetchMenu();

    const handleFocus = () => fetchMenu();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user, privilegeKey]);

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
      '/items/categories',
      '/items/menu-items',
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

  const mainRoot = menuData.find(m => m.name === 'Main Menu');
  const canteenRoot = menuData.find(m => m.name === 'Canteen Module');

  const currentMenuItems = activeModule === 'canteen' || !canAccessMain ?
    (canteenRoot?.submodules || []) :
    (mainRoot?.submodules || []);

  const normalized = (value) => (value || '').toLowerCase().trim();
  const duplicateSystemSettingNames = new Set(['temple identity', 'receipt settings', 'data cleanup']);
  const hasSystemSettingsParent = currentMenuItems.some((item) => normalized(item.name) === 'system settings');
  const visibleMenuItems = hasSystemSettingsParent ?
    currentMenuItems.filter((item) => !duplicateSystemSettingNames.has(normalized(item.name))) :
    currentMenuItems;

  const renderMenuItem = (item, depth = 0) => {
    const hasChildren = item.submodules && item.submodules.length > 0;
    const isExpanded = expandedMenus[item.id];
    const isActive = item.route && location.pathname === item.route;
    const canExpandChildren = hasChildren;

    const content =
    <div
      className={cn(
        "group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
        item.route || canExpandChildren ? "cursor-pointer" : "cursor-default",
        isActive ?
        "bg-sidebar-active text-white shadow-sm" :
        "text-[#D7CCC8] hover:bg-sidebar-hover hover:text-white",
        depth > 0 && "ml-4 py-1.5"
      )}
      onClick={() => {
        if (canExpandChildren) {
          toggleExpand(item.id);
        } else if (item.route) {
          if (item.route === '/canteen') setActiveModule('canteen');
          if (item.route === '/' && activeModule === 'canteen') setActiveModule('main');
          navigate(item.route);
          setIsSidebarOpen(false);
        }
      }}>
      
        {item.icon && <DynamicIcon name={item.icon} className={cn("w-5 h-5", isActive ? "text-white" : "text-[#D7CCC8] group-hover:text-white")} />}
        <span className="flex-1">{item.name}</span>
        {canExpandChildren && (
      isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)
      }
      </div>;


    return (
      <div key={item.id} className="space-y-1">
        {content}
        {canExpandChildren && isExpanded &&
        <div className="space-y-1 mt-1">
            {item.submodules.map((child) => renderMenuItem(child, depth + 1))}
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
        {activeModule === 'canteen' && canAccessMain && (
          <div
            className="group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer text-[#D7CCC8] hover:bg-sidebar-hover hover:text-white"
            onClick={() => {
              setActiveModule('main');
              navigate('/');
              setIsSidebarOpen(false);
            }}
          >
            <Home className="w-5 h-5 text-[#D7CCC8] group-hover:text-white" />
            <span className="flex-1">Home</span>
          </div>
        )}
        {visibleMenuItems.map((item) => renderMenuItem(item))}
        {activeModule === 'canteen' && canAccessMain && (
          <div
            className="group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer text-[#D7CCC8] hover:bg-sidebar-hover hover:text-white"
            onClick={() => {
              setActiveModule('main');
              navigate('/');
              setIsSidebarOpen(false);
            }}
          >
            <ArrowLeft className="w-5 h-5 text-[#D7CCC8] group-hover:text-white" />
            <span className="flex-1">Back</span>
          </div>
        )}
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
        <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 bg-white border-b border-border-temple sm:px-6 shadow-sm">
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
