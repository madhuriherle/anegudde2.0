export const hasPermission = (user, permission) => {
  if (!user) return false;
  if (user.is_all_access) return true;
  return user.privileges?.includes(permission);
};

export const hasAnyPermission = (user, permissions) =>
  permissions.some((permission) => hasPermission(user, permission));

export const canteenPermissions = [
  'dashboard.read',
  'purchases.read',
  'purchase_returns.read',
  'consumptions.read',
  'donations.read',
  'vendors.read',
  'items.read',
  'item_categories.read',
  'menu_items.read',
  'reports.read',
];

export const mainPermissions = [
  'users.read',
  'users.write',
  'privileges.read',
  'privileges.write',
  'activity_logs.read',
  'settings.read',
  'donation_types.read',
  'devotees.read',
];

export const hasCanteenAccess = (user) => hasAnyPermission(user, canteenPermissions);

export const hasMainAccess = (user) => hasAnyPermission(user, mainPermissions);

export const getDefaultPath = (user) => {
  if (!user) return '/login';

  if (hasMainAccess(user)) return '/';
  if (hasPermission(user, 'dashboard.read')) return '/canteen';
  if (hasPermission(user, 'purchases.read')) return '/purchases';
  if (hasPermission(user, 'purchase_returns.read')) return '/purchases/returns';
  if (hasPermission(user, 'consumptions.read')) return '/daily-usage';
  if (hasPermission(user, 'donations.read')) return '/donations';
  if (hasPermission(user, 'vendors.read')) return '/vendors';
  if (hasPermission(user, 'items.read')) return '/items';
  if (hasPermission(user, 'item_categories.read')) return '/settings/categories';
  if (hasPermission(user, 'menu_items.read')) return '/settings/menu-items';
  if (hasPermission(user, 'reports.read')) return '/reports/stock-summary';
  if (hasPermission(user, 'users.read')) return '/users';
  if (hasPermission(user, 'settings.read')) return '/settings';
  if (hasPermission(user, 'donation_types.read')) return '/settings/donation-types';

  return '/profile';
};
