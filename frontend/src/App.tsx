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
import ItemPriceHistoryPage from './pages/ItemPriceHistoryPage';
import PurchasesPage from './pages/PurchasesPage';
import ConsumptionsPage from './pages/ConsumptionsPage';
import UsersPage from './pages/UsersPage';
import ItemCategoriesPage from './pages/ItemCategoriesPage';
import UnitsPage from './pages/UnitsPage';
import MenuItemsPage from './pages/MenuItemsPage';
import WastagesPage from './pages/WastagesPage';
import ReportsPage from './pages/ReportsPage';
import ProfilePage from './pages/ProfilePage';
import DailyStockReportPage from './pages/DailyStockReportPage';
import StockSummaryPage from './pages/StockSummaryPage';
import MonthlyPerformanceReportPage from './pages/MonthlyPerformanceReportPage';
import VendorOutstandingReportPage from './pages/VendorOutstandingReportPage';
import TokenReportPage from './pages/TokenReportPage';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route path="/" element={<ModulesPage />} />
        <Route path="/canteen" element={<CanteenDashboardPage />} />
        <Route path="/office" element={<OfficePage />} />
        <Route path="/vendors" element={<VendorsPage />} />
        <Route path="/items" element={<ItemsPage />} />
        <Route path="/items/:id/history" element={<ItemHistoryPage />} />
        <Route path="/items/:id/price-history" element={<ItemPriceHistoryPage />} />
        <Route path="/purchases" element={<PurchasesPage />} />
        <Route path="/consumptions" element={<ConsumptionsPage />} />
        <Route path="/wastages" element={<WastagesPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/reports/tokens" element={<TokenReportPage />} />
        <Route path="/reports/daily-closing" element={<DailyStockReportPage />} />
        <Route path="/reports/stock-summary" element={<StockSummaryPage />} />
        <Route path="/reports/monthly-performance" element={<MonthlyPerformanceReportPage />} />
        <Route path="/reports/vendor-outstanding" element={<VendorOutstandingReportPage />} />
        <Route path="/users" element={<UsersPage />} />
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
