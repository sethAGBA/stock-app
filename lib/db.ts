import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, setDoc,
  deleteDoc, query, where, orderBy, limit, runTransaction,
  serverTimestamp, Timestamp, onSnapshot, QueryConstraint
} from "firebase/firestore";
import { format } from "date-fns";
import { db } from "./firebase";
import type { Produit, Mouvement, Categorie, Client, Vente, Unite, Etablissement, Fournisseur, CommandeFournisseur, AppUser, TypeMouvement, AuditLog, ClotureCaisse, InventaireSession, SortieCaisse, Magasin } from "@/types";

// ── Collections ───────────────────────────────────────────
const COLS = {
  produits: "produits",
  mouvements: "mouvements",
  categories: "categories",
  fournisseurs: "fournisseurs",
  utilisateurs: "utilisateurs",
  clients: "clients",
  ventes: "ventes",
  unites: "unites",
  configurations: "configurations",
  commandesFournisseurs: "commandes_fournisseurs",
  audit: "audit_logs",
  clotures: "clotures_caisse",
  inventaires: "inventaires",
  sortiesCaisse: "sorties_caisse",
  magasins: "magasins",
};

const toDate = (ts: any): Date =>
  ts instanceof Timestamp ? ts.toDate() : new Date(ts);

// ════════════════════════════════════════
// AUDIT LOGS
// ════════════════════════════════════════
export const auditService = {
  async enregistrer(data: Omit<AuditLog, "id" | "createdAt">): Promise<void> {
    await addDoc(collection(db, COLS.audit), {
      ...data,
      createdAt: serverTimestamp(),
    });
  },

  async getRecent(limitN = 100): Promise<AuditLog[]> {
    const q = query(collection(db, COLS.audit), orderBy("createdAt", "desc"), limit(limitN));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: toDate(d.data().createdAt)
    } as AuditLog));
  }
};

// ════════════════════════════════════════
// MAGASINS
// ════════════════════════════════════════
export const magasinsService = {
  async getAll(): Promise<Magasin[]> {
    const q = query(collection(db, COLS.magasins), orderBy("createdAt", "asc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: toDate(d.data().createdAt)
    } as Magasin));
  },

  async getById(id: string): Promise<Magasin | null> {
    const snap = await getDoc(doc(db, COLS.magasins, id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data(), createdAt: toDate(snap.data()!.createdAt) } as Magasin;
  },

  async create(data: Omit<Magasin, "id" | "createdAt">): Promise<string> {
    const ref = await addDoc(collection(db, COLS.magasins), {
      ...data,
      actif: true,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  },

  async update(id: string, data: Partial<Omit<Magasin, "id" | "createdAt">>): Promise<void> {
    await updateDoc(doc(db, COLS.magasins, id), data);
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, COLS.magasins, id));
  },

  async assignUserToMagasin(userId: string, magasinId: string | null): Promise<void> {
    await updateDoc(doc(db, COLS.utilisateurs, userId), {
      magasinId: magasinId ?? null,
    });
  },
};

// ════════════════════════════════════════
// SORTIES DE CAISSE
// ════════════════════════════════════════
export const sortiesCaisseService = {
  async enregistrer(data: Omit<SortieCaisse, "id" | "createdAt">, magasinId?: string | null): Promise<string> {
    const ref = await addDoc(collection(db, COLS.sortiesCaisse), {
      ...data,
      magasinId: magasinId || null,
      createdAt: serverTimestamp(),
    });

    await auditService.enregistrer({
      type: "paiement",
      action: "SORTIE_CAISSE",
      details: `Sortie de caisse (${data.categorie}) de ${data.montant} F - Motif: ${data.motif}`,
      utilisateurId: data.utilisateurId,
      utilisateurNom: data.utilisateurNom,
    });

    return ref.id;
  },

  async getAll(magasinId?: string | null): Promise<SortieCaisse[]> {
    let q = query(collection(db, COLS.sortiesCaisse), orderBy("createdAt", "desc"));
    if (magasinId) {
      // Pour les vendeurs/gestionnaires, on filtre obligatoirement au niveau serveur
      q = query(collection(db, COLS.sortiesCaisse), where("magasinId", "==", magasinId), orderBy("createdAt", "desc"));
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: toDate(d.data().createdAt)
    } as SortieCaisse));
  },

  async getForDateRange(start: Date, end: Date, magasinId?: string | null): Promise<SortieCaisse[]> {
    let q = query(
      collection(db, COLS.sortiesCaisse),
      where("createdAt", ">=", start),
      where("createdAt", "<=", end),
      orderBy("createdAt", "desc")
    );
    if (magasinId) {
      q = query(
        collection(db, COLS.sortiesCaisse),
        where("magasinId", "==", magasinId),
        where("createdAt", ">=", start),
        where("createdAt", "<=", end),
        orderBy("createdAt", "desc")
      );
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: toDate(d.data().createdAt)
    } as SortieCaisse));
  }
};

