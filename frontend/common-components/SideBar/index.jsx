import { useState, useEffect } from "react";
import "./SideBar.css";

const NAV = [
   { href: "http://localhost:5173", label: "Conformité", port: "5173" },
   { href: "http://localhost:5174", label: "CRM Fournisseurs", port: "5174" },
];

function Sidebar() {
   const [health, setHealth] = useState(null);
   const currentPort = window.location.port;

   useEffect(() => {
      let alive = true;
      async function check() {
         try {
            const res = await fetch("http://localhost:8000/health", { signal: AbortSignal.timeout(3000) });
            const data = await res.json();
            if (alive) setHealth(data?.status === "ok" || data?.status === "healthy");
         } catch {
            if (alive) setHealth(false);
         }
      }
      check();
      const id = setInterval(check, 30000);
      return () => { alive = false; clearInterval(id); };
   }, []);

   return (
      <aside className="sidebar">
         {/* Logo */}
         <div className="sidebar-logo">
            <div className="sidebar-logo-icon">D</div>
            <span className="sidebar-logo-text">DocPro</span>
         </div>

         {/* Nav */}
         <nav className="sidebar-nav">
            <div className="sidebar-nav-label">Applications</div>
            {NAV.map((item) => {
               const isActive = currentPort === item.port;
               return (
                  <a
                     key={item.href}
                     href={item.href}
                     className={`sidebar-link${isActive ? " active" : ""}`}
                  >
                     <span className="sidebar-link-dot" />
                     {item.label}
                  </a>
               );
            })}
         </nav>

         {/* Health */}
         <div className="sidebar-footer">
            <span
               className="sidebar-health-dot"
               style={{
                  background: health === null ? "#d1d5db" : health ? "#16a34a" : "#dc2626",
               }}
            />
            <span className="sidebar-footer-text">
               {health === null ? "Connexion…" : health ? "Backend OK" : "Backend offline"}
            </span>
         </div>
      </aside>
   );
}

export default Sidebar;
