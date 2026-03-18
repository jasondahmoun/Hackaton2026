import { mockAnomalies, mockFournisseurs, mockDocuments } from "./mockData";

/**
 * Passer USE_MOCK à false une fois le backend de l'étudiant 6 disponible.
 * Routes attendues :
 *   GET /api/anomalies
 *   GET /api/compliance/:id
 *   GET /api/status/:id
 */
const USE_MOCK = true;

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchAnomalies() {
  if (USE_MOCK) {
    await delay(400);
    return mockAnomalies;
  }
  const res = await fetch("/api/anomalies");
  if (!res.ok) throw new Error("Erreur réseau /api/anomalies");
  return res.json();
}

export async function fetchCompliance(fournisseurId) {
  if (USE_MOCK) {
    await delay(300);
    const fournisseur = mockFournisseurs.find((f) => f.id === fournisseurId);
    const anomalies   = mockAnomalies.filter((a) => a.fournisseurId === fournisseurId);
    const documents   = mockDocuments.filter((d) => d.fournisseurId === fournisseurId);
    return { fournisseur, anomalies, documents };
  }
  const res = await fetch(`/api/compliance/${fournisseurId}`);
  if (!res.ok) throw new Error(`Erreur réseau /api/compliance/${fournisseurId}`);
  return res.json();
}

export async function fetchStatus(fournisseurId) {
  if (USE_MOCK) {
    await delay(300);
    return mockDocuments.filter((d) => d.fournisseurId === fournisseurId);
  }
  const res = await fetch(`/api/status/${fournisseurId}`);
  if (!res.ok) throw new Error(`Erreur réseau /api/status/${fournisseurId}`);
  return res.json();
}

export async function fetchAllFournisseurs() {
  if (USE_MOCK) {
    await delay(400);
    return mockFournisseurs;
  }
  const res = await fetch("/api/fournisseurs");
  if (!res.ok) throw new Error("Erreur réseau /api/fournisseurs");
  return res.json();
}

export async function fetchAllDocuments() {
  if (USE_MOCK) {
    await delay(300);
    return mockDocuments;
  }
  const res = await fetch("/api/documents");
  if (!res.ok) throw new Error("Erreur réseau /api/documents");
  return res.json();
}

export async function fetchCorrections(limit = 50) {
  const res = await fetch(`http://localhost:8000/corrections?limit=${limit}`);
  if (!res.ok) throw new Error("Erreur réseau /corrections");
  const data = await res.json();
  return data.corrections || [];
}

export async function fetchDocumentByRef(ref) {
  // Cherche d'abord par ID exact, sinon par nom de fichier
  try {
    const byId = await fetch(`/documents/${ref}`);
    if (byId.ok) return byId.json();
  } catch (_) {}

  const bySearch = await fetch(`/documents?search=${encodeURIComponent(ref)}&limit=1`);
  if (!bySearch.ok) throw new Error("Document introuvable");
  const data = await bySearch.json();
  if (!data.documents?.length) throw new Error(`Aucun document trouvé pour "${ref}"`);
  return data.documents[0];
}
