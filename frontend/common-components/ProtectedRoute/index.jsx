import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { checkIsAdmin } from "../auth/auth-service";

export default function ProtectedRoute({ children }) {
   const [status, setStatus] = useState("loading");

   useEffect(() => {
      checkIsAdmin().then((isAdmin) => {
         setStatus(isAdmin ? "authorized" : "unauthorized");
      });
   }, []);

   if (status === "loading")
      return <div className="loading">Vérification...</div>;

   if (status === "unauthorized") return <Navigate to="/login" replace />;

   return children;
}
