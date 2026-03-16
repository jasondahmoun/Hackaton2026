import axios from 'axios'
import { MOCK_SUPPLIERS, MOCK_DOCUMENTS_EXTRACTED } from '../mock/data'

// Passer à false quand le backend est prêt
const USE_MOCK = true

const api = axios.create({
  baseURL: 'http://localhost:8000',
  timeout: 10000,
})

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

// Génère un faux résultat OCR + extraction à partir du nom de fichier
function generateMockExtraction(filename) {
  const name = filename.toLowerCase()
  let type = 'facture'
  if (name.includes('kbis')) type = 'kbis'
  else if (name.includes('urssaf')) type = 'urssaf'
  else if (name.includes('rib')) type = 'rib'
  else if (name.includes('devis')) type = 'devis'
  else if (name.includes('siret') || name.includes('attestation')) type = 'attestation SIRET'

  const siret = `${Math.floor(Math.random() * 90000 + 10000)}${Math.floor(Math.random() * 90000 + 10000)}${Math.floor(Math.random() * 90000 + 10000)}`

  const fields = { siret }
  if (type === 'facture' || type === 'devis') {
    const ht = (Math.random() * 20000 + 500).toFixed(2)
    Object.assign(fields, {
      tva: `FR${Math.floor(Math.random() * 90 + 10)}${siret.slice(0, 9)}`,
      montantHT: `${parseFloat(ht).toLocaleString('fr-FR')} €`,
      montantTTC: `${(parseFloat(ht) * 1.2).toLocaleString('fr-FR')} €`,
      dateEmission: new Date().toLocaleDateString('fr-FR'),
    })
  }
  if (type === 'kbis') {
    const futureDate = new Date()
    futureDate.setFullYear(futureDate.getFullYear() + 1)
    Object.assign(fields, {
      raisonSociale: 'Entreprise Demo SARL',
      adresse: '1 rue de la Demo, 75000 Paris',
      dateEmission: new Date().toLocaleDateString('fr-FR'),
      dateEcheance: futureDate.toLocaleDateString('fr-FR'),
    })
  }
  if (type === 'urssaf') {
    const expiry = new Date()
    expiry.setMonth(expiry.getMonth() + 6)
    Object.assign(fields, {
      dateEmission: new Date().toLocaleDateString('fr-FR'),
      dateEcheance: expiry.toLocaleDateString('fr-FR'),
    })
  }
  if (type === 'rib') {
    Object.assign(fields, {
      iban: 'FR76 3000 4000 0100 0000 0000 000',
      bic: 'BNPAFRPP',
    })
  }

  return { type, fields, anomalies: [] }
}

// — Upload
export async function uploadDocument(file) {
  if (USE_MOCK) {
    await delay(600)
    return { id: `doc-${Date.now()}`, filename: file.name }
  }
  const form = new FormData()
  form.append('file', file)
  const res = await api.post('/upload', form)
  return res.data
}

// — OCR
export async function runOCR(file) {
  if (USE_MOCK) {
    await delay(1000)
    return { text: 'SIRET: 12345678901234\nMontant HT: 1500 EUR\nMontant TTC: 1800 EUR\nTVA: FR12345678901' }
  }
  const form = new FormData()
  form.append('file', file)
  try {
    const res = await api.post('/ocr', form)
    return res.data
  } catch {
    return { text: '' }
  }
}

// — Extraction entités
export async function extractFields(docId, filename) {
  if (USE_MOCK) {
    await delay(800)
    return generateMockExtraction(filename)
  }
  try {
    const res = await api.get(`/documents/${docId}`)
    return res.data
  } catch {
    return generateMockExtraction(filename)
  }
}

// — Classification
export async function classifyDocument(docId, filename) {
  if (USE_MOCK) {
    await delay(500)
    const { type } = generateMockExtraction(filename)
    return { type }
  }
  try {
    const res = await api.post('/classify', { docId, filename })
    return res.data
  } catch {
    const { type } = generateMockExtraction(filename)
    return { type }
  }
}

// — Liste documents
export async function getDocuments() {
  if (USE_MOCK) return Object.values(MOCK_DOCUMENTS_EXTRACTED)
  try {
    const res = await api.get('/documents')
    return res.data.documents || []
  } catch {
    return Object.values(MOCK_DOCUMENTS_EXTRACTED)
  }
}

// — Fournisseurs
export async function getSuppliers() {
  if (USE_MOCK) return MOCK_SUPPLIERS
  try {
    const res = await api.get('/suppliers')
    return res.data
  } catch {
    return MOCK_SUPPLIERS
  }
}

export async function saveSupplier(supplier) {
  if (USE_MOCK) {
    await delay(400)
    return { ...supplier, id: supplier.id || `sup-${Date.now()}` }
  }
  try {
    const res = await api.post('/suppliers', supplier)
    return res.data
  } catch {
    return { ...supplier, id: supplier.id || `sup-${Date.now()}` }
  }
}

// — Health check
export async function healthCheck() {
  try {
    const res = await api.get('/health', { timeout: 3000 })
    return res.data
  } catch {
    return { status: 'error' }
  }
}
