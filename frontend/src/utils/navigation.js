export const hasPermission = (user, permission) => {
  if (!user) return false;
  if (user.is_all_access) return true;
  return user.privileges?.includes(permission);
};

export const hasAnyPermission = (user, permissions) =>
  permissions.some((permission) => hasPermission(user, permission));

export const canteenPermissions = [
  'main.canteen.read',
  'dashboard.read',
  'purchases.read',
  'purchase_returns.read',
  'daily_usage.read',
  'donations.read',
  'vendors.read',
  'items.read',
  'item_categories.read',
  'menu_items.read',
  'reports.stock_summary.read',
  'reports.canteen_summary.read',
  'reports.manpower.read',
  'reports.donations.read',
  'reports.purchases.read',
  'reports.tokens.read',
];

export const mainPermissions = [
  'main.home.read',
  'main.office.read',
  'main.users.read',
  'main.reports.read',
  'main.master_settings.read',
  'users.management.read',
  'users.privileges.read',
  'users.modules.read',
  'roles.read',
  'activity_logs.read',
  'settings.printers.read',
  'settings.temple_identity.read',
  'settings.receipt_settings.read',
  'settings.data_cleanup.read',
  'recycle_bin.read',
  'units.read',
  'donation_types.read',
];

export const hasCanteenAccess = (user) => hasAnyPermission(user, canteenPermissions);

export const hasMainAccess = (user) => hasAnyPermission(user, mainPermissions);

export const getDefaultPath = (user) => {
  if (!user) return '/login';

  if (hasPermission(user, 'main.home.read')) return '/';
  if (hasPermission(user, 'main.canteen.read')) return '/canteen';
  if (hasMainAccess(user)) return '/';
  if (hasPermission(user, 'dashboard.read')) return '/canteen';
  if (hasPermission(user, 'purchases.read')) return '/purchases';
  if (hasPermission(user, 'purchase_returns.read')) return '/purchases/returns';
  if (hasPermission(user, 'daily_usage.read')) return '/daily-usage';
  if (hasPermission(user, 'donations.read')) return '/donations';
  if (hasPermission(user, 'vendors.read')) return '/vendors';
  if (hasPermission(user, 'items.read')) return '/items/rawitem';
  if (hasPermission(user, 'item_categories.read')) return '/items/categories';
  if (hasPermission(user, 'menu_items.read')) return '/items/menu-items';
  if (hasPermission(user, 'reports.stock_summary.read')) return '/reports/stock-summary';
  if (hasPermission(user, 'reports.purchases.read')) return '/reports/purchases';
  if (hasPermission(user, 'users.management.read')) return '/users';
  if (hasAnyPermission(user, [
    'settings.temple_identity.read',
    'settings.receipt_settings.read',
    'settings.printers.read',
    'recycle_bin.read',
    'settings.data_cleanup.read',
  ])) return '/settings';
  if (hasPermission(user, 'donation_types.read')) return '/settings/donation-types';
  if (hasPermission(user, 'profile.read')) return '/profile';

  return '/no-access';
};
