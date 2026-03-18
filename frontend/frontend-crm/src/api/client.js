import axios from 'axios'
import { MOCK_SUPPLIERS } from '../mock/data'

const api = axios.create({
  baseURL: 'http://localhost:8000',
  timeout: 15000,
})

// ── Parseur de texte OCR → champs structurés ─────────────
function parseOCRText(text) {
  const fields = {}

  const siretMatch = text.match(/\b(\d{3}[\s]?\d{3}[\s]?\d{3}[\s]?\d{5})\b/)
  if (siretMatch) fields.siret = siretMatch[1].replace(/\s/g, '')

  const tvaMatch = text.match(/FR\s*\d{2}\s*\d{9}/i)
  if (tvaMatch) fields.tva = tvaMatch[0].replace(/\s/g, '')

  const htMatch = text.match(/(?:montant\s*h\.?t\.?|ht)[^\d]*(\d[\d\s,.]*)\s*€?/i)
  if (htMatch) fields.montantHT = htMatch[1].trim() + ' €'

  const ttcMatch = text.match(/(?:montant\s*t\.?t\.?c\.?|ttc)[^\d]*(\d[\d\s,.]*)\s*€?/i)
  if (ttcMatch) fields.montantTTC = ttcMatch[1].trim() + ' €'

  const dates = [...text.matchAll(/\b(\d{2})[\/\-](\d{2})[\/\-](\d{4})\b/g)].map(m => m[0])
  if (dates[0]) fields.dateEmission = dates[0]
  if (dates[1]) fields.dateEcheance = dates[1]

  const ibanMatch = text.match(/FR\d{2}[\s\d]{20,30}/i)
  if (ibanMatch) fields.iban = ibanMatch[0].replace(/\s+/g, ' ').trim()

  const bicMatch = text.match(/\b([A-Z]{4}FR[A-Z0-9]{2,5})\b/)
  if (bicMatch) fields.bic = bicMatch[1]

  return fields
}

function detectType(filename, text = '') {
  const s = (filename + ' ' + text).toLowerCase()
  if (s.includes('kbis')) return 'kbis'
  if (s.includes('urssaf') || s.includes('vigilance')) return 'urssaf'
  if (s.includes('rib') || s.includes('iban')) return 'rib'
  if (s.includes('devis')) return 'devis'
  if (s.includes('siret') || s.includes('attestation')) return 'attestation SIRET'
  return 'facture'
}

// ── Pipeline Upload ───────────────────────────────────────

// Étape 1 : upload (pas d'endpoint dédié, on génère un id local)
export async function uploadDocument(file) {
  return { id: `doc-${Date.now()}`, filename: file.name }
}

// Étape 2 : OCR réel via POST /ocr
// Lance une erreur si le backend échoue ou si c'est un PDF
export async function runOCR(file) {
  if (file.type === 'application/pdf') {
    throw new Error('Les PDF ne sont pas encore supportés par l\'OCR. Utilisez une image (JPG, PNG).')
  }

  const form = new FormData()
  form.append('file', file)

  const res = await api.post('/ocr', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data  // { id, filename, text, timestamp }
}

// Étape 3 : extraction des champs depuis le texte OCR
export async function extractFields(ocrResult, filename) {
  if (!ocrResult?.text?.trim()) {
    throw new Error('Le texte extrait est vide. Vérifiez la qualité de l\'image.')
  }
  const fields = parseOCRText(ocrResult.text)
  const type = detectType(filename, ocrResult.text)
  return { type, fields, anomalies: [], ocrId: ocrResult.id }
}

// Étape 4 : classification
export async function classifyDocument(ocrResult, filename) {
  return { type: detectType(filename, ocrResult?.text || '') }
}

// ── Corrections ───────────────────────────────────────────
export async function getCorrections(limit = 50) {
  const res = await api.get(`/corrections?limit=${limit}`)
  return res.data.corrections
}

// ── CRM / Fournisseurs ────────────────────────────────────
export async function getSuppliers() {
  try {
    const res = await api.get('/suppliers')
    return res.data
  } catch {
    return MOCK_SUPPLIERS
  }
}

export async function saveSupplier(supplier) {
  try {
    const res = await api.post('/suppliers', supplier)
    return res.data
  } catch {
    return { ...supplier, id: supplier.id || `sup-${Date.now()}` }
  }
}

// ── Health check ──────────────────────────────────────────
export async function healthCheck() {
  try {
    const res = await api.get('/health', { timeout: 3000 })
    return res.data
  } catch {
    return { status: 'error' }
  }
}
