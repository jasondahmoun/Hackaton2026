export function formatSiret(s) {
  if (!s) return ''
  const clean = s.replace(/\s/g, '')
  if (clean.length === 14)
    return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6, 9)} ${clean.slice(9)}`
  return clean
}

export function getBadgeClass(type) {
  const map = {
    facture: 'badge-facture',
    devis: 'badge-devis',
    kbis: 'badge-kbis',
    urssaf: 'badge-urssaf',
    rib: 'badge-rib',
    'attestation siret': 'badge-siret',
  }
  return map[type?.toLowerCase()] || 'badge-default'
}
