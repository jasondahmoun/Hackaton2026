import { useState, useEffect } from 'react'
import { saveSupplier } from '../api/client'
import { MOCK_DOCUMENTS_EXTRACTED, mapDocToSupplier } from '../mock/data'
import { getBadgeClass } from '../utils/formatters'
import StatusChip from './StatusChip'
import DocList from './DocList'

export default function SupplierForm({ supplier, onSave, onCancel }) {
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

  useEffect(() => {
    const pending = JSON.parse(sessionStorage.getItem('pendingCRM') || '[]')
    if (pending.length > 0) {
      const doc = pending[pending.length - 1]
      handleAutoFill({ id: doc.docId, fields: doc.fields, type: doc.type, filename: doc.filename })
      setForm(prev => ({
        ...prev,
        documents: [
          ...(prev.documents || []),
          { id: doc.docId, type: doc.type, filename: doc.filename, status: 'done', previewUrl: doc.previewUrl || null },
        ],
      }))
      sessionStorage.removeItem('pendingCRM')
    }
  }, [supplier.id])

  function set(path, value) {
    setForm((prev) => {
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
    setAutoFilled((prev) => new Set([...prev, ...filled]))
    setShowAutoFillMenu(false)
  }

  async function handleSave() {
    setSaving(true)
    const result = await saveSupplier(form)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    onSave(result)
  }

  const isNew = !supplier.id

  const availableDocs = [
    ...Object.values(MOCK_DOCUMENTS_EXTRACTED).slice(0, 3),
    ...(form.documents || []).map((d) => ({
      id: d.id,
      type: d.type,
      filename: d.filename,
      fields: { siret: form.siret },
    })),
  ]

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '20px 22px',
      background: 'var(--bg)',
      boxSizing: 'border-box',
      overflowY: 'auto',
    }}>
      {/* Header */}
      <div className="flex-between" style={{ marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-h)' }}>
            {isNew ? '+ Nouveau fournisseur' : form.raisonSociale || 'Fournisseur'}
          </h2>
          {!isNew && <StatusChip status={form.status} />}
        </div>

        {/* Auto-fill dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowAutoFillMenu((m) => !m)}
          >
            ✨ Auto-remplir (IA)
          </button>
          {showAutoFillMenu && (
            <div style={{
              position: 'absolute', right: 0, top: '100%', marginTop: 4,
              background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 8, boxShadow: 'var(--shadow-md)',
              zIndex: 100, minWidth: 260, padding: 6,
            }}>
              <div style={{ fontSize: 11, color: 'var(--text)', padding: '4px 8px 6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Choisir un document source
              </div>
              {availableDocs.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => handleAutoFill(doc)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', padding: '7px 10px', border: 'none',
                    background: 'none', cursor: 'pointer', borderRadius: 6,
                    fontSize: 12, color: 'var(--text-h)', textAlign: 'left',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-bg)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
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

      {/* Banner auto-fill */}
      {autoFilled.size > 0 && (
        <div className="alert-banner orange" style={{ marginBottom: 16 }}>
          <span className="alert-icon">✨</span>
          <span className="alert-text">
            <strong>Remplissage automatique par IA</strong>
            {autoFilled.size} champ{autoFilled.size > 1 ? 's' : ''} complété{autoFilled.size > 1 ? 's' : ''} automatiquement. Vérifiez avant d'enregistrer.
          </span>
        </div>
      )}

      {/* Section Identité */}
      <div className="form-section">
        <div className="form-section-title">Identité</div>
        <div className="form-grid" style={{ marginBottom: 10 }}>
          <div className={`form-group${autoFilled.has('raisonSociale') ? ' field-ia-filled' : ''}`}>
            <label>Raison sociale {autoFilled.has('raisonSociale') && <span className="ia-tag">IA</span>}</label>
            <input value={form.raisonSociale} onChange={(e) => set('raisonSociale', e.target.value)} placeholder="Ex : Dupont & Associés SARL" />
          </div>
          <div className={`form-group${autoFilled.has('siret') ? ' field-ia-filled' : ''}`}>
            <label>SIRET {autoFilled.has('siret') && <span className="ia-tag">IA</span>}</label>
            <input
              value={form.siret}
              onChange={(e) => { set('siret', e.target.value); set('siren', e.target.value.replace(/\s/g, '').slice(0, 9)) }}
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
            <input value={form.contact?.nom || ''} onChange={(e) => set('contact.nom', e.target.value)} placeholder="Prénom Nom" />
          </div>
        </div>
        <div className="form-grid" style={{ marginBottom: 10 }}>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={form.contact?.email || ''} onChange={(e) => set('contact.email', e.target.value)} placeholder="contact@entreprise.fr" />
          </div>
          <div className="form-group">
            <label>Téléphone</label>
            <input value={form.contact?.tel || ''} onChange={(e) => set('contact.tel', e.target.value)} placeholder="01 23 45 67 89" />
          </div>
        </div>
        <div className="form-grid cols1">
          <div className={`form-group${autoFilled.has('adresse') ? ' field-ia-filled' : ''}`}>
            <label>Adresse {autoFilled.has('adresse') && <span className="ia-tag">IA</span>}</label>
            <textarea value={form.adresse} onChange={(e) => set('adresse', e.target.value)} placeholder="Rue, Code postal, Ville" />
          </div>
        </div>
      </div>

      {/* Section RIB */}
      <div className="form-section">
        <div className="form-section-title">RIB / Coordonnées bancaires</div>
        <div className="form-grid">
          <div className={`form-group${autoFilled.has('iban') ? ' field-ia-filled' : ''}`}>
            <label>IBAN {autoFilled.has('iban') && <span className="ia-tag">IA</span>}</label>
            <input value={form.rib?.iban || ''} onChange={(e) => set('rib.iban', e.target.value)} placeholder="FR76 0000 0000 0000 0000 0000 000" style={{ fontFamily: 'var(--mono)', fontSize: 12 }} />
          </div>
          <div className={`form-group${autoFilled.has('bic') ? ' field-ia-filled' : ''}`}>
            <label>BIC {autoFilled.has('bic') && <span className="ia-tag">IA</span>}</label>
            <input value={form.rib?.bic || ''} onChange={(e) => set('rib.bic', e.target.value)} placeholder="BNPAFRPP" style={{ fontFamily: 'var(--mono)', fontSize: 12 }} />
          </div>
        </div>
      </div>

      {/* Section Documents */}
      <div className="form-section">
        <div className="form-section-title">Documents liés</div>
        <DocList documents={form.documents} />
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', gap: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ minWidth: 120 }}>
          {saving ? 'Enregistrement…' : saved ? 'Enregistré !' : 'Enregistrer'}
        </button>
        {!isNew && (
          <button className="btn btn-secondary" onClick={onCancel}>Annuler</button>
        )}
      </div>
    </div>
  )
}
