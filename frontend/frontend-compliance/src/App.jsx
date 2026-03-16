import React from "react";
import Sidebar from "@common/SideBar";

function App() {
   return (
      <div style={{ display: "flex", minHeight: "100svh" }}>
         <Sidebar />
         <main style={{ flex: 1, padding: "32px 36px", background: "#f9fafb" }}>
            <h1>Compliance</h1>
         </main>
      </div>
   );
}

export default App;