// ════════════════════════════════════════
// PRODUITS
// ════════════════════════════════════════
export const produitsService = {
  async getAll(magasinId?: string | null): Promise<Produit[]> {
    const q = query(collection(db, COLS.produits), orderBy("designation"));
    const snap = await getDocs(q);
    let all = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        createdAt: toDate(data.createdAt),
        updatedAt: toDate(data.updatedAt),
        datePeremption: data.datePeremption ? toDate(data.datePeremption) : undefined
      } as Produit;
    });
    if (magasinId) {
      all = all.filter(p => !p.magasinId || p.magasinId === magasinId);
    }
    return all;
  },

  async getById(id: string): Promise<Produit | null> {
    const snap = await getDoc(doc(db, COLS.produits, id));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      id: snap.id,
      ...data,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
      datePeremption: data.datePeremption ? toDate(data.datePeremption) : undefined
    } as Produit;
  },

  async create(data: Omit<Produit, "id" | "createdAt" | "updatedAt">, utilisateur: { uid: string; nom: string }, magasinId?: string | null): Promise<string> {
    const ref = await addDoc(collection(db, COLS.produits), {
      ...data,
      stockActuel: 0,
      ...(magasinId ? { magasinId } : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await auditService.enregistrer({
      type: "stock",
      action: "PRODUIT_CREE",
      details: `Création du produit : ${data.designation} (${data.reference})`,
      utilisateurId: utilisateur.uid,
      utilisateurNom: utilisateur.nom,
    });

    return ref.id;
  },

  async update(id: string, data: Partial<Produit>, utilisateur: { uid: string; nom: string }): Promise<void> {
    await updateDoc(doc(db, COLS.produits, id), { ...data, updatedAt: serverTimestamp() });

    await auditService.enregistrer({
      type: "stock",
      action: "PRODUIT_MODIFIE",
      details: `Modification du produit ID: ${id}. Champs modifiés : ${Object.keys(data).join(", ")}`,
      utilisateurId: utilisateur.uid,
      utilisateurNom: utilisateur.nom,
    });
  },

  async delete(id: string, designation: string, utilisateur: { uid: string; nom: string }): Promise<void> {
    await deleteDoc(doc(db, COLS.produits, id));

    await auditService.enregistrer({
      type: "stock",
      action: "PRODUIT_SUPPRIME",
      details: `Suppression du produit : ${designation} (ID: ${id})`,
      utilisateurId: utilisateur.uid,
      utilisateurNom: utilisateur.nom,
    });
  },

  async getEnAlerte(): Promise<Produit[]> {
    const all = await this.getAll();
    return all.filter(p => p.stockActuel <= p.stockMinimum);
  },

  onSnapshot(callback: (produits: Produit[]) => void, magasinId?: string | null) {
    const q = query(collection(db, COLS.produits), orderBy("designation"));
    return onSnapshot(q,
      snap => {
        let all = snap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            createdAt: toDate(data.createdAt),
            updatedAt: toDate(data.updatedAt),
            datePeremption: data.datePeremption ? toDate(data.datePeremption) : undefined
          } as Produit;
        });
        if (magasinId) {
          all = all.filter(p => !p.magasinId || p.magasinId === magasinId);
        }
        callback(all);
      },
      error => {
        console.error("Erreur onSnapshot produits:", error);
      }
    );
  },
};

// ════════════════════════════════════════
// MOUVEMENTS
// ════════════════════════════════════════
export const mouvementsService = {
  async enregistrer(
    produitId: string,
    type: TypeMouvement,
    quantite: number,
    motif: string,
    utilisateur: { uid: string; nom: string }
  ): Promise<void> {
    await runTransaction(db, async (tx) => {
      const produitRef = doc(db, COLS.produits, produitId);
      const produitSnap = await tx.get(produitRef);
      if (!produitSnap.exists()) throw new Error("Produit introuvable");

      const produit = produitSnap.data() as Produit;
      const stockAvant = produit.stockActuel;
      const stockApres = type === "entree"
        ? stockAvant + quantite
        : type === "sortie"
          ? stockAvant - quantite
          : quantite; // ajustement direct

      if (stockApres < 0) throw new Error("Stock insuffisant");

      // Mise à jour du stock
      tx.update(produitRef, { stockActuel: stockApres, updatedAt: serverTimestamp() });

      // Enregistrement du mouvement
      const mvtRef = doc(collection(db, COLS.mouvements));
      tx.set(mvtRef, {
        produitId,
        produitRef: produit.reference,
        produitNom: produit.designation,
        type,
        quantite,
        stockAvant,
        stockApres,
        motif,
        utilisateurId: utilisateur.uid,
        utilisateurNom: utilisateur.nom,
        magasinId: produit.magasinId || null,
        createdAt: serverTimestamp(),
      });

      // Log action
      await auditService.enregistrer({
        type: "stock",
        action: "MOUVEMENT_" + type.toUpperCase(),
        details: `${quantite} ${produit.designation} (${type}) : ${motif}`,
        utilisateurId: utilisateur.uid,
        utilisateurNom: utilisateur.nom,
      });
    });
  },

  async getRecents(limitN = 50, magasinId?: string | null): Promise<Mouvement[]> {
    let q = query(collection(db, COLS.mouvements), orderBy("createdAt", "desc"), limit(limitN));
    if (magasinId) q = query(collection(db, COLS.mouvements), where("magasinId", "==", magasinId), orderBy("createdAt", "desc"), limit(limitN));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: toDate(d.data().createdAt) } as Mouvement));
  },

  async getByProduit(produitId: string): Promise<Mouvement[]> {
    const snap = await getDocs(query(collection(db, COLS.mouvements), where("produitId", "==", produitId), orderBy("createdAt", "desc")));
    return snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: toDate(d.data().createdAt) } as Mouvement));
  },

  async getByPeriode(debut: Date, fin: Date, magasinId?: string | null): Promise<Mouvement[]> {
    let q = query(
      collection(db, COLS.mouvements),
      where("createdAt", ">=", Timestamp.fromDate(debut)),
      where("createdAt", "<=", Timestamp.fromDate(fin)),
      orderBy("createdAt", "desc")
    );
    if (magasinId) {
      q = query(
        collection(db, COLS.mouvements),
        where("magasinId", "==", magasinId),
        where("createdAt", ">=", Timestamp.fromDate(debut)),
        where("createdAt", "<=", Timestamp.fromDate(fin)),
        orderBy("createdAt", "desc")
      );
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: toDate(d.data().createdAt) } as Mouvement));
  },

  async reconcilier(
    ajustements: { produitId: string; nouveauStock: number; motif: string }[],
    utilisateur: { uid: string; nom: string }
  ): Promise<void> {
    await runTransaction(db, async (tx) => {
      // 1. Lire tous les produits d'abord
      const snaps = await Promise.all(
        ajustements.map(adj => tx.get(doc(db, COLS.produits, adj.produitId)))
      );

      // 2. Appliquer les modifications après toutes les lectures
      snaps.forEach((produitSnap, i) => {
        if (!produitSnap.exists()) return;

        const adj = ajustements[i];
        const produit = produitSnap.data() as Produit;
        const produitRef = doc(db, COLS.produits, adj.produitId);
        const stockAvant = produit.stockActuel;
        const stockApres = adj.nouveauStock;

        tx.update(produitRef, { stockActuel: stockApres, updatedAt: serverTimestamp() });

        const mvtRef = doc(collection(db, COLS.mouvements));
        tx.set(mvtRef, {
          produitId: adj.produitId,
          produitRef: produit.reference,
          produitNom: produit.designation,
          type: "ajustement",
          quantite: stockApres,
          stockAvant,
          stockApres,
          motif: adj.motif,
          utilisateurId: utilisateur.uid,
          utilisateurNom: utilisateur.nom,
          magasinId: produit.magasinId || null,
          createdAt: serverTimestamp(),
        });
      });

      // Log action
      await auditService.enregistrer({
        type: "stock",
        action: "RECONCILIATION_MASSE",
        details: `${ajustements.length} produits ajustés`,
        utilisateurId: utilisateur.uid,
        utilisateurNom: utilisateur.nom,
      });
    });
  },

  onSnapshot(callback: (mouvements: Mouvement[]) => void, magasinId?: string | null) {
    let q = query(collection(db, COLS.mouvements), orderBy("createdAt", "desc"), limit(100));
    if (magasinId) q = query(collection(db, COLS.mouvements), where("magasinId", "==", magasinId), orderBy("createdAt", "desc"), limit(100));
    return onSnapshot(q,
      snap => {
        const all = snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: toDate(d.data().createdAt) } as Mouvement));
        callback(all);
      },
      error => {
        console.error("Erreur onSnapshot mouvements:", error);
      }
    );
  },
};

