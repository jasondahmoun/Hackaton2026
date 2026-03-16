import React from "react";
import "./StatusTag.css";

const CONFIG = {
  anomalie:     { label: "Anomalie",      icon: "✕" },
  non_conforme: { label: "Non conforme",  icon: "✕" },
  avertissement:{ label: "Avertissement", icon: "⚠" },
  ok:           { label: "Conforme",      icon: "✓" },
  conforme:     { label: "Conforme",      icon: "✓" },
  en_cours:     { label: "En cours",      icon: "◌" },
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
      <span className="status-tag__icon">{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}
