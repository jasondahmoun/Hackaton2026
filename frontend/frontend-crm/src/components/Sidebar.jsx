import { NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { healthCheck } from '../api/client'

const NAV = [
  { to: '/', icon: '↑', label: 'Upload', end: true },
  { to: '/crm', icon: '◫', label: 'CRM Fournisseurs', end: false },
]

export default function Sidebar() {
  const [health, setHealth] = useState(null)

  useEffect(() => {
    let alive = true
    async function check() {
      const res = await healthCheck()
      if (alive) setHealth(res?.status === 'ok' || res?.status === 'healthy')
    }
    check()
    const id = setInterval(check, 30000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  return (
    <aside style={{
      width: 'var(--sidebar-width)',
      minWidth: 'var(--sidebar-width)',
      background: 'var(--bg)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      position: 'sticky',
      top: 0,
      height: '100svh',
    }}>

      {/* Logo */}
      <div style={{
        padding: '24px 20px 20px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 28, height: 28,
            background: 'var(--accent)',
            borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 700, lineHeight: 1 }}>D</span>
          </div>
          <span style={{
            fontWeight: 700,
            fontSize: 15,
            color: 'var(--text-h)',
            letterSpacing: '-0.3px',
          }}>
            DocPro
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '12px 10px', flex: 1 }}>
        <div style={{
          fontSize: 10,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.8px',
          color: 'var(--text)',
          padding: '4px 10px 8px',
          opacity: 0.6,
        }}>
          Applications
        </div>

        {NAV.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 10px',
              borderRadius: 6,
              textDecoration: 'none',
              marginBottom: 2,
              background: isActive ? 'var(--accent-bg)' : 'transparent',
              borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              transition: 'background 0.12s',
            })}
          >
            {({ isActive }) => (
              <>
                <span style={{
                  fontSize: 15,
                  color: isActive ? 'var(--accent)' : 'var(--text)',
                  lineHeight: 1,
                  width: 18,
                  textAlign: 'center',
                  flexShrink: 0,
                }}>
                  {item.icon}
                </span>
                <span style={{
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--accent-dark)' : 'var(--text-h)',
                }}>
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer health */}
      <div style={{
        padding: '14px 16px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 7,
      }}>
        <div style={{
          width: 7, height: 7,
          borderRadius: '50%',
          flexShrink: 0,
          background: health === null
            ? '#d1d5db'
            : health
              ? 'var(--status-green)'
              : 'var(--status-red)',
        }} />
      </div>
    </aside>
  )
}