// ════════════════════════════════════════
// CATEGORIES
// ════════════════════════════════════════
export const categoriesService = {
  async getAll(): Promise<Categorie[]> {
    const snap = await getDocs(query(collection(db, COLS.categories), orderBy("nom")));
    return snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: toDate(d.data().createdAt) } as Categorie));
  },

  async create(data: Omit<Categorie, "id" | "createdAt">, utilisateur: { uid: string; nom: string }): Promise<string> {
    const ref = await addDoc(collection(db, COLS.categories), { ...data, createdAt: serverTimestamp() });
    await auditService.enregistrer({
      type: "stock",
      action: "CATEGORIE_CREEE",
      details: `Création de la catégorie : ${data.nom}`,
      utilisateurId: utilisateur.uid,
      utilisateurNom: utilisateur.nom,
    });
    return ref.id;
  },

  async update(id: string, data: Partial<Categorie>, utilisateur: { uid: string; nom: string }): Promise<void> {
    await updateDoc(doc(db, COLS.categories, id), data);
    await auditService.enregistrer({
      type: "stock",
      action: "CATEGORIE_MODIFIEE",
      details: `Modification de la catégorie ID: ${id}`,
      utilisateurId: utilisateur.uid,
      utilisateurNom: utilisateur.nom,
    });
  },

  async delete(id: string, nom: string, utilisateur: { uid: string; nom: string }): Promise<void> {
    await deleteDoc(doc(db, COLS.categories, id));
    await auditService.enregistrer({
      type: "stock",
      action: "CATEGORIE_SUPPRIMEE",
      details: `Suppression de la catégorie : ${nom} (ID: ${id})`,
      utilisateurId: utilisateur.uid,
      utilisateurNom: utilisateur.nom,
    });
  },
};

// ════════════════════════════════════════
// UNITÉS
// ════════════════════════════════════════
export const unitesService = {
  async getAll(): Promise<Unite[]> {
    const snap = await getDocs(query(collection(db, COLS.unites), orderBy("nom")));
    return snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: toDate(d.data().createdAt) } as Unite));
  },

  async create(data: Omit<Unite, "id" | "createdAt">, utilisateur: { uid: string; nom: string }): Promise<string> {
    const ref = await addDoc(collection(db, COLS.unites), { ...data, createdAt: serverTimestamp() });
    await auditService.enregistrer({
      type: "stock",
      action: "UNITE_CREEE",
      details: `Création de l'unité : ${data.nom} (${data.abreviation})`,
      utilisateurId: utilisateur.uid,
      utilisateurNom: utilisateur.nom,
    });
    return ref.id;
  },

  async update(id: string, data: Partial<Unite>, utilisateur: { uid: string; nom: string }): Promise<void> {
    await updateDoc(doc(db, COLS.unites, id), data);
    await auditService.enregistrer({
      type: "stock",
      action: "UNITE_MODIFIEE",
      details: `Modification de l'unité ID: ${id}`,
      utilisateurId: utilisateur.uid,
      utilisateurNom: utilisateur.nom,
    });
  },

  async delete(id: string, nom: string, utilisateur: { uid: string; nom: string }): Promise<void> {
    await deleteDoc(doc(db, COLS.unites, id));
    await auditService.enregistrer({
      type: "stock",
      action: "UNITE_SUPPRIMEE",
      details: `Suppression de l'unité : ${nom} (ID: ${id})`,
      utilisateurId: utilisateur.uid,
      utilisateurNom: utilisateur.nom,
    });
  },
};

// ════════════════════════════════════════
// CONFIGURATION (ÉTABLISSEMENT)
// ════════════════════════════════════════
export const etablissementService = {
  async get(): Promise<Etablissement | null> {
    const snap = await getDoc(doc(db, COLS.configurations, "default"));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data(), updatedAt: toDate(snap.data()!.updatedAt) } as Etablissement;
  },

  async save(data: Omit<Etablissement, "id" | "updatedAt">, utilisateur: { uid: string; nom: string }): Promise<void> {
    await setDoc(doc(db, COLS.configurations, "default"), { ...data, updatedAt: serverTimestamp() }, { merge: true });
    await auditService.enregistrer({
      type: "configuration",
      action: "CONFIG_MODIFIEE",
      details: `Mise à jour des informations de l'établissement : ${data.nom}`,
      utilisateurId: utilisateur.uid,
      utilisateurNom: utilisateur.nom,
    });
  },
};

