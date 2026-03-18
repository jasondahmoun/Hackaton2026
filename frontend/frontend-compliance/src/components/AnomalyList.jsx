import { useState } from "react";
import "./AnomalyList.css";
import AlertBadge from "./AlertBadge";
import { fetchDocumentByRef } from "../api";

const TYPE_LABELS = {
   siret_mismatch:    "SIRET",
   tva_incoherence:   "TVA",
   montant_calcul:    "Calcul",
   urssaf_expire:     "URSSAF",
   urssaf_expire_soon:"URSSAF",
};

function formatDate(iso) {
   return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit", month: "short", year: "numeric",
   });
}

// ── Parseur champs depuis texte OCR ─────────────────────
function parseFields(text = "") {
   const fields = {};
   const siret = text.match(/\b(\d{3}[\s]?\d{3}[\s]?\d{3}[\s]?\d{5})\b/);
   if (siret) fields["SIRET"] = siret[1].replace(/\s/g, "");
   const tva = text.match(/FR\s*\d{2}\s*\d{9}/i);
   if (tva) fields["N° TVA"] = tva[0].replace(/\s/g, "");
   const ht = text.match(/(?:montant\s*h\.?t\.?|ht)[^\d]*(\d[\d\s,.]*)\s*€?/i);
   if (ht) fields["Montant HT"] = ht[1].trim() + " €";
   const ttc = text.match(/(?:montant\s*t\.?t\.?c\.?|ttc|total)[^\d]*(\d[\d\s,.]*)\s*€?/i);
   if (ttc) fields["Montant TTC"] = ttc[1].trim() + " €";
   const dates = [...text.matchAll(/\b(\d{2})[\/\-](\d{2})[\/\-](\d{4})\b/g)].map(m => m[0]);
   if (dates[0]) fields["Date émission"] = dates[0];
   if (dates[1]) fields["Date échéance"] = dates[1];
   const iban = text.match(/FR\d{2}[\s\d]{20,30}/i);
   if (iban) fields["IBAN"] = iban[0].replace(/\s+/g, " ").trim();
   return fields;
}

// ── Modal document ────────────────────────────────────────
function DocumentModal({ doc, onClose }) {
   if (!doc) return null;

   const fields = parseFields(doc.text);
   const imgUrl = doc.file_url ? `/uploads/${doc.file_url.replace("data/uploads/", "")}` : null;

   return (
      <div
         onClick={onClose}
         style={{
            position: "fixed", inset: 0, zIndex: 10000,
            background: "rgba(0,0,0,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
         }}
      >
         <div
            onClick={e => e.stopPropagation()}
            style={{
               background: "#fff", borderRadius: 12,
               width: "100%", maxWidth: 800, maxHeight: "90vh",
               overflow: "hidden", display: "flex", flexDirection: "column",
               boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
            }}
         >
            {/* Header */}
            <div style={{
               padding: "14px 20px", borderBottom: "1px solid #e5e7eb",
               display: "flex", alignItems: "center", justifyContent: "space-between",
               flexShrink: 0,
            }}>
               <div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: "#111" }}>{doc.filename}</div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                     {doc.timestamp ? new Date(doc.timestamp).toLocaleString("fr-FR") : ""}
                     {doc.file_url && <span style={{ marginLeft: 8, color: "#9ca3af", fontFamily: "monospace", fontSize: 11 }}>{doc.file_url}</span>}
                  </div>
               </div>
               <button
                  onClick={onClose}
                  style={{
                     background: "#f3f4f6", border: "none", borderRadius: "50%",
                     width: 32, height: 32, cursor: "pointer", fontSize: 18,
                     display: "flex", alignItems: "center", justifyContent: "center", color: "#374151",
                  }}
               >×</button>
            </div>

            {/* Body */}
            <div style={{ display: "flex", overflow: "hidden", flex: 1 }}>

               {/* Image */}
               {imgUrl && (
                  <div style={{
                     flex: "0 0 50%", borderRight: "1px solid #e5e7eb",
                     overflow: "auto", padding: 16, background: "#f9fafb",
                     display: "flex", alignItems: "flex-start", justifyContent: "center",
                  }}>
                     <img
                        src={imgUrl}
                        alt={doc.filename}
                        style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid #e5e7eb" }}
                     />
                  </div>
               )}

               {/* Champs */}
               <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
                  {Object.keys(fields).length > 0 ? (
                     <>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#6b7280", marginBottom: 12 }}>
                           Champs extraits
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                           {Object.entries(fields).map(([k, v]) => (
                              <div key={k}>
                                 <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "#9ca3af", letterSpacing: "0.4px" }}>{k}</div>
                                 <div style={{ fontSize: 14, fontWeight: 500, color: "#111", marginTop: 2 }}>{v}</div>
                              </div>
                           ))}
                        </div>
                     </>
                  ) : (
                     <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 16 }}>Aucun champ structuré extrait</div>
                  )}

                  {doc.text && (
                     <div style={{ marginTop: 20 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#6b7280", marginBottom: 8 }}>
                           Texte OCR brut
                        </div>
                        <pre style={{
                           fontSize: 11, color: "#374151", background: "#f3f4f6",
                           borderRadius: 6, padding: 12, whiteSpace: "pre-wrap",
                           wordBreak: "break-word", maxHeight: 280, overflow: "auto",
                           border: "1px solid #e5e7eb", fontFamily: "monospace",
                        }}>
                           {doc.text}
                        </pre>
                     </div>
                  )}
               </div>
            </div>
         </div>
      </div>
   );
}

