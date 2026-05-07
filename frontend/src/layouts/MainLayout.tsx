import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  ShoppingCart, 
  UtensilsCrossed, 
  BarChart3, 
  LogOut, 
  Menu as MenuIcon, 
  User,
  UserCog,
  Tags,
  Ruler
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Avatar from '@radix-ui/react-avatar';
import { useAuth } from '../context/AuthContext';
import { cn } from '../utils/cn';

const templeLogoSrc = '/temple-logo-banner.webp';

const menuItems = [
  { text: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { text: 'Vendors', icon: Users, path: '/vendors' },
  { text: 'Items', icon: Package, path: '/items' },
  { text: 'Purchases', icon: ShoppingCart, path: '/purchases' },
  { text: 'Consumption', icon: UtensilsCrossed, path: '/consumptions' },
  { text: 'Reports', icon: BarChart3, path: '/reports' },
];

const masterSettings = [
  { text: 'Categories', icon: Tags, path: '/settings/categories' },
  { text: 'Units', icon: Ruler, path: '/settings/units' },
  { text: 'Menu Items', icon: UtensilsCrossed, path: '/settings/menu-items' },
  { text: 'Users', icon: UserCog, path: '/users' },
];

const MainLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-secondary border-r border-secondary-dark/20">
      <div className="h-16 border-b border-white/5 flex items-center px-4">
        <div className="bg-white p-1 rounded-lg shadow-sm w-full">
          <img 
            src={templeLogoSrc} 
            alt="Logo" 
            className="h-9 w-auto mx-auto object-contain" 
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto no-scrollbar py-4 px-3 space-y-1">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => setIsSidebarOpen(false)}
              className={cn(
                "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-300",
                location.pathname === item.path
                  ? "bg-sidebar-active text-white shadow-sm scale-[1.02]"
                  : "text-[#D7CCC8] hover:bg-sidebar-hover hover:text-white hover:translate-x-1"
              )}
          >
            <item.icon className={cn("w-5 h-5 transition-colors", location.pathname === item.path ? "text-white" : "text-[#D7CCC8] group-hover:text-white")} />
            {item.text}
          </Link>
        ))}

        <div className="pt-8 pb-2">
          <span className="px-3 text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] font-serif">Master Settings</span>
        </div>

        {masterSettings.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => setIsSidebarOpen(false)}
              className={cn(
                "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-300",
                location.pathname === item.path
                  ? "bg-sidebar-active text-white shadow-sm scale-[1.02]"
                  : "text-[#D7CCC8] hover:bg-sidebar-hover hover:text-white hover:translate-x-1"
              )}
          >
            <item.icon className={cn("w-5 h-5 transition-colors", location.pathname === item.path ? "text-white" : "text-[#D7CCC8] group-hover:text-white")} />
            {item.text}
          </Link>
        ))}
      </nav>
    </div>
  );

  return (
    <div className="min-h-screen bg-bg-temple">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-secondary-dark/60 lg:hidden backdrop-blur-sm" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Desktop */}
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 lg:block">
        <SidebarContent />
      </aside>

      {/* Sidebar - Mobile */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-300 transform lg:hidden shadow-2xl",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 bg-bg-cream border-b border-border-temple sm:px-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <div className="flex items-center gap-4">
            <button 
              className="p-2 text-secondary hover:bg-secondary/5 rounded-md transition-colors lg:hidden"
              onClick={() => setIsSidebarOpen(true)}
            >
              <MenuIcon className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-3 lg:hidden">
               <span className="text-lg font-bold text-secondary font-serif">Anegudde Temple</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:block text-xs font-medium text-gray-700 ml-2">
              {user?.full_name}
            </span>

            {/* User Profile */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="p-1 rounded-full hover:bg-gray-100 transition-colors focus:outline-none ml-1">
                  <Avatar.Root className="inline-flex items-center justify-center align-middle overflow-hidden select-none w-8 h-8 rounded-full bg-secondary">
                    <Avatar.Fallback className="w-full h-full flex items-center justify-center text-white text-xs font-medium uppercase">
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

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;

