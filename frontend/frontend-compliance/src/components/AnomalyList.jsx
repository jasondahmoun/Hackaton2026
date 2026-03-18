import React from "react";
import "./AnomalyList.css";
import AlertBadge from "./AlertBadge";

const TYPE_LABELS = {
   siret_mismatch: "SIRET",
   tva_incoherence: "TVA",
   montant_calcul: "Calcul",
   urssaf_expire: "URSSAF",
   urssaf_expire_soon: "URSSAF",
};

function formatDate(iso) {
   return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
   });
}

/**
 * AnomalyList — liste d'anomalies avec barre sévérité, icône, références docs
 * @param {Array} anomalies
 */
export default function AnomalyList({ anomalies = [] }) {
   if (!anomalies.length) {
      return (
         <div className="anomaly-list__empty">✓ Aucune anomalie détectée</div>
      );
   }

   return (
      <div className="anomaly-list">
         {anomalies.map((ano) => (
            <div key={ano.id} className="anomaly-list__row">
               {/* Barre couleur */}
               <div
                  className={`anomaly-list__bar anomaly-list__bar--${ano.severite}`}
               />

               {/* Contenu */}
               <div className="anomaly-list__body">
                  <div className="anomaly-list__title-row">
                     <span className="anomaly-list__title">{ano.titre}</span>
                     <AlertBadge level={ano.severite} small />
                     <span
                        className={`anomaly-list__type-badge anomaly-list__type-badge--${ano.severite}`}
                     >
                        {TYPE_LABELS[ano.type] ?? ano.type}
                     </span>
                  </div>

                  <p className="anomaly-list__desc">{ano.description}</p>

                  <div className="anomaly-list__meta">
                     {ano.documents.map((doc) => (
                        <span key={doc} className="anomaly-list__doc-ref">
                           {doc}
                        </span>
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
