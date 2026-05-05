import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './layouts/MainLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import VendorsPage from './pages/VendorsPage';
import ItemsPage from './pages/ItemsPage';
import ItemHistoryPage from './pages/ItemHistoryPage';
import PurchasesPage from './pages/PurchasesPage';
import ConsumptionsPage from './pages/ConsumptionsPage';
import UsersPage from './pages/UsersPage';
import ChefsPage from './pages/ChefsPage';
import ItemCategoriesPage from './pages/ItemCategoriesPage';
import UnitsPage from './pages/UnitsPage';
import MenuItemsPage from './pages/MenuItemsPage';
import WastagesPage from './pages/WastagesPage';
import TokensPage from './pages/TokensPage';
import TokenHistoryPage from './pages/TokenHistoryPage';
import ReportsPage from './pages/ReportsPage';
import ProfilePage from './pages/ProfilePage';
import VendorPaymentsPage from './pages/VendorPaymentsPage';
import DailyStockReportPage from './pages/DailyStockReportPage';
import MonthlyPerformanceReportPage from './pages/MonthlyPerformanceReportPage';
import VendorOutstandingReportPage from './pages/VendorOutstandingReportPage';
import { Typography, Box } from '@mui/material';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/vendors" element={<VendorsPage />} />
        <Route path="/items" element={<ItemsPage />} />
        <Route path="/items/:id/history" element={<ItemHistoryPage />} />
        <Route path="/purchases" element={<PurchasesPage />} />
        <Route path="/tokens" element={<TokensPage />} />
        <Route path="/tokens/history" element={<TokenHistoryPage />} />
        <Route path="/consumptions" element={<ConsumptionsPage />} />
        <Route path="/wastages" element={<WastagesPage />} />
        <Route path="/vendor-payments" element={<VendorPaymentsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/reports/daily-closing" element={<DailyStockReportPage />} />
        <Route path="/reports/monthly-performance" element={<MonthlyPerformanceReportPage />} />
        <Route path="/reports/vendor-outstanding" element={<VendorOutstandingReportPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/settings/chefs" element={<ChefsPage />} />
        <Route path="/settings/categories" element={<ItemCategoriesPage />} />
        <Route path="/settings/units" element={<UnitsPage />} />
        <Route path="/settings/menu-items" element={<MenuItemsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