// ════════════════════════════════════════
// FOURNISSEURS
// ════════════════════════════════════════
export const fournisseursService = {
  async getAll(): Promise<Fournisseur[]> {
    const snap = await getDocs(query(collection(db, COLS.fournisseurs), orderBy("nom")));
    return snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: toDate(d.data().createdAt) } as Fournisseur));
  },

  async create(data: Omit<Fournisseur, "id" | "createdAt">, utilisateur: { uid: string; nom: string }): Promise<string> {
    const ref = await addDoc(collection(db, COLS.fournisseurs), {
      ...data,
      soldeDette: 0,
      createdAt: serverTimestamp()
    });
    await auditService.enregistrer({
      type: "stock",
      action: "FOURNISSEUR_CREE",
      details: `Nouveau fournisseur : ${data.nom}`,
      utilisateurId: utilisateur.uid,
      utilisateurNom: utilisateur.nom,
    });
    return ref.id;
  },

  async update(id: string, data: Partial<Fournisseur>, utilisateur: { uid: string; nom: string }): Promise<void> {
    await updateDoc(doc(db, COLS.fournisseurs, id), data);
    await auditService.enregistrer({
      type: "stock",
      action: "FOURNISSEUR_MODIFIE",
      details: `Modification du fournisseur ID: ${id}`,
      utilisateurId: utilisateur.uid,
      utilisateurNom: utilisateur.nom,
    });
  },

  async delete(id: string, nom: string, utilisateur: { uid: string; nom: string }): Promise<void> {
    await deleteDoc(doc(db, COLS.fournisseurs, id));
    await auditService.enregistrer({
      type: "stock",
      action: "FOURNISSEUR_SUPPRIME",
      details: `Suppression du fournisseur : ${nom} (ID: ${id})`,
      utilisateurId: utilisateur.uid,
      utilisateurNom: utilisateur.nom,
    });
  },

  async updateSoldeDette(id: string, montant: number): Promise<void> {
    await runTransaction(db, async (tx) => {
      const ref = doc(db, COLS.fournisseurs, id);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("Fournisseur introuvable");
      const current = snap.data().soldeDette || 0;
      tx.update(ref, { soldeDette: current + montant });
    });
  }
};

// ════════════════════════════════════════
// UTILISATEURS
// ════════════════════════════════════════
export const utilisateursService = {
  async getById(uid: string): Promise<AppUser | null> {
    const snap = await getDoc(doc(db, COLS.utilisateurs, uid));
    if (!snap.exists()) return null;
    return { uid: snap.id, ...snap.data(), createdAt: toDate(snap.data()!.createdAt) } as AppUser;
  },

  async getAll(magasinId?: string | null): Promise<AppUser[]> {
    const q = query(collection(db, COLS.utilisateurs), orderBy("nom"));
    const snap = await getDocs(q);
    let all = snap.docs.map(d => ({ uid: d.id, ...d.data(), createdAt: toDate(d.data().createdAt) } as AppUser));
    if (magasinId) {
      all = all.filter(u => !u.magasinId || u.magasinId === magasinId);
    }
    return all;
  },

  async create(uid: string, data: Omit<AppUser, "uid" | "createdAt">, admin: { uid: string; nom: string }): Promise<void> {
    await setDoc(doc(db, COLS.utilisateurs, uid), { ...data, createdAt: serverTimestamp() });

    await auditService.enregistrer({
      type: "admin",
      action: "UTILISATEUR_CREE",
      details: `Création de l'utilisateur ${data.prenom} ${data.nom} (${data.email}) avec le rôle ${data.role}`,
      utilisateurId: admin.uid,
      utilisateurNom: admin.nom,
    });
  },

  async count(): Promise<number> {
    const snap = await getDocs(collection(db, COLS.utilisateurs));
    return snap.size;
  },

  async update(uid: string, data: Partial<AppUser>, admin: { uid: string; nom: string }): Promise<void> {
    await updateDoc(doc(db, COLS.utilisateurs, uid), data);

    await auditService.enregistrer({
      type: "admin",
      action: "UTILISATEUR_MODIFIE",
      details: `Modification de l'utilisateur ${uid}. Rôle : ${data.role || "inchangé"}. Actif : ${data.actif !== undefined ? data.actif : "inchangé"}`,
      utilisateurId: admin.uid,
      utilisateurNom: admin.nom,
    });
  },
};

// ════════════════════════════════════════
// CLIENTS
// ════════════════════════════════════════
export const clientsService = {
  async getAll(magasinId?: string | null): Promise<Client[]> {
    const q = query(collection(db, COLS.clients), orderBy("nom"));
    const snap = await getDocs(q);
    let all = snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: toDate(d.data().createdAt), derniereVisite: d.data().derniereVisite ? toDate(d.data().derniereVisite) : undefined } as Client));
    if (magasinId) {
      all = all.filter(c => !c.magasinId || c.magasinId === magasinId);
    }
    return all;
  },

  async create(data: Omit<Client, "id" | "createdAt" | "totalAchats" | "soldeDette">, utilisateur: { uid: string; nom: string }, magasinId?: string | null): Promise<string> {
    const ref = await addDoc(collection(db, COLS.clients), {
      ...data,
      totalAchats: 0,
      soldeDette: 0,
      magasinId: magasinId || null,
      createdAt: serverTimestamp(),
    });

    await auditService.enregistrer({
      type: "client",
      action: "CLIENT_CREE",
      details: `Nouveau client : ${data.prenom} ${data.nom}`,
      utilisateurId: utilisateur.uid,
      utilisateurNom: utilisateur.nom,
    });

    return ref.id;
  },

  async update(id: string, data: Partial<Client>, utilisateur: { uid: string; nom: string }): Promise<void> {
    await updateDoc(doc(db, COLS.clients, id), data);

    await auditService.enregistrer({
      type: "client",
      action: "CLIENT_MODIFIE",
      details: `Modification du client ID: ${id}`,
      utilisateurId: utilisateur.uid,
      utilisateurNom: utilisateur.nom,
    });
  },

  async delete(id: string, nom: string, utilisateur: { uid: string; nom: string }): Promise<void> {
    await deleteDoc(doc(db, COLS.clients, id));

    await auditService.enregistrer({
      type: "client",
      action: "CLIENT_SUPPRIME",
      details: `Suppression du client : ${nom} (ID: ${id})`,
      utilisateurId: utilisateur.uid,
      utilisateurNom: utilisateur.nom,
    });
  },

  // Enregistrer un versement pour épurer une dette
  async payerDette(clientId: string, montant: number): Promise<void> {
    const clientRef = doc(db, COLS.clients, clientId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(clientRef);
      if (!snap.exists()) throw "Client introuvable";
      const data = snap.data();
      const nouveauSolde = (data.soldeDette || 0) - montant;
      tx.update(clientRef, {
        soldeDette: nouveauSolde,
        updatedAt: serverTimestamp()
      });
    });
  }
};

