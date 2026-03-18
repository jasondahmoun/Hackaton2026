import { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { uploadDocument, runOCR, extractFields, classifyDocument } from '../api/client'
import { getBadgeClass, formatSiret } from '../utils/formatters'
import Lightbox from '../components/Lightbox'

// ── Helpers ──────────────────────────────────────────────
const STEPS = ['Chargement', 'OCR', 'Extraction', 'Classification', 'Terminé']
const STEP_KEYS = ['uploading', 'ocr', 'extracting', 'classifying', 'done']

function stepIndex(status) {
  const i = STEP_KEYS.indexOf(status)
  return i === -1 ? -1 : i
}


function detectAnomalies(files) {
  const done = files.filter(f => f.status === 'done' && f.fields)
  const alerts = []

  const sirets = done
    .filter(f => f.fields.siret)
    .map(f => ({ name: f.name, siret: f.fields.siret.replace(/\s/g, '') }))

  if (sirets.length >= 2) {
    const unique = [...new Set(sirets.map(s => s.siret))]
    if (unique.length > 1) {
      alerts.push({
        id: 'siret-mismatch',
        severity: 'red',
        title: 'Incohérence SIRET',
        message: `Les documents ont des SIRET différents : ${unique.join(' ≠ ')}`,
      })
    }
  }

  done.forEach(f => {
    if (f.fields.dateEcheance) {
      const [d, m, y] = f.fields.dateEcheance.split('/')
      const date = new Date(y, m - 1, d)
      if (date < new Date()) {
        alerts.push({
          id: `expired-${f.id}`,
          severity: 'red',
          title: `Document expiré`,
          message: `${f.name} (${f.type}) — échéance dépassée le ${f.fields.dateEcheance}`,
        })
      }
    }
    if (f.anomalies?.length) {
      f.anomalies.forEach(a => {
        alerts.push({
          id: `${f.id}-${a.type}`,
          severity: a.severity,
          title: a.message,
          message: `Dans le fichier "${f.name}"`,
        })
      })
    }
  })
  return alerts
}

function ProgressSteps({ status }) {
  const current = stepIndex(status)
  const isError = status === 'error'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, margin: '12px 0 4px' }}>
      {STEPS.map((label, i) => {
        const done = current > i
        const active = current === i

        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'initial' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 60 }}>
              <div style={{
                width: 22, height: 22,
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700,
                background: isError && active
                  ? 'var(--status-red)'
                  : done
                    ? 'var(--status-green)'
                    : active
                      ? 'var(--accent)'
                      : 'var(--border)',
                color: done || active ? '#fff' : 'var(--text)',
                transition: 'background 0.3s',
                flexShrink: 0,
              }}>
                {done ? '✓' : isError && active ? '✕' : i + 1}
              </div>
              <span style={{
                fontSize: 10,
                color: done ? 'var(--status-green)' : active ? 'var(--accent)' : 'var(--text)',
                fontWeight: active || done ? 600 : 400,
                whiteSpace: 'nowrap',
              }}>
                {active && !done ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                    <Spinner /> {label}
                  </span>
                ) : label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{
                flex: 1, height: 2, margin: '0 2px',
                background: done ? 'var(--status-green)' : 'var(--border)',
                marginBottom: 16,
                transition: 'background 0.4s',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block',
      width: 8, height: 8,
      border: '2px solid var(--accent-border)',
      borderTopColor: 'var(--accent)',
      borderRadius: '50%',
      animation: 'spin 0.6s linear infinite',
    }} />
  )
}

function ExtractedFields({ fields }) {
  if (!fields) return null
  const labels = {
    siret: 'SIRET', tva: 'N° TVA', montantHT: 'Montant HT',
    montantTTC: 'Montant TTC', dateEmission: "Date d'émission",
    dateEcheance: "Date d'échéance", raisonSociale: 'Raison sociale',
    adresse: 'Adresse', iban: 'IBAN', bic: 'BIC',
  }
  const entries = Object.entries(fields).filter(([, v]) => v)

  if (!entries.length) return (
    <p style={{ color: 'var(--text)', fontSize: 12, margin: '8px 0 0' }}>
      Aucun champ extrait
    </p>
  )

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr',
      gap: '6px 16px', marginTop: 12,
    }}>
      {entries.map(([key, val]) => (
        <div key={key}>
          <div style={{ fontSize: 10, color: 'var(--text)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            {labels[key] || key}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-h)', fontWeight: 500, marginTop: 1 }}>
            {key === 'siret' ? formatSiret(val) : val}
          </div>
        </div>
      ))}
    </div>
  )
}

