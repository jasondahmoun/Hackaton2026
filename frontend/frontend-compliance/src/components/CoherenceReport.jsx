import React from "react";
import "./CoherenceReport.css";
import StatusTag from "./StatusTag";

const CHECKS = [
  { key: "siret",   label: "Cohérence SIRET",         types: ["siret_mismatch"] },
  { key: "tva",     label: "Cohérence TVA",            types: ["tva_incoherence"] },
  { key: "calcul",  label: "Calculs HT/TTC",           types: ["montant_calcul"] },
  { key: "urssaf",  label: "Attestation URSSAF valide",types: ["urssaf_expire", "urssaf_expire_soon"] },
];

/**
 * CoherenceReport — rapport inter-documents pour un fournisseur
 * @param {object} fournisseur
 * @param {Array}  anomalies
 * @param {Array}  documents
 */
export default function CoherenceReport({ fournisseur, anomalies = [], documents = [] }) {
  if (!fournisseur) return null;

  const nbCritiques = anomalies.filter((a) => a.severite === "critique").length;
  const nbWarnings  = anomalies.filter((a) => a.severite === "warn").length;
  const nbProblemes = documents.filter(
    (d) => d.statut === "anomalie" || d.statut === "avertissement"
  ).length;

  return (
    <div className="coherence-report">
      {/* Header */}
      <div className="coherence-report__header">
        <div>
          <h3 className="coherence-report__title">
            Rapport de cohérence inter-documents
          </h3>
          <p className="coherence-report__subtitle">
            Analyse croisée de {documents.length} document{documents.length > 1 ? "s" : ""} — {fournisseur.nom}
          </p>
        </div>
        <StatusTag statut={fournisseur.statut} />
      </div>

      {/* Identité */}
      <div className="coherence-report__section">
        <p className="coherence-report__section-title">Identité fournisseur</p>
        <div className="coherence-report__row">
          <span className="coherence-report__row-label">Dénomination</span>
          <span className="coherence-report__row-value">{fournisseur.nom}</span>
        </div>
        <div className="coherence-report__row">
          <span className="coherence-report__row-label">SIRET de référence</span>
          <span className="coherence-report__row-value coherence-report__row-value--mono">
            {fournisseur.siret}
          </span>
        </div>
      </div>

      {/* Synthèse */}
      <div className="coherence-report__section">
        <p className="coherence-report__section-title">Synthèse des contrôles</p>
        <div className="coherence-report__kpi-grid">
          <div className="coherence-report__kpi">
            <div
              className="coherence-report__kpi-value"
              style={{ color: "var(--c-error)" }}
            >
              {nbCritiques}
            </div>
            <div className="coherence-report__kpi-label">Anomalies critiques</div>
          </div>
          <div className="coherence-report__kpi">
            <div
              className="coherence-report__kpi-value"
              style={{ color: "var(--c-warning)" }}
            >
              {nbWarnings}
            </div>
            <div className="coherence-report__kpi-label">Avertissements</div>
          </div>
          <div className="coherence-report__kpi">
            <div
              className="coherence-report__kpi-value"
              style={{ color: "var(--c-text-body)" }}
            >
              {nbProblemes}
            </div>
            <div className="coherence-report__kpi-label">Docs. problématiques</div>
          </div>
        </div>
      </div>

      {/* Points de contrôle */}
      <div className="coherence-report__section">
        <p className="coherence-report__section-title">Points de contrôle</p>
        {CHECKS.map(({ key, label, types }) => {
          const ok = !anomalies.some((a) => types.includes(a.type));
          return (
            <div key={key} className="coherence-report__check">
              <span className="coherence-report__check-label">{label}</span>
              <span
                className={`coherence-report__check-result coherence-report__check-result--${ok ? "ok" : "fail"}`}
              >
                {ok ? "✓ Conforme" : "✕ Anomalie"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
