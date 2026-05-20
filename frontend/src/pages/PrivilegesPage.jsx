import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings } from 'lucide-react';
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
  'Master': [
    'items', 'item_categories', 'item_types', 'units', 'menu_items', 'vendors', 'devotees', 'donation_types'
  ],
  'Transaction': [
    'purchases', 'purchase_returns', 'consumptions', 'wastages', 'tokens', 'donations', 'stock_adjustments'
  ],
  'Report': [
    'reports'
  ],
  'System & Security': [
    'users', 'privileges', 'activity_logs', 'settings', 'dashboard'
  ]
};

const PrivilegesPage = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError, showConfirm } = useNotification();
  const [selectedRoleId, setSelectedRoleId] = useState('');

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

  const handleModuleToggle = (moduleName, type) => {
    if (isProtectedRole) return;
    const modulePrefixes = MODULE_GROUPS[moduleName];
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

  const renderModulePrivileges = (moduleName) => {
    const modulePrefixes = MODULE_GROUPS[moduleName];
    
    return (
      <Card key={moduleName} className="border-border-temple mb-6">
        <CardHeader className="bg-[#FAF7F2] border-b border-border-temple/40 py-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-text-main text-lg">{moduleName} Module</CardTitle>
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
              {modulePrefixes.map(prefix => {
                const readPriv = allPrivileges?.find(p => p.privilege_name === `${prefix}.read`);
                const writePriv = allPrivileges?.find(p => p.privilege_name === `${prefix}.write`);
                const deletePriv = allPrivileges?.find(p => p.privilege_name === `${prefix}.delete`);
                
                return (
                  <tr key={prefix} className="hover:bg-gray-50/50">
                    <td className="px-6 py-3 font-medium text-text-main capitalize">
                      {prefix.replace('_', ' ')}
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
        <div className="pb-10">
          {Object.keys(MODULE_GROUPS).map(groupName => renderModulePrivileges(groupName))}
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
