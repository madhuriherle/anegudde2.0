import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './layouts/MainLayout';
import LoginPage from './pages/LoginPage';
import NoAccessPage from './pages/NoAccessPage';
import ModulesPage from './pages/ModulesPage';
import CanteenDashboardPage from './pages/CanteenDashboardPage';
import OfficePage from './pages/OfficePage';
import VendorsPage from './pages/VendorsPage';
import ItemsPage from './pages/ItemsPage';
import ItemHistoryPage from './pages/ItemHistoryPage';
import PurchasesPage from './pages/PurchasesPage';
import PurchaseReturnsPage from './pages/PurchaseReturnsPage';
import UsageEntriesPage from './pages/UsageEntriesPage';
import UsersPage from './pages/UsersPage';
import RolesPage from './pages/RolesPage';
import PrivilegesPage from './pages/PrivilegesPage';
import ActivityLogsPage from './pages/ActivityLogsPage';
import DevoteesPage from './pages/DevoteesPage';
import ItemCategoriesPage from './pages/ItemCategoriesPage';
import MenuItemsPage from './pages/MenuItemsPage';
import WastagesPage from './pages/WastagesPage';
import DonationsPage from './pages/DonationsPage';
import DonationTypesPage from './pages/DonationTypesPage';
import SettingsPage from './pages/SettingsPage';
import TempleIdentitySettingsPage from './pages/TempleIdentitySettingsPage';
import ReceiptSettingsPage from './pages/ReceiptSettingsPage';
import DataCleanupPage from './pages/DataCleanupPage';
import PrinterSettingsSettingsPage from './pages/PrinterSettingsSettingsPage';
import ProfilePage from './pages/ProfilePage';
import RecycleBinPage from './pages/RecycleBinPage';
import { StockSummaryPage } from './pages/StockSummaryPage';
import TokenReportPage from './pages/TokenReportPage';
import DonationReportPage from './pages/DonationReportPage';
import PurchaseReportPage from './pages/PurchaseReportPage';
import TokenDetailLedgerPage from './pages/TokenDetailLedgerPage';
import CanteenSummaryPage from './pages/CanteenSummaryPage';
import ManpowerReportPage from './pages/ManpowerReportPage';
import { useAuth } from './context/AuthContext';
import { getDefaultPath, hasMainAccess } from './utils/navigation';

