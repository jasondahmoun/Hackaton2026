import React from "react";
import {
   BrowserRouter,
   Routes,
   Route,
   NavLink,
   useLocation,
} from "react-router-dom";
import "./App.css";
import Sidebar from "@common/SideBar";
import Login from "@common/Login";
import ProtectedRoute from "@common/ProtectedRoute";

import ComplianceDashboard from "./pages/ComplianceDashboard";
import AnomalyDetail from "./pages/AnomalyDetail";
import DocumentStatus from "./pages/DocumentStatus";
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
            Tableau de bord
         </NavLink>
         <NavLink
            to="/documents"
            className={({ isActive }) =>
               "app-nav__link" + (isActive ? " app-nav__link--active" : "")
            }
         >
            Documents
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
                  <Route path="/login" element={<Login />} />

                  <Route
                     path="/"
                     element={
                        <ProtectedRoute>
                           <ComplianceDashboard />
                        </ProtectedRoute>
                     }
                  />

                  <Route
                     path="/fournisseur/:id"
                     element={
                        <ProtectedRoute>
                           <AnomalyDetail />
                        </ProtectedRoute>
                     }
                  />

                  <Route
                     path="/documents"
                     element={
                        <ProtectedRoute>
                           <DocumentStatus />
                        </ProtectedRoute>
                     }
                  />
               </Routes>
            </main>
         </div>
      </BrowserRouter>
   );
}
