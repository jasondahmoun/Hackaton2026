import React, { useState } from "react";
import { loginAdmin } from "@common/auth/auth-service";
import "./Login.css";

export default function Login() {
   const [form, setForm] = useState({ user: "", pass: "" });
   const [error, setError] = useState(false);

   const handleSubmit = async (e) => {
      e.preventDefault();
      const success = await loginAdmin(form.user, form.pass);
      if (success) {
         window.location.href = "/";
      } else {
         setError(true);
      }
   };

   return (
      <div className="login-page">
         <form className="login-card" onSubmit={handleSubmit}>
            <h1>Connexion Admin</h1>
            {error && <p style={{ color: "red" }}>Identifiants incorrects</p>}
            <input
               type="text"
               placeholder="Utilisateur"
               onChange={(e) => setForm({ ...form, user: e.target.value })}
            />
            <input
               type="password"
               placeholder="Mot de passe"
               onChange={(e) => setForm({ ...form, pass: e.target.value })}
            />
            <button type="submit" className="login-button">
               Entrer
            </button>
         </form>
      </div>
   );
}
