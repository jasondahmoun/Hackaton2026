import { useState, useEffect } from 'react'
import { getOcrResults } from '../api/client'

const API = 'http://localhost:8000'

function OcrDetail({ doc }) {
  const text  = doc.extracted_text || ''
  const lines = text.split('\n').filter(l => l.trim())
  const imgUrl = doc.document_id ? `${API}/documents/${doc.document_id}/file` : null
  const [imgError, setImgError] = useState(false)
  const [lightbox, setLightbox] = useState(false)

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 8,
      padding: '20px 22px', background: 'var(--bg)',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--text)', fontFamily: 'var(--mono)', marginBottom: 4 }}>
          {doc._id}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 11, color: 'var(--text)' }}>
          {doc.language && <span>Langue : {doc.language.toUpperCase()}</span>}
          {doc.created_at && <span>{new Date(doc.created_at).toLocaleString('fr-FR')}</span>}
        </div>
      </div>

      {/* Layout image + texte */}
      <div style={{ display: 'grid', gridTemplateColumns: imgUrl && !imgError ? '1fr 1fr' : '1fr', gap: 16 }}>

        {/* Image du document */}
        {imgUrl && !imgError && (
          <div>
            <div style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.6px', color: 'var(--text)',
              borderBottom: '1px solid var(--border)', paddingBottom: 6, marginBottom: 10,
            }}>
              Document original
            </div>
            <img
              src={imgUrl}
              alt="Document original"
              onClick={() => setLightbox(true)}
              onError={() => setImgError(true)}
              style={{
                width: '100%', borderRadius: 7,
                border: '1px solid var(--border)',
                cursor: 'zoom-in', objectFit: 'contain',
                maxHeight: 420,
              }}
            />
          </div>
        )}

        {/* Texte OCR */}
        <div>
          <div style={{
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.6px', color: 'var(--text)',
            borderBottom: '1px solid var(--border)', paddingBottom: 6, marginBottom: 10,
          }}>
            Texte extrait ({lines.length} lignes)
          </div>
          {text ? (
            <pre style={{
              fontSize: 12, color: 'var(--text-h)', background: 'var(--bg-subtle)',
              border: '1px solid var(--border)', borderRadius: 7,
              padding: '12px 14px', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              maxHeight: 420, overflow: 'auto', fontFamily: 'var(--mono)',
              lineHeight: 1.6, margin: 0,
            }}>
              {text}
            </pre>
          ) : (
            <div style={{ color: 'var(--text)', fontSize: 13 }}>Aucun texte extrait</div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out',
          }}
        >
          <img
            src={imgUrl}
            alt="Document"
            style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, objectFit: 'contain' }}
          />
        </div>
      )}
    </div>
  )
}

export default function CRM() {
  const [results,    setResults]    = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [search,     setSearch]     = useState('')

  useEffect(() => {
    getOcrResults()
      .then(data => {
        setResults(data)
        if (data.length > 0) setSelectedId(data[0]._id)
      })
      .catch(err => setError(err?.message || 'Erreur de chargement'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = results.filter(r => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      r._id?.toLowerCase().includes(s) ||
      r.document_id?.toLowerCase().includes(s) ||
      r.extracted_text?.toLowerCase().includes(s)
    )
  })

  const selected = results.find(r => r._id === selectedId)

  return (
    <>
      <div className="page-header">
        <h1>OCR Results</h1>
        <p>Documents traités — texte extrait et image d'origine</p>
      </div>

      <div className="page-content">
        {loading ? (
          <div className="empty-state">
            <span className="empty-icon">⏳</span>
            <span>Chargement…</span>
          </div>
        ) : error ? (
          <div className="alert-banner red">
            <span className="alert-icon"></span>
            <span className="alert-text"><strong>Erreur</strong>{error}</span>
          </div>
        ) : results.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon"></span>
            <span>Aucun résultat OCR en base</span>
            <span style={{ fontSize: 12 }}>Uploadez des documents pour les voir apparaître ici</span>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, alignItems: 'start' }}>

            {/* Liste */}
            <div>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher…"
                style={{
                  width: '100%', padding: '7px 10px', boxSizing: 'border-box',
                  border: '1px solid var(--border)', borderRadius: 6, marginBottom: 10,
                  fontSize: 13, background: 'var(--bg)', color: 'var(--text-h)',
                  outline: 'none', fontFamily: 'var(--sans)',
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={e  => (e.target.style.borderColor = 'var(--border)')}
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {filtered.map(r => {
                  const isSelected = r._id === selectedId
                  const preview = (r.extracted_text || '').slice(0, 100).replace(/\n/g, ' ')
                  return (
                    <div
                      key={r._id}
                      onClick={() => setSelectedId(r._id)}
                      style={{
                        padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                        border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                        background: isSelected ? 'var(--accent-bg)' : 'var(--bg)',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{
                        fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-h)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        marginBottom: 4,
                      }}>
                        {r._id}
                      </div>
                      {preview && (
                        <div style={{
                          fontSize: 11, color: 'var(--text)', lineHeight: 1.4,
                          overflow: 'hidden', display: '-webkit-box',
                          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        }}>
                          {preview}…
                        </div>
                      )}
                      {r.created_at && (
                        <div style={{ fontSize: 10, color: 'var(--text)', marginTop: 4, opacity: 0.7 }}>
                          {new Date(r.created_at).toLocaleDateString('fr-FR')}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text)', textAlign: 'center' }}>
                {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
              </div>
            </div>

            {/* Détail */}
            <div>
              {selected ? (
                <OcrDetail doc={selected} />
              ) : (
                <div className="empty-state" style={{ border: '1px solid var(--border)', borderRadius: 8, minHeight: 300 }}>
                  <span className="empty-icon"></span>
                  <span>Sélectionnez un résultat</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
