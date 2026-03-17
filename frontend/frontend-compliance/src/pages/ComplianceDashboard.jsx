import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./ComplianceDashboard.css";
import { fetchAnomalies, fetchAllFournisseurs } from "../api";
import KPICard from "../components/KPICard";
import AlertBadge from "../components/AlertBadge";
import StatusTag from "../components/StatusTag";

function SkeletonRow() {
   return (
      <div className="dashboard__skeleton-row">
         <div className="skeleton-block" style={{ width: "70%" }} />
         <div className="skeleton-block" style={{ width: "60%" }} />
         <div
            className="skeleton-block"
            style={{ width: 80, height: 22, borderRadius: 6 }}
         />
         <div
            className="skeleton-block"
            style={{ width: 20, margin: "0 auto" }}
         />
         <div
            className="skeleton-block"
            style={{ width: 20, margin: "0 auto" }}
         />
         <div
            className="skeleton-block"
            style={{ width: 80, height: 28, borderRadius: 7, margin: "0 auto" }}
         />
      </div>
   );
}

export default function ComplianceDashboard() {
   const navigate = useNavigate();
   const [fournisseurs, setFournisseurs] = useState([]);
   const [anomalies, setAnomalies] = useState([]);
   const [loading, setLoading] = useState(true);
   const [search, setSearch] = useState("");

   useEffect(() => {
      Promise.all([fetchAllFournisseurs(), fetchAnomalies()]).then(([f, a]) => {
         setFournisseurs(f);
         setAnomalies(a);
         setLoading(false);
      });
   }, []);

   const nbCritiques = anomalies.filter(
      (a) => a.severite === "critique",
   ).length;
   const nbWarnings = anomalies.filter((a) => a.severite === "warn").length;
   const nbConformes = fournisseurs.filter(
      (f) => f.statut === "conforme",
   ).length;
   const nbDocs = fournisseurs.reduce((s, f) => s + f.nbDocuments, 0);

   const filtered = fournisseurs.filter(
      (f) =>
         !search ||
         f.nom.toLowerCase().includes(search.toLowerCase()) ||
         f.siret.includes(search),
   );

   return (
      <div>
         {/* En-tête page */}
         <div className="dashboard__header">
            <h1 className="dashboard__title">Tableau de bord conformité</h1>
            <p className="dashboard__subtitle">
               Vue d'ensemble des anomalies inter-documents par fournisseur
            </p>
         </div>

         {/* KPIs */}
         <div className="dashboard__kpis">
            <KPICard
               label="Anomalies critiques"
               value={loading ? "—" : nbCritiques}
               colorVar="var(--c-error)"
               bgVar="var(--c-error-light)"
               borderColor="#FECACA"
               sub="Nécessitent une action immédiate"
            />
            <KPICard
               label="Avertissements"
               value={loading ? "—" : nbWarnings}
               colorVar="var(--c-warning)"
               bgVar="var(--c-warning-light)"
               borderColor="#FDE68A"
               sub="À surveiller"
            />
            <KPICard
               label="Fournisseurs conformes"
               value={loading ? "—" : `${nbConformes}/${fournisseurs.length}`}
               colorVar="var(--c-success)"
               bgVar="var(--c-success-light)"
               borderColor="#A7F3D0"
               sub="Sans anomalie détectée"
            />
            <KPICard
               label="Documents analysés"
               value={loading ? "—" : nbDocs}
               sub="Total toutes sources"
            />
         </div>

         {/* Liste fournisseurs */}
         <div className="dashboard__table-card">
            {/* Toolbar */}
            <div className="dashboard__toolbar">
               <h2 className="dashboard__toolbar-title">Fournisseurs</h2>
               <input
                  className="dashboard__search"
                  type="text"
                  placeholder="Rechercher par nom ou SIRET…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
               />
            </div>

            {/* En-tête colonnes */}
            <div className="dashboard__thead">
               <span>Fournisseur</span>
               <span>SIRET</span>
               <span>Statut</span>
               <span>Critiques</span>
               <span>Warnings</span>
               <span>Actions</span>
            </div>

            {/* Lignes */}
            {loading ? (
               Array(4)
                  .fill(0)
                  .map((_, i) => <SkeletonRow key={i} />)
            ) : filtered.length === 0 ? (
               <div className="dashboard__empty">
                  Aucun fournisseur ne correspond à la recherche.
               </div>
            ) : (
               filtered.map((f) => (
                  <div
                     key={f.id}
                     className="dashboard__row"
                     onClick={() => navigate(`/fournisseur/${f.id}`)}
                  >
                     <div>
                        <div className="dashboard__row-name">{f.nom}</div>
                        <div className="dashboard__row-docs">
                           {f.nbDocuments} document
                           {f.nbDocuments > 1 ? "s" : ""}
                        </div>
                     </div>

                     <div className="dashboard__row-siret">{f.siret}</div>

                     <div>
                        <StatusTag statut={f.statut} small />
                     </div>

                     <div className="dashboard__row-center">
                        {f.nbCritiques > 0 ? (
                           <AlertBadge level="critique" small />
                        ) : (
                           <span className="dashboard__row-dash">—</span>
                        )}
                     </div>

                     <div className="dashboard__row-center">
                        {f.nbWarnings > 0 ? (
                           <AlertBadge level="warn" small />
                        ) : (
                           <span className="dashboard__row-dash">—</span>
                        )}
                     </div>

                     <div>
                        <button
                           className="dashboard__detail-btn"
                           onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/fournisseur/${f.id}`);
                           }}
                        >
                           Détails →
                        </button>
                     </div>
                  </div>
               ))
            )}
         </div>
      </div>
   );
}
