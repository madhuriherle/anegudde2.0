import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Settings } from 'lucide-react';
import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Select } from '../components/ui/Select';
import { Label } from '../components/ui/Label';

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

const buildGroupedModules = (menuRoots = []) => {
  const buildRowsForRoot = (root) => {
    const rows = [];

    const walk = (node, parentTrail = []) => {
      const trail = [...parentTrail, node.name];
      const linkedPrivs = node.privileges || [];

      const readPriv = pickMostSpecificPrivilege(linkedPrivs, 'read');
      const writePriv = pickMostSpecificPrivilege(linkedPrivs, 'write');
      const deletePriv = pickMostSpecificPrivilege(linkedPrivs, 'delete');

      const hasChildren = Boolean(node.submodules?.length);
      const shouldRender =
        node.id !== root.id &&
        !hasChildren &&
        (node.route || readPriv || writePriv || deletePriv);

      if (shouldRender) {
        rows.push({
          key: node.id,
          label: node.name,
          depth: Math.max(trail.length - 2, 0),
          path: trail.slice(1).join(' / '),
          parent: trail.length > 1 ? trail[trail.length - 2] : root.name,
          type:
            trail.length <= 2
              ? 'Module'
              : trail.length === 3
                ? 'Submodule'
                : 'Page',
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
      rows: buildRowsForRoot(root),
    }))
    .filter((group) => group.rows.length > 0);
};

const uniqueIds = (ids) => Array.from(new Set(ids.filter(Boolean)));

const PrivilegeCheckbox = ({ checked, disabled, onChange }) => (
  <input
    type="checkbox"
    checked={checked}
    disabled={disabled}
    onChange={onChange}
    className="h-4 w-4 rounded border-[#CDB79F] accent-[#8B5E34] disabled:cursor-not-allowed disabled:opacity-50"
  />
);

const PrivilegesPage = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError, showConfirm } = useNotification();
  const { user } = useAuth();

  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [localPrivIds, setLocalPrivIds] = useState([]);
  const [moduleFilter, setModuleFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

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
    () => {
      const groups = buildGroupedModules(menuRoots || []);

      return groups
        .map((group) => ({
          ...group,
          rows: group.rows.filter((row) => row.label !== 'Module Management'),
        }))
        .filter((group) => group.rows.length > 0);
    },
    [menuRoots]
  );

  React.useEffect(() => {
    setLocalPrivIds(rolePrivilegeIds || []);
  }, [rolePrivilegeIds]);

  const selectedRole = roles?.find((r) => r.id === Number(selectedRoleId));
  const myRank = user?.role_rank_level ?? 99;
  const selectedRoleRank = selectedRole?.rank_level ?? 99;
  const isAllAccessRole = Boolean(selectedRole?.is_all_access);
  const isProtectedRole = selectedRole ? selectedRoleRank <= myRank : false;
  const canEdit = selectedRoleId && !isProtectedRole && !isAllAccessRole;

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
      .filter((group) => moduleFilter === 'all' || String(group.id) === moduleFilter)
      .map((group) => ({
        ...group,
        rows: group.rows.filter((row) => {
          if (!search) return true;
          return [group.name, row.label, row.parent, row.path, row.type]
            .filter(Boolean)
            .some((value) => value.toLowerCase().includes(search));
        }),
      }))
      .filter((group) => group.rows.length > 0);
  }, [groupedModules, moduleFilter, searchTerm]);

  const isChecked = (priv) =>
    Boolean(priv && (isAllAccessRole || localPrivIds.includes(priv.id)));

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

  const setGroupPrivilege = (group, action) => {
    if (!canEdit) return;

    const ids = group.rows
      .map((row) =>
        action === 'read'
          ? row.readPriv?.id
          : action === 'write'
            ? row.writePriv?.id
            : row.deletePriv?.id
      )
      .filter(Boolean);

    if (ids.length === 0) return;

    const readIds =
      action === 'read'
        ? []
        : group.rows.map((row) => row.readPriv?.id).filter(Boolean);

    setLocalPrivIds((prev) => {
      const allSelected = ids.every((id) => prev.includes(id));
      if (allSelected) {
        return prev.filter((id) => !ids.includes(id));
      }
      return uniqueIds([...prev, ...readIds, ...ids]);
    });
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

  const renderPermissionCell = (row, action) => {
    const priv =
      action === 'read'
        ? row.readPriv
        : action === 'write'
          ? row.writePriv
          : row.deletePriv;

    if (!priv) {
      return <span className="text-xs text-[#B8A999]">-</span>;
    }

    const readMissing = action !== 'read' && !isChecked(row.readPriv);

    return (
      <PrivilegeCheckbox
        checked={isChecked(priv)}
        disabled={!canEdit || readMissing}
        onChange={() => setRowPrivilege(row, action)}
      />
    );
  };

  const renderGroup = (group) => (
    <Card key={group.id} className="overflow-hidden border-[#E6D8C9] bg-white">
      <div className="flex flex-col gap-3 border-b border-[#EDE2D6] bg-white px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-base font-black text-[#2B2B2B]">{group.name}</h3>
          <p className="text-xs font-semibold text-[#7A6A5A]">
            {group.rows.length} permission items
          </p>
        </div>

        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setGroupPrivilege(group, 'read')}
              className="h-8 rounded-md bg-[#FAF3E7] px-3 text-xs font-bold text-[#6F431E] hover:bg-[#F1E2CF]"
            >
              All Read
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setGroupPrivilege(group, 'write')}
              className="h-8 rounded-md bg-[#FAF3E7] px-3 text-xs font-bold text-[#6F431E] hover:bg-[#F1E2CF]"
            >
              All Write
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setGroupPrivilege(group, 'delete')}
              className="h-8 rounded-md bg-[#FAF3E7] px-3 text-xs font-bold text-[#6F431E] hover:bg-[#F1E2CF]"
            >
              All Delete
            </Button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead className="bg-white text-xs uppercase tracking-wider text-[#7A6A5A]">
            <tr className="border-b border-[#EDE2D6]">
              <th className="px-4 py-3 font-black">Page / Module</th>
              <th className="w-24 px-4 py-3 text-center font-black">Read</th>
              <th className="w-24 px-4 py-3 text-center font-black">Write</th>
              <th className="w-24 px-4 py-3 text-center font-black">Delete</th>
            </tr>
          </thead>
          <tbody>
            {group.rows.map((row) => (
              <tr
                key={row.key}
                className="border-b border-[#F0E8DF] last:border-b-0 hover:bg-[#FFFDF9]"
              >
                <td className="px-4 py-3">
                  <div
                    className="flex items-start gap-3"
                    style={{ paddingLeft: `${row.depth * 18}px` }}
                  >
                    <div className="mt-2 h-2 w-2 rounded-full bg-[#B77B45]" />
                    <div className="min-w-0">
                      <div className="text-sm font-black text-[#23150E]">
                        {row.label}
                      </div>
                      <div className="mt-0.5 text-xs font-semibold text-[#887869]">
                        {row.type}
                        {row.path ? ` - ${row.path}` : ''}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">{renderPermissionCell(row, 'read')}</td>
                <td className="px-4 py-3 text-center">{renderPermissionCell(row, 'write')}</td>
                <td className="px-4 py-3 text-center">{renderPermissionCell(row, 'delete')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );

  return (
    <div className="space-y-6 bg-[#F8F6F3] pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="page-title">Privilege Management</h2>
          <p className="mt-1 text-sm font-medium text-[#777777]">
            Assign access per page using a compact permission matrix.
          </p>
        </div>

        {canEdit && (
          <Button
            onClick={handleSave}
            disabled={mutation.isPending}
            className="h-10 bg-[#8B5E34] px-8 font-bold text-white hover:bg-[#754B29]"
          >
            {mutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        )}
      </div>

      <Card className="border-[#E6D8C9] bg-white">
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_240px_1fr]">
            <div className="space-y-1.5">
              <Label className="font-bold text-[#2B2B2B]">Role</Label>
              <Select
                value={selectedRoleId}
                onChange={(e) => setSelectedRoleId(e.target.value)}
                className="bg-white"
              >
                <option value="" disabled>
                  Select a role
                </option>
                {roles?.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.role_name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="font-bold text-[#2B2B2B]">Module</Label>
              <Select
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                className="bg-white"
              >
                <option value="all">All modules</option>
                {groupedModules.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="font-bold text-[#2B2B2B]">Search</Label>
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search page or module"
                className="h-10 w-full rounded-md border border-[#D9C8AF] bg-white px-3 text-sm outline-none focus:border-[#B77B45] focus:ring-1 focus:ring-[#B77B45]"
              />
            </div>
          </div>

          {selectedRole && (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-[#7A6A5A]">
              <span className="rounded-full bg-[#FAF3E7] px-3 py-1 text-[#6F431E]">
                {selectedRole.role_name}
              </span>
              {isAllAccessRole && <span>All access role. Permissions are shown as enabled.</span>}
              {isProtectedRole && !isAllAccessRole && (
                <span>This role cannot be modified from your current account.</span>
              )}
              {canEdit && <span>Write/Delete automatically includes Read.</span>}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedRoleId ? (
        filteredGroups.length > 0 ? (
          <div className="space-y-4">{filteredGroups.map(renderGroup)}</div>
        ) : (
          <div className="rounded-lg border border-dashed border-[#D9C8AF] bg-white p-10 text-center text-sm font-bold text-[#777777]">
            No permissions match this filter.
          </div>
        )
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#D9C8AF] bg-white py-20">
          <div className="mb-4 rounded-full bg-[#F3E8DD] p-4">
            <Settings className="h-8 w-8 text-[#8B5E34]" />
          </div>
          <p className="font-bold text-[#777777]">
            Select a role to manage privileges.
          </p>
        </div>
      )}
    </div>
  );
};

export default PrivilegesPage;
