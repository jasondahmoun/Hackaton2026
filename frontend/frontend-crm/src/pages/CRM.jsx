import { useState, useEffect } from 'react'
import { getCorrections } from '../api/client'
import { getBadgeClass } from '../utils/formatters'

function Field({ label, value }) {
  if (!value) return null
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text)', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-h)', fontWeight: 500 }}>{value}</div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px',
        color: 'var(--text)', borderBottom: '1px solid var(--border)', paddingBottom: 6, marginBottom: 12,
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function CorrectionDetail({ correction }) {
  const d = correction.details || {}
  const vendeur = correction.Info_vendeur || {}
  const acheteur = correction.Info_acheteur || {}
  const produits = correction.Biens_et_produit || []

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 8,
      padding: '20px 22px', background: 'var(--bg)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-h)' }}>
            {vendeur.Nom || 'Fournisseur inconnu'}
          </h2>
          <div style={{ marginTop: 4, display: 'flex', gap: 8, alignItems: 'center' }}>
            {correction.type && (
              <span className={`badge ${getBadgeClass(correction.type?.toLowerCase())}`}>
                {correction.type}
              </span>
            )}
            {d.ID && <span style={{ fontSize: 12, color: 'var(--text)' }}>N° {d.ID}</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>
            {correction.total_TTC ? `${correction.total_TTC} €` : '—'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text)', marginTop: 2 }}>
            HT : {correction.total_ht ? `${correction.total_ht} €` : '—'}
          </div>
        </div>
      </div>

      {/* Dates */}
      <Section title="Dates">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
          <Field label="Date d'émission" value={d.Date_emission} />
          <Field label="Date d'achat" value={d.Date_achat} />
        </div>
      </Section>

      {/* Vendeur */}
      <Section title="Vendeur">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
          <Field label="Nom" value={vendeur.Nom} />
          <Field label="SIRET" value={vendeur.SIRET} />
          <Field label="Adresse" value={vendeur.adresse !== 'Non trouvée' ? vendeur.adresse : null} />
        </div>
      </Section>

      {/* Acheteur */}
      <Section title="Acheteur">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
          <Field label="Nom" value={acheteur.Nom} />
          <Field label="Adresse client" value={acheteur.adresse_client} />
          <Field label="Adresse facturation" value={acheteur.adresse_facturation} />
        </div>
      </Section>

      {/* Produits */}
      {produits.length > 0 && (
        <Section title={`Produits / Services (${produits.length})`}>
          <div style={{ border: '1px solid var(--border)', borderRadius: 7, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)' }}>
                  <th style={{ padding: '7px 10px', textAlign: 'left', color: 'var(--text)', fontWeight: 600 }}>Produit</th>
                  <th style={{ padding: '7px 10px', textAlign: 'center', color: 'var(--text)', fontWeight: 600 }}>Qté</th>
                  <th style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--text)', fontWeight: 600 }}>PU HT</th>
                  <th style={{ padding: '7px 10px', textAlign: 'center', color: 'var(--text)', fontWeight: 600 }}>TVA</th>
                  <th style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--text)', fontWeight: 600 }}>Total ligne</th>
                </tr>
              </thead>
              <tbody>
                {produits.map((p, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '7px 10px', color: 'var(--text-h)' }}>{p.NomProduit}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'center', color: 'var(--text)' }}>{p.Quantité_QT}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--text)' }}>{p.prix_unitaire_hors_taxes} €</td>
                    <td style={{ padding: '7px 10px', textAlign: 'center', color: 'var(--text)' }}>{p.Taux_de_TVA}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--text-h)' }}>{p.Prix_TOTAL_Ligne} €</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg-subtle)' }}>
                  <td colSpan={4} style={{ padding: '8px 10px', textAlign: 'right', fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>
                    Total HT
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--text-h)' }}>
                    {correction.total_ht} €
                  </td>
                </tr>
                <tr style={{ background: 'var(--accent-bg)' }}>
                  <td colSpan={4} style={{ padding: '8px 10px', textAlign: 'right', fontSize: 13, color: 'var(--accent)', fontWeight: 700 }}>
                    Total TTC
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--accent)', fontSize: 14 }}>
                    {correction.total_TTC} €
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Section>
      )}

      <div style={{ fontSize: 10, color: 'var(--text)', marginTop: 8, fontFamily: 'var(--mono)' }}>
        id : {correction._id} · original : {correction.original_id}
      </div>
    </div>
  )
}

export default function CRM() {
  const [corrections, setCorrections] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    getCorrections()
      .then(data => {
        setCorrections(data)
        if (data.length > 0) setSelectedId(data[0]._id)
      })
      .catch(err => setError(err?.message || 'Erreur de chargement'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = corrections.filter(c => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      c.Info_vendeur?.Nom?.toLowerCase().includes(s) ||
      c.Info_vendeur?.SIRET?.includes(s) ||
      c.details?.ID?.toLowerCase().includes(s) ||
      c.type?.toLowerCase().includes(s)
    )
  })

  const selected = corrections.find(c => c._id === selectedId)

  return (
    <>
      <div className="page-header">
        <h1>CRM Fournisseurs</h1>
        <p>Documents traités et extraits depuis la base de corrections</p>
      </div>

      <div className="page-content">
        {loading ? (
          <div className="empty-state">
            <span className="empty-icon">⏳</span>
            <span>Chargement des corrections…</span>
          </div>
        ) : error ? (
          <div className="alert-banner red">
            <span className="alert-icon"></span>
            <span className="alert-text"><strong>Erreur</strong>{error}</span>
          </div>
        ) : corrections.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon"></span>
            <span>Aucune correction en base</span>
            <span style={{ fontSize: 12 }}>Uploadez des documents pour les voir apparaître ici</span>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, alignItems: 'start' }}>

            {/* ── Liste corrections ── */}
            <div>
              <div style={{ marginBottom: 10 }}>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher…"
                  style={{
                    width: '100%', padding: '7px 10px', boxSizing: 'border-box',
                    border: '1px solid var(--border)', borderRadius: 6,
                    fontSize: 13, background: 'var(--bg)', color: 'var(--text-h)',
                    outline: 'none', fontFamily: 'var(--sans)',
                  }}
                  onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {filtered.map(c => (
                  <div
                    key={c._id}
                    onClick={() => setSelectedId(c._id)}
                    style={{
                      padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                      border: `1px solid ${c._id === selectedId ? 'var(--accent)' : 'var(--border)'}`,
                      background: c._id === selectedId ? 'var(--accent-bg)' : 'var(--bg)',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span className={`badge ${getBadgeClass(c.type?.toLowerCase())}`}>
                        {c.type || 'doc'}
                      </span>
                      {c.details?.ID && (
                        <span style={{ fontSize: 11, color: 'var(--text)' }}>N° {c.details.ID}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-h)', lineHeight: 1.3 }}>
                      {c.Info_vendeur?.Nom || 'Vendeur inconnu'}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                      <span style={{ fontSize: 11, color: 'var(--text)' }}>
                        {c.details?.Date_emission || '—'}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
                        {c.total_TTC ? `${c.total_TTC} €` : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text)', textAlign: 'center' }}>
                {filtered.length} correction{filtered.length > 1 ? 's' : ''}
              </div>
            </div>

            {/* ── Détail ── */}
            <div>
              {selected ? (
                <CorrectionDetail correction={selected} />
              ) : (
                <div className="empty-state" style={{ border: '1px solid var(--border)', borderRadius: 8, minHeight: 300 }}>
                  <span className="empty-icon"></span>
                  <span>Sélectionnez une correction</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
