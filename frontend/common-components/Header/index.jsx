import React from "react";
import "./Header.css";

function Header() {
   return (
      <header className="app-header">
         <div className="logo">Hackaton 2026</div>
         <nav className="nav-links">
            <a href="http://localhost:5173" className="nav-link">
               Compliance
            </a>
            <a href="http://localhost:5174" className="nav-link">
               CRM
            </a>
         </nav>
      </header>
   );
}

export default Header;
