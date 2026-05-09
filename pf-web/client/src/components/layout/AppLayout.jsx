import { Outlet } from "react-router-dom";
import Topbar from "../navigation/Topbar.jsx";
import { useAuth } from "../../features/auth/AuthContext.jsx";
import { PortfolioWorkspaceProvider } from "../../features/portfolio/PortfolioWorkspaceContext.jsx";

function AppLayout() {
  const { isAuthenticated } = useAuth();

  return (
    <PortfolioWorkspaceProvider isAuthenticated={isAuthenticated}>
      <div className="app-frame">
        <Topbar />
        <main className="page-shell">
          <Outlet />
        </main>
      </div>
    </PortfolioWorkspaceProvider>
  );
}

export default AppLayout;
