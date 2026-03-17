import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout.jsx";
import AssetDetailPage from "./pages/AssetDetailPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import HoldingsPage from "./pages/HoldingsPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import SignInPage from "./pages/SignInPage.jsx";
import TransactionsPage from "./pages/TransactionsPage.jsx";

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="/holdings" element={<HoldingsPage />} />
        <Route path="/holdings/:assetId" element={<AssetDetailPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/signin" element={<SignInPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