// ════════════════════════════════════════
// VENTES
// ════════════════════════════════════════
export const ventesService = {
  async enregistrer(data: Omit<Vente, "id" | "createdAt">): Promise<string> {
    const venteRef = doc(collection(db, COLS.ventes));
    return await runTransaction(db, async (tx) => {
      // 1. Lectures (Reads) d'abord
      const produitSnaps = await Promise.all(
        data.lignes.map(l => tx.get(doc(db, COLS.produits, l.produitId)))
      );

      let clientSnap = null;
      if (data.clientId) {
        clientSnap = await tx.get(doc(db, COLS.clients, data.clientId));
      }

      // 2. Opérations d'écriture (Writes) ensuite
      produitSnaps.forEach((produitSnap, i) => {
        const ligne = data.lignes[i];
        if (!produitSnap.exists()) throw new Error(`Produit ${ligne.produitNom} introuvable`);

        const produit = produitSnap.data() as Produit;
        if (produit.stockActuel < ligne.quantite) {
          throw new Error(`Stock insuffisant pour ${ligne.produitNom} (disponible: ${produit.stockActuel})`);
        }

        const produitRef = doc(db, COLS.produits, ligne.produitId);
        tx.update(produitRef, {
          stockActuel: produit.stockActuel - ligne.quantite,
          updatedAt: serverTimestamp()
        });

        const mvtRef = doc(collection(db, COLS.mouvements));
        tx.set(mvtRef, {
          produitId: ligne.produitId,
          produitRef: ligne.produitRef,
          produitNom: ligne.produitNom,
          type: "sortie",
          quantite: ligne.quantite,
          stockAvant: produit.stockActuel,
          stockApres: produit.stockActuel - ligne.quantite,
          motif: "Vente " + venteRef.id,
          utilisateurId: data.utilisateurId,
          utilisateurNom: data.utilisateurNom,
          createdAt: serverTimestamp(),
        });
      });

      if (clientSnap && clientSnap.exists()) {
        const clientData = clientSnap.data();
        const clientRef = doc(db, COLS.clients, data.clientId!);
        tx.update(clientRef, {
          totalAchats: (clientData.totalAchats || 0) + data.totalTTC,
          soldeDette: (clientData.soldeDette || 0) + (data.resteAPayer || 0),
          derniereVisite: serverTimestamp(),
        });
      }

      tx.set(venteRef, {
        ...data,
        statut: "valide",
        magasinId: data.magasinId || null,
        createdAt: serverTimestamp(),
      });

      // Log action (indirectly outside transaction for simplicity or inside if preferred)
      // Here we assume it's okay to log right after if the transaction fails the whole call throws.
      const venteId = venteRef.id;
      auditService.enregistrer({
        type: "vente",
        action: "VENTE_ENREGISTREE",
        details: `Vente #${venteId.slice(0, 8)} - Total: ${data.totalTTC} F - Client: ${data.clientNom}`,
        utilisateurId: data.utilisateurId,
        utilisateurNom: data.utilisateurNom,
      }).catch(err => console.error("Logging error:", err));

      return venteId;
    });
  },

  async annuler(vente: Vente, motif: string, utilisateur: { uid: string; nom: string }): Promise<void> {
    const venteRef = doc(db, COLS.ventes, vente.id);
    await runTransaction(db, async (tx) => {
      // 1. Lectures (Reads)
      const vDoc = await tx.get(venteRef);
      if (!vDoc.exists()) throw "Vente introuvable";
      const vData = vDoc.data() as Vente;
      if (vData.statut === "annulee") throw "Cette vente est déjà annulée";

      const produitSnaps = await Promise.all(
        vente.lignes.map(l => tx.get(doc(db, COLS.produits, l.produitId)))
      );

      let clientSnap = null;
      if (vente.clientId) {
        clientSnap = await tx.get(doc(db, COLS.clients, vente.clientId));
      }

      // 2. Écritures (Writes)
      produitSnaps.forEach((produitSnap, i) => {
        const ligne = vente.lignes[i];
        if (!produitSnap.exists()) return; // On ignore si le produit n'existe plus

        const produit = produitSnap.data() as Produit;
        const produitRef = doc(db, COLS.produits, ligne.produitId);

        const nouveauStock = (produit.stockActuel || 0) + ligne.quantite;
        tx.update(produitRef, {
          stockActuel: nouveauStock,
          updatedAt: serverTimestamp()
        });

        // Mouvement de stock inverse
        const mvtRef = doc(collection(db, COLS.mouvements));
        tx.set(mvtRef, {
          produitId: ligne.produitId,
          produitRef: ligne.produitRef,
          produitNom: ligne.produitNom,
          type: "entree",
          quantite: ligne.quantite,
          stockAvant: produit.stockActuel,
          stockApres: nouveauStock,
          motif: `Annulation Vente #${vente.id.slice(0, 8)}`,
          utilisateurId: utilisateur.uid,
          utilisateurNom: utilisateur.nom,
          createdAt: serverTimestamp(),
        });
      });

      if (clientSnap && clientSnap.exists()) {
        const clientData = clientSnap.data();
        const clientRef = doc(db, COLS.clients, vente.clientId!);
        tx.update(clientRef, {
          totalAchats: Math.max(0, (clientData.totalAchats || 0) - vente.totalTTC),
          soldeDette: Math.max(0, (clientData.soldeDette || 0) - (vente.resteAPayer || 0)),
          updatedAt: serverTimestamp(),
        });
      }

      tx.update(venteRef, {
        statut: "annulee",
        motifAnnulation: motif,
        annuleParId: utilisateur.uid,
        annuleParNom: utilisateur.nom,
        annuleAt: serverTimestamp(),
      });
    });

    await auditService.enregistrer({
      type: "vente",
      action: "VENTE_ANNULEE",
      details: `Annulation vente #${vente.id.slice(0, 8)} - Motif: ${motif}`,
      utilisateurId: utilisateur.uid,
      utilisateurNom: utilisateur.nom,
    });
  },

  async getAll(magasinId?: string | null): Promise<Vente[]> {
    let q = query(collection(db, COLS.ventes), orderBy("createdAt", "desc"));
    if (magasinId) {
      q = query(collection(db, COLS.ventes), where("magasinId", "==", magasinId), orderBy("createdAt", "desc"));
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: toDate(d.data().createdAt) } as Vente));
  },

  async getForDateRange(start: Date, end: Date, utilisateurId?: string, magasinId?: string | null): Promise<Vente[]> {
    let q = query(
      collection(db, COLS.ventes),
      where("createdAt", ">=", start),
      where("createdAt", "<=", end)
    );
    if (magasinId) {
      q = query(
        collection(db, COLS.ventes),
        where("magasinId", "==", magasinId),
        where("createdAt", ">=", start),
        where("createdAt", "<=", end)
      );
    }

    const snap = await getDocs(q);
    let results = snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: toDate(d.data().createdAt) } as Vente));

    // Filtrage par utilisateur en mémoire
    if (utilisateurId) {
      results = results.filter(v => v.utilisateurId === utilisateurId);
    }

    // Tri en mémoire
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  async getRecent(limitN = 50, magasinId?: string | null): Promise<Vente[]> {
    let q = query(collection(db, COLS.ventes), orderBy("createdAt", "desc"), limit(limitN));
    if (magasinId) q = query(collection(db, COLS.ventes), where("magasinId", "==", magasinId), orderBy("createdAt", "desc"), limit(limitN));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: toDate(d.data().createdAt) } as Vente));
  },

  async getStats(dateDebut: Date, dateFin: Date, magasinId?: string | null) {
    // Fetch all sales in range
    let q = query(
      collection(db, COLS.ventes),
      where("createdAt", ">=", dateDebut),
      where("createdAt", "<=", dateFin),
      orderBy("createdAt", "desc")
    );
    if (magasinId) {
      q = query(
        collection(db, COLS.ventes),
        where("magasinId", "==", magasinId),
        where("createdAt", ">=", dateDebut),
        where("createdAt", "<=", dateFin),
        orderBy("createdAt", "desc")
      );
    }
    const snap = await getDocs(q);
    const ventes = snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: toDate(d.data().createdAt) } as Vente));

    // Stats
    const totalVentes = ventes.length;
    const caTotal = ventes.reduce((acc, v) => acc + v.totalTTC, 0);

    // Top products
    const productMap = new Map<string, { nom: string; qte: number; total: number }>();
    ventes.forEach(v => {
      v.lignes.forEach(l => {
        const existing = productMap.get(l.produitId) || { nom: l.produitNom, qte: 0, total: 0 };
        productMap.set(l.produitId, {
          nom: l.produitNom,
          qte: existing.qte + l.quantite,
          total: existing.total + l.total
        });
      });
    });

    const topProduits = Array.from(productMap.values())
      .sort((a, b) => b.qte - a.qte)
      .slice(0, 5);

    // Evolution CA par jour
    const evolutionMap = new Map<string, number>();
    ventes.forEach(v => {
      const day = format(v.createdAt, "yyyy-MM-dd");
      evolutionMap.set(day, (evolutionMap.get(day) || 0) + v.totalTTC);
    });
    const evolutionCA = Array.from(evolutionMap.entries())
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { totalVentes, caTotal, topProduits, evolutionCA, ventes };
  },

  onSnapshot(callback: (ventes: Vente[]) => void, magasinId?: string | null) {
    let q = query(collection(db, COLS.ventes), orderBy("createdAt", "desc"), limit(100));
    if (magasinId) q = query(collection(db, COLS.ventes), where("magasinId", "==", magasinId), orderBy("createdAt", "desc"), limit(100));
    return onSnapshot(q,
      snap => {
        const all = snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: toDate(d.data().createdAt) } as Vente));
        callback(all);
      },
      error => {
        console.error("Erreur onSnapshot ventes:", error);
      }
    );
  },
};

