export const MOCK_SUPPLIERS = [
  {
    id: 'sup-001',
    raisonSociale: 'Dupont & Associés SARL',
    siret: '12345678901234',
    siren: '123456789',
    adresse: '14 rue de la Paix, 75001 Paris',
    contact: { nom: 'Jean Dupont', email: 'j.dupont@dupont-asso.fr', tel: '01 23 45 67 89' },
    rib: { iban: 'FR76 3000 4000 0100 0000 0000 123', bic: 'BNPAFRPP' },
    status: 'alerte',
    documents: [
      { id: 'doc-001', type: 'facture', filename: 'facture_dupont_2024_01.pdf', status: 'done' },
      { id: 'doc-002', type: 'kbis', filename: 'kbis_dupont.pdf', status: 'done' },
      { id: 'doc-003', type: 'urssaf', filename: 'attestation_urssaf_dupont.pdf', status: 'done' },
    ],
  },
  {
    id: 'sup-002',
    raisonSociale: 'Tech Solutions Paris SAS',
    siret: '98765432100011',
    siren: '987654321',
    adresse: '8 avenue de l\'Opéra, 75002 Paris',
    contact: { nom: 'Marie Martin', email: 'm.martin@techsolutions.fr', tel: '01 98 76 54 32' },
    rib: { iban: 'FR76 1400 7000 0100 0000 0000 456', bic: 'SOGEFRPP' },
    status: 'complet',
    documents: [
      { id: 'doc-004', type: 'facture', filename: 'facture_techsol_2024_03.pdf', status: 'done' },
      { id: 'doc-005', type: 'rib', filename: 'rib_techsolutions.pdf', status: 'done' },
      { id: 'doc-006', type: 'kbis', filename: 'kbis_techsolutions.pdf', status: 'done' },
      { id: 'doc-007', type: 'urssaf', filename: 'attestation_urssaf_techsol.pdf', status: 'done' },
    ],
  },
  {
    id: 'sup-003',
    raisonSociale: 'BTP Construction Est',
    siret: '55544433300022',
    siren: '555444333',
    adresse: '22 boulevard Haussmann, 67000 Strasbourg',
    contact: { nom: 'Pierre Lambert', email: 'p.lambert@btpconstruction.fr', tel: '03 88 12 34 56' },
    rib: { iban: 'FR76 2004 1010 0505 0000 0000 789', bic: 'CRLYFRPP' },
    status: 'incomplet',
    documents: [
      { id: 'doc-008', type: 'facture', filename: 'facture_btp_2024_02.pdf', status: 'done' },
      { id: 'doc-009', type: 'kbis', filename: 'kbis_btp.pdf', status: 'done' },
    ],
  },
]

export const MOCK_DOCUMENTS_EXTRACTED = {
  'doc-001': {
    id: 'doc-001', type: 'facture', filename: 'facture_dupont_2024_01.pdf',
    fields: {
      siret: '99999999901234', // SIRET mismatch volontaire pour démo
      tva: 'FR99123456789',
      montantHT: '12 500,00 €',
      montantTTC: '15 000,00 €',
      dateEmission: '15/01/2024',
      dateEcheance: null,
    },
    anomalies: [{ type: 'siret_mismatch', message: 'SIRET différent du Kbis', severity: 'red' }],
  },
  'doc-002': {
    id: 'doc-002', type: 'kbis', filename: 'kbis_dupont.pdf',
    fields: {
      siret: '12345678901234',
      raisonSociale: 'Dupont & Associés SARL',
      adresse: '14 rue de la Paix, 75001 Paris',
      dateEmission: '03/01/2024',
      dateEcheance: '03/01/2025',
    },
    anomalies: [],
  },
  'doc-003': {
    id: 'doc-003', type: 'urssaf', filename: 'attestation_urssaf_dupont.pdf',
    fields: {
      siret: '12345678901234',
      dateEmission: '01/10/2023',
      dateEcheance: '31/12/2023', // expirée
    },
    anomalies: [{ type: 'expired', message: 'Attestation URSSAF expirée', severity: 'red' }],
  },
  'doc-004': {
    id: 'doc-004', type: 'facture', filename: 'facture_techsol_2024_03.pdf',
    fields: {
      siret: '98765432100011',
      tva: 'FR87987654321',
      montantHT: '8 200,00 €',
      montantTTC: '9 840,00 €',
      dateEmission: '10/03/2024',
      dateEcheance: null,
    },
    anomalies: [],
  },
}

// Template vide pour un nouveau fournisseur
export const EMPTY_SUPPLIER = {
  id: null,
  raisonSociale: '',
  siret: '',
  siren: '',
  adresse: '',
  contact: { nom: '', email: '', tel: '' },
  rib: { iban: '', bic: '' },
  status: 'incomplet',
  documents: [],
}

// Mapping champs document → champs fournisseur pour l'auto-fill
export function mapDocToSupplier(doc, existingSupplier) {
  const f = doc.fields
  const updated = { ...existingSupplier }
  const autoFilled = new Set()

  if (f.siret && !existingSupplier.siret) {
    updated.siret = f.siret
    updated.siren = f.siret.replace(/\s/g, '').slice(0, 9)
    autoFilled.add('siret')
    autoFilled.add('siren')
  }
  if (f.raisonSociale && !existingSupplier.raisonSociale) {
    updated.raisonSociale = f.raisonSociale
    autoFilled.add('raisonSociale')
  }
  if (f.adresse && !existingSupplier.adresse) {
    updated.adresse = f.adresse
    autoFilled.add('adresse')
  }
  if (f.iban && !existingSupplier.rib.iban) {
    updated.rib = { ...updated.rib, iban: f.iban }
    autoFilled.add('iban')
  }
  if (f.bic && !existingSupplier.rib.bic) {
    updated.rib = { ...updated.rib, bic: f.bic }
    autoFilled.add('bic')
  }
  return { updated, autoFilled }
}