// ── DocRef cliquable ──────────────────────────────────────
function DocRef({ ref }) {
   const [loading, setLoading] = useState(false);
   const [doc,     setDoc]     = useState(null);
   const [error,   setError]   = useState(null);

   async function handleClick() {
      setLoading(true);
      setError(null);
      try {
         const d = await fetchDocumentByRef(ref);
         setDoc(d);
      } catch (e) {
         setError(e.message);
      } finally {
         setLoading(false);
      }
   }

   return (
      <>
         <span
            className="anomaly-list__doc-ref"
            onClick={handleClick}
            style={{ cursor: "pointer", textDecoration: "underline dotted" }}
            title="Cliquer pour afficher le document"
         >
            {loading ? "…" : ref}
            {error && <span style={{ color: "red", marginLeft: 4, fontSize: 10 }}>({error})</span>}
         </span>

         {doc && <DocumentModal doc={doc} onClose={() => setDoc(null)} />}
      </>
   );
}

// ── AnomalyList ───────────────────────────────────────────
export default function AnomalyList({ anomalies = [] }) {
   if (!anomalies.length) {
      return <div className="anomaly-list__empty">✓ Aucune anomalie détectée</div>;
   }

   return (
      <div className="anomaly-list">
         {anomalies.map((ano) => (
            <div key={ano.id} className="anomaly-list__row">
               <div className={`anomaly-list__bar anomaly-list__bar--${ano.severite}`} />

               <div className="anomaly-list__body">
                  <div className="anomaly-list__title-row">
                     <span className="anomaly-list__title">{ano.titre}</span>
                     <AlertBadge level={ano.severite} small />
                     <span className={`anomaly-list__type-badge anomaly-list__type-badge--${ano.severite}`}>
                        {TYPE_LABELS[ano.type] ?? ano.type}
                     </span>
                  </div>

                  <p className="anomaly-list__desc">{ano.description}</p>

                  <div className="anomaly-list__meta">
                     {ano.documents.map((doc) => (
                        <DocRef key={doc} ref={doc} />
                     ))}
                     <span className="anomaly-list__date">
                        Détecté le {formatDate(ano.dateDetection)}
                     </span>
                  </div>
               </div>
            </div>
         ))}
      </div>
   );
}
