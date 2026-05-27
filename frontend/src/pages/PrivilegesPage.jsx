import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Icons from 'lucide-react';
import { CheckCircle2, Settings, ChevronDown } from 'lucide-react';
import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Select } from '../components/ui/Select';
import { Label } from '../components/ui/Label';

const DynamicIcon = ({ name, ...props }) => {
  const IconComponent = Icons[name] || Icons.HelpCircle;
  return <IconComponent {...props} />;
};

const getPrivilegeParts = (privilegeName = '') => {
  const parts = privilegeName.split('.');
  if (parts.length < 2) return { prefix: privilegeName, action: '' };
  return {
    prefix: parts.slice(0, -1).join('.'),
    action: parts[parts.length - 1],
  };
};

const pickMostSpecificPrivilege = (privileges = [], action) => {
  const candidates = privileges.filter(
    (p) => getPrivilegeParts(p.privilege_name).action === action
  );

  if (candidates.length === 0) return null;

  return [...candidates].sort((a, b) => {
    const aPrefixLen = getPrivilegeParts(a.privilege_name).prefix.length;
    const bPrefixLen = getPrivilegeParts(b.privilege_name).prefix.length;
    return bPrefixLen - aPrefixLen;
  })[0];
};

const buildGroupedModules = (menuRoots = [], allPrivileges = []) => {
  const allPrivilegesSafe = allPrivileges || [];

  const buildRowsForRoot = (root) => {
    const rows = [];

    const walk = (node, parentTrail = []) => {
      const trail = [...parentTrail, node.name];
      const linkedPrivs = node.privileges || [];

      const prefixSet = new Set(
        linkedPrivs
          .map((p) => getPrivilegeParts(p.privilege_name).prefix)
          .filter(Boolean)
      );

      let readPriv = pickMostSpecificPrivilege(linkedPrivs, 'read');
      let writePriv = pickMostSpecificPrivilege(linkedPrivs, 'write');
      let deletePriv = pickMostSpecificPrivilege(linkedPrivs, 'delete');

      const prefixList = [...prefixSet].sort((a, b) => b.length - a.length);

      if (!readPriv && prefixList.length > 0) {
        readPriv =
          allPrivilegesSafe.find((p) => {
            const parts = getPrivilegeParts(p.privilege_name);
            return prefixList.includes(parts.prefix) && parts.action === 'read';
          }) || null;
      }

      if (!writePriv && prefixList.length > 0) {
        writePriv =
          allPrivilegesSafe.find((p) => {
            const parts = getPrivilegeParts(p.privilege_name);
            return prefixList.includes(parts.prefix) && parts.action === 'write';
          }) || null;
      }

      if (!deletePriv && prefixList.length > 0) {
        deletePriv =
          allPrivilegesSafe.find((p) => {
            const parts = getPrivilegeParts(p.privilege_name);
            return prefixList.includes(parts.prefix) && parts.action === 'delete';
          }) || null;
      }

      const hasChildren = Boolean(node.submodules?.length);
      const shouldRender =
        node.id !== root.id &&
        (node.route || hasChildren || readPriv || writePriv || deletePriv);

      if (shouldRender) {
        const parent = trail.length > 1 ? trail[trail.length - 2] : root.name;
        const hierarchyLevel = Math.max(trail.length - 1, 1);

        const type =
          hierarchyLevel === 1
            ? 'Root'
            : hierarchyLevel === 2
              ? 'Module'
              : hierarchyLevel === 3
                ? 'Submodule'
                : 'Page';

        rows.push({
          key: node.id,
          parent,
          label: node.name,
          depth: Math.max(trail.length - 2, 0),
          hierarchyLevel,
          type,
          readPriv,
          writePriv,
          deletePriv,
        });
      }

      (node.submodules || []).forEach((child) => walk(child, trail));
    };

    walk(root, []);
    return rows;
  };

  return menuRoots
    .map((root) => ({
      id: root.id,
      name: root.name,
      icon: root.icon,
      rows: buildRowsForRoot(root),
    }))
    .filter((group) => group.rows.length > 0);
};

