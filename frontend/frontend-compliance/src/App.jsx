import React from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import "./App.css";
import Sidebar             from "@common/SideBar";
import ComplianceDashboard from "./pages/ComplianceDashboard";
import AnomalyDetail       from "./pages/AnomalyDetail";
import DocumentStatus      from "./pages/DocumentStatus";

function AppNav() {
  return (
    <nav className="app-nav">
      <NavLink
        to="/"
        end
        className={({ isActive }) =>
          "app-nav__link" + (isActive ? " app-nav__link--active" : "")
        }
      >
        📊 Tableau de bord
      </NavLink>
      <NavLink
        to="/documents"
        className={({ isActive }) =>
          "app-nav__link" + (isActive ? " app-nav__link--active" : "")
        }
      >
        📄 Documents
      </NavLink>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <Sidebar />
        <main className="app-main">
          <AppNav />
          <Routes>
            <Route path="/"                element={<ComplianceDashboard />} />
            <Route path="/fournisseur/:id" element={<AnomalyDetail />} />
            <Route path="/documents"       element={<DocumentStatus />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
