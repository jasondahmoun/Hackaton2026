import React from "react";
import "./KPICard.css";

/**
 * KPICard — carte indicateur clé
 * @param {string} label
 * @param {string|number} value
 * @param {string} sub    - sous-titre optionnel
 * @param {string} colorVar  - variable CSS couleur valeur (ex: "var(--c-error)")
 * @param {string} bgVar     - variable CSS couleur fond  (ex: "var(--c-error-light)")
 * @param {string} borderColor - couleur de bordure hex/css
 */
export default function KPICard({
   label,
   value,
   sub,
   colorVar,
   bgVar,
   borderColor,
}) {
   return (
      <div
         className="kpi-card"
         style={{
            background: bgVar || undefined,
            borderColor: borderColor || undefined,
         }}
      >
         <div className="kpi-card__header">
            <span
               className="kpi-card__label"
               style={{ color: colorVar || undefined }}
            >
               {label}
            </span>
         </div>

         <div
            className="kpi-card__value"
            style={{ color: colorVar || undefined }}
         >
            {value}
         </div>

         {sub && <p className="kpi-card__sub">{sub}</p>}
      </div>
   );
}
