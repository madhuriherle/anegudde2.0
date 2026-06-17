import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  ChevronRight, 
  ChevronDown, 
  Search, 
  Layout, 
  Settings as SettingsIcon,
  Save,
  X,
  RefreshCw
} from 'lucide-react';
import * as Icons from 'lucide-react';
import api from '../api/axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { cn } from '../utils/cn';
import ConfirmDialog from '../components/ConfirmDialog';

const DynamicIcon = ({ name, ...props }) => {
  const IconComponent = Icons[name] || Icons.HelpCircle;
  return <IconComponent {...props} />;
};

const VALID_ROUTES = [
  '/',
  '/canteen',
  '/office',
  '/users',
  '/users/privileges',
  '/settings/modules',
  '/settings',
  '/settings/temple',
  '/settings/receipt',
  '/settings/cleanup',
  '/settings/printers',
  '/settings/donation-types',
  '/vendors',
  '/purchases',
  '/purchases/returns',
  '/daily-usage',
  '/donations',
  '/items/rawitem',
  '/items/categories',
  '/items/menu-items',
  '/reports/stock-summary',
  '/reports/canteen-summary',
  '/reports/manpower',
  '/reports/donations',
  '/reports/purchases',
  '/reports/tokens'
];

const ModuleManagementPage = () => {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [editingModule, setEditingModule] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null });
  const [routeError, setRouteError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    icon: '',
    route: '',
    opens_module_id: null,
    display_order: 0,
    parent_id: null,
    status: 1
  });

  const rootModuleOptions = modules.filter((module) => (
    module.parent_id === null &&
    module.name !== 'Main Menu' &&
    module.id !== editingModule?.id
  ));

  const fetchModules = async () => {
    setLoading(true);
    try {
      const response = await api.get('/modules/');
      setModules(response.data);
    } catch (error) {
      console.error('Failed to fetch modules:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModules();
  }, []);

  const toggleExpand = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleOpenModal = (module = null, parentId = null) => {
    setRouteError('');
    if (module) {
      setEditingModule(module);
      setFormData({
        name: module.name,
        icon: module.icon || '',
        route: module.route || '',
        opens_module_id: module.opens_module_id || null,
        display_order: module.display_order,
        parent_id: module.parent_id,
        status: module.status
      });
    } else {
      setEditingModule(null);
      setFormData({
        name: '',
        icon: '',
        route: '',
        opens_module_id: null,
        display_order: 0,
        parent_id: parentId,
        status: 1
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setRouteError('');
    const normalizedRoute = (formData.route || '').trim();
    const isGroupModule = editingModule?.submodules?.length > 0;

    if (normalizedRoute && !VALID_ROUTES.includes(normalizedRoute)) {
      setRouteError('Select a valid existing route from the list.');
      return;
    }

    const payload = {
      ...formData,
      opens_module_id: formData.opens_module_id ? Number(formData.opens_module_id) : null,
      route: isGroupModule ? '' : normalizedRoute
    };

    try {
      if (editingModule) {
        await api.put(`/modules/${editingModule.id}`, payload);
      } else {
        await api.post('/modules/', payload);
      }
      setIsModalOpen(false);
      fetchModules();
    } catch (error) {
      console.error('Failed to save module:', error);
      alert(error.response?.data?.detail || 'Failed to save module');
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/modules/${deleteConfirm.id}`);
      setDeleteConfirm({ open: false, id: null });
      fetchModules();
    } catch (error) {
      console.error('Failed to delete module:', error);
      alert(error.response?.data?.detail || 'Failed to delete module');
    }
  };

  const renderModuleRow = (module, depth = 0) => {
    const hasChildren = module.submodules && module.submodules.length > 0;
    const isExp = expanded[module.id];

    return (
      <React.Fragment key={module.id}>
        <div 
          className={cn(
            "flex items-center gap-4 py-3 px-4 border-b border-gray-100 hover:bg-gray-50 transition-colors",
            depth > 0 && "bg-gray-50/30"
          )}
          style={{ paddingLeft: `${(depth + 1) * 1.5}rem` }}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {hasChildren ? (
              <button onClick={() => toggleExpand(module.id)} className="p-1 hover:bg-gray-200 rounded">
                {isExp ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            ) : <div className="w-6" />}
            
            {module.icon ? <DynamicIcon name={module.icon} size={18} className="text-primary shrink-0" /> : <div className="w-4.5" />}
            
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-secondary truncate">{module.name}</span>
              {module.route && <span className="text-[10px] text-gray-400 font-mono truncate">{module.route}</span>}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-wrap gap-1 max-w-[200px]">
              {module.privileges?.map(p => (
                <span key={p.id} className="px-1.5 py-0.5 bg-secondary/10 text-secondary text-[10px] rounded border border-secondary/20 font-medium">
                  {p.privilege_name}
                </span>
              ))}
            </div>
            
            <div className="flex items-center gap-1">
              <button 
                onClick={() => handleOpenModal(null, module.id)}
                className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                title="Add Submodule"
              >
                <Plus size={16} />
              </button>
              <button 
                onClick={() => handleOpenModal(module)}
                className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                title="Edit"
              >
                <Edit2 size={16} />
              </button>
              <button 
                onClick={() => setDeleteConfirm({ open: true, id: module.id })}
                className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                title="Delete"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>
        {hasChildren && isExp && module.submodules.map(sm => renderModuleRow(sm, depth + 1))}
      </React.Fragment>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="page-title">Module Management</h1>
        </div>
        <Button 
          onClick={() => handleOpenModal()}
        >
          New Root Module
        </Button>
      </div>

      <Card className="border-none shadow-xl overflow-hidden rounded-3xl">
        <CardHeader className="bg-[#FAF7F2] border-b border-border-temple/10 py-6">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold text-secondary">Hierarchy View</CardTitle>
            <button onClick={fetchModules} className="p-2 hover:bg-white rounded-full transition-colors">
              <RefreshCw size={18} className={cn("text-text-light", loading && "animate-spin")} />
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 flex flex-col items-center gap-4">
              <Icons.Loader2 size={40} className="animate-spin text-primary" />
              <span className="text-xs font-black text-text-light uppercase tracking-widest">Loading modules...</span>
            </div>
          ) : (
            <div className="min-w-full">
              <div className="flex bg-gray-50/50 py-3 px-4 border-b border-gray-100 text-[10px] font-black text-text-light uppercase tracking-widest">
                <span className="flex-1">Module Name & Route</span>
                <span className="hidden md:block w-[200px] mr-12 text-center">Linked Privileges</span>
                <span className="w-[120px] text-right">Actions</span>
              </div>
              {modules.length > 0 ? modules.map(m => renderModuleRow(m)) : (
                <div className="py-20 text-center">
                  <Layout size={48} className="mx-auto text-gray-200 mb-4" />
                  <p className="text-gray-400 font-medium">No modules found. Start by creating a root module.</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal for Add/Edit Module */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="bg-[#FAF7F2] p-6 border-b border-border-temple/10 flex items-center justify-between">
              <h3 className="text-xl font-bold text-secondary">{editingModule ? 'Edit Module' : 'New Module'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-text-light uppercase tracking-widest">Module Name</label>
                <input 
                  required
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border-border-temple/20 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                  placeholder="e.g., Canteen Management"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-text-light uppercase tracking-widest">Icon (Lucide)</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={formData.icon}
                      onChange={e => setFormData({...formData, icon: e.target.value})}
                      className="w-full pl-11 pr-4 py-3 rounded-xl border-border-temple/20 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                      placeholder="e.g., Package"
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2">
                      <DynamicIcon name={formData.icon} size={18} className="text-text-light" />
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-text-light uppercase tracking-widest">Display Order</label>
                  <input 
                    type="number" 
                    value={formData.display_order}
                    onChange={e => setFormData({...formData, display_order: parseInt(e.target.value)})}
                    className="w-full px-4 py-3 rounded-xl border-border-temple/20 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-text-light uppercase tracking-widest">Frontend Route</label>
                <select
                  value={formData.route}
                  onChange={e => setFormData({...formData, route: e.target.value})}
                  disabled={editingModule?.submodules?.length > 0}
                  className="w-full px-4 py-3 rounded-xl border-border-temple/20 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <option value="">No route (Group only)</option>
                  {VALID_ROUTES.map((route) => (
                    <option key={route} value={route}>{route}</option>
                  ))}
                </select>
                {editingModule?.submodules?.length > 0 && (
                  <p className="text-xs text-gray-500">Parent module with children. Route is disabled.</p>
                )}
                {routeError && <p className="text-xs text-red-600">{routeError}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-text-light uppercase tracking-widest">Open Module</label>
                <select
                  value={formData.opens_module_id || ''}
                  onChange={e => setFormData({...formData, opens_module_id: e.target.value || null})}
                  className="w-full px-4 py-3 rounded-xl border-border-temple/20 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                >
                  <option value="">No module switch</option>
                  {rootModuleOptions.map((module) => (
                    <option key={module.id} value={module.id}>{module.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">Use this for launchers like Main Menu &gt; Canteen / Office / Seva.</p>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <input 
                  type="checkbox" 
                  id="status"
                  checked={formData.status === 1}
                  onChange={e => setFormData({...formData, status: e.target.checked ? 1 : 0})}
                  className="w-5 h-5 rounded border-border-temple/20 text-primary focus:ring-primary/20"
                />
                <label htmlFor="status" className="font-bold text-secondary">Active Status</label>
              </div>
              <div className="flex gap-3 mt-8">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  {editingModule ? 'Update Module' : 'Create Module'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog 
        isOpen={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: null })}
        onConfirm={handleDelete}
        title="Delete Module?"
        message="Are you sure you want to delete this module? This action cannot be undone."
        type="danger"
      />
    </div>
  );
};

export default ModuleManagementPage;
