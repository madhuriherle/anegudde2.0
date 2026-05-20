import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, CheckCircle2, Settings, UtensilsCrossed } from 'lucide-react';
import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Select } from '../components/ui/Select';
import { Label } from '../components/ui/Label';

const Checkbox = ({ checked, onCheckedChange, disabled }) => (
  <input 
    type="checkbox" 
    checked={checked} 
    onChange={(e) => onCheckedChange(e.target.checked)}
    disabled={disabled}
    className="w-4 h-4 text-[#C47A3A] border-gray-300 rounded focus:ring-[#C47A3A] cursor-pointer disabled:cursor-not-allowed"
  />
);

const MODULE_GROUPS = {
  'Main Module': [
    { prefix: 'users', parent: 'Users', label: 'Users', subItems: ['User Management', 'User Privileges'] },
    { prefix: 'settings', parent: 'Master Settings', label: 'System Settings', subItems: ['Temple Identity', 'Receipt Settings', 'Data Cleanup'] },
    { prefix: 'donation_types', parent: 'Master Settings', label: 'Donation Type' },
    { prefix: 'activity_logs', parent: 'Users', label: 'User Activity' },
    { prefix: 'devotees', parent: 'Office', label: 'Devotees' },
  ],
  'Canteen Module': [
    { prefix: 'dashboard', parent: 'Canteen', label: 'Dashboard' },
    { prefix: 'purchases', parent: 'Purchase', label: 'Purchase Entry' },
    { prefix: 'purchase_returns', parent: 'Purchase', label: 'Purchase Returns' },
    { prefix: 'consumptions', parent: 'Canteen', label: 'Daily Usage Entry' },
    { prefix: 'donations', parent: 'Canteen', label: 'Donations' },
    { prefix: 'vendors', parent: 'Canteen', label: 'Vendors' },
    { prefix: 'item_categories', parent: 'Items', label: 'Category' },
    { prefix: 'items', parent: 'Items', label: 'Raw Item' },
    { prefix: 'menu_items', parent: 'Items', label: 'Menu Item' },
    { prefix: 'item_types', parent: 'Items', label: 'Item Types' },
    { prefix: 'units', parent: 'Items', label: 'Units' },
    { prefix: 'wastages', parent: 'Canteen', label: 'Wastages' },
    { prefix: 'tokens', parent: 'Reports', label: 'Token Issued Report' },
    { prefix: 'reports', parent: 'Reports', label: 'Reports', subItems: ['Stock Summary', 'Canteen Summary', 'Manpower Report', 'Donation Report'] },
    { prefix: 'stock_adjustments', parent: 'Inventory', label: 'Stock Adjustments' },
    { prefix: 'vendor_payments', parent: 'Vendors', label: 'Vendor Payments' },
  ]
};

const MODULE_DETAILS = {
  'Main Module': {
    icon: Building2,
  },
  'Canteen Module': {
    icon: UtensilsCrossed,
  },
};

const getModuleEntries = (moduleName) => MODULE_GROUPS[moduleName] || [];

const formatFeatureName = (prefix) =>
  prefix.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());

const getModulePrivilegeIds = (moduleName, allPrivileges = []) => {
  const modulePrefixes = getModuleEntries(moduleName).map((entry) => entry.prefix);

  return allPrivileges
    .filter((privilege) => {
      const [modulePrefix] = privilege.privilege_name.split('.');
      return modulePrefixes.includes(modulePrefix);
    })
    .map((privilege) => privilege.id);
};

