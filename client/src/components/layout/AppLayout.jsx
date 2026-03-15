import { Outlet } from "react-router-dom";
import Topbar from "../navigation/Topbar.jsx";

function AppLayout() {
  return (
    <div className="app-frame">
      <Topbar />
      <main className="page-shell">
        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;
