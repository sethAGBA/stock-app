// ── Magasin ───────────────────────────────────────────────
export interface Magasin {
  id: string;
  nom: string;
  adresse?: string;
  telephone?: string;
  actif: boolean;
  createdAt: Date;
}

// ── Utilisateur ──────────────────────────────────────────
export type UserRole = "admin" | "gestionnaire" | "vendeur" | "lecteur";

export interface AppUser {
  uid: string;
  email: string;
  nom: string;
  prenom: string;
  role: UserRole;
  actif: boolean;
  magasinId?: string | null;
  createdAt: Date;
}

// ── Catégorie ─────────────────────────────────────────────
export interface Categorie {
  id: string;
  nom: string;
  description?: string;
  createdAt: Date;
}

// ── Unité ─────────────────────────────────────────────────
export interface Unite {
  id: string;
  nom: string; // ex: Kilogramme
  abreviation: string; // ex: kg
  createdAt: Date;
}

// ── Établissement (Config) ────────────────────────────────
export interface Etablissement {
  id: string; // "default"
  nom: string;
  adresse?: string;
  telephone?: string;
  email?: string;
  devise: string; // "XOF", "USD"...
  tva?: number; // %
  piedDePage?: string; // Message sur les tickets
  logoUrl?: string; // Pour le futur
  updatedAt: Date;
}

// ── Client ────────────────────────────────────────────────
export interface Client {
  id: string;
  nom: string;
  prenom?: string;
  email?: string;
  telephone?: string;
  adresse?: string;
  totalAchats: number;
  soldeDette: number; // Nouveau: Somme totale due par le client
  derniereVisite?: Date;
  magasinId?: string | null;
  createdAt: Date;
}

// ── Fournisseur ───────────────────────────────────────────
export interface Fournisseur {
  id: string;
  nom: string;
  contact: string;
  email?: string;
  telephone?: string;
  delaiLivraison?: number; // en jours
  soldeDette: number; // Somme totale due à ce fournisseur
  createdAt: Date;
}

