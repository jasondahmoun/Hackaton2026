import { useState, useEffect } from 'react'
import { getSuppliers, saveSupplier } from '../api/client'
import { EMPTY_SUPPLIER, mapDocToSupplier, MOCK_DOCUMENTS_EXTRACTED } from '../mock/data'

// ── Helpers ──────────────────────────────────────────────
function formatSiret(s) {
  if (!s) return ''
  const clean = s.replace(/\s/g, '')
  if (clean.length === 14) return `${clean.slice(0,3)} ${clean.slice(3,6)} ${clean.slice(6,9)} ${clean.slice(9)}`
  return clean
}

function getBadgeClass(type) {
  const map = {
    facture: 'badge-facture', devis: 'badge-devis', kbis: 'badge-kbis',
    urssaf: 'badge-urssaf', rib: 'badge-rib', 'attestation siret': 'badge-siret',
  }
  return map[type?.toLowerCase()] || 'badge-default'
}

function StatusChip({ status }) {
  const labels = { complet: 'Complet', incomplet: 'Incomplet', alerte: 'Alerte' }
  return (
    <span className={`status-chip ${status}`}>
      <span className={`status-dot ${status === 'complet' ? 'green' : status === 'incomplet' ? 'orange' : 'red'}`} />
      {labels[status] || status}
    </span>
  )
}

