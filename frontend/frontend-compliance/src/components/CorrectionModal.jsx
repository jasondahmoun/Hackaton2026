import { useState, useEffect } from "react";

const API = "http://localhost:8000";

export default function CorrectionModal({ c, onClose }) {
   if (!c) return null;

   const docId  = c.document_id || c._id;
   const fileUrl = docId ? `${API}/documents/${docId}/file` : null;
   const [fileType, setFileType] = useState(null);

     useEffect(() => {
    if (!fileUrl) return;

    if (c.content_type && c.content_type.includes("pdf")) {
      setFileType("pdf");
    } else if (c.content_type && c.content_type.startsWith("image/")) {
      setFileType("image");
    } else {
      setFileType("unknown");
    }
  }, [fileUrl, c]);


   const nom     = c.extracted_info?.nom_fournisseur || c.infos_scrap_document?.Info_vendeur?.Nom || c.gouv_info?.nom_complet || c.infos_gouv?.nom_officiel || "—";
   const siret   = c.siret || c.extracted_info?.siret_fournisseur || c.NUM_SIRET || "—";
   const type    = c.document_type || c.type_doc || "—";
   const adresse = c.gouv_info?.adresse || c.infos_gouv?.adresse_officielle || null;
   const produits  = c.extracted_info?.biens_et_produits || c.infos_scrap_document?.Biens_et_produits || [];
   const totalHT   = c.extracted_info?.total_ht  || c.infos_scrap_document?.total_ht  || null;
   const totalTTC  = c.extracted_info?.ttc        || c.infos_scrap_document?.total_ttc || null;
   const tva       = c.extracted_info?.tva        || null;
   const idDoc     = c.extracted_info?.id_facture || c.infos_scrap_document?.ID_Facture || c._id;
   const ok        = c.STATUT === "SUCCES" || c.is_conform === true;
   const warn      = c.WARNING_FLAG;

   const Section = ({ title, children }) => (
      <div style={{ marginBottom: 20 }}>
         <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#9ca3af", marginBottom: 8 }}>{title}</div>
         {children}
      </div>
   );

   const Field = ({ label, value }) => value ? (
      <div style={{ marginBottom: 8 }}>
         <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase" }}>{label}</div>
         <div style={{ fontSize: 13, color: "#111", marginTop: 2, fontFamily: label === "SIRET" ? "monospace" : "inherit" }}>{value}</div>
      </div>
   ) : null;

   return (
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
         <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 720, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 8px 40px rgba(0,0,0,0.25)" }}>

            {/* Header */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
               <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: "#111" }}>{nom}</div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                     <span style={{ fontFamily: "monospace", marginRight: 12 }}>{siret}</span>
                     <span style={{ background: "#f3f4f6", borderRadius: 4, padding: "1px 7px", fontSize: 11, fontWeight: 600 }}>{type}</span>
                  </div>
               </div>
               <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {warn ? (
                     <span style={{ fontSize: 12, fontWeight: 700, color: "var(--c-warning)", background: "var(--c-warning-light)", borderRadius: 6, padding: "3px 10px" }}>⚠ Avertissement</span>
                  ) : ok ? (
                     <span style={{ fontSize: 12, fontWeight: 700, color: "var(--c-success)", background: "#dcfce7", borderRadius: 6, padding: "3px 10px" }}>✓ Conforme</span>
                  ) : (
                     <span style={{ fontSize: 12, fontWeight: 700, color: "var(--c-error)", background: "var(--c-error-light)", borderRadius: 6, padding: "3px 10px" }}>✕ Erreur</span>
                  )}
                  <button onClick={onClose} style={{ background: "#f3f4f6", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", color: "#374151" }}>×</button>
               </div>
            </div>

            {fileUrl && fileType && fileType !== "error" && fileType !== "unknown" && (
               <div style={{ borderBottom: "1px solid #e5e7eb", background: "#f9fafb", display: "flex", justifyContent: "center", padding: "12px 20px", flexShrink: 0 }}>
                  {fileType === "pdf" ? (
                     <iframe
                        src={fileUrl}
                        title="PDF preview"
                        style={{ width: "100%", height: 300, borderRadius: 6, border: "1px solid #e5e7eb" }}
                     />
                  ) : (
                     <img
                        src={fileUrl}
                        alt="Document original"
                        onClick={() => window.open(fileUrl, "_blank")}
                        onError={e => { e.target.closest("div").style.display = "none" }}
                        style={{ maxHeight: 220, maxWidth: "100%", borderRadius: 6, border: "1px solid #e5e7eb", cursor: "zoom-in", objectFit: "contain" }}
                     />
                  )}
               </div>
            )}

            {/* Body scrollable */}
            <div style={{ overflow: "auto", padding: "20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

               {/* Colonne gauche */}
               <div>
                  <Section title="Document">
                     <Field label="ID" value={idDoc} />
                     <Field label="Type" value={type} />
                     <Field label="Date émission" value={c.infos_scrap_document?.date_emission || null} />
                  </Section>

                  <Section title="Fournisseur (document)">
                     <Field label="Nom" value={nom} />
                     <Field label="SIRET" value={siret} />
                     <Field label="Adresse" value={c.extracted_info?.adresse_fournisseur || c.infos_scrap_document?.Info_vendeur?.adresse || null} />
                  </Section>

                  {(c.gouv_info || c.infos_gouv) && (
                     <Section title="Données officielles (API Gouv)">
                        <Field label="Nom officiel" value={c.gouv_info?.nom_complet || c.infos_gouv?.nom_officiel} />
                        <Field label="SIREN" value={c.gouv_info?.siren || c.infos_gouv?.siren} />
                        <Field label="Adresse" value={adresse} />
                        <Field label="Activité" value={c.infos_gouv?.activite || null} />
                        <Field label="État" value={c.infos_gouv?.etat === "A" ? "Actif" : c.infos_gouv?.etat || null} />
                     </Section>
                  )}

                  <Section title="Statut pipeline">
                     <Field label="Statut" value={c.STATUT || (c.is_conform != null ? (c.is_conform ? "SUCCES" : "ERREUR") : null)} />
                     <Field label="Détail" value={c.STATUT_TEXT || c.WARNING_TEXT || null} />
                     <Field label="Traité le" value={c.processed_at ? new Date(c.processed_at).toLocaleString("fr-FR") : c.timestamp_audit || null} />
                  </Section>
               </div>

               {/* Colonne droite */}
               <div>
                  {produits.length > 0 && (
                     <Section title={`Produits (${produits.length})`}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                           {produits.map((p, i) => (
                              <div key={i} style={{ background: "#f9fafb", borderRadius: 6, padding: "8px 10px", border: "1px solid #e5e7eb" }}>
                                 <div style={{ fontWeight: 600, fontSize: 13, color: "#111" }}>{p.NomProduit}</div>
                                 <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                                    Qté&nbsp;{p.Quantite ?? p.Quantité_QT} · {p.prix_unitaire_ht} € HT/u
                                 </div>
                              </div>
                           ))}
                        </div>
                     </Section>
                  )}

                  <Section title="Montants">
                     <Field label="Total HT" value={totalHT ? `${totalHT} €` : null} />
                     <Field label="TVA" value={tva ? `${tva} €` : null} />
                     <Field label="Total TTC" value={totalTTC ? `${totalTTC} €` : null} />
                  </Section>
               </div>
            </div>
         </div>
      </div>
   );
}
