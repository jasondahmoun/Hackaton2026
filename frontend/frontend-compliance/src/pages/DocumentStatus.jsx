import React, { useEffect, useState } from "react";
import "./DocumentStatus.css";
import { fetchAllDocuments } from "../api";
import StatusTag from "../components/StatusTag";

const TYPE_OPTIONS   = ["Tous", "Facture", "Bon de commande", "Contrat", "Attestation URSSAF"];
const STATUT_OPTIONS = ["Tous", "anomalie", "avertissement", "ok"];

function SkeletonRow() {
  const widths = ["55%", "65%", "45%", "40%", "35%"];
  return (
    <div className="docstatus__skeleton-row">
      {widths.map((w, i) => (
        <div
          key={i}
          className="skeleton-block"
          style={{ width: w, height: 14 }}
        />
      ))}
    </div>
  );
}

export default function DocumentStatus() {
  const [documents,    setDocuments]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [filterType,   setFilterType]   = useState("Tous");
  const [filterStatut, setFilterStatut] = useState("Tous");
  const [search,       setSearch]       = useState("");

  useEffect(() => {
    fetchAllDocuments().then((docs) => {
      setDocuments(docs);
      setLoading(false);
    });
  }, []);

  const filtered = documents.filter((doc) => {
    const matchType   = filterType   === "Tous" || doc.type   === filterType;
    const matchStatut = filterStatut === "Tous" || doc.statut === filterStatut;
    const matchSearch =
      !search ||
      doc.id.toLowerCase().includes(search.toLowerCase()) ||
      doc.fournisseur.toLowerCase().includes(search.toLowerCase());
    return matchType && matchStatut && matchSearch;
  });

  const nbAnomalies     = documents.filter((d) => d.statut === "anomalie").length;
  const nbAvertissements= documents.filter((d) => d.statut === "avertissement").length;
  const nbOk            = documents.filter((d) => d.statut === "ok").length;

  return (
    <div>
      {/* En-tête */}
      <div className="docstatus__header">
        <h1 className="docstatus__title">État des documents</h1>
        <p className="docstatus__subtitle">
          Liste complète des documents analysés et leur statut de traitement
        </p>
      </div>

      {/* Stats */}
      <div className="docstatus__stats">
        <div className="docstatus__stat">
          <div className="docstatus__stat-value" style={{ color: "var(--c-error)" }}>
            {loading ? "—" : nbAnomalies}
          </div>
          <div className="docstatus__stat-label">Anomalies</div>
        </div>
        <div className="docstatus__stat">
          <div className="docstatus__stat-value" style={{ color: "var(--c-warning)" }}>
            {loading ? "—" : nbAvertissements}
          </div>
          <div className="docstatus__stat-label">Avertissements</div>
        </div>
        <div className="docstatus__stat">
          <div className="docstatus__stat-value" style={{ color: "var(--c-success)" }}>
            {loading ? "—" : nbOk}
          </div>
          <div className="docstatus__stat-label">Conformes</div>
        </div>
        <div className="docstatus__stat">
          <div className="docstatus__stat-value" style={{ color: "var(--c-text-body)" }}>
            {loading ? "—" : documents.length}
          </div>
          <div className="docstatus__stat-label">Total</div>
        </div>
      </div>

      {/* Tableau */}
      <div className="docstatus__card">
        {/* Toolbar */}
        <div className="docstatus__toolbar">
          <input
            className="docstatus__search"
            type="text"
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="docstatus__select"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            {TYPE_OPTIONS.map((t) => <option key={t}>{t}</option>)}
          </select>
          <select
            className="docstatus__select"
            value={filterStatut}
            onChange={(e) => setFilterStatut(e.target.value)}
          >
            {STATUT_OPTIONS.map((s) => <option key={s}>{s}</option>)}
          </select>
          <span className="docstatus__count">
            {filtered.length} document{filtered.length > 1 ? "s" : ""}
          </span>
        </div>

        {/* En-tête colonnes */}
        <div className="docstatus__thead">
          <span>Référence</span>
          <span>Fournisseur</span>
          <span>Type</span>
          <span>Statut</span>
          <span>Traité le</span>
        </div>

        {/* Lignes */}
        {loading ? (
          Array(6).fill(0).map((_, i) => <SkeletonRow key={i} />)
        ) : filtered.length === 0 ? (
          <div className="docstatus__empty">
            Aucun document ne correspond aux filtres.
          </div>
        ) : (
          filtered.map((doc) => (
            <div key={doc.id} className="docstatus__row">
              <span className="docstatus__ref">{doc.id}</span>
              <span className="docstatus__supplier">{doc.fournisseur}</span>
              <span className="docstatus__type">{doc.type}</span>
              <StatusTag statut={doc.statut} small />
              <span className="docstatus__date">
                {new Date(doc.dateTraitement).toLocaleDateString("fr-FR")}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