// --- Commandes Fournisseurs ---
export const commandesFournisseursService = {
  async create(data: Omit<CommandeFournisseur, "id" | "createdAt" | "updatedAt">, utilisateur: { uid: string; nom: string }, magasinId?: string | null): Promise<string> {
    const totalTTC = data.totalTTC;
    const montantPaye = data.montantPaye || 0;
    const resteAPayer = totalTTC - montantPaye;
    const statutPaiement = resteAPayer <= 0 ? "paye" : (montantPaye > 0 ? "partiel" : "en_attente");

    const id = await runTransaction(db, async (tx) => {
      let fSnap = null;
      let fRef = null;

      // 1. Lectures (Reads) d'abord
      if (resteAPayer > 0) {
        fRef = doc(db, COLS.fournisseurs, data.fournisseurId);
        fSnap = await tx.get(fRef);
      }

      // 2. Écritures (Writes) ensuite
      const docRef = doc(collection(db, COLS.commandesFournisseurs));
      tx.set(docRef, {
        ...data,
        montantPaye,
        resteAPayer,
        statutPaiement,
        magasinId: magasinId || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Si c'est à crédit (reste à payer > 0), on augmente la dette du fournisseur
      if (fSnap && fSnap.exists() && fRef) {
        const solde = fSnap.data().soldeDette || 0;
        tx.update(fRef, { soldeDette: solde + resteAPayer });
      }

      return docRef.id;
    });

    await auditService.enregistrer({
      type: "stock",
      action: "COMMANDE_FOURNISSEUR_CREEE",
      details: `Nouvelle commande #${id.slice(0, 8)} - Fournisseur: ${data.fournisseurNom} - Total: ${totalTTC} F`,
      utilisateurId: utilisateur.uid,
      utilisateurNom: utilisateur.nom,
    });

    return id;
  },

  async update(id: string, data: Partial<CommandeFournisseur>, utilisateur: { uid: string; nom: string }): Promise<void> {
    await updateDoc(doc(db, COLS.commandesFournisseurs, id), {
      ...data,
      updatedAt: serverTimestamp(),
    });

    await auditService.enregistrer({
      type: "stock",
      action: "COMMANDE_FOURNISSEUR_MODIFIEE",
      details: `Modification commande #${id.slice(0, 8)}. Statut: ${data.statut || "inchangé"}`,
      utilisateurId: utilisateur.uid,
      utilisateurNom: utilisateur.nom,
    });
  },

  async delete(id: string, fournisseurNom: string, utilisateur: { uid: string; nom: string }): Promise<void> {
    await deleteDoc(doc(db, COLS.commandesFournisseurs, id));
    await auditService.enregistrer({
      type: "stock",
      action: "COMMANDE_FOURNISSEUR_SUPPRIMEE",
      details: `Suppression commande #${id.slice(0, 8)} (${fournisseurNom})`,
      utilisateurId: utilisateur.uid,
      utilisateurNom: utilisateur.nom,
    });
  },

  async getAll(magasinId?: string | null): Promise<CommandeFournisseur[]> {
    let q = query(collection(db, COLS.commandesFournisseurs));
    if (magasinId) {
      q = query(q, where("magasinId", "==", magasinId));
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const raw = d.data();
      const totalTTC = raw.totalTTC || 0;
      const montantPaye = raw.montantPaye || 0;
      return {
        id: d.id,
        ...raw,
        montantPaye,
        resteAPayer: raw.resteAPayer !== undefined ? raw.resteAPayer : Math.max(0, totalTTC - montantPaye),
        date: raw.date ? toDate(raw.date) : new Date(),
        dateEcheance: raw.dateEcheance ? toDate(raw.dateEcheance) : null,
        createdAt: raw.createdAt ? toDate(raw.createdAt) : new Date(),
        updatedAt: raw.updatedAt ? toDate(raw.updatedAt) : new Date(),
      } as CommandeFournisseur;
    });
  },

  onSnapshot(fournisseurId: string, callback: (commandes: CommandeFournisseur[]) => void, magasinId?: string | null) {
    let q = query(
      collection(db, COLS.commandesFournisseurs),
      where("fournisseurId", "==", fournisseurId)
    );
    if (magasinId) {
      q = query(q, where("magasinId", "==", magasinId));
    }
    return onSnapshot(q,
      (snap) => {
        const data = snap.docs.map(d => {
          const raw = d.data();
          const totalTTC = raw.totalTTC || 0;
          const montantPaye = raw.montantPaye || 0;
          return {
            id: d.id,
            ...raw,
            montantPaye,
            resteAPayer: raw.resteAPayer !== undefined ? raw.resteAPayer : Math.max(0, totalTTC - montantPaye),
            date: raw.date ? toDate(raw.date) : new Date(),
            dateEcheance: raw.dateEcheance ? toDate(raw.dateEcheance) : null,
            createdAt: raw.createdAt ? toDate(raw.createdAt) : new Date(),
            updatedAt: raw.updatedAt ? toDate(raw.updatedAt) : new Date(),
          } as CommandeFournisseur;
        });
        callback(data.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
      },
      (error) => {
        console.error("Erreur onSnapshot commandes:", error);
      }
    );
  },

  // Réception de commande : Met à jour le stock et le statut
  async receptionner(commande: CommandeFournisseur, stockUpdates: { produitId: string; quantite: number }[], userInfo: { receivedBy: string; receivedByName: string }) {
    await runTransaction(db, async (tx) => {
      // 0. Lectures (Reads)
      const cmdRef = doc(db, COLS.commandesFournisseurs, commande.id);
      const cmdDoc = await tx.get(cmdRef);
      if (!cmdDoc.exists()) throw "Commande introuvable";
      if (cmdDoc.data().statut === "recu") throw "Cette commande a déjà été réceptionnée";

      const productSnaps = await Promise.all(
        stockUpdates.map(item => tx.get(doc(db, COLS.produits, item.produitId)))
      );

      // 1. Écritures (Writes)
      productSnaps.forEach((productDoc, i) => {
        const item = stockUpdates[i];
        if (!productDoc.exists()) throw "Produit introuvable";

        const productData = productDoc.data() as Produit;
        const newStock = (productData.stockActuel || 0) + item.quantite;
        const productRef = doc(db, COLS.produits, item.produitId);

        tx.update(productRef, {
          stockActuel: newStock,
          updatedAt: serverTimestamp()
        });

        // Enregistrement du mouvement
        const mvtRef = doc(collection(db, COLS.mouvements));
        tx.set(mvtRef, {
          produitId: item.produitId,
          produitNom: productData.designation,
          produitRef: productData.reference,
          type: "entree",
          quantite: item.quantite,
          stockAvant: productData.stockActuel,
          stockApres: newStock,
          motif: `Réception commande #${commande.id.slice(0, 6)}`,
          utilisateurId: userInfo.receivedBy,
          utilisateurNom: userInfo.receivedByName,
          magasinId: productData.magasinId || null,
          createdAt: serverTimestamp()
        });
      });

      // 2. Mise à jour statut commande
      tx.update(cmdRef, {
        statut: "recu",
        receivedBy: userInfo.receivedBy,
        receivedByName: userInfo.receivedByName,
        updatedAt: serverTimestamp()
      });
    });

    await auditService.enregistrer({
      type: "stock",
      action: "COMMANDE_FOURNISSEUR_RECUE",
      details: `Réception de la commande #${commande.id.slice(0, 8)} (${commande.fournisseurNom})`,
      utilisateurId: userInfo.receivedBy,
      utilisateurNom: userInfo.receivedByName,
    });
  },

  // Enregistrer un paiement sur une commande
  async enregistrerPaiement(commandeId: string, montant: number, utilisateurId: string, utilisateurNom: string) {
    if (montant <= 0) throw new Error("Le montant du paiement doit être supérieur à 0");

    await runTransaction(db, async (tx) => {
      // 1. Lectures (Reads)
      const cmdRef = doc(db, COLS.commandesFournisseurs, commandeId);
      const cmdSnap = await tx.get(cmdRef);
      if (!cmdSnap.exists()) throw new Error("Commande introuvable");

      const cmd = cmdSnap.data() as CommandeFournisseur;

      const fRef = doc(db, COLS.fournisseurs, cmd.fournisseurId);
      const fSnap = await tx.get(fRef);

      // 2. Écritures (Writes)
      const nouveauMontantPaye = (cmd.montantPaye || 0) + montant;
      const nouveauResteAPayer = cmd.totalTTC - nouveauMontantPaye;

      if (nouveauResteAPayer < -1) { // Tolerance de 1 F
        throw new Error(`Le paiement dépasse le montant restant (${cmd.resteAPayer} F)`);
      }

      const statutPaiement = nouveauResteAPayer <= 0 ? "paye" : "partiel";

      tx.update(cmdRef, {
        montantPaye: nouveauMontantPaye,
        resteAPayer: Math.max(0, nouveauResteAPayer),
        statutPaiement,
        updatedAt: serverTimestamp()
      });

      // Mettre à jour le solde du fournisseur (diminution de la dette)
      if (fSnap.exists()) {
        const soldeActuel = fSnap.data().soldeDette || 0;
        tx.update(fRef, { soldeDette: Math.max(0, soldeActuel - montant) });
      }

      // Log audit
      const auditRef = doc(collection(db, COLS.audit));
      tx.set(auditRef, {
        type: "paiement",
        action: "PAIEMENT_FOURNISSEUR",
        details: `Paiement de ${montant} F sur commande #${commandeId.slice(0, 8)} (${cmd.fournisseurNom})`,
        utilisateurId,
        utilisateurNom,
        createdAt: serverTimestamp()
      });
    });
  }
};

// ════════════════════════════════════════

// ════════════════════════════════════════
// CLOTURES DE CAISSE
// ════════════════════════════════════════
export const cloturesService = {
  async enregistrer(data: Omit<ClotureCaisse, "id" | "createdAt">, magasinId?: string | null): Promise<string> {
    const ref = await addDoc(collection(db, COLS.clotures), {
      ...data,
      magasinId: magasinId || null,
      createdAt: serverTimestamp(),
    });

    // Log the closure
    const cible = data.vendeurNom ? `caisse de ${data.vendeurNom}` : `caisse`;
    await auditService.enregistrer({
      type: "admin",
      action: "CLOTURE_CAISSE",
      details: `Clôture ${cible} du ${format(data.date, "dd/MM/yyyy")} par ${data.utilisateurNom}. Total: ${data.totalVentes} F`,
      utilisateurId: data.utilisateurId,
      utilisateurNom: data.utilisateurNom
    });

    return ref.id;
  },

  async getAll(vendeurId?: string, magasinId?: string | null): Promise<ClotureCaisse[]> {
    let q = query(collection(db, COLS.clotures), orderBy("date", "desc"));
    if (vendeurId) {
      q = query(collection(db, COLS.clotures), where("vendeurId", "==", vendeurId), orderBy("date", "desc"));
    }
    if (magasinId) {
      q = query(collection(db, COLS.clotures), where("magasinId", "==", magasinId), orderBy("date", "desc"));
      if (vendeurId) {
        q = query(collection(db, COLS.clotures), where("magasinId", "==", magasinId), where("vendeurId", "==", vendeurId), orderBy("date", "desc"));
      }
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      date: d.data().date ? toDate(d.data().date) : new Date(),
      createdAt: toDate(d.data().createdAt)
    } as ClotureCaisse));
  }
};