const PrivilegesPage = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError, showConfirm } = useNotification();
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [enabledModules, setEnabledModules] = useState({});

  // Fetch Roles
  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await api.get('/users/list_roles');
      return res.data;
    }
  });

  // Fetch All Privileges
  const { data: allPrivileges } = useQuery({
    queryKey: ['all-privileges'],
    queryFn: async () => {
      const res = await api.get('/users/list_privileges');
      return res.data;
    }
  });

  // Fetch Selected Role's Privileges
  const { data: rolePrivilegeIds, isLoading: isLoadingPrivs } = useQuery({
    queryKey: ['role-privileges', selectedRoleId],
    queryFn: async () => {
      if (!selectedRoleId) return [];
      const res = await api.get(`/users/get_role_privileges/${selectedRoleId}`);
      return res.data;
    },
    enabled: !!selectedRoleId
  });

  const [localPrivIds, setLocalPrivIds] = useState([]);

  // Sync local state when data loads
  React.useEffect(() => {
    if (rolePrivilegeIds) {
      setLocalPrivIds(rolePrivilegeIds);
      setEnabledModules({});
    }
  }, [rolePrivilegeIds]);

  const selectedRole = roles?.find(r => r.id === Number(selectedRoleId));
  const isProtectedRole = selectedRole?.is_all_access;

  const mutation = useMutation({
    mutationFn: async (privilege_ids) => {
      return api.put(`/users/update_role_privileges/${selectedRoleId}`, { privilege_ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-privileges', selectedRoleId] });
      showSuccess('Privileges updated successfully');
    },
    onError: (err) => {
      showError(err.response?.data?.detail || 'Update failed');
    }
  });

  const handleToggle = (privId) => {
    if (isProtectedRole) return;
    setLocalPrivIds(prev => 
      prev.includes(privId) ? prev.filter(id => id !== privId) : [...prev, privId]
    );
  };

  const handleModuleAccessToggle = (moduleName, enabled) => {
    if (isProtectedRole) return;

    setEnabledModules((prev) => ({ ...prev, [moduleName]: enabled }));
  };

  const handleModuleToggle = (moduleName, type) => {
    if (isProtectedRole) return;
    const modulePrefixes = getModuleEntries(moduleName).map((entry) => entry.prefix);
    const privsToToggle = allPrivileges?.filter(p => {
      const [mod, action] = p.privilege_name.split('.');
      return modulePrefixes.includes(mod) && action === type;
    });

    if (!privsToToggle) return;

    const privIds = privsToToggle.map(p => p.id);
    const allSelected = privIds.every(id => localPrivIds.includes(id));

    if (allSelected) {
      setLocalPrivIds(prev => prev.filter(id => !privIds.includes(id)));
    } else {
      setLocalPrivIds(prev => Array.from(new Set([...prev, ...privIds])));
    }
  };

  const handleSave = async () => {
    const confirmed = await showConfirm(
      "Confirm Update",
      `Are you sure you want to update privileges for ${selectedRole?.role_name}?`
    );
    if (confirmed) {
      mutation.mutate(localPrivIds);
    }
  };

  const renderModuleAccessCard = (moduleName) => {
    const details = MODULE_DETAILS[moduleName];
    const Icon = details.icon;
    const enabled = Boolean(enabledModules[moduleName]) || isProtectedRole;

    return (
      <button
        key={moduleName}
        type="button"
        disabled={isProtectedRole}
        onClick={() => handleModuleAccessToggle(moduleName, !enabled)}
        className={`min-h-[120px] rounded-2xl border p-6 text-left transition-all ${
          enabled
            ? 'border-[#C97B63] bg-[#FFF7ED] shadow-sm ring-2 ring-[#C97B63]/10'
            : 'border-[#E7D8CC] bg-white hover:border-[#C97B63]/50 hover:bg-[#FFFDFB]'
        } ${isProtectedRole ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
      >
        <div className="flex h-full items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`rounded-xl p-3 ${enabled ? 'bg-[#C97B63] text-white' : 'bg-[#F8F4EE] text-[#8B4513]'}`}>
              <Icon className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-black text-[#2B2B2B]">{moduleName}</h3>
          </div>
          {enabled ? (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#C97B63] px-3 py-1 text-xs font-black uppercase tracking-widest text-white">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Selected
            </div>
          ) : (
            <div className="rounded-full bg-[#F3E8DE] px-3 py-1 text-xs font-black uppercase tracking-widest text-[#8B4513]">
              Select
            </div>
          )}
        </div>
      </button>
    );
  };

  const renderModulePrivileges = (moduleName) => {
    const moduleEntries = getModuleEntries(moduleName);
    
    return (
      <Card key={moduleName} className="border-border-temple mb-6">
        <CardHeader className="bg-[#FAF7F2] border-b border-border-temple/40 py-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-text-main text-lg">{moduleName} Pages</CardTitle>
            <div className="flex gap-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleModuleToggle(moduleName, 'read')}
                disabled={isProtectedRole}
                className="text-xs h-7"
              >
                Toggle All Read
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleModuleToggle(moduleName, 'write')}
                disabled={isProtectedRole}
                className="text-xs h-7"
              >
                Toggle All Write
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleModuleToggle(moduleName, 'delete')}
                disabled={isProtectedRole}
                className="text-xs h-7"
              >
                Toggle All Delete
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-gray-50 text-gray-700 border-b">
              <tr>
                <th className="px-6 py-3 font-bold">Module / Feature</th>
                <th className="px-6 py-3 text-center font-bold">Read Access</th>
                <th className="px-6 py-3 text-center font-bold">Write Access</th>
                <th className="px-6 py-3 text-center font-bold">Delete Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {moduleEntries.map(({ prefix, parent, label, subItems }) => {
                const readPriv = allPrivileges?.find(p => p.privilege_name === `${prefix}.read`);
                const writePriv = allPrivileges?.find(p => p.privilege_name === `${prefix}.write`);
                const deletePriv = allPrivileges?.find(p => p.privilege_name === `${prefix}.delete`);
                
                return (
                  <tr key={prefix} className="hover:bg-gray-50/50">
                    <td className="px-6 py-3 font-medium text-text-main">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black uppercase tracking-widest text-[#8B4513]/60">
                          {parent}
                        </span>
                        <span className="text-[15px] font-bold text-[#2B2B2B]">
                          {label || formatFeatureName(prefix)}
                        </span>
                        {subItems?.length > 0 && (
                          <span className="mt-1 flex flex-wrap gap-1.5">
                            {subItems.map((item) => (
                              <span
                                key={item}
                                className="rounded-full border border-[#E7D8CC] bg-[#FAF7F2] px-2 py-0.5 text-[11px] font-semibold text-[#6B5B4B]"
                              >
                                {item}
                              </span>
                            ))}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-center">
                      {readPriv && (
                        <Checkbox 
                          checked={localPrivIds.includes(readPriv.id) || isProtectedRole}
                          onCheckedChange={() => handleToggle(readPriv.id)}
                          disabled={isProtectedRole}
                        />
                      )}
                    </td>
                    <td className="px-6 py-3 text-center">
                      {writePriv && (
                        <Checkbox 
                          checked={localPrivIds.includes(writePriv.id) || isProtectedRole}
                          onCheckedChange={() => handleToggle(writePriv.id)}
                          disabled={isProtectedRole}
                        />
                      )}
                    </td>
                    <td className="px-6 py-3 text-center">
                      {deletePriv && (
                        <Checkbox 
                          checked={localPrivIds.includes(deletePriv.id) || isProtectedRole}
                          onCheckedChange={() => handleToggle(deletePriv.id)}
                          disabled={isProtectedRole}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="page-title">Privilege Management</h2>

        </div>
        {selectedRoleId && !isProtectedRole && (
          <Button 
            onClick={handleSave} 
            disabled={mutation.isPending}
            className="text-text-main font-bold px-8 h-10"
          >
            {mutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        )}
      </div>

      <Card className="border-border-temple bg-[#FAF7F2]/50">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-end gap-4">
            <div className="space-y-1.5 w-full sm:max-w-xs">
              <Label className="text-text-main font-bold">Select Role to Configure</Label>
              <Select 
                value={selectedRoleId} 
                onChange={(e) => setSelectedRoleId(e.target.value)}
                className="bg-white"
              >
                <option value="" disabled>Select a role</option>
                {roles?.map(r => (
                  <option key={r.id} value={r.id}>{r.role_name}</option>
                ))}
              </Select>
            </div>
            {isProtectedRole && (
              <p className="text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded text-sm mb-1">
                Note: <strong>{selectedRole?.role_name}</strong> has full access to all modules by default. These settings cannot be modified.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedRoleId ? (
        <div className="space-y-6 pb-10">
          <div className="space-y-3">
            <div>
              <h3 className="text-lg font-black text-[#2B2B2B]">Select Module</h3>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {Object.keys(MODULE_GROUPS).map(renderModuleAccessCard)}
            </div>
          </div>

          {(Object.keys(MODULE_GROUPS).some((groupName) => enabledModules[groupName] || isProtectedRole)) && (
            <div className="space-y-6 border-t border-[#E7D8CC] pt-6">
              <div>
                <h3 className="text-lg font-black text-[#2B2B2B]">Related Page Permissions</h3>
              </div>
              {Object.keys(MODULE_GROUPS)
                .filter((groupName) => enabledModules[groupName] || isProtectedRole)
                .map(groupName => renderModulePrivileges(groupName))}
            </div>
          )}

          {!Object.keys(MODULE_GROUPS).some((groupName) => enabledModules[groupName] || isProtectedRole) && (
            <div className="rounded-2xl border border-dashed border-[#D9C8AF] bg-white p-8 text-center">
              <p className="text-base font-bold text-[#6B6B6B]">
                Select a module to show permissions.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-dashed border-gray-300 rounded-lg">
          <div className="bg-gray-50 p-4 rounded-full mb-4">
            <Settings className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500 font-medium">Please select a role to view and manage privileges</p>
        </div>
      )}
    </div>
  );
};

export default PrivilegesPage;
