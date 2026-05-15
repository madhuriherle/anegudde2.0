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
  ChevronDown,
  ChevronRight,
  ArrowLeft
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Avatar from '@radix-ui/react-avatar';
import { useAuth } from '../context/AuthContext';
import { cn } from '../utils/cn';
import Footer from '../components/Footer';

const templeLogoSrc = '/temple-logo-banner.webp';

type MenuItem = {
  text: string;
  icon?: any;
  path?: string;
  children?: MenuItem[];
  action?: () => void;
};

const MainLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeModule, setActiveModule] = useState<'main' | 'canteen'>('main');
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const path = location.pathname;
    const canteenPaths = [
      '/canteen', 
      '/purchases', 
      '/daily-usage', 
      '/wastages', 
      '/items', 
      '/vendors', 
      '/settings',
      '/reports'
    ];
    if (canteenPaths.some(p => path.startsWith(p))) {
      setActiveModule('canteen');
    } else if (path === '/') {
      setActiveModule('main');
    }
  }, [location.pathname]);

  const toggleExpand = (key: string) => {
    setExpandedMenus(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const mainMenuItems: MenuItem[] = [
    { text: 'Home', icon: Home, path: '/', action: () => setActiveModule('main') },
    { text: 'Canteen', icon: UtensilsCrossed, path: '/canteen', action: () => setActiveModule('canteen') },
    { text: 'Office', icon: Briefcase, path: '/office' },
    { text: 'Users', icon: Users, path: '/users' },
    { text: 'Reports', icon: BarChart3, path: undefined },
    { text: 'Master Settings', icon: Settings, path: undefined },
  ];

  const canteenMenuItems: MenuItem[] = [
    { text: 'Home', icon: Home, path: '/', action: () => setActiveModule('main') },
    { text: 'Dashboard', icon: UtensilsCrossed, path: '/canteen' },
    { 
      text: 'Purchase', 
      icon: ShoppingCart,
      children: [
        { text: 'Purchase Entry', path: '/purchases' },
        { text: 'Purchase Returns', path: '/purchases/returns' },
      ]
    },
    { 
      text: 'Daily Usage Entry', 
      icon: Package,
      path: '/daily-usage'
    },
    { text: 'Vendors', icon: Users, path: '/vendors' },
    { 
      text: 'Items', 
      icon: Package,
      children: [
        { text: 'Category', path: '/settings/categories' },
        { text: 'Raw Item', path: '/items' },
        { text: 'Menu Item', path: '/settings/menu-items' },
      ]
    },
    {
      text: 'Reports',
      icon: BarChart3,
      children: [
        { text: 'Stock Summary', path: '/reports/stock-summary' },
        { text: 'Canteen Summary', path: '/reports/canteen-summary' },
        { text: 'Token Issued Report', path: '/reports/tokens' },
      ]
    },
    { text: 'Back', icon: ArrowLeft, path: '/', action: () => setActiveModule('main') },
  ];

  const renderMenuItem = (item: MenuItem, depth = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedMenus[item.text];
    const isActive = item.path && location.pathname === item.path;
    const shouldHideSubmenusInMain = false;
    const canExpandChildren = hasChildren && !shouldHideSubmenusInMain;

    const content = (
      <div 
        className={cn(
          "group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
          item.path || item.action || canExpandChildren ? "cursor-pointer" : "cursor-default",
          isActive 
            ? "bg-sidebar-active text-white shadow-sm" 
            : "text-[#D7CCC8] hover:bg-sidebar-hover hover:text-white",
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
        }}
      >
        {item.icon && <item.icon className={cn("w-5 h-5", isActive ? "text-white" : "text-[#D7CCC8] group-hover:text-white")} />}
        <span className="flex-1">{item.text}</span>
        {canExpandChildren && (
          isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
        )}
      </div>
    );

    return (
      <div key={item.text} className="space-y-1">
        {content}
        {canExpandChildren && isExpanded && (
          <div className="space-y-1 mt-1">
            {item.children!.map(child => renderMenuItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-secondary border-r border-secondary-dark/20">
      <div className="h-16 border-b border-white/5 flex items-center px-4">
        <div 
          className="bg-white p-1 rounded-lg shadow-sm w-full"
        >
          <img 
            src={templeLogoSrc} 
            alt="Logo" 
            className="h-9 w-auto mx-auto object-contain" 
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto no-scrollbar py-4 px-3 space-y-1">
        <div className="pb-2 px-3">
          <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] font-serif">
            {activeModule === 'canteen' ? 'Canteen Module' : 'Main Menu'}
          </span>
        </div>
        {(activeModule === 'canteen' ? canteenMenuItems : mainMenuItems).map(item => renderMenuItem(item))}
      </nav>
    </div>
  );

  return (
    <div className="min-h-dvh bg-bg-temple">
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-secondary-dark/60 lg:hidden backdrop-blur-sm" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

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
              onClick={() => setIsSidebarOpen(true)}
            >
              <MenuIcon className="w-6 h-6" />
            </button>
            <div className="bg-[#F8E6D1] border border-[#B08968] px-4 py-2 rounded-[10px] shadow-[0_2px_6px_rgba(90,46,31,0.08)]">
               <span className="text-sm font-bold text-[#5C2E1F] leading-none block whitespace-nowrap">
                  Financial Year : {user?.active_financial_year?.name || (() => {
                    const now = new Date();
                    const year = now.getFullYear();
                    const month = now.getMonth();
                    return month >= 3 
                      ? `${year}-${(year + 1).toString().slice(-2)}` 
                      : `${year - 1}-${year.toString().slice(-2)}`;
                  })()}
               </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:block text-xs font-medium text-gray-700 mr-2">
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
                  sideOffset={8}
                >
                  <DropdownMenu.Item 
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-50 outline-none cursor-pointer"
                    onClick={() => navigate('/profile')}
                  >
                    <User className="w-4 h-4" />
                    Profile
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator className="h-px bg-gray-100 my-1" />
                  <DropdownMenu.Item 
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-error hover:bg-error/5 outline-none cursor-pointer font-medium"
                    onClick={handleLogout}
                  >
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
    </div>
  );
};

export default MainLayout;
