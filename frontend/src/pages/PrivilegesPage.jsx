import React, { useMemo, useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Settings, ChevronDown, ChevronRight, Save as SaveIcon, Search as SearchIcon, ShieldCheck } from 'lucide-react';
import * as Icons from 'lucide-react';
import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Select } from '../components/ui/Select';
import { Label } from '../components/ui/Label';
import { cn } from '../utils/cn';

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

const buildGroupedModules = (displayRoots = [], referenceRoots = [], selectedRoleRank = 99) => {
  const buildRowsForRoot = (root) => {
    const rows = [];
    const walkedModuleIds = new Set();

    const walk = (node, parentTrail = [], parentIds = []) => {
      if (node.min_rank_level && selectedRoleRank > node.min_rank_level) return;
      if (walkedModuleIds.has(node.id)) return;
      walkedModuleIds.add(node.id);

      const trail = [...parentTrail, node.name];
      const linkedPrivs = node.privileges || [];

      const readPriv = pickMostSpecificPrivilege(linkedPrivs, 'read');
      const writePriv = pickMostSpecificPrivilege(linkedPrivs, 'write');
      const deletePriv = pickMostSpecificPrivilege(linkedPrivs, 'delete');

      const hasChildren = Boolean(node.submodules?.length);
      const hasLinkedPrivilege = Boolean(readPriv || writePriv || deletePriv);

      // Render if it has privileges, OR it's a leaf node with a route
      const shouldRender = hasLinkedPrivilege || (!hasChildren && node.route);

      if (shouldRender) {
        rows.push({
          key: node.id,
          label: node.name,
          icon: node.icon,
          depth: Math.max(trail.length - 1, 0),
          path: trail.slice(0, -1).join(' / '),
          parent: parentTrail.length > 0 ? parentTrail[parentTrail.length - 1] : null,
          parentIds: [...parentIds],
          minRankLevel: node.min_rank_level,
          type:
            trail.length === 1
              ? 'Root'
              : trail.length === 2
                ? 'Module'
                : trail.length === 3
                  ? 'Submodule'
                  : 'Page',
          readPriv,
          writePriv,
          deletePriv,
        });
      }

      (node.submodules || []).forEach((child) => walk(child, trail, [...parentIds, node.id]));
    };

    walk(root, []);
    return rows;
  };

  const groups = displayRoots
    .map((root) => ({
      id: root.id,
      name: root.name,
      icon: root.icon,
      rows: buildRowsForRoot(root),
    }))
    .filter((group) => group.rows.length > 0);

  return groups;
};

const uniqueIds = (ids) => Array.from(new Set(ids.filter(Boolean)));

const PrivilegeCheckbox = ({ checked, disabled, onChange, indeterminate = false }) => {
  const ref = React.useRef();

  React.useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      className={cn(
        "h-4 w-4 rounded border-[#CDB79F] accent-[#8B5E34] transition-all cursor-pointer",
        disabled && "cursor-not-allowed opacity-50"
      )}
    />
  );
};

const RowBadge = ({ children, tone = 'neutral' }) => {
  const tones = {
    neutral: 'border-[#E6D8C9] bg-[#FBF8F4] text-[#6F6257]',
    module: 'border-[#D8C1A7] bg-[#F6E9D8] text-[#70431E]',
    rank: 'border-[#D9C2B6] bg-[#F8ECE7] text-[#8C3E22]',
    dependency: 'border-[#E7C9A4] bg-[#FFF5E8] text-[#A34D18]',
  };

  return (
    <span className={`inline-flex h-5 items-center rounded px-1.5 text-[9px] font-black uppercase tracking-tight border ${tones[tone]}`}>
      {children}
    </span>
  );
};

