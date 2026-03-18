import { useEffect, useState } from "react";
import "./ComplianceDashboard.css";
import { fetchCorrections } from "../api";
import KPICard from "../components/KPICard";

export default function ComplianceDashboard() {
   const [corrections, setCorrections] = useState([]);
   const [loading, setLoading] = useState(true);
   const [search, setSearch] = useState("");

   useEffect(() => {
      fetchCorrections()
         .then((c) => setCorrections(c))
         .catch(() => {})
         .finally(() => setLoading(false));
   }, []);

   // KPIs calculés depuis les vraies corrections
   const nbTotal    = corrections.length;
   const nbOk       = corrections.filter(c => c.STATUT === "SUCCES" || c.is_conform === true).length;
   const nbWarning  = corrections.filter(c => c.WARNING_FLAG === true).length;
   const nbErreur   = corrections.filter(c => c.STATUT === "ERREUR" || c.is_conform === false).length;

   const filtered = corrections.filter(c => {
      if (!search) return true;
      const s = search.toLowerCase();
      const nom   = c.extracted_info?.nom_fournisseur || c.infos_scrap_document?.Info_vendeur?.Nom || c.gouv_info?.nom_complet || c.infos_gouv?.nom_officiel || "";
      const siret = c.siret || c.extracted_info?.siret_fournisseur || c.NUM_SIRET || "";
      return nom.toLowerCase().includes(s) || siret.includes(s);
   });

   return (
      <div>
         <div className="dashboard__header">
            <h1 className="dashboard__title">Tableau de bord conformité</h1>
            <p className="dashboard__subtitle">
               Corrections extraites et vérifiées depuis les documents uploadés
            </p>
         </div>

         {/* KPIs */}
         <div className="dashboard__kpis">
            <KPICard
               label="Documents traités"
               value={loading ? "—" : nbTotal}
               sub="Total corrections en base"
            />
            <KPICard
               label="Conformes"
               value={loading ? "—" : nbOk}
               colorVar="var(--c-success)"
               bgVar="var(--c-success-light)"
               borderColor="#A7F3D0"
               sub="SIRET vérifié, données extraites"
            />
            <KPICard
               label="Avertissements"
               value={loading ? "—" : nbWarning}
               colorVar="var(--c-warning)"
               bgVar="var(--c-warning-light)"
               borderColor="#FDE68A"
               sub="À vérifier manuellement"
            />
            <KPICard
               label="Erreurs"
               value={loading ? "—" : nbErreur}
               colorVar="var(--c-error)"
               bgVar="var(--c-error-light)"
               borderColor="#FECACA"
               sub="SIRET absent ou non trouvé"
            />
         </div>

         {/* Table corrections */}
         <div className="dashboard__table-card">
            <div className="dashboard__toolbar">
               <h2 className="dashboard__toolbar-title">Corrections</h2>
               <input
                  className="dashboard__search"
                  type="text"
                  placeholder="Rechercher par nom ou SIRET…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
               />
            </div>

            <div className="dashboard__thead" style={{ gridTemplateColumns: "2fr 1fr 1.5fr 1fr 100px" }}>
               <span>Fournisseur</span>
               <span>Type</span>
               <span>SIRET</span>
               <span>Montant TTC</span>
               <span>Statut</span>
            </div>

            {loading ? (
               <div className="dashboard__empty">Chargement…</div>
            ) : filtered.length === 0 ? (
               <div className="dashboard__empty">
                  {corrections.length === 0
                     ? "Aucune correction en base — uploadez des documents pour commencer."
                     : "Aucun résultat pour cette recherche."}
               </div>
            ) : (
               filtered.map((c) => {
                  const nom   = c.extracted_info?.nom_fournisseur || c.infos_scrap_document?.Info_vendeur?.Nom || c.gouv_info?.nom_complet || c.infos_gouv?.nom_officiel || "—";
                  const type  = c.document_type || c.type_doc || "—";
                  const siret = c.siret || c.extracted_info?.siret_fournisseur || c.NUM_SIRET || "—";
                  const ttc   = c.extracted_info?.ttc || c.infos_scrap_document?.total_ttc || null;
                  const ok    = c.STATUT === "SUCCES" || c.is_conform === true;
                  const warn  = c.WARNING_FLAG;

                  return (
                     <div
                        key={c._id}
                        className="dashboard__row"
                        style={{ gridTemplateColumns: "2fr 1fr 1.5fr 1fr 100px", cursor: "default" }}
                     >
                        <div>
                           <div className="dashboard__row-name">{nom}</div>
                           {c.gouv_info?.adresse && (
                              <div className="dashboard__row-docs" style={{ marginTop: 2 }}>
                                 {c.gouv_info.adresse}
                              </div>
                           )}
                           {c.infos_gouv?.adresse_officielle && (
                              <div className="dashboard__row-docs" style={{ marginTop: 2 }}>
                                 {c.infos_gouv.adresse_officielle}
                              </div>
                           )}
                        </div>

                        <div style={{ fontSize: 12, alignSelf: "center" }}>{type}</div>

                        <div style={{ fontSize: 12, fontFamily: "monospace", alignSelf: "center" }}>{siret}</div>

                        <div style={{ fontSize: 13, fontWeight: 600, alignSelf: "center" }}>
                           {ttc ? `${ttc} €` : "—"}
                        </div>

                        <div style={{ alignSelf: "center" }}>
                           {warn ? (
                              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--c-warning)", background: "var(--c-warning-light)", borderRadius: 5, padding: "2px 7px" }}>
                                 ⚠ Warn
                              </span>
                           ) : ok ? (
                              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--c-success)" }}>
                                 ✓ Conforme
                              </span>
                           ) : (
                              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--c-error)", background: "var(--c-error-light)", borderRadius: 5, padding: "2px 7px" }}>
                                 ✕ Erreur
                              </span>
                           )}
                        </div>
                     </div>
                  );
               })
            )}
         </div>
      </div>
   );
}
