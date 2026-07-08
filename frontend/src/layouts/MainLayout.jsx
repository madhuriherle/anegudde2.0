import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, NavLink } from 'react-router-dom';
import * as Icons from 'lucide-react';
import {
  ChevronDown,
  ChevronRight,
  Menu as MenuIcon,
  User,
  LogOut,
  ArrowLeft,
  Home,
  Download } from
'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Avatar from '@radix-ui/react-avatar';
import { useAuth } from '../context/AuthContext';
import { cn } from '../utils/cn';
import { getDefaultPath, hasMainAccess } from '../utils/navigation';
import Footer from '../components/Footer';
import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';

const DynamicIcon = ({ name, ...props }) => {
  const IconComponent = Icons[name] || Icons.HelpCircle;
  return <IconComponent {...props} />;
};

const MainLayout = () => {
  const { user, logout } = useAuth();
  const { showError } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeModule, setActiveModule] = useState('main');
  const [expandedMenus, setExpandedMenus] = useState({});
  const [menuData, setMenuData] = useState([]);
  const [templeLogoSrc, setTempleLogoSrc] = useState('/temple-logo-permanent.png');
  const canAccessMain = hasMainAccess(user);
  const privilegeKey = [
    user?.id,
    user?.is_all_access ? 'all' : 'limited',
    ...(user?.privileges || []),
  ].join('|');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await api.get('/settings/get_current_settings');
        if (response.data?.temple_logo) {
          setTempleLogoSrc(response.data.temple_logo);
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error);
      }
    };
    fetchSettings();
  }, []);

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

    const findCanteenModule = (modules) => {
      for (const mod of modules || []) {
        if (mod.submodules?.length) {
          const hasCanteenChild = mod.submodules.some(
            (child) => child.route && canteenPaths.some((p) => child.route.startsWith(p))
          );
          if (hasCanteenChild) return mod;
          const found = findCanteenModule(mod.submodules);
          if (found) return found;
        }
      }
      return null;
    };

    if (
      path === '/settings' ||
      path.startsWith('/settings/temple') ||
      path.startsWith('/settings/receipt') ||
      path.startsWith('/settings/cleanup') ||
      path.startsWith('/settings/printers') ||
      path.startsWith('/settings/donation-types')
    ) {
      setActiveModule('main');
    } else if (canteenPaths.some((p) => path.startsWith(p))) {
      const canteenRoot = findCanteenModule(menuData);
      setActiveModule(canteenRoot?.id || 'main');
    } else if (path === '/') {
      const firstChildModule = menuData.find((module) => module.parent_id !== null);
      setActiveModule(canAccessMain ? 'main' : firstChildModule?.id || 'main');
    }
  }, [location.pathname, canAccessMain, menuData]);

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

  const downloadFile = async (endpoint, filename) => {
    try {
      const response = await api.get(endpoint, { responseType: 'blob' });
      const contentType = response.headers?.['content-type'] || response.data?.type || '';
      if (contentType.includes('application/json')) {
        const message = await response.data.text();
        let detail = message;
        try {
          const parsed = JSON.parse(message);
          detail = parsed.detail || detail;
        } catch {
          // Keep the raw message when the body is not valid JSON.
        }
        throw new Error(detail || `Failed to download ${filename}`);
      }
      const disposition = response.headers?.['content-disposition'] || '';
      const match = disposition.match(/filename="?([^"]+)"?/i);
      const downloadName = match?.[1] || filename;
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', downloadName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(`Failed to download ${filename}:`, error);
      if (error.response?.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          const parsed = JSON.parse(text);
          showError(parsed.detail || `Failed to download ${filename}`);
          return;
        } catch {
          // Fall through to the generic handler below.
        }
      }
      showError(error.response?.data?.detail || error.message || `Failed to download ${filename}`);
    }
  };

  const mainRoot = menuData.find(m => m.parent_id === null);

  const findModuleById = (modules, id) => {
    for (const module of modules || []) {
      if (module.id === id) return module;
      const found = findModuleById(module.submodules || [], id);
      if (found) return found;
    }
    return null;
  };

  const activeRoot = activeModule === 'main' ?
    (mainRoot || menuData[0]) :
    (findModuleById(menuData, activeModule) || mainRoot || menuData[0]);

  const findFirstRoute = (items = []) => {
    for (const item of items) {
      if (item.route) return item.route;
      const childRoute = findFirstRoute(item.submodules || []);
      if (childRoute) return childRoute;
    }
    return null;
  };

  let currentMenuItems = activeRoot?.submodules || [];
  // Special case: if the root has no submodules but has a route, it might be the only item
  if (currentMenuItems.length === 0 && activeRoot?.route && !mainRoot) {
    currentMenuItems = [activeRoot];
  }

  const settingsChildRoutes = new Set(['/settings/temple', '/settings/receipt', '/settings/cleanup']);
  const hasSystemSettingsParent = currentMenuItems.some((item) => item.route === '/settings');
  const visibleMenuItems = currentMenuItems.filter((item) => {
    if (item.route === '/profile') return false;
    if (hasSystemSettingsParent && settingsChildRoutes.has(item.route)) return false;
    return true;
  });

  const renderMenuItem = (item, depth = 0) => {
    const hasChildren = item.submodules && item.submodules.length > 0;
    const isExpanded = expandedMenus[item.id];
    const opensRoom = activeModule === 'main' && canAccessMain && hasChildren && !item.route &&
      item.submodules?.some((child) => child.route === '/canteen');
    const canExpandChildren = hasChildren && !opensRoom;

    const targetRoute = opensRoom
      ? (findFirstRoute(item.submodules || []) || item.route || '/canteen')
      : item.route;

    const content = targetRoute ? (
      <NavLink
        to={targetRoute}
        end
        className={({ isActive: isLinkActive }) => cn(
          "group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer",
          isLinkActive ?
          "bg-sidebar-active text-white shadow-sm" :
          "text-[#D7CCC8] hover:bg-sidebar-hover hover:text-white",
          depth > 0 && "ml-4 py-1.5"
        )}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) {
            return;
          }
          if (opensRoom) {
            setActiveModule(item.id);
            setIsSidebarOpen(false);
          } else if (item.route) {
            if (item.route === '/' && activeModule !== 'main') setActiveModule('main');
            setIsSidebarOpen(false);
          }
        }}
      >
        {({ isActive: isLinkActive }) => (
          <>
            {item.icon && item.route !== '/devotees' && (
              <DynamicIcon
                name={item.icon}
                className={cn("w-5 h-5", isLinkActive ? "text-white" : "text-[#D7CCC8] group-hover:text-white")}
              />
            )}
            <span className="flex-1">{item.name}</span>
            {canExpandChildren && (
              <button
                type="button"
                className="rounded p-1 hover:bg-white/10"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  toggleExpand(item.id);
                }}
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            )}
          </>
        )}
      </NavLink>
    ) : (
      <div
        className={cn(
          "group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
          canExpandChildren ? "cursor-pointer" : "cursor-default",
          "text-[#D7CCC8] hover:bg-sidebar-hover hover:text-white",
          depth > 0 && "ml-4 py-1.5"
        )}
        onClick={() => {
          if (canExpandChildren) {
            toggleExpand(item.id);
          }
        }}
      >
        {item.icon && item.route !== '/devotees' && (
          <DynamicIcon
            name={item.icon}
            className="w-5 h-5 text-[#D7CCC8] group-hover:text-white"
          />
        )}
        <span className="flex-1">{item.name}</span>
        {canExpandChildren && (
          <button
            type="button"
            className="rounded p-1 hover:bg-white/10"
            onClick={(event) => {
              event.stopPropagation();
              toggleExpand(item.id);
            }}
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        )}
      </div>
    );


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
            {activeRoot?.submodules?.some((c) => c.route === '/canteen') ? 'Mahaprasad Module' : activeRoot?.name || 'Main Menu'}
          </span>
        </div>
        {activeModule !== 'main' && canAccessMain && (
          <NavLink
            to="/"
            end
            className="group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer text-[#D7CCC8] hover:bg-sidebar-hover hover:text-white"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) {
                return;
              }
              setActiveModule('main');
              setIsSidebarOpen(false);
            }}
          >
            <Home className="w-5 h-5 text-[#D7CCC8] group-hover:text-white" />
            <span className="flex-1">Home</span>
          </NavLink>
        )}
        {visibleMenuItems.map((item) => renderMenuItem(item))}
        {activeModule !== 'main' && canAccessMain && (
          <NavLink
            to="/"
            end
            className="group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer text-[#D7CCC8] hover:bg-sidebar-hover hover:text-white"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) {
                return;
              }
              setActiveModule('main');
              setIsSidebarOpen(false);
            }}
          >
            <ArrowLeft className="w-5 h-5 text-[#D7CCC8] group-hover:text-white" />
            <span className="flex-1">Back</span>
          </NavLink>
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
                <button
                  className="p-2 text-gray-500 hover:text-primary hover:bg-gray-100 rounded-lg transition-all"
                  title="Downloads"
                >
                  <Download className="w-5 h-5" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="z-50 min-w-[230px] bg-white rounded-lg shadow-xl border border-gray-200 p-1 animate-in fade-in zoom-in duration-200"
                  align="end"
                  sideOffset={8}>
                  
                  <DropdownMenu.Item
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-50 outline-none cursor-pointer"
                    onClick={() => downloadFile('/downloads/manual', 'User_Manual.pdf')}>
                    
                    <Icons.BookOpen className="w-4 h-4" />
                    User Manual
                  </DropdownMenu.Item>
                  {user?.role_rank_level === 1 && (
                    <DropdownMenu.Item
                      className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-50 outline-none cursor-pointer"
                      onClick={() => downloadFile('/downloads/token-app', 'TokenApp_Setup.exe')}>
                      
                      <Icons.MonitorDown className="w-4 h-4" />
                      Token App Installer
                    </DropdownMenu.Item>
                  )}
                  {user?.user_code === 'dpsadmin' && (
                    <>
                      <DropdownMenu.Separator className="h-px bg-gray-100 my-1" />
                      <DropdownMenu.Item
                        className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-50 outline-none cursor-pointer"
                        onClick={async () => {
                          try {
                            const res = await api.get('/settings/get_current_settings');
                            const currentSettings = res.data;
                            const currentPath = currentSettings.token_file_path || '';
                            const newPath = window.prompt(
                              "Enter the local folder path to save the token count file (e.g., C:\\Tokens):",
                              currentPath
                            );
                            if (newPath !== null) {
                              const updatedSettings = { ...currentSettings, token_file_path: newPath.trim() };
                              await api.put('/settings/update', updatedSettings);
                              alert("Token folder path synced to database! All apps will now use this path.");
                            }
                          } catch (err) {
                            console.error(err);
                            alert("Failed to update token folder path.");
                          }
                        }}>
                        <Icons.FolderOpen className="w-4 h-4" />
                        Set Token Folder Path
                      </DropdownMenu.Item>
                    </>
                  )}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

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
                  
                  {(user?.is_all_access || user?.privileges?.includes('profile.read')) && (
                    <DropdownMenu.Item
                      className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-50 outline-none cursor-pointer"
                      onClick={() => navigate('/profile')}>
                      
                      <Icons.User className="w-4 h-4" />
                      Profile
                    </DropdownMenu.Item>
                  )}
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
