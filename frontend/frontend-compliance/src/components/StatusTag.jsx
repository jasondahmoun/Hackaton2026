import React from "react";
import "./StatusTag.css";

const CONFIG = {
   anomalie: { label: "Anomalie" },
   non_conforme: { label: "Non conforme" },
   avertissement: { label: "Avertissement" },
   ok: { label: "Conforme" },
   conforme: { label: "Conforme" },
   en_cours: { label: "En cours" },
};

/**
 * StatusTag
 * @param {string}  statut - "anomalie"|"non_conforme"|"avertissement"|"ok"|"conforme"|"en_cours"
 * @param {boolean} small
 */
export default function StatusTag({ statut = "ok", small = false }) {
   const cfg = CONFIG[statut] ?? CONFIG.ok;

   return (
      <span
         className={[
            "status-tag",
            `status-tag--${statut}`,
            small ? "status-tag--small" : "status-tag--normal",
         ].join(" ")}
      >
         {cfg.label}
      </span>
   );
}