export const inventaireService = {
  async enregistrer(data: Omit<InventaireSession, "id" | "createdAt" | "updatedAt">, utilisateur: { uid: string; nom: string }, magasinId?: string | null): Promise<string> {
    const ref = await addDoc(collection(db, COLS.inventaires), {
      ...data,
      magasinId: magasinId || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await auditService.enregistrer({
      type: "stock",
      action: "INVENTAIRE_CREE",
      details: `Démarrage d'un nouvel inventaire le ${format(toDate(data.date), "dd/MM/yyyy")}`,
      utilisateurId: utilisateur.uid,
      utilisateurNom: utilisateur.nom,
    });

    return ref.id;
  },

  async getAll(magasinId?: string | null): Promise<InventaireSession[]> {
    let q = query(collection(db, COLS.inventaires), orderBy("createdAt", "desc"));
    if (magasinId) {
      q = query(collection(db, COLS.inventaires), where("magasinId", "==", magasinId), orderBy("createdAt", "desc"));
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      date: d.data().date ? toDate(d.data().date) : new Date(),
      createdAt: toDate(d.data().createdAt),
      updatedAt: toDate(d.data().updatedAt),
    } as InventaireSession));
  },

  async valider(id: string, utilisateurId: string, utilisateurNom: string): Promise<void> {
    const ref = doc(db, COLS.inventaires, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error("Inventaire non trouvé");
    const inv = snap.data() as InventaireSession;

    await runTransaction(db, async (tx) => {
      // 1. Lectures (Reads)
      const lignesAvecEcart = inv.lignes.filter(l => l.ecart !== 0);
      const productSnaps = await Promise.all(
        lignesAvecEcart.map(l => tx.get(doc(db, COLS.produits, l.produitId)))
      );

      // 2. Écritures (Writes) - Mettre à jour le stock réel de chaque produit
      lignesAvecEcart.forEach((ligne, i) => {
        const prodSnap = productSnaps[i];
        if (!prodSnap.exists()) return;

        const prodRef = doc(db, COLS.produits, ligne.produitId);

        // Mise à jour du stock
        tx.update(prodRef, {
          stockActuel: ligne.stockReel,
          updatedAt: serverTimestamp(),
        });

        // Enregistrer le mouvement d'ajustement
        const mvtRef = doc(collection(db, COLS.mouvements));
        tx.set(mvtRef, {
          produitId: ligne.produitId,
          produitRef: ligne.produitRef,
          produitNom: ligne.produitNom,
          type: "ajustement",
          quantite: Math.abs(ligne.ecart),
          stockAvant: ligne.stockTheorique,
          stockApres: ligne.stockReel,
          motif: `Régularisation inventaire #${id.slice(0, 8)}`,
          utilisateurId,
          utilisateurNom,
          createdAt: serverTimestamp(),
        });
      });

      // 3. Marquer l'inventaire comme validé
      tx.update(ref, {
        statut: "valide",
        updatedAt: serverTimestamp(),
      });
    });

    // Logging audit
    await auditService.enregistrer({
      type: "stock",
      action: "INVENTAIRE_VALIDE",
      details: `Inventaire #${id.slice(0, 8)} validé par ${utilisateurNom}.`,
      utilisateurId,
      utilisateurNom,
    });
  }
};