// ── Mini-doc list dans le formulaire ────────────────────
function DocList({ documents }) {
  if (!documents?.length) return (
    <div style={{ fontSize: 12, color: 'var(--text)', padding: '8px 0' }}>
      Aucun document lié
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {documents.map(doc => (
        <div key={doc.id} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 10px',
          border: '1px solid var(--border)',
          borderRadius: 7,
          fontSize: 12,
          background: 'var(--code-bg)',
        }}>
          <span>{doc.filename?.endsWith('.pdf') ? '📄' : '🖼'}</span>
          <span style={{ flex: 1, color: 'var(--text-h)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {doc.filename}
          </span>
          <span className={`badge ${getBadgeClass(doc.type)}`}>{doc.type}</span>
          <span style={{ fontSize: 14 }}>
            {doc.status === 'done' ? '✅' : doc.status === 'error' ? '❌' : '⏳'}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Formulaire fournisseur ───────────────────────────────
function SupplierForm({ supplier, onSave, onCancel }) {
  const [form, setForm] = useState(supplier)
  const [autoFilled, setAutoFilled] = useState(new Set())
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showAutoFillMenu, setShowAutoFillMenu] = useState(false)

  useEffect(() => {
    setForm(supplier)
    setAutoFilled(new Set())
    setSaved(false)
  }, [supplier.id])

  // Lit les données en attente depuis sessionStorage (arrivées depuis Upload)
  useEffect(() => {
    const pending = JSON.parse(sessionStorage.getItem('pendingCRM') || '[]')
    if (pending.length > 0) {
      const doc = pending[pending.length - 1] // prend le dernier
      handleAutoFill({ id: doc.docId, fields: doc.fields, type: doc.type, filename: doc.filename })
      sessionStorage.removeItem('pendingCRM')
    }
  }, [supplier.id])

  function set(path, value) {
    setForm(prev => {
      const next = { ...prev }
      if (path.includes('.')) {
        const [parent, child] = path.split('.')
        next[parent] = { ...next[parent], [child]: value }
      } else {
        next[path] = value
      }
      return next
    })
  }

  function handleAutoFill(doc) {
    const { updated, autoFilled: filled } = mapDocToSupplier(doc, form)
    setForm(updated)
    setAutoFilled(prev => new Set([...prev, ...filled]))
    setShowAutoFillMenu(false)
  }

  async function handleSave() {
    setSaving(true)
    const saved = await saveSupplier(form)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    onSave(saved)
  }

  const isNew = !supplier.id

  // Documents disponibles pour auto-fill (mock + docs liés)
  const availableDocs = [
    ...Object.values(MOCK_DOCUMENTS_EXTRACTED).slice(0, 3),
    ...(form.documents || []).map(d => ({
      id: d.id,
      type: d.type,
      filename: d.filename,
      fields: { siret: form.siret },
    })),
  ]

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '20px 22px',
      background: 'var(--bg)',
      height: '100%',
      boxSizing: 'border-box',
      overflowY: 'auto',
    }}>
      {/* Header formulaire */}
      <div className="flex-between" style={{ marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-h)' }}>
            {isNew ? '+ Nouveau fournisseur' : form.raisonSociale || 'Fournisseur'}
          </h2>
          {!isNew && (
            <StatusChip status={form.status} />
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
          {/* Bouton auto-fill */}
          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowAutoFillMenu(m => !m)}
            >
              ✨ Auto-remplir (IA)
            </button>
            {showAutoFillMenu && (
              <div style={{
                position: 'absolute', right: 0, top: '100%', marginTop: 4,
                background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 8, boxShadow: 'var(--shadow)',
                zIndex: 100, minWidth: 260, padding: 6,
              }}>
                <div style={{ fontSize: 11, color: 'var(--text)', padding: '4px 8px 6px', fontWeight: 600 }}>
                  CHOISIR UN DOCUMENT SOURCE
                </div>
                {availableDocs.map(doc => (
                  <button
                    key={doc.id}
                    onClick={() => handleAutoFill(doc)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      width: '100%', padding: '7px 10px', border: 'none',
                      background: 'none', cursor: 'pointer', borderRadius: 6,
                      fontSize: 12, color: 'var(--text-h)', textAlign: 'left',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <span className={`badge ${getBadgeClass(doc.type)}`}>{doc.type}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {doc.filename}
                    </span>
                  </button>
                ))}
                <button
                  onClick={() => setShowAutoFillMenu(false)}
                  style={{
                    width: '100%', padding: '6px', border: 'none',
                    background: 'none', cursor: 'pointer', color: 'var(--text)',
                    fontSize: 12, borderTop: '1px solid var(--border)', marginTop: 4,
                  }}
                >
                  Annuler
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Notification auto-fill */}
      {autoFilled.size > 0 && (
        <div className="alert-banner orange" style={{ marginBottom: 16 }}>
          <span className="alert-icon">✨</span>
          <span className="alert-text">
            <strong>Remplissage automatique par IA</strong>
            {autoFilled.size} champ{autoFilled.size > 1 ? 's' : ''} complété{autoFilled.size > 1 ? 's' : ''} automatiquement.
            Vérifiez avant d'enregistrer.
          </span>
        </div>
      )}

      {/* Section Identité */}
      <div className="form-section">
        <div className="form-section-title">Identité</div>
        <div className="form-grid" style={{ marginBottom: 10 }}>
          <div className={`form-group${autoFilled.has('raisonSociale') ? ' field-ia-filled' : ''}`}>
            <label>
              Raison sociale
              {autoFilled.has('raisonSociale') && <span className="ia-tag">IA</span>}
            </label>
            <input
              value={form.raisonSociale}
              onChange={e => set('raisonSociale', e.target.value)}
              placeholder="Ex : Dupont & Associés SARL"
            />
          </div>
          <div className={`form-group${autoFilled.has('siret') ? ' field-ia-filled' : ''}`}>
            <label>
              SIRET
              {autoFilled.has('siret') && <span className="ia-tag">IA</span>}
            </label>
            <input
              value={form.siret}
              onChange={e => {
                set('siret', e.target.value)
                set('siren', e.target.value.replace(/\s/g, '').slice(0, 9))
              }}
              placeholder="000 000 000 00000"
            />
          </div>
        </div>
        <div className="form-grid" style={{ marginBottom: 10 }}>
          <div className="form-group">
            <label>SIREN <span style={{ fontSize: 10, color: 'var(--text)' }}>(auto)</span></label>
            <input value={form.siren} readOnly />
          </div>
          <div className="form-group">
            <label>Contact — Nom</label>
            <input
              value={form.contact?.nom || ''}
              onChange={e => set('contact.nom', e.target.value)}
              placeholder="Prénom Nom"
            />
          </div>
        </div>
        <div className="form-grid" style={{ marginBottom: 10 }}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={form.contact?.email || ''}
              onChange={e => set('contact.email', e.target.value)}
              placeholder="contact@entreprise.fr"
            />
          </div>
          <div className="form-group">
            <label>Téléphone</label>
            <input
              value={form.contact?.tel || ''}
              onChange={e => set('contact.tel', e.target.value)}
              placeholder="01 23 45 67 89"
            />
          </div>
        </div>
        <div className="form-grid cols1">
          <div className={`form-group${autoFilled.has('adresse') ? ' field-ia-filled' : ''}`}>
            <label>
              Adresse
              {autoFilled.has('adresse') && <span className="ia-tag">IA</span>}
            </label>
            <textarea
              value={form.adresse}
              onChange={e => set('adresse', e.target.value)}
              placeholder="Rue, Code postal, Ville"
            />
          </div>
        </div>
      </div>

      {/* Section RIB */}
      <div className="form-section">
        <div className="form-section-title">RIB / Coordonnées bancaires</div>
        <div className="form-grid">
          <div className={`form-group${autoFilled.has('iban') ? ' field-ia-filled' : ''}`}>
            <label>
              IBAN
              {autoFilled.has('iban') && <span className="ia-tag">IA</span>}
            </label>
            <input
              value={form.rib?.iban || ''}
              onChange={e => set('rib.iban', e.target.value)}
              placeholder="FR76 0000 0000 0000 0000 0000 000"
              style={{ fontFamily: 'var(--mono)', fontSize: 12 }}
            />
          </div>
          <div className={`form-group${autoFilled.has('bic') ? ' field-ia-filled' : ''}`}>
            <label>
              BIC
              {autoFilled.has('bic') && <span className="ia-tag">IA</span>}
            </label>
            <input
              value={form.rib?.bic || ''}
              onChange={e => set('rib.bic', e.target.value)}
              placeholder="BNPAFRPP"
              style={{ fontFamily: 'var(--mono)', fontSize: 12 }}
            />
          </div>
        </div>
      </div>

      {/* Section Documents liés */}
      <div className="form-section">
        <div className="form-section-title">Documents liés</div>
        <DocList documents={form.documents} />
      </div>

      {/* Pied de page */}
      <div style={{ display: 'flex', gap: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
          style={{ minWidth: 120 }}
        >
          {saving ? '⏳ Enregistrement…' : saved ? '✓ Enregistré !' : '💾 Enregistrer'}
        </button>
        {!isNew && (
          <button className="btn btn-secondary" onClick={onCancel}>
            Annuler
          </button>
        )}
      </div>
    </div>
  )
}

// ── Page CRM ─────────────────────────────────────────────
export default function CRM() {
  const [suppliers, setSuppliers] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    getSuppliers().then(data => {
      setSuppliers(data)
      if (data.length > 0) setSelectedId(data[0].id)
      setLoading(false)
    })
  }, [])

  // Sélection via param URL (depuis Upload)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sid = params.get('supplierId')
    if (sid) setSelectedId(sid)
  }, [])

  const selected = suppliers.find(s => s.id === selectedId)

  const filtered = suppliers.filter(s =>
    !search ||
    s.raisonSociale.toLowerCase().includes(search.toLowerCase()) ||
    s.siret.includes(search)
  )

  function addNew() {
    const newSup = {
      ...EMPTY_SUPPLIER,
      id: `sup-new-${Date.now()}`,
    }
    setSuppliers(prev => [newSup, ...prev])
    setSelectedId(newSup.id)
  }

  function handleSave(updated) {
    setSuppliers(prev => {
      const exists = prev.find(s => s.id === updated.id)
      if (exists) return prev.map(s => s.id === updated.id ? updated : s)
      return [updated, ...prev]
    })
    setSelectedId(updated.id)
  }

  return (
    <>
      <div className="page-header">
        <h1>CRM Fournisseurs</h1>
        <p>Gérer les fournisseurs et leurs documents — auto-remplissage par IA</p>
      </div>

      <div className="page-content">
        {loading ? (
          <div className="empty-state">
            <span className="empty-icon">⏳</span>
            <span>Chargement…</span>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '340px 1fr',
            gap: 20,
            alignItems: 'start',
          }}>
            {/* ── Colonne gauche : liste fournisseurs ── */}
            <div>
              {/* Barre de recherche + bouton nouveau */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher…"
                  style={{
                    flex: 1, padding: '7px 10px',
                    border: '1px solid var(--border)',
                    borderRadius: 7, fontSize: 13,
                    background: 'var(--bg)', color: 'var(--text-h)',
                    outline: 'none', fontFamily: 'var(--sans)',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--accent-border)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
                <button className="btn btn-primary btn-sm" onClick={addNew}>
                  + Nouveau
                </button>
              </div>

              {/* Tableau fournisseurs */}
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Fournisseur</th>
                      <th>Statut</th>
                      <th style={{ textAlign: 'center' }}>Docs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text)', padding: 24 }}>
                          Aucun résultat
                        </td>
                      </tr>
                    ) : filtered.map(s => (
                      <tr
                        key={s.id}
                        className={s.id === selectedId ? 'row-active' : ''}
                        onClick={() => setSelectedId(s.id)}
                      >
                        <td>
                          <div style={{ fontWeight: 500, color: 'var(--text-h)', fontSize: 13, lineHeight: 1.3 }}>
                            {s.raisonSociale || <em style={{ color: 'var(--text)' }}>Sans nom</em>}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text)', marginTop: 2 }}>
                            {s.siret ? formatSiret(s.siret) : '—'}
                          </div>
                        </td>
                        <td><StatusChip status={s.status} /></td>
                        <td style={{ textAlign: 'center', fontSize: 13, color: 'var(--text)' }}>
                          {s.documents?.length || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Légende statuts */}
              <div style={{
                marginTop: 12, padding: '10px 12px',
                background: 'var(--code-bg)',
                borderRadius: 8, fontSize: 12,
              }}>
                <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Légende
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="status-dot green" />
                    <span style={{ color: 'var(--text)' }}>Complet — tous les documents sont valides</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="status-dot orange" />
                    <span style={{ color: 'var(--text)' }}>Incomplet — documents manquants</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="status-dot red" />
                    <span style={{ color: 'var(--text)' }}>Alerte — incohérence ou document expiré</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Colonne droite : formulaire ── */}
            <div>
              {selected ? (
                <SupplierForm
                  key={selected.id}
                  supplier={selected}
                  onSave={handleSave}
                  onCancel={() => {}}
                />
              ) : (
                <div className="empty-state" style={{
                  border: '1px solid var(--border)',
                  borderRadius: 12, minHeight: 300,
                }}>
                  <span className="empty-icon">👈</span>
                  <span>Sélectionnez un fournisseur</span>
                  <span style={{ fontSize: 12 }}>ou créez-en un nouveau</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
