import { useState, useEffect } from 'react'
import { getSuppliers } from '../api/client'
import { EMPTY_SUPPLIER } from '../mock/data'
import { formatSiret } from '../utils/formatters'
import StatusChip from '../components/StatusChip'
import SupplierForm from '../components/SupplierForm'

export default function CRM() {
  const [suppliers, setSuppliers] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    getSuppliers().then((data) => {
      setSuppliers(data)
      if (data.length > 0) setSelectedId(data[0].id)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sid = params.get('supplierId')
    if (sid) setSelectedId(sid)
  }, [])

  const selected = suppliers.find((s) => s.id === selectedId)

  const filtered = suppliers.filter(
    (s) =>
      !search ||
      s.raisonSociale.toLowerCase().includes(search.toLowerCase()) ||
      s.siret.includes(search)
  )

  function addNew() {
    const newSup = { ...EMPTY_SUPPLIER, id: `sup-new-${Date.now()}` }
    setSuppliers((prev) => [newSup, ...prev])
    setSelectedId(newSup.id)
  }

  function handleSave(updated) {
    setSuppliers((prev) => {
      const exists = prev.find((s) => s.id === updated.id)
      if (exists) return prev.map((s) => (s.id === updated.id ? updated : s))
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
          <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, alignItems: 'start' }}>

            {/* ── Liste fournisseurs ── */}
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher…"
                  style={{
                    flex: 1, padding: '7px 10px',
                    border: '1px solid var(--border)', borderRadius: 6,
                    fontSize: 13, background: 'var(--bg)', color: 'var(--text-h)',
                    outline: 'none', fontFamily: 'var(--sans)',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
                />
                <button className="btn btn-primary btn-sm" onClick={addNew}>
                  + Nouveau
                </button>
              </div>

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
                    ) : (
                      filtered.map((s) => (
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
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Légende */}
              <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: 8, fontSize: 12, border: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Légende
                </div>
                {[
                  { color: 'green', label: 'Complet — tous les documents sont valides' },
                  { color: 'orange', label: 'Incomplet — documents manquants' },
                  { color: 'red', label: 'Alerte — incohérence ou document expiré' },
                ].map(({ color, label }) => (
                  <div key={color} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span className={`status-dot ${color}`} />
                    <span style={{ color: 'var(--text)' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Formulaire ── */}
            <div>
              {selected ? (
                <SupplierForm
                  key={selected.id}
                  supplier={selected}
                  onSave={handleSave}
                  onCancel={() => {}}
                />
              ) : (
                <div className="empty-state" style={{ border: '1px solid var(--border)', borderRadius: 8, minHeight: 300 }}>
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