const groupRowsByParent = (rows = []) => {
  return rows.reduce((acc, row) => {
    const groupName = row.parent || 'General';
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(row);
    return acc;
  }, {});
};

const levelStyle = {
  Root: {
    badge: 'bg-[#EAD7C2] text-[#6F431E]',
    line: 'bg-[#B77B45]',
  },
  Module: {
    badge: 'bg-[#E7EEF8] text-[#355C8A]',
    line: 'bg-[#5F8FC5]',
  },
  Submodule: {
    badge: 'bg-[#E9F4EA] text-[#3F6B45]',
    line: 'bg-[#6BA56F]',
  },
  Page: {
    badge: 'bg-[#F1EAF8] text-[#684487]',
    line: 'bg-[#9875B8]',
  },
};

const PermissionChip = ({ label, checked, disabled, onClick }) => {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`h-8 min-w-[72px] rounded-full border px-3 text-xs font-black transition-all ${
        checked
          ? 'border-[#8B5E34] bg-[#8B5E34] text-white shadow-sm'
          : 'border-[#E4D5C5] bg-white text-[#7A6A5A] hover:border-[#8B5E34]/60 hover:bg-[#F8F1EA]'
      } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
    >
      {label}
    </button>
  );
};

const PrivilegesPage = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError, showConfirm } = useNotification();
  const { user } = useAuth();

  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [enabledModules, setEnabledModules] = useState({});
  const [expandedModules, setExpandedModules] = useState({});
  const [levelFilter, setLevelFilter] = useState('All');
  const [localPrivIds, setLocalPrivIds] = useState([]);

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await api.get('/users/list_roles');
      return res.data;
    },
  });

  const { data: allPrivileges } = useQuery({
    queryKey: ['all-privileges'],
    queryFn: async () => {
      const res = await api.get('/users/list_privileges');
      return res.data;
    },
  });

  const { data: menuRoots } = useQuery({
    queryKey: ['modules-menu-for-privileges'],
    queryFn: async () => {
      const res = await api.get('/modules/menu');
      return res.data;
    },
  });

  const { data: rolePrivilegeIds } = useQuery({
    queryKey: ['role-privileges', selectedRoleId],
    queryFn: async () => {
      if (!selectedRoleId) return [];
      const res = await api.get(`/users/get_role_privileges/${selectedRoleId}`);
      return res.data;
    },
    enabled: !!selectedRoleId,
  });

  const groupedModules = useMemo(
    () => buildGroupedModules(menuRoots || [], allPrivileges || []),
    [menuRoots, allPrivileges]
  );

  React.useEffect(() => {
    if (rolePrivilegeIds) {
      setLocalPrivIds(rolePrivilegeIds);
      setEnabledModules({});
      setExpandedModules({});
    }
  }, [rolePrivilegeIds]);

  const selectedRole = roles?.find((r) => r.id === Number(selectedRoleId));
  const myRank = user?.role_rank_level ?? 99;
  const selectedRoleRank = selectedRole?.rank_level ?? 99;
  const isAllAccessRole = selectedRole?.is_all_access;
  const isProtectedRole = selectedRole ? selectedRoleRank <= myRank : false;

  const mutation = useMutation({
    mutationFn: async (privilege_ids) => {
      return api.put(`/users/update_role_privileges/${selectedRoleId}`, {
        privilege_ids,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['role-privileges', selectedRoleId],
      });
      showSuccess('Privileges updated successfully');
    },
    onError: (err) => {
      showError(err.response?.data?.detail || 'Update failed');
    },
  });
    const handleToggle = (privId) => {
    if (isProtectedRole) return;

    setLocalPrivIds((prev) =>
      prev.includes(privId)
        ? prev.filter((id) => id !== privId)
        : [...prev, privId]
    );
  };

  const handleModuleAccessToggle = (moduleId, enabled) => {
    if (isProtectedRole) return;

    setEnabledModules((prev) => ({
      ...prev,
      [moduleId]: enabled,
    }));

    if (enabled) {
      setExpandedModules((prev) => ({
        ...prev,
        [moduleId]: true,
      }));
    }
  };

  const handleModuleExpandToggle = (moduleId) => {
    setExpandedModules((prev) => ({
      ...prev,
      [moduleId]: !prev[moduleId],
    }));
  };

  const handleModuleToggle = (moduleId, type) => {
    if (isProtectedRole) return;

    const module = groupedModules.find((m) => m.id === moduleId);
    if (!module) return;

    const privIds = module.rows
      .map((row) =>
        type === 'read'
          ? row.readPriv?.id
          : type === 'write'
            ? row.writePriv?.id
            : row.deletePriv?.id
      )
      .filter(Boolean);

    if (privIds.length === 0) return;

    const allSelected = privIds.every((id) =>
      localPrivIds.includes(id)
    );

    if (allSelected) {
      setLocalPrivIds((prev) =>
        prev.filter((id) => !privIds.includes(id))
      );
    } else {
      setLocalPrivIds((prev) =>
        Array.from(new Set([...prev, ...privIds]))
      );
    }
  };

  const handleSave = async () => {
    const confirmed = await showConfirm(
      'Confirm Update',
      `Are you sure you want to update privileges for ${selectedRole?.role_name}?`
    );

    if (confirmed) {
      mutation.mutate(localPrivIds);
    }
  };

  const renderModuleAccessCard = (module) => {
    const enabled =
      Boolean(enabledModules[module.id]) || isProtectedRole;

    return (
      <button
        key={module.id}
        type="button"
        disabled={isProtectedRole}
        onClick={() =>
          handleModuleAccessToggle(module.id, !enabled)
        }
        className={`rounded-2xl border p-5 text-left transition-all ${
          enabled
            ? 'border-[#8B5E34] bg-[#F8F1EA] shadow-sm ring-2 ring-[#8B5E34]/10'
            : 'border-[#E6D8C9] bg-white hover:border-[#8B5E34]/50 hover:bg-[#FFFDFB]'
        } ${
          isProtectedRole
            ? 'cursor-not-allowed opacity-80'
            : 'cursor-pointer'
        }`}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div
              className={`rounded-xl p-3 shrink-0 ${
                enabled
                  ? 'bg-[#8B5E34] text-white'
                  : 'bg-[#F3E8DD] text-[#8B5E34]'
              }`}
            >
              <DynamicIcon
                name={module.icon}
                className="h-5 w-5"
              />
            </div>

            <div className="min-w-0">
              <h3 className="truncate text-base font-black text-[#2B2B2B]">
                {module.name}
              </h3>

              <p className="text-xs font-semibold text-[#777777] mt-0.5">
                {module.rows.length} permission items
              </p>
            </div>
          </div>

          {enabled ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#8B5E34] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white shrink-0">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Selected
            </span>
          ) : (
            <span className="rounded-full bg-[#F3E8DD] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#8B5E34] shrink-0">
              Select
            </span>
          )}
        </div>
      </button>
    );
  };

  const renderPermissionRow = (row) => {
    const style = levelStyle[row.type] || levelStyle.Page;

    return (
      <div
        key={row.key}
        className={`group relative flex flex-col gap-3 rounded-2xl border border-[#ECE2D8] bg-white px-4 py-3 transition-all hover:border-[#D7B89A] hover:shadow-sm lg:flex-row lg:items-center lg:justify-between ${
          row.depth > 0 ? 'ml-3' : ''
        }`}
      >
        {/* left accent */}
        <div
          className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full ${style.line}`}
        />

        {/* LEFT */}
        <div className="min-w-0 pl-3">
          <h4 className="truncate text-[15px] font-black text-[#2B2B2B]">
            {row.label}
          </h4>

          <div className="mt-1 flex items-center gap-2 text-xs">
            <span
              className={`rounded-full px-2 py-[3px] text-[10px] font-black uppercase tracking-wider ${style.badge}`}
            >
              {row.type}
            </span>

            <span className="text-[#8A7B6C] font-semibold">
              {row.parent}
            </span>
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex shrink-0 items-center">
          <div className="flex overflow-hidden rounded-full border border-[#E5D6C7] bg-[#FAF7F3]">
            {/* READ */}
            {row.readPriv && (
              <button
                type="button"
                onClick={() => handleToggle(row.readPriv.id)}
                className={`min-w-[88px] px-4 py-2 text-xs font-black transition-all active:scale-95 ${
                  localPrivIds.includes(row.readPriv.id) || isAllAccessRole
                    ? 'bg-[#8B5E34] text-white shadow-[inset_0_-2px_0_rgba(0,0,0,0.18)]'
                    : 'bg-white text-[#7A5A42] hover:bg-[#F7EEE4]'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {(localPrivIds.includes(row.readPriv.id) || isAllAccessRole) && <span>✓</span>}
                  <span>Read</span>
                </span>
              </button>
            )}

            {/* WRITE */}
            {row.writePriv && (
              <button
                type="button"
                onClick={() => handleToggle(row.writePriv.id)}
                className={`min-w-[88px] border-l border-[#E5D6C7] px-4 py-2 text-xs font-black transition-all active:scale-95 ${
                  localPrivIds.includes(row.writePriv.id) || isAllAccessRole
                    ? 'bg-[#8B5E34] text-white shadow-[inset_0_-2px_0_rgba(0,0,0,0.18)]'
                    : 'bg-white text-[#7A5A42] hover:bg-[#F7EEE4]'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {(localPrivIds.includes(row.writePriv.id) || isAllAccessRole) && <span>✓</span>}
                  <span>Write</span>
                </span>
              </button>
            )}

            {/* DELETE */}
            {row.deletePriv && (
              <button
                type="button"
                onClick={() => handleToggle(row.deletePriv.id)}
                className={`min-w-[88px] border-l border-[#E5D6C7] px-4 py-2 text-xs font-black transition-all active:scale-95 ${
                  localPrivIds.includes(row.deletePriv.id) || isAllAccessRole
                    ? 'bg-[#8B5E34] text-white shadow-[inset_0_-2px_0_rgba(0,0,0,0.18)]'
                    : 'bg-white text-[#7A5A42] hover:bg-[#F7EEE4]'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {(localPrivIds.includes(row.deletePriv.id) || isAllAccessRole) && <span>✓</span>}
                  <span>Delete</span>
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderModulePrivileges = (module) => {
    const filteredRows = module.rows.filter(
      (row) =>
        levelFilter === 'All' || row.type === levelFilter
    );

    const grouped = groupRowsByParent(filteredRows);

    const isExpanded =
      expandedModules[module.id] ?? true;

    return (
      <Card
        key={module.id}
        className="overflow-hidden border-[#E6D8C9] bg-white"
      >
        <CardHeader className="bg-[#FAF7F2] border-b border-[#EFE3D8] px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <button
              type="button"
              onClick={() =>
                handleModuleExpandToggle(module.id)
              }
              className="flex items-center gap-3 text-left"
            >
              <div className="rounded-xl bg-[#F3E8DD] p-2.5 text-[#8B5E34]">
                <DynamicIcon
                  name={module.icon}
                  className="h-5 w-5"
                />
              </div>

              <div>
                <CardTitle className="text-base font-black text-[#2B2B2B]">
                  {module.name}
                </CardTitle>

                <p className="text-xs font-semibold text-[#777777]">
                  {filteredRows.length} visible permissions
                </p>
              </div>

              <ChevronDown
                className={`h-5 w-5 text-[#8B5E34] transition-transform ${
                  isExpanded ? 'rotate-180' : ''
                }`}
              />
            </button>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  handleModuleToggle(module.id, 'read')
                }
                disabled={isProtectedRole}
                className="h-8 rounded-full bg-white px-3 text-xs font-black text-[#8B5E34] hover:bg-[#F3E8DD]"
              >
                All Read
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  handleModuleToggle(module.id, 'write')
                }
                disabled={isProtectedRole}
                className="h-8 rounded-full bg-white px-3 text-xs font-black text-[#8B5E34] hover:bg-[#F3E8DD]"
              >
                All Write
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  handleModuleToggle(module.id, 'delete')
                }
                disabled={isProtectedRole}
                className="h-8 rounded-full bg-white px-3 text-xs font-black text-[#8B5E34] hover:bg-[#F3E8DD]"
              >
                All Delete
              </Button>
            </div>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="space-y-3 bg-[#F8F6F3] p-3">
            {Object.entries(grouped).map(
              ([groupName, rows]) => (
                <div
                  key={groupName}
                  className="rounded-2xl bg-[#FCFAF8] p-3"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-black uppercase tracking-wider text-[#8B5E34]">
                      {groupName}
                    </h3>

                    <div className="h-px flex-1 bg-[#E9DDD1] ml-4" />
                  </div>

                  <div className="space-y-3">
                    {rows.map(renderPermissionRow)}
                  </div>
                </div>
              )
            )}
          </CardContent>
        )}
      </Card>
    );
  };

  const hierarchyFilters = [
    'All',
    'Root',
    'Module',
    'Submodule',
    'Page',
  ];

  const isAnyModuleSelected = groupedModules.some(
    (group) =>
      enabledModules[group.id] || isProtectedRole
  );

  return (
    <div className="space-y-6 bg-[#F8F6F3]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="page-title">
            Privilege Management
          </h2>

          <p className="mt-1 text-sm font-medium text-[#777777]">
            Clean permission management with grouped access controls.
          </p>
        </div>

        {selectedRoleId && !isProtectedRole && (
          <Button
            onClick={handleSave}
            disabled={mutation.isPending}
            className="h-10 bg-[#8B5E34] hover:bg-[#754B29] text-white px-8 font-bold"
          >
            {mutation.isPending
              ? 'Saving...'
              : 'Save Changes'}
          </Button>
        )}
      </div>

      <Card className="border-[#E6D8C9] bg-white">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-end gap-4">
            <div className="space-y-1.5 w-full sm:max-w-xs">
              <Label className="text-[#2B2B2B] font-bold">
                Select Role
              </Label>

              <Select
                value={selectedRoleId}
                onChange={(e) =>
                  setSelectedRoleId(e.target.value)
                }
                className="bg-white"
              >
                <option value="" disabled>
                  Select a role
                </option>

                {roles?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.role_name}
                  </option>
                ))}
              </Select>
            </div>

            {isProtectedRole && (
              <p className="text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded text-sm mb-1">
                <strong>
                  {selectedRole?.role_name}
                </strong>{' '}
                cannot be modified.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedRoleId ? (
        <div className="space-y-6 pb-10">
          <div className="space-y-3">
            <h3 className="text-lg font-black text-[#2B2B2B]">
              Select Modules
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {groupedModules.map(renderModuleAccessCard)}
            </div>
          </div>

          {isAnyModuleSelected && (
            <div className="space-y-5 border-t border-[#E6D8C9] pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-[#2B2B2B]">
                    Page Permissions
                  </h3>

                  <p className="text-sm font-medium text-[#777777]">
                    Modern grouped permission layout.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {hierarchyFilters.map((filter) => {
                    const style = levelStyle[filter];

                    return (
                      <button
                        key={filter}
                        type="button"
                        onClick={() =>
                          setLevelFilter(filter)
                        }
                        className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider border transition ${
                          levelFilter === filter
                            ? 'bg-[#8B5E34] text-white border-[#8B5E34]'
                            : style
                              ? `${style.badge} border-transparent`
                              : 'bg-white text-[#8B5E34] border-[#E6D8C9] hover:bg-[#F3E8DD]'
                        }`}
                      >
                        {filter}
                      </button>
                    );
                  })}
                </div>
              </div>

              {groupedModules
                .filter(
                  (group) =>
                    enabledModules[group.id] ||
                    isProtectedRole
                )
                .map((group) =>
                  renderModulePrivileges(group)
                )}
            </div>
          )}

          {!isAnyModuleSelected && (
            <div className="rounded-2xl border border-dashed border-[#D9C8AF] bg-white p-8 text-center">
              <p className="text-base font-bold text-[#777777]">
                Select a module to show permissions.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-dashed border-[#D9C8AF] rounded-2xl">
          <div className="bg-[#F3E8DD] p-4 rounded-full mb-4">
            <Settings className="w-8 h-8 text-[#8B5E34]" />
          </div>

          <p className="text-[#777777] font-bold">
            Please select a role to manage privileges
          </p>
        </div>
      )}
    </div>
  );
};

export default PrivilegesPage;