const PrivilegesPage = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError, showConfirm } = useNotification();
  const { user } = useAuth();

  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [localPrivIds, setLocalPrivIds] = useState([]);
  const [moduleFilter, setModuleFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState({});

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await api.get('/users/list_roles');
      return res.data;
    },
  });

  const { data: menuRoots } = useQuery({
    queryKey: ['modules-privilege-tree'],
    queryFn: async () => {
      const res = await api.get('/modules/privilege-tree');
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

  const selectedRole = roles?.find((r) => r.id === Number(selectedRoleId));
  const myRank = user?.role_rank_level ?? 99;
  const selectedRoleRank = selectedRole?.rank_level ?? 99;
  const isAllAccessRole = Boolean(selectedRole?.is_all_access);
  const isProtectedRole = selectedRole ? selectedRoleRank <= myRank : false;
  const canEdit = selectedRoleId && !isProtectedRole && !isAllAccessRole;

  const groupedModules = useMemo(
    () => {
      let rawRoots = menuRoots || [];
      
      // If the only root is "Main Menu", flatten it so its children become the rooms
      if (rawRoots.length === 1 && rawRoots[0].name === "Main Menu") {
        rawRoots = rawRoots[0].submodules || [];
      }

      let filteredRoots = rawRoots;
      if (selectedRole?.module_id) {
        const findBranch = (modules) => {
          for (const m of modules) {
            if (String(m.id) === String(selectedRole.module_id)) return [m];
            if (m.submodules) {
              const found = findBranch(m.submodules);
              if (found) return found;
            }
          }
          return null;
        };
        const branch = findBranch(rawRoots);
        if (branch) {
          filteredRoots = branch;
        } else {
          filteredRoots = [];
        }
      }
      return buildGroupedModules(filteredRoots, menuRoots || [], selectedRoleRank);
    },
    [menuRoots, selectedRoleRank, selectedRole?.module_id]
  );

  const editablePrivilegeIds = useMemo(
    () =>
      new Set(
        groupedModules.flatMap((group) =>
          group.rows.flatMap((row) => [
            row.readPriv?.id,
            row.writePriv?.id,
            row.deletePriv?.id,
          ])
        ).filter(Boolean)
      ),
    [groupedModules]
  );

  const departmentOptions = useMemo(() => {
    // Only show the top-level Groups in the filter to keep it clean
    return groupedModules.map((group) => ({
      id: group.id,
      name: group.name,
      depth: 0,
    }));
  }, [groupedModules]);

  useEffect(() => {
    if (!rolePrivilegeIds) {
      setLocalPrivIds([]);
      return;
    }
    if (editablePrivilegeIds.size === 0) {
      setLocalPrivIds(rolePrivilegeIds);
      return;
    }
    setLocalPrivIds(rolePrivilegeIds.filter((id) => editablePrivilegeIds.has(id)));
  }, [rolePrivilegeIds, editablePrivilegeIds]);

  useEffect(() => {
    if (searchTerm.trim()) {
      setCollapsedGroups({});
    }
  }, [searchTerm]);

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

  const filteredGroups = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return groupedModules
      .map((group) => {
        const isWholeGroup =
          moduleFilter === 'all' || String(group.id) === moduleFilter;

        return {
          ...group,
          rows: group.rows.filter((row) => {
          const isInSelectedDepartment =
            isWholeGroup ||
            String(row.key) === moduleFilter ||
            row.parentIds.some((id) => String(id) === moduleFilter);

          if (!isInSelectedDepartment) return false;

          if (!search) return true;
          return [group.name, row.label, row.parent, row.path, row.type]
            .filter(Boolean)
            .some((value) => value.toLowerCase().includes(search));
          }),
        };
      })
      .filter((group) => group.rows.length > 0);
  }, [groupedModules, moduleFilter, searchTerm]);

  const isChecked = (priv) =>
    Boolean(priv && (isAllAccessRole || localPrivIds.includes(priv.id)));

  const toggleGroup = (groupId) => {
    setCollapsedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const setRowPrivilege = (row, action) => {
    if (!canEdit) return;

    const actionPriv =
      action === 'read'
        ? row.readPriv
        : action === 'write'
          ? row.writePriv
          : row.deletePriv;

    if (!actionPriv) return;

    setLocalPrivIds((prev) => {
      const hasPrivilege = prev.includes(actionPriv.id);
      let next = hasPrivilege
        ? prev.filter((id) => id !== actionPriv.id)
        : [...prev, actionPriv.id];

      if (action === 'read' && hasPrivilege) {
        next = next.filter(
          (id) => id !== row.writePriv?.id && id !== row.deletePriv?.id
        );
      }

      if ((action === 'write' || action === 'delete') && !hasPrivilege && row.readPriv) {
        next.push(row.readPriv.id);
      }

      return uniqueIds(next);
    });
  };

  const handleSave = async () => {
    const confirmed = await showConfirm(
      'Confirm Update',
      `Are you sure you want to update privileges for ${selectedRole?.role_name}?`
    );

    if (confirmed) {
      mutation.mutate(localPrivIds.filter((id) => editablePrivilegeIds.has(id)));
    }
  };

  const renderPermissionCell = (row, action) => {
    const priv =
      action === 'read'
        ? row.readPriv
        : action === 'write'
          ? row.writePriv
          : row.deletePriv;

    if (!priv) {
      return <span className="text-[10px] text-gray-300 font-bold">—</span>;
    }

    return (
      <PrivilegeCheckbox
        checked={isChecked(priv)}
        disabled={!canEdit}
        onChange={() => setRowPrivilege(row, action)}
      />
    );
  };

  const toggleColumn = (group, action) => {
    if (!canEdit) return;

    const privs = group.rows.map(row => 
      action === 'read' ? row.readPriv : 
      action === 'write' ? row.writePriv : 
      row.deletePriv
    ).filter(Boolean);

    if (privs.length === 0) return;

    const allChecked = privs.every(p => localPrivIds.includes(p.id));

    setLocalPrivIds(prev => {
      let next;
      if (allChecked) {
        // Uncheck all in this column
        const idsToRemove = new Set(privs.map(p => p.id));
        next = prev.filter(id => !idsToRemove.has(id));

        // If unchecking READ, also uncheck WRITE and DELETE for these rows
        if (action === 'read') {
          group.rows.forEach(row => {
            if (row.writePriv) next = next.filter(id => id !== row.writePriv.id);
            if (row.deletePriv) next = next.filter(id => id !== row.deletePriv.id);
          });
        }
      } else {
        // Check all in this column
        const idsToAdd = privs.map(p => p.id);
        next = [...prev, ...idsToAdd];

        // If checking WRITE or DELETE, also check READ for these rows
        if (action === 'write' || action === 'delete') {
          group.rows.forEach(row => {
            if (row.readPriv) next.push(row.readPriv.id);
          });
        }
      }
      return uniqueIds(next);
    });
  };

  const toggleSystemWide = (action) => {
    if (!canEdit) return;

    const allPrivs = groupedModules.flatMap(group => 
      group.rows.map(row => 
        action === 'read' ? row.readPriv : 
        action === 'write' ? row.writePriv : 
        row.deletePriv
      )
    ).filter(Boolean);

    if (allPrivs.length === 0) return;

    const allChecked = allPrivs.every(p => localPrivIds.includes(p.id));

    setLocalPrivIds(prev => {
      let next;
      if (allChecked) {
        const idsToRemove = new Set(allPrivs.map(p => p.id));
        next = prev.filter(id => !idsToRemove.has(id));

        if (action === 'read') {
          groupedModules.forEach(group => {
            group.rows.forEach(row => {
              if (row.writePriv) next = next.filter(id => id !== row.writePriv.id);
              if (row.deletePriv) next = next.filter(id => id !== row.deletePriv.id);
            });
          });
        }
      } else {
        const idsToAdd = allPrivs.map(p => p.id);
        next = [...prev, ...idsToAdd];

        if (action === 'write' || action === 'delete') {
          groupedModules.forEach(group => {
            group.rows.forEach(row => {
              if (row.readPriv) next.push(row.readPriv.id);
            });
          });
        }
      }
      return uniqueIds(next);
    });
  };

  const getSystemWideState = (action) => {
    const allPrivs = groupedModules.flatMap(group => 
      group.rows.map(row => 
        action === 'read' ? row.readPriv : 
        action === 'write' ? row.writePriv : 
        row.deletePriv
      )
    ).filter(Boolean);
    
    if (allPrivs.length === 0) return { checked: false, indeterminate: false };
    
    const checkedCount = allPrivs.filter(p => localPrivIds.includes(p.id)).length;
    return {
      checked: checkedCount === allPrivs.length,
      indeterminate: checkedCount > 0 && checkedCount < allPrivs.length
    };
  };

  const globalRead = getSystemWideState('read');
  const globalWrite = getSystemWideState('write');
  const globalDelete = getSystemWideState('delete');

  const renderGroup = (group) => {
    const isCollapsed = collapsedGroups[group.id];

    // Calculate header checkbox states
    const getColumnState = (action) => {
      const privs = group.rows.map(row => 
        action === 'read' ? row.readPriv : 
        action === 'write' ? row.writePriv : 
        row.deletePriv
      ).filter(Boolean);
      
      if (privs.length === 0) return { checked: false, indeterminate: false };
      
      const checkedCount = privs.filter(p => localPrivIds.includes(p.id)).length;
      return {
        checked: checkedCount === privs.length,
        indeterminate: checkedCount > 0 && checkedCount < privs.length
      };
    };

    const readState = getColumnState('read');
    const writeState = getColumnState('write');
    const deleteState = getColumnState('delete');

    return (
      <Card key={group.id} className="overflow-hidden border-[#E6D8C9] bg-white shadow-sm hover:shadow-md transition-shadow">
        <div
          className="flex cursor-pointer select-none items-center justify-between border-b border-[#EDE2D6] bg-gradient-to-r from-white to-[#FDFBF9] px-5 py-4"
          onClick={() => toggleGroup(group.id)}
        >
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F3E8D4] text-primary">
               {group.icon ? <DynamicIcon name={group.icon} size={20} /> : <Settings size={20} />}
            </div>
            <div>
              <h3 className="text-[17px] font-black text-secondary">{group.name}</h3>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                {group.rows.length} permission items
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {isCollapsed ? <ChevronRight className="text-gray-400" /> : <ChevronDown className="text-gray-400" />}
          </div>
        </div>

        {!isCollapsed && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead className="bg-[#FBF9F6] text-[10px] uppercase tracking-[0.15em] text-gray-500">
                <tr className="border-b border-[#EDE2D6]">
                  <th className="px-6 py-4 font-black">Page / Module Hierarchy</th>
                  <th className="w-24 px-4 py-4 text-center font-black text-[9px]">
                    <div className="flex flex-col items-center gap-2">
                      <span>READ ALL</span>
                      <PrivilegeCheckbox 
                        checked={readState.checked}
                        indeterminate={readState.indeterminate}
                        disabled={!canEdit}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleColumn(group, 'read');
                        }}
                      />
                    </div>
                  </th>
                  <th className="w-24 px-4 py-4 text-center font-black text-[9px]">
                    <div className="flex flex-col items-center gap-2">
                      <span>WRITE ALL</span>
                      <PrivilegeCheckbox 
                        checked={writeState.checked}
                        indeterminate={writeState.indeterminate}
                        disabled={!canEdit}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleColumn(group, 'write');
                        }}
                      />
                    </div>
                  </th>
                  <th className="w-24 px-4 py-4 text-center font-black text-[9px]">
                    <div className="flex flex-col items-center gap-2">
                      <span>DELETE ALL</span>
                      <PrivilegeCheckbox 
                        checked={deleteState.checked}
                        indeterminate={deleteState.indeterminate}
                        disabled={!canEdit}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleColumn(group, 'delete');
                        }}
                      />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => (
                  <tr
                    key={row.key}
                    className="group border-b border-[#F5F0E9] last:border-b-0 hover:bg-[#FDFBF8] transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div
                        className="flex items-start gap-4"
                        style={{ paddingLeft: `${row.depth * 24}px` }}
                      >
                        <div className="relative flex flex-col items-center">
                            {row.depth > 0 && (
                                <div className="absolute -left-4 top-0 h-full border-l border-dashed border-[#D9C8AF]" />
                            )}
                            <div className={cn(
                                "mt-1.5 h-3 w-3 rounded-full border-2 border-white ring-2 ring-[#F3E8D4]",
                                row.type === 'Root' ? "bg-primary" : row.type === 'Module' ? "bg-[#B08968]" : "bg-gray-300"
                            )} />
                        </div>
                        <div className="min-w-0">
                          <div className={cn(
                            "font-black leading-tight",
                            row.type === 'Root' ? "text-lg text-secondary" : row.type === 'Module' ? "text-[15px] text-secondary/80" : "text-sm text-gray-700"
                          )}>
                            {row.label}
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            <RowBadge tone="neutral">{row.type}</RowBadge>
                            {row.path && <RowBadge>{row.path}</RowBadge>}
                            {row.minRankLevel && <RowBadge tone="rank">Rank {row.minRankLevel}+</RowBadge>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">{renderPermissionCell(row, 'read')}</td>
                    <td className="px-4 py-4 text-center">{renderPermissionCell(row, 'write')}</td>
                    <td className="px-4 py-4 text-center">{renderPermissionCell(row, 'delete')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="relative min-h-[calc(100vh-160px)] space-y-6 pb-20">
      {/* STICKY TOP ACTION BAR */}
      <div className="sticky top-[-24px] z-[40] -mx-4 mb-6 bg-bg-temple/80 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="page-title">Privilege Management</h2>
            <p className="mt-1 text-sm font-medium text-gray-500">
              Define specific access levels for each department and page.
            </p>
          </div>

          {canEdit && (
            <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-4 duration-500">
              <Button
                onClick={handleSave}
                disabled={mutation.isPending}
                className="h-10 gap-2 rounded-xl bg-primary px-8 text-sm font-black text-white shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
              >
                {mutation.isPending ? <Icons.Loader2 className="animate-spin" size={18} /> : null}
                {mutation.isPending ? 'Updating...' : 'Save Changes'}
              </Button>
            </div>
          )}
        </div>
      </div>

      <Card className="border-border-temple bg-white shadow-sm">
        <CardContent className="p-5">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1fr_1fr]">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-secondary/60">Target Role</Label>
              <Select
                value={selectedRoleId}
                onChange={(e) => setSelectedRoleId(e.target.value)}
                className="h-11 font-bold text-secondary border-[#D9C8AF]"
              >
                <option value="" disabled>Select a role to begin</option>
                {roles?.map((role) => (
                  <option key={role.id} value={role.id}>{role.role_name}</option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-secondary/60">Filter by Department</Label>
              <Select
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                className="h-11 border-[#D9C8AF]"
              >
                <option value="all">Entire System (All Rooms)</option>
                {departmentOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {'\u00A0'.repeat(option.depth * 2)}{option.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-secondary/60">Quick Find</Label>
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Find page or module..."
                    className="h-11 w-full rounded-lg border border-[#D9C8AF] pl-10 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>
          </div>

          {selectedRole && (
            <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <span className="text-sm font-black text-primary">{selectedRole.role_name}</span>
                </div>
                {isAllAccessRole ? (
                  <span className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-md border border-amber-100 italic">
                    All access enabled. Every gate is open.
                  </span>
                ) : isProtectedRole ? (
                  <span className="text-xs font-bold text-error bg-error/5 px-3 py-1 rounded-md border border-error/10">
                    System Protection: Access levels for this role cannot be modified.
                  </span>
                ) : (
                    <span className="text-xs font-bold text-gray-400 italic">
                        Select checkboxes below to open specific doors for this role.
                    </span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedRoleId ? (
        filteredGroups.length > 0 ? (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            {filteredGroups.map(renderGroup)}
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-[#D9C8AF] bg-white p-20 text-center">
            <SearchIcon className="mx-auto h-12 w-12 text-gray-200 mb-4" />
            <p className="text-lg font-black text-secondary">No results found</p>
            <p className="text-sm text-gray-400">Try searching for a different room or page name.</p>
          </div>
        )
      ) : (
        <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-[#D9C8AF] bg-white/50 py-32 animate-in fade-in zoom-in-95 duration-700">
          <div className="mb-6 rounded-full bg-white p-6 shadow-xl shadow-primary/10">
            <Icons.Key className="h-12 w-12 text-primary animate-bounce" />
          </div>
          <p className="text-xl font-black text-secondary">Ready to assign keys?</p>
          <p className="mt-2 font-bold text-gray-400 max-w-sm text-center">
            Select a role from the dropdown above to start managing their access to the system rooms.
          </p>
        </div>
      )}
    </div>
  );
};

export default PrivilegesPage;
