import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./AnomalyDetail.css";
import { fetchCompliance } from "../api";
import AnomalyList      from "../components/AnomalyList";
import CoherenceReport  from "../components/CoherenceReport";
import StatusTag        from "../components/StatusTag";

const TABS = [
  { key: "anomalies", label: (n) => `Anomalies (${n})` },
  { key: "rapport",   label: ()  => "Rapport de cohérence" },
  { key: "documents", label: (n) => `Documents (${n})` },
];

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("fr-FR");
}

export default function AnomalyDetail() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [activeTab,setActiveTab]= useState("anomalies");

  useEffect(() => {
    setLoading(true);
    fetchCompliance(id).then((d) => {
      setData(d);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <div className="detail__loading">Chargement…</div>;
  if (!data?.fournisseur) return <div className="detail__error">Fournisseur introuvable.</div>;

  const { fournisseur, anomalies, documents } = data;
  const nbCritiques = anomalies.filter((a) => a.severite === "critique").length;
  const nbWarnings  = anomalies.filter((a) => a.severite === "warn").length;

  return (
    <div>
      {/* Fil d'ariane */}
      <div className="detail__breadcrumb">
        <button className="detail__breadcrumb-back" onClick={() => navigate("/")}>
          ← Tableau de bord
        </button>
        <span className="detail__breadcrumb-sep">/</span>
        <span className="detail__breadcrumb-current">{fournisseur.nom}</span>
      </div>

      {/* Carte fournisseur */}
      <div className="detail__supplier-card">
        <div>
          <h1 className="detail__supplier-name">{fournisseur.nom}</h1>
          <div className="detail__supplier-meta">
            <span className="detail__supplier-meta-item">
              SIRET : <span className="detail__supplier-meta-value">{fournisseur.siret}</span>
            </span>
            <span className="detail__supplier-meta-item">
              Dernière analyse : {formatDate(fournisseur.derniereAnalyse)}
            </span>
          </div>
        </div>
        <StatusTag statut={fournisseur.statut} />
      </div>

      {/* Stats rapides */}
      <div className="detail__stats">
        <div className="detail__stat">
          <div className="detail__stat-value" style={{ color: "var(--c-error)" }}>
            {nbCritiques}
          </div>
          <div className="detail__stat-label">Critiques</div>
        </div>
        <div className="detail__stat">
          <div className="detail__stat-value" style={{ color: "var(--c-warning)" }}>
            {nbWarnings}
          </div>
          <div className="detail__stat-label">Avertissements</div>
        </div>
        <div className="detail__stat">
          <div className="detail__stat-value" style={{ color: "var(--c-primary)" }}>
            {documents.length}
          </div>
          <div className="detail__stat-label">Documents</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="detail__tabs">
        {TABS.map((tab) => {
          const count = tab.key === "anomalies" ? anomalies.length : documents.length;
          return (
            <button
              key={tab.key}
              className={`detail__tab${activeTab === tab.key ? " detail__tab--active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label(count)}
            </button>
          );
        })}
      </div>

      {/* Contenu onglet */}
      {activeTab === "anomalies" && (
        <div className="detail__panel">
          {anomalies.length === 0
            ? <div className="detail__panel-empty">✓ Aucune anomalie pour ce fournisseur.</div>
            : <AnomalyList anomalies={anomalies} />
          }
        </div>
      )}

      {activeTab === "rapport" && (
        <CoherenceReport
          fournisseur={fournisseur}
          anomalies={anomalies}
          documents={documents}
        />
      )}

      {activeTab === "documents" && (
        <div className="detail__panel">
          <div className="detail__doc-thead">
            <span>Référence</span>
            <span>Type</span>
            <span>Statut</span>
            <span>Traité le</span>
          </div>
          {documents.map((doc) => (
            <div key={doc.id} className="detail__doc-row">
              <span className="detail__doc-ref">{doc.id}</span>
              <span className="detail__doc-type">{doc.type}</span>
              <StatusTag statut={doc.statut} small />
              <span className="detail__doc-date">{formatDate(doc.dateTraitement)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