const DefaultRoute = () => {
  const { user } = useAuth();

  if (!hasMainAccess(user)) {
    return <Navigate to={getDefaultPath(user)} replace />;
  }

  return <ModulesPage />;
};

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/no-access" element={<NoAccessPage />} />

      <Route element={<MainLayout />}>
        <Route path="/" element={<ProtectedRoute><DefaultRoute /></ProtectedRoute>} />
        <Route path="/canteen" element={<ProtectedRoute requiredPermission="dashboard.read"><CanteenDashboardPage /></ProtectedRoute>} />
        <Route path="/office" element={<ProtectedRoute requiredPermission="main.office.read"><OfficePage /></ProtectedRoute>} />
        <Route path="/vendors" element={<ProtectedRoute requiredPermission="vendors.read"><VendorsPage /></ProtectedRoute>} />
        <Route path="/items" element={<ProtectedRoute requiredPermission="items.read"><Navigate to="/items/rawitem" replace /></ProtectedRoute>} />
        <Route path="/items/rawitem" element={<ProtectedRoute requiredPermission="items.read"><ItemsPage /></ProtectedRoute>} />
        <Route path="/items/:id/history" element={<ProtectedRoute requiredPermission="items.read"><ItemHistoryPage /></ProtectedRoute>} />
        <Route path="/items/rawitem/:id/history" element={<ProtectedRoute requiredPermission="items.read"><ItemHistoryPage /></ProtectedRoute>} />
        <Route path="/purchases" element={<ProtectedRoute requiredPermission="purchases.read"><PurchasesPage /></ProtectedRoute>} />
        <Route path="/purchases/returns" element={<ProtectedRoute requiredPermission="purchase_returns.read"><PurchaseReturnsPage /></ProtectedRoute>} />
        <Route path="/daily-usage" element={<ProtectedRoute requiredPermission="daily_usage.read"><UsageEntriesPage /></ProtectedRoute>} />
        <Route path="/donations" element={<ProtectedRoute requiredPermission="donations.read"><DonationsPage /></ProtectedRoute>} />
        <Route path="/wastages" element={<ProtectedRoute requiredPermission="daily_usage.read"><WastagesPage /></ProtectedRoute>} />
        
        <Route path="/reports/tokens" element={<ProtectedRoute requiredPermission="reports.tokens.read"><TokenReportPage /></ProtectedRoute>} />
        <Route path="/reports/tokens/:date" element={<ProtectedRoute requiredPermission="reports.tokens.read"><TokenDetailLedgerPage /></ProtectedRoute>} />
        <Route path="/reports/donations" element={<ProtectedRoute requiredPermission="reports.donations.read"><DonationReportPage /></ProtectedRoute>} />
        <Route path="/reports/purchases" element={<ProtectedRoute requiredPermission="reports.purchases.read"><PurchaseReportPage /></ProtectedRoute>} />
        <Route path="/reports/stock-summary" element={<ProtectedRoute requiredPermission="reports.stock_summary.read"><StockSummaryPage /></ProtectedRoute>} />
        <Route path="/reports/canteen-summary" element={<ProtectedRoute requiredPermission="reports.canteen_summary.read"><CanteenSummaryPage /></ProtectedRoute>} />
        <Route path="/reports/manpower" element={<ProtectedRoute requiredPermission="reports.manpower.read"><ManpowerReportPage /></ProtectedRoute>} />
        
        <Route path="/users" element={<ProtectedRoute requiredPermission="users.management.read"><UsersPage /></ProtectedRoute>} />
        <Route path="/users/roles" element={<ProtectedRoute requiredPermission="roles.read"><RolesPage /></ProtectedRoute>} />
        <Route path="/users/privileges" element={<ProtectedRoute requiredPermission="users.privileges.read"><PrivilegesPage /></ProtectedRoute>} />
        <Route path="/users/activity" element={<ProtectedRoute requiredPermission="activity_logs.read"><ActivityLogsPage /></ProtectedRoute>} />
        <Route path="/devotees" element={<ProtectedRoute requiredPermission="donations.read"><DevoteesPage /></ProtectedRoute>} />

        <Route path="/items/categories" element={<ProtectedRoute requiredPermission="item_categories.read"><ItemCategoriesPage /></ProtectedRoute>} />
        <Route path="/items/menu-items" element={<ProtectedRoute requiredPermission="menu_items.read"><MenuItemsPage /></ProtectedRoute>} />
        <Route path="/settings/donation-types" element={<ProtectedRoute requiredPermission="donation_types.read"><DonationTypesPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute requiredPermission={["settings.temple_identity.read", "settings.receipt_settings.read", "recycle_bin.read", "settings.data_cleanup.read"]}><SettingsPage /></ProtectedRoute>} />
        <Route path="/settings/temple" element={<ProtectedRoute requiredPermission="settings.temple_identity.read"><TempleIdentitySettingsPage /></ProtectedRoute>} />
        <Route path="/settings/receipt" element={<ProtectedRoute requiredPermission="settings.receipt_settings.read"><ReceiptSettingsPage /></ProtectedRoute>} />
        <Route path="/settings/cleanup" element={<ProtectedRoute requiredPermission="settings.data_cleanup.read"><DataCleanupPage /></ProtectedRoute>} />
        <Route path="/settings/printers" element={<ProtectedRoute requiredPermission="settings.printers.read"><PrinterSettingsSettingsPage /></ProtectedRoute>} />
        <Route path="/settings/recycle-bin" element={<ProtectedRoute requiredPermission="recycle_bin.read"><RecycleBinPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute requiredPermission="profile.read"><ProfilePage /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>);

}

export default App;


