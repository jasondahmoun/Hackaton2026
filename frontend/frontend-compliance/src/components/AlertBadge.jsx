import React from "react";
import "./AlertBadge.css";

const LABELS = {
  critique: "Critique",
  warn:     "Avertissement",
  ok:       "Conforme",
};

/**
 * AlertBadge
 * @param {string}  level  - "critique" | "warn" | "ok"
 * @param {boolean} small  - taille réduite
 */
export default function AlertBadge({ level = "ok", small = false }) {
  const safeLevel = LABELS[level] ? level : "ok";

  return (
    <span
      className={[
        "alert-badge",
        `alert-badge--${safeLevel}`,
        small ? "alert-badge--small" : "alert-badge--normal",
      ].join(" ")}
    >
      <span className="alert-badge__dot" />
      {LABELS[safeLevel]}
    </span>
  );
}
