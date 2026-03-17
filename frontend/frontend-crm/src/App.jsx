import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Sidebar from "@common/SideBar";
import Login from "@common/Login";
import ProtectedRoute from "@common/ProtectedRoute";

import Upload from "./pages/Upload";
import CRM from "./pages/CRM";
import "./App.css";
export default function App() {
   return (
      <BrowserRouter>
         <div className="app-shell">
            <Sidebar />

            <main className="app-main">
               <Routes>
                  <Route path="/login" element={<Login />} />

                  <Route path="/" element={<Upload />} />

                  <Route
                     path="/crm"
                     element={
                        <ProtectedRoute>
                           <CRM />
                        </ProtectedRoute>
                     }
                  />
               </Routes>
            </main>
         </div>
      </BrowserRouter>
   );
}
