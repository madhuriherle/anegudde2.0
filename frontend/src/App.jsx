import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './layouts/MainLayout';
import LoginPage from './pages/LoginPage';
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
import PrivilegesPage from './pages/PrivilegesPage';
import ActivityLogsPage from './pages/ActivityLogsPage';
import DevoteesPage from './pages/DevoteesPage';
import ItemCategoriesPage from './pages/ItemCategoriesPage';
import UnitsPage from './pages/UnitsPage';
import MenuItemsPage from './pages/MenuItemsPage';
import WastagesPage from './pages/WastagesPage';
import DonationsPage from './pages/DonationsPage';
import DonationTypesPage from './pages/DonationTypesPage';
import SettingsPage from './pages/SettingsPage';
import TempleIdentitySettingsPage from './pages/TempleIdentitySettingsPage';
import ReceiptSettingsPage from './pages/ReceiptSettingsPage';
import DataCleanupPage from './pages/DataCleanupPage';
import ProfilePage from './pages/ProfilePage';
import DailyStockReportPage from './pages/DailyStockReportPage';
import { StockSummaryPage } from './pages/StockSummaryPage';
import MonthlyPerformanceReportPage from './pages/MonthlyPerformanceReportPage';
import VendorOutstandingReportPage from './pages/VendorOutstandingReportPage';
import TokenReportPage from './pages/TokenReportPage';
import DonationReportPage from './pages/DonationReportPage';
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

      <Route element={<MainLayout />}>
        <Route path="/" element={<ProtectedRoute><DefaultRoute /></ProtectedRoute>} />
        <Route path="/canteen" element={<ProtectedRoute requiredPermission="dashboard.read"><CanteenDashboardPage /></ProtectedRoute>} />
        <Route path="/office" element={<ProtectedRoute requiredPermission="donations.read"><OfficePage /></ProtectedRoute>} />
        <Route path="/vendors" element={<ProtectedRoute requiredPermission="vendors.read"><VendorsPage /></ProtectedRoute>} />
        <Route path="/items" element={<ProtectedRoute requiredPermission="items.read"><ItemsPage /></ProtectedRoute>} />
        <Route path="/items/:id/history" element={<ProtectedRoute requiredPermission="items.read"><ItemHistoryPage /></ProtectedRoute>} />
        <Route path="/purchases" element={<ProtectedRoute requiredPermission="purchases.read"><PurchasesPage /></ProtectedRoute>} />
        <Route path="/purchases/returns" element={<ProtectedRoute requiredPermission="purchase_returns.read"><PurchaseReturnsPage /></ProtectedRoute>} />
        <Route path="/daily-usage" element={<ProtectedRoute requiredPermission="consumptions.read"><UsageEntriesPage /></ProtectedRoute>} />
        <Route path="/donations" element={<ProtectedRoute requiredPermission="donations.read"><DonationsPage /></ProtectedRoute>} />
        <Route path="/wastages" element={<ProtectedRoute requiredPermission="wastages.read"><WastagesPage /></ProtectedRoute>} />
        
        <Route path="/reports/tokens" element={<ProtectedRoute requiredPermission="reports.read"><TokenReportPage /></ProtectedRoute>} />
        <Route path="/reports/tokens/:date" element={<ProtectedRoute requiredPermission="reports.read"><TokenDetailLedgerPage /></ProtectedRoute>} />
        <Route path="/reports/daily-closing" element={<ProtectedRoute requiredPermission="reports.read"><DailyStockReportPage /></ProtectedRoute>} />
        <Route path="/reports/donations" element={<ProtectedRoute requiredPermission="reports.read"><DonationReportPage /></ProtectedRoute>} />
        <Route path="/reports/stock-summary" element={<ProtectedRoute requiredPermission="reports.read"><StockSummaryPage /></ProtectedRoute>} />
        <Route path="/reports/canteen-summary" element={<ProtectedRoute requiredPermission="reports.read"><CanteenSummaryPage /></ProtectedRoute>} />
        <Route path="/reports/manpower" element={<ProtectedRoute requiredPermission="reports.read"><ManpowerReportPage /></ProtectedRoute>} />
        <Route path="/reports/monthly-performance" element={<ProtectedRoute requiredPermission="reports.read"><MonthlyPerformanceReportPage /></ProtectedRoute>} />
        <Route path="/reports/vendor-outstanding" element={<ProtectedRoute requiredPermission="reports.read"><VendorOutstandingReportPage /></ProtectedRoute>} />
        
        <Route path="/users" element={<ProtectedRoute requiredPermission="users.read"><UsersPage /></ProtectedRoute>} />
        <Route path="/users/privileges" element={<ProtectedRoute requiredPermission="users.write"><PrivilegesPage /></ProtectedRoute>} />
        <Route path="/users/activity" element={<ProtectedRoute requiredPermission="activity_logs.read"><ActivityLogsPage /></ProtectedRoute>} />
        <Route path="/devotees" element={<ProtectedRoute requiredPermission="devotees.read"><DevoteesPage /></ProtectedRoute>} />
        
        <Route path="/settings/categories" element={<ProtectedRoute requiredPermission="item_categories.read"><ItemCategoriesPage /></ProtectedRoute>} />
        <Route path="/settings/units" element={<ProtectedRoute requiredPermission="units.read"><UnitsPage /></ProtectedRoute>} />
        <Route path="/settings/menu-items" element={<ProtectedRoute requiredPermission="menu_items.read"><MenuItemsPage /></ProtectedRoute>} />
        <Route path="/settings/donation-types" element={<ProtectedRoute requiredPermission="donation_types.read"><DonationTypesPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute requiredPermission="settings.read"><SettingsPage /></ProtectedRoute>} />
        <Route path="/settings/temple" element={<ProtectedRoute requiredPermission="settings.read"><TempleIdentitySettingsPage /></ProtectedRoute>} />
        <Route path="/settings/receipt" element={<ProtectedRoute requiredPermission="settings.read"><ReceiptSettingsPage /></ProtectedRoute>} />
        <Route path="/settings/cleanup" element={<ProtectedRoute requiredPermission="settings.read"><DataCleanupPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>);

}

export default App;