function FileCard({ file, onSendToCRM, onOpenImage }) {
  const [expanded, setExpanded] = useState(true)

  const statusColors = {
    waiting: 'var(--text)',
    uploading: 'var(--accent)',
    ocr: 'var(--accent)',
    extracting: 'var(--accent)',
    classifying: 'var(--accent)',
    done: 'var(--status-green)',
    error: 'var(--status-red)',
  }

  return (
    <div style={{
      border: `1px solid ${file.status === 'error' ? 'var(--status-red)' : file.status === 'done' ? 'var(--border)' : 'var(--accent-border)'}`,
      borderRadius: 8,
      padding: '16px 18px',
      background: file.status === 'error' ? 'var(--status-red-bg)' : 'var(--bg)',
      transition: 'border-color 0.3s',
      marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 20 }}>
          {file.name.endsWith('.pdf') ? '📄' : '🖼'}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 13, fontWeight: 600, color: 'var(--text-h)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {file.name}
            </span>
            {file.type && (
              <span className={`badge ${getBadgeClass(file.type)}`}>
                {file.type}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: statusColors[file.status], marginTop: 2, fontWeight: 500 }}>
            {file.status === 'waiting' && 'En attente…'}
            {file.status === 'uploading' && 'Chargement du fichier…'}
            {file.status === 'ocr' && 'Extraction du texte (OCR)…'}
            {file.status === 'extracting' && 'Analyse des entités…'}
            {file.status === 'classifying' && 'Classification du document…'}
            {file.status === 'done' && `Traitement terminé${file.fields ? ' · Champs extraits' : ''}`}
            {file.status === 'error' && (file.errorMessage || 'Erreur de traitement')}
          </div>
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 14 }}
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {file.status !== 'waiting' && (
        <ProgressSteps status={file.status} />
      )}

      {expanded && file.status === 'done' && (
        <>
          <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />

          {file.previewUrl && (
            <div style={{ marginBottom: 12 }}>
              <img
                src={file.previewUrl}
                alt={file.name}
                onClick={() => onOpenImage(file.previewUrl)}
                style={{
                  maxWidth: '100%', maxHeight: 220,
                  borderRadius: 6, border: '1px solid var(--border)',
                  objectFit: 'contain', display: 'block',
                  cursor: 'zoom-in',
                }}
              />
            </div>
          )}

          <ExtractedFields fields={file.fields} />

          {file.anomalies?.length > 0 && (
            <div style={{ marginTop: 10 }}>
              {file.anomalies.map((a, i) => (
                <div key={i} className={`alert-banner ${a.severity}`}>
                  <span className="alert-icon">⚠</span>
                  <span className="alert-text">
                    <strong>{a.message}</strong>
                  </span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button className="btn btn-primary btn-sm" onClick={() => onSendToCRM(file)}>
              Envoyer au CRM
            </button>
            <button className="btn btn-orange btn-sm">
              Conformité
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── DEBUG PANEL (temporaire) ──────────────────────────────
function DebugPanel({ files }) {
  const [open, setOpen] = useState(false)
  const done = files.filter(f => f.status === 'done' || f.status === 'error')
  if (!done.length) return null

  return (
    <div style={{
      position: 'fixed', bottom: 16, right: 16, zIndex: 9999,
      width: open ? 480 : 'auto',
      background: '#0f172a', color: '#e2e8f0',
      borderRadius: 10, boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
      fontFamily: 'monospace', fontSize: 12,
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '8px 14px',
          background: '#1e293b', border: 'none', cursor: 'pointer',
          color: '#94a3b8', fontSize: 12, textAlign: 'left',
          display: 'flex', alignItems: 'center', gap: 8,
        }}
      >
        <span style={{ color: '#22d3ee' }}>◉</span>
        DEBUG — {done.length} doc{done.length > 1 ? 's' : ''} traité{done.length > 1 ? 's' : ''}
        <span style={{ marginLeft: 'auto' }}>{open ? '▼' : '▲'}</span>
      </button>

      {open && (
        <div style={{ maxHeight: 420, overflowY: 'auto', padding: '12px 14px' }}>
          {done.map(f => (
            <div key={f.id} style={{ marginBottom: 20, borderBottom: '1px solid #334155', paddingBottom: 12 }}>
              <div style={{ color: '#f472b6', fontWeight: 700, marginBottom: 6 }}>
                📄 {f.name}
              </div>

              {f.status === 'error' ? (
                <div style={{ color: '#f87171' }}>❌ {f.errorMessage}</div>
              ) : (
                <>
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ color: '#94a3b8' }}>type : </span>
                    <span style={{ color: '#34d399' }}>{f.type || '—'}</span>
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ color: '#94a3b8' }}>docId : </span>
                    <span style={{ color: '#fbbf24' }}>{f.docId || '—'}</span>
                  </div>
                  <div style={{ color: '#94a3b8', marginBottom: 4 }}>champs :</div>
                  {f.fields && Object.keys(f.fields).length > 0
                    ? Object.entries(f.fields).map(([k, v]) => (
                        <div key={k} style={{ paddingLeft: 12 }}>
                          <span style={{ color: (k === 'montantHT' || k === 'montantTTC') ? '#fbbf24' : '#7dd3fc' }}>{k}</span>
                          <span style={{ color: '#64748b' }}> : </span>
                          <span style={{ color: (k === 'montantHT' || k === 'montantTTC') ? '#fbbf24' : '#e2e8f0', fontWeight: (k === 'montantHT' || k === 'montantTTC') ? 700 : 400 }}>{v}</span>
                        </div>
                      ))
                    : <div style={{ paddingLeft: 12, color: '#64748b' }}>aucun champ extrait</div>
                  }
                  {f.anomalies?.length > 0 && (
                    <div style={{ marginTop: 6, color: '#fb923c' }}>
                      ⚠ anomalies : {f.anomalies.map(a => a.message).join(', ')}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Upload() {
  const [files, setFiles] = useState([])
  const [alerts, setAlerts] = useState([])
  const [lightboxUrl, setLightboxUrl] = useState(null)
  const navigate = useNavigate()
  const processingRef = useRef(new Set())

  const updateFile = useCallback((id, patch) => {
    setFiles(prev => {
      const next = prev.map(f => f.id === id ? { ...f, ...patch } : f)
      setAlerts(detectAnomalies(next))
      return next
    })
  }, [])

  async function runPipeline(fileEntry) {
    const { id, file } = fileEntry
    if (processingRef.current.has(id)) return
    processingRef.current.add(id)

    try {
      updateFile(id, { status: 'uploading' })
      await uploadDocument(file)
      console.log(`[Upload] Fichier accepté : ${file.name} (${file.type}, ${(file.size / 1024).toFixed(1)} Ko)`)

      updateFile(id, { status: 'ocr' })
      const ocrResult = await runOCR(file)
      console.log(`[OCR] Résultat brut pour "${file.name}" :`, ocrResult)
      console.log(`[OCR] Texte extrait :\n${ocrResult?.text}`)

      updateFile(id, { status: 'extracting' })
      const extracted = await extractFields(ocrResult, file.name)
      console.log(`[Extraction]  Champs extraits pour "${file.name}" :`, extracted.fields)
      console.log(`[Extraction]  Type détecté : ${extracted.type}`)
      console.log(`[Extraction] ⚠ Anomalies :`, extracted.anomalies)

      updateFile(id, { status: 'classifying' })
      const classified = await classifyDocument(ocrResult, file.name)
      console.log(`[Classification]  Type final : ${classified.type}`)

      updateFile(id, {
        status: 'done',
        type: classified.type || extracted.type,
        fields: extracted.fields,
        anomalies: extracted.anomalies || [],
        docId: ocrResult?.id || id,
        backendFileUrl: ocrResult?.file_url || null,
      })
    } catch (err) {
      const message = err?.response?.data?.detail || err?.message || 'Erreur inconnue'
      updateFile(id, { status: 'error', errorMessage: message })
    } finally {
      processingRef.current.delete(id)
    }
  }

  const onDrop = useCallback((acceptedFiles) => {
    const newEntries = acceptedFiles.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      name: file.name,
      status: 'waiting',
      type: null,
      fields: null,
      anomalies: [],
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
    }))
    setFiles(prev => [...prev, ...newEntries])
    newEntries.forEach(entry => runPipeline(entry))
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': [],
      'image/png': [],
      'application/pdf': [],
    },
    multiple: true,
  })

  function handleSendToCRM(file) {
    const existing = JSON.parse(sessionStorage.getItem('pendingCRM') || '[]')
    existing.push({
      docId: file.docId,
      filename: file.name,
      type: file.type,
      fields: file.fields,
      previewUrl: file.previewUrl || null,
    })
    sessionStorage.setItem('pendingCRM', JSON.stringify(existing))
    navigate('/crm')
  }

  function dismissAlert(id) {
    setAlerts(prev => prev.filter(a => a.id !== id))
  }

  const doneCount = files.filter(f => f.status === 'done').length
  const processingCount = files.filter(f => !['waiting', 'done', 'error'].includes(f.status)).length

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="page-header">
        <h1>Upload de documents</h1>
        <p>Déposez vos pièces comptables — OCR, extraction et classification automatiques</p>
      </div>

      <div className="page-content">

        {alerts.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.6px', color: 'var(--text)', marginBottom: 8,
            }}>
              ⚠ Incohérences détectées ({alerts.length})
            </div>
            {alerts.map(a => (
              <div key={a.id} className={`alert-banner ${a.severity}`}>
                <span className="alert-icon">
                  {a.severity === 'red' ? '🔴' : '🟠'}
                </span>
                <span className="alert-text">
                  <strong>{a.title}</strong>
                  {a.message}
                </span>
                <button className="alert-dismiss" onClick={() => dismissAlert(a.id)}>×</button>
              </div>
            ))}
          </div>
        )}

        <div
          {...getRootProps()}
          style={{
            border: `2px dashed ${isDragActive ? 'var(--accent)' : 'var(--border-strong)'}`,
            borderRadius: 8,
            padding: '36px 32px',
            textAlign: 'center',
            cursor: 'pointer',
            background: isDragActive ? 'var(--accent-bg)' : 'var(--bg)',
            transition: 'all 0.18s',
            marginBottom: 24,
          }}
        >
          <input {...getInputProps()} />
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: 'var(--accent-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px', fontSize: 20,
          }}>
            {isDragActive ? '↓' : '↑'}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-h)', marginBottom: 4 }}>
            {isDragActive ? 'Relâchez pour déposer' : 'Glissez vos documents ici'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text)' }}>
            ou{' '}
            <span style={{ color: 'var(--accent)', fontWeight: 500, cursor: 'pointer' }}>
              parcourir les fichiers
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text)', marginTop: 8, opacity: 0.7 }}>
            PDF, JPG, PNG — multi-sélection possible
          </div>
        </div>

        {files.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16,
            marginBottom: 16, fontSize: 13, color: 'var(--text)',
          }}>
            <span>{files.length} fichier{files.length > 1 ? 's' : ''}</span>
            {processingCount > 0 && (
              <span style={{ color: 'var(--accent)', fontWeight: 500 }}>
                ⚙ {processingCount} en cours…
              </span>
            )}
            {doneCount > 0 && (
              <span style={{ color: 'var(--status-green)', fontWeight: 500 }}>
                ✓ {doneCount} terminé{doneCount > 1 ? 's' : ''}
              </span>
            )}
            {files.length > 0 && (
              <button
                className="btn-ghost"
                style={{ marginLeft: 'auto' }}
                onClick={() => { setFiles([]); setAlerts([]) }}
              >
                Tout effacer
              </button>
            )}
          </div>
        )}

        {files.length === 0 && (
          <div className="empty-state">
            <span className="empty-icon">🗂</span>
            <span>Aucun document déposé</span>
            <span style={{ fontSize: 12 }}>Glissez des fichiers dans la zone ci-dessus</span>
          </div>
        )}

        {files.map(f => (
          <FileCard
            key={f.id}
            file={f}
            onSendToCRM={handleSendToCRM}
            onOpenImage={setLightboxUrl}
          />
        ))}

      </div>

      <DebugPanel files={files} />
      <Lightbox src={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </>
  )
}
