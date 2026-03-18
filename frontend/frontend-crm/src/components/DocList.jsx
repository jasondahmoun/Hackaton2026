import { useState } from 'react'
import { getBadgeClass } from '../utils/formatters'
import Lightbox from './Lightbox'

export default function DocList({ documents }) {
  const [lightboxUrl, setLightboxUrl] = useState(null)

  if (!documents?.length)
    return (
      <div style={{ fontSize: 12, color: 'var(--text)', padding: '8px 0' }}>
        Aucun document lié
      </div>
    )

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {documents.map((doc) => (
          <div
            key={doc.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 10px',
              border: '1px solid var(--border)',
              borderRadius: 7,
              fontSize: 12,
              background: 'var(--bg-subtle)',
            }}
          >
            {doc.previewUrl ? (
              <img
                src={doc.previewUrl}
                alt={doc.filename}
                onClick={() => setLightboxUrl(doc.previewUrl)}
                style={{
                  width: 36, height: 36, objectFit: 'cover',
                  borderRadius: 4, border: '1px solid var(--border)',
                  cursor: 'zoom-in', flexShrink: 0,
                }}
              />
            ) : (
              <span style={{ fontSize: 18, flexShrink: 0 }}>
                {doc.filename?.endsWith('.pdf') ? '📄' : '🖼'}
              </span>
            )}
            <span style={{ flex: 1, color: 'var(--text-h)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {doc.filename}
            </span>
            <span className={`badge ${getBadgeClass(doc.type)}`}>{doc.type}</span>
            <span style={{ fontSize: 14 }}>
              {doc.status === 'done' ? '' : doc.status === 'error' ? '' : ''}
            </span>
          </div>
        ))}
      </div>

      <Lightbox src={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </>
  )
}
