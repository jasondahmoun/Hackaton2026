import { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { uploadDocument, runOCR, extractFields, classifyDocument } from '../api/client'

// ── Helpers ──────────────────────────────────────────────
const STEPS = ['Chargement', 'OCR', 'Extraction', 'Classification', 'Terminé']
const STEP_KEYS = ['uploading', 'ocr', 'extracting', 'classifying', 'done']

function stepIndex(status) {
  const i = STEP_KEYS.indexOf(status)
  return i === -1 ? -1 : i
}

function getBadgeClass(type) {
  const map = {
    facture: 'badge-facture', devis: 'badge-devis', kbis: 'badge-kbis',
    urssaf: 'badge-urssaf', rib: 'badge-rib',
    'attestation SIRET': 'badge-siret', 'attestation siret': 'badge-siret',
  }
  return map[type?.toLowerCase()] || 'badge-default'
}

function formatSiret(s) {
  if (!s) return s
  const clean = s.replace(/\s/g, '')
  if (clean.length === 14) return `${clean.slice(0,3)} ${clean.slice(3,6)} ${clean.slice(6,9)} ${clean.slice(9)}`
  return clean
}

// ── Détection anomalies inter-documents ─────────────────
function detectAnomalies(files) {
  const done = files.filter(f => f.status === 'done' && f.fields)
  const alerts = []

  // SIRET mismatch
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

  // Documents expirés
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

// ── Composant ProgressSteps ──────────────────────────────
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

// ── Composant ExtractedFields ────────────────────────────
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

// ── Composant FileCard ───────────────────────────────────
function FileCard({ file, onSendToCRM }) {
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
      {/* Header */}
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
            {file.status === 'error' && 'Erreur de traitement'}
          </div>
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 14 }}
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {/* Pipeline steps */}
      {file.status !== 'waiting' && (
        <ProgressSteps status={file.status} />
      )}

      {/* Expanded: champs + actions */}
      {expanded && file.status === 'done' && (
        <>
          <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />
          <ExtractedFields fields={file.fields} />

          {/* Anomalies du fichier */}
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

          {/* Boutons d'action */}
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

// ── Page Upload ──────────────────────────────────────────
export default function Upload() {
  const [files, setFiles] = useState([])
  const [alerts, setAlerts] = useState([])
  const navigate = useNavigate()
  const processingRef = useRef(new Set())

  // Met à jour un fichier dans la liste
  const updateFile = useCallback((id, patch) => {
    setFiles(prev => {
      const next = prev.map(f => f.id === id ? { ...f, ...patch } : f)
      // Recalcul des alertes inter-docs
      setAlerts(detectAnomalies(next))
      return next
    })
  }, [])

  // Pipeline de traitement
  async function runPipeline(fileEntry) {
    const { id, file } = fileEntry
    if (processingRef.current.has(id)) return
    processingRef.current.add(id)

    try {
      // 1. Upload
      updateFile(id, { status: 'uploading' })
      const uploaded = await uploadDocument(file)

      // 2. OCR
      updateFile(id, { status: 'ocr' })
      await runOCR(file)

      // 3. Extraction
      updateFile(id, { status: 'extracting' })
      const extracted = await extractFields(uploaded.id, file.name)

      // 4. Classification
      updateFile(id, { status: 'classifying' })
      const classified = await classifyDocument(uploaded.id, file.name)

      // 5. Done
      updateFile(id, {
        status: 'done',
        type: classified.type || extracted.type,
        fields: extracted.fields,
        anomalies: extracted.anomalies || [],
        docId: uploaded.id,
      })
    } catch (err) {
      console.error(err)
      updateFile(id, { status: 'error' })
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
    }))
    setFiles(prev => [...prev, ...newEntries])
    // Lance le pipeline pour chaque fichier
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
    // Stocke les données dans sessionStorage pour le CRM
    const existing = JSON.parse(sessionStorage.getItem('pendingCRM') || '[]')
    existing.push({
      docId: file.docId,
      filename: file.name,
      type: file.type,
      fields: file.fields,
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

        {/* Alertes inter-documents */}
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

        {/* Zone de dépôt */}
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

        {/* Compteur */}
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

        {/* Liste des fichiers */}
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
          />
        ))}

        {/* Types de documents supportés */}
        {files.length === 0 && (
          <div style={{
            marginTop: 32,
            padding: '20px 24px',
            border: '1px solid var(--border)',
            borderRadius: 12,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.6px', color: 'var(--text)', marginBottom: 14,
            }}>
              Documents supportés
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {['Facture', 'Devis', 'Kbis', 'Attestation URSSAF', 'Attestation SIRET', 'RIB'].map(t => (
                <span key={t} className={`badge badge-${t.split(' ')[0].toLowerCase()}`}>
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