export interface CommandeFournisseur {
  id: string;
  fournisseurId: string;
  fournisseurNom: string;
  date: Date;
  statut: "brouillon" | "commandee" | "recu" | "annulee";
  lignes: {
    produitId: string;
    produitNom: string;
    quantite: number;
    prixAchat: number;
    total: number;
  }[];
  totalHT: number;
  fraisLivraison?: number;
  totalTTC: number;
  montantPaye: number;
  resteAPayer: number;
  statutPaiement: "en_attente" | "partiel" | "paye";
  dateEcheance?: Date | null;
  motifAnnulation?: string;
  // Traçabilité
  createdBy: string;
  createdByName: string;
  orderedBy?: string;
  orderedByName?: string;
  receivedBy?: string;
  receivedByName?: string;
  cancelledBy?: string;
  cancelledByName?: string;
  magasinId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ── Produit ───────────────────────────────────────────────
export interface Produit {
  id: string;
  reference: string;
  designation: string;
  description?: string;
  categorieId: string;
  categorie?: string; // nom dénormalisé
  fournisseurId: string;
  fournisseur?: string; // nom dénormalisé
  unite: string; // pièce, kg, litre...
  marque?: string;
  prixAchat: number;
  prixVente: number;
  prixVenteGros?: number; // Prix pour les ventes en quantité
  stockActuel: number;
  stockMinimum: number;
  datePeremption?: Date | null; // Crucial pour pharma/agro
  emplacement?: string; // Rayon, Étagère...
  photoUrl?: string;
  magasinId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ── Mouvement de stock ────────────────────────────────────
export type TypeMouvement = "entree" | "sortie" | "ajustement";

export interface Mouvement {
  id: string;
  produitId: string;
  produitRef: string;       // référence dénormalisée
  produitNom: string;       // désignation dénormalisée
  type: TypeMouvement;
  quantite: number;
  stockAvant: number;
  stockApres: number;
  motif: string;
  utilisateurId: string;
  utilisateurNom: string;
  magasinId?: string | null;
  createdAt: Date;
}

// ── Vente ─────────────────────────────────────────────────
export interface LigneVente {
  produitId: string;
  produitRef: string;
  produitNom: string;
  quantite: number;
  prixUnitaire: number;
  prixAchat: number; // Nouveau: Coût à l'achat pour calcul de marge
  typePrix: "detail" | "gros";
  total: number;
}

export interface Vente {
  id: string;
  clientId?: string | null;
  clientNom?: string; // "Client passage" par défaut
  lignes: LigneVente[];
  totalHT: number;
  remise: number; // Rabais / Ristourne
  totalTTC: number; // Final après remise
  montantRecu?: number; // Somme donnée par le client
  monnaie?: number; // Monnaie rendue
  resteAPayer: number; // Nouveau: Différence si vente à crédit
  modePaiement: "especes" | "mobile_money" | "carte" | "autre" | "credit";
  statut?: "valide" | "annulee";
  motifAnnulation?: string;
  annuleParId?: string;
  annuleParNom?: string;
  annuleAt?: Date;
  utilisateurId: string;
  utilisateurNom: string;
  magasinId?: string | null;
  createdAt: Date;
}

// ── Dashboard stats ───────────────────────────────────────
export interface DashboardStats {
  totalProduits: number;
  produitsEnAlerte: number;
  produitsExpires: number; // Nouveau
  produitsProchesExpiration: number; // Nouveau
  valeurTotaleStockAchat: number; // Nouveau
  valeurTotaleStockVente: number; // Nouveau
  mouvementsAujourdhui: number;
  entreesAujourdhui: number;
  sortiesAujourdhui: number;
}

// ── Rapport ───────────────────────────────────────────────
export interface FiltreRapport {
  dateDebut: Date;
  dateFin: Date;
  categorieId?: string;
  fournisseurId?: string;
  type?: TypeMouvement;
}

// ── Audit Logs ───────────────────────────────────────────
export interface AuditLog {
  id: string;
  type: "vente" | "stock" | "auth" | "client" | "fournisseur" | "paiement" | "admin" | "configuration";
  action: string;
  details: string;
  utilisateurId: string;
  utilisateurNom: string;
  createdAt: Date;
}

// ── Clôture de Caisse ─────────────────────────────────────
export interface ClotureCaisse {
  id: string;
  date: Date;
  totalVentes: number;
  nbVentes: number;
  repartition: {
    especes: number;
    mobile_money: number;
    carte: number;
    credit: number;
    autre: number;
  };
  montantTheorique: number; // Somme des espèces attendues
  montantReel: number;     // Somme réellement en caisse
  ecart: number;           // Différence
  note?: string;
  utilisateurId: string;    // Personne qui effectue la clôture
  utilisateurNom: string;
  vendeurId?: string;       // Personne dont c'est la caisse (pour V2)
  vendeurNom?: string;
  magasinId?: string | null;
  createdAt: Date;
}

// ── Inventaire (Comptage Physique) ────────────────────────
export interface InventaireSession {
  id: string;
  date: Date;
  utilisateurId: string;
  utilisateurNom: string;
  statut: "en_cours" | "termine" | "valide";
  categorieId?: string; // Optionnel: Inventaire partiel
  lignes: {
    produitId: string;
    produitRef: string;
    produitNom: string;
    stockTheorique: number;
    stockReel: number;
    ecart: number;
  }[];
  notes?: string;
  magasinId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
// ── Sortie de Caisse ─────────────────────────────────────
export interface SortieCaisse {
  id: string;
  montant: number;
  motif: string;
  categorie: string;
  beneficiaire?: string;
  utilisateurId: string;
  utilisateurNom: string;
  magasinId?: string | null;
  createdAt: Date;
}
