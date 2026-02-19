import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, setDoc,
  deleteDoc, query, where, orderBy, limit, runTransaction,
  serverTimestamp, Timestamp, onSnapshot, QueryConstraint
} from "firebase/firestore";
import { format } from "date-fns";
import { db } from "./firebase";
import type { Produit, Mouvement, Categorie, Client, Vente, Unite, Etablissement, Fournisseur, CommandeFournisseur, AppUser, TypeMouvement, AuditLog, ClotureCaisse, InventaireSession } from "@/types";

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
};

const toDate = (ts: any): Date =>
  ts instanceof Timestamp ? ts.toDate() : new Date(ts);

// ════════════════════════════════════════
// PRODUITS
// ════════════════════════════════════════
export const produitsService = {
  async getAll(): Promise<Produit[]> {
    const snap = await getDocs(query(collection(db, COLS.produits), orderBy("designation")));
    return snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        createdAt: toDate(data.createdAt),
        updatedAt: toDate(data.updatedAt),
        datePeremption: data.datePeremption ? toDate(data.datePeremption) : undefined
      } as Produit;
    });
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

  async create(data: Omit<Produit, "id" | "createdAt" | "updatedAt">): Promise<string> {
    const ref = await addDoc(collection(db, COLS.produits), {
      ...data,
      stockActuel: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  },

  async update(id: string, data: Partial<Produit>): Promise<void> {
    await updateDoc(doc(db, COLS.produits, id), { ...data, updatedAt: serverTimestamp() });
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, COLS.produits, id));
  },

  async getEnAlerte(): Promise<Produit[]> {
    const all = await this.getAll();
    return all.filter(p => p.stockActuel <= p.stockMinimum);
  },

  onSnapshot(callback: (produits: Produit[]) => void) {
    return onSnapshot(query(collection(db, COLS.produits), orderBy("designation")), snap => {
      callback(snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          createdAt: toDate(data.createdAt),
          updatedAt: toDate(data.updatedAt),
          datePeremption: data.datePeremption ? toDate(data.datePeremption) : undefined
        } as Produit;
      }));
    });
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

  async getRecents(limitN = 50): Promise<Mouvement[]> {
    const snap = await getDocs(query(collection(db, COLS.mouvements), orderBy("createdAt", "desc"), limit(limitN)));
    return snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: toDate(d.data().createdAt) } as Mouvement));
  },

  async getByProduit(produitId: string): Promise<Mouvement[]> {
    const snap = await getDocs(query(collection(db, COLS.mouvements), where("produitId", "==", produitId), orderBy("createdAt", "desc")));
    return snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: toDate(d.data().createdAt) } as Mouvement));
  },

  async getByPeriode(debut: Date, fin: Date): Promise<Mouvement[]> {
    const snap = await getDocs(query(
      collection(db, COLS.mouvements),
      where("createdAt", ">=", Timestamp.fromDate(debut)),
      where("createdAt", "<=", Timestamp.fromDate(fin)),
      orderBy("createdAt", "desc")
    ));
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

  onSnapshot(callback: (mouvements: Mouvement[]) => void) {
    return onSnapshot(query(collection(db, COLS.mouvements), orderBy("createdAt", "desc"), limit(100)), snap => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: toDate(d.data().createdAt) } as Mouvement)));
    });
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

  async create(data: Omit<Categorie, "id" | "createdAt">): Promise<string> {
    const ref = await addDoc(collection(db, COLS.categories), { ...data, createdAt: serverTimestamp() });
    return ref.id;
  },

  async update(id: string, data: Partial<Categorie>): Promise<void> {
    await updateDoc(doc(db, COLS.categories, id), data);
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, COLS.categories, id));
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

  async create(data: Omit<Unite, "id" | "createdAt">): Promise<string> {
    const ref = await addDoc(collection(db, COLS.unites), { ...data, createdAt: serverTimestamp() });
    return ref.id;
  },

  async update(id: string, data: Partial<Unite>): Promise<void> {
    await updateDoc(doc(db, COLS.unites, id), data);
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, COLS.unites, id));
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

  async save(data: Omit<Etablissement, "id" | "updatedAt">): Promise<void> {
    await setDoc(doc(db, COLS.configurations, "default"), { ...data, updatedAt: serverTimestamp() }, { merge: true });
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

  async create(data: Omit<Fournisseur, "id" | "createdAt">): Promise<string> {
    const ref = await addDoc(collection(db, COLS.fournisseurs), {
      ...data,
      soldeDette: 0,
      createdAt: serverTimestamp()
    });
    return ref.id;
  },

  async update(id: string, data: Partial<Fournisseur>): Promise<void> {
    await updateDoc(doc(db, COLS.fournisseurs, id), data);
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, COLS.fournisseurs, id));
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

  async getAll(): Promise<AppUser[]> {
    const snap = await getDocs(query(collection(db, COLS.utilisateurs), orderBy("nom")));
    return snap.docs.map(d => ({ uid: d.id, ...d.data(), createdAt: toDate(d.data().createdAt) } as AppUser));
  },

  async create(uid: string, data: Omit<AppUser, "uid" | "createdAt">): Promise<void> {
    await setDoc(doc(db, COLS.utilisateurs, uid), { ...data, createdAt: serverTimestamp() });
  },

  async count(): Promise<number> {
    const snap = await getDocs(collection(db, COLS.utilisateurs));
    return snap.size;
  },

  async update(uid: string, data: Partial<AppUser>): Promise<void> {
    await updateDoc(doc(db, COLS.utilisateurs, uid), data);
  },
};

// ════════════════════════════════════════
// CLIENTS
// ════════════════════════════════════════
export const clientsService = {
  async getAll(): Promise<Client[]> {
    const snap = await getDocs(query(collection(db, COLS.clients), orderBy("nom")));
    return snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: toDate(d.data().createdAt), derniereVisite: d.data().derniereVisite ? toDate(d.data().derniereVisite) : undefined } as Client));
  },

  async create(data: Omit<Client, "id" | "createdAt" | "totalAchats" | "soldeDette">): Promise<string> {
    const ref = await addDoc(collection(db, COLS.clients), {
      ...data,
      totalAchats: 0,
      soldeDette: 0,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  },

  async update(id: string, data: Partial<Client>): Promise<void> {
    await updateDoc(doc(db, COLS.clients, id), data);
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, COLS.clients, id));
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

  async getAll(): Promise<Vente[]> {
    const snap = await getDocs(query(collection(db, COLS.ventes), orderBy("createdAt", "desc")));
    return snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: toDate(d.data().createdAt) } as Vente));
  },

  async getForDateRange(start: Date, end: Date, utilisateurId?: string): Promise<Vente[]> {
    // On ne filtre plus par utilisateurId dans la requête Firestore pour éviter les index composites
    const q = query(
      collection(db, COLS.ventes),
      where("createdAt", ">=", start),
      where("createdAt", "<=", end)
    );

    const snap = await getDocs(q);
    let results = snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: toDate(d.data().createdAt) } as Vente));

    // Filtrage par utilisateur en mémoire
    if (utilisateurId) {
      results = results.filter(v => v.utilisateurId === utilisateurId);
    }

    // Tri en mémoire
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  async getRecent(limitN = 50): Promise<Vente[]> {
    const snap = await getDocs(query(collection(db, COLS.ventes), orderBy("createdAt", "desc"), limit(limitN)));
    return snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: toDate(d.data().createdAt) } as Vente));
  },

  async getStats(dateDebut: Date, dateFin: Date) {
    // Fetch all sales in range
    const q = query(
      collection(db, COLS.ventes),
      orderBy("createdAt", "desc"),
      where("createdAt", ">=", dateDebut),
      where("createdAt", "<=", dateFin)
    );
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

  onSnapshot(callback: (ventes: Vente[]) => void) {
    return onSnapshot(query(collection(db, COLS.ventes), orderBy("createdAt", "desc"), limit(100)), snap => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: toDate(d.data().createdAt) } as Vente)));
    });
  },
};

// --- Commandes Fournisseurs ---
export const commandesFournisseursService = {
  async create(data: Omit<CommandeFournisseur, "id" | "createdAt" | "updatedAt">): Promise<string> {
    const totalTTC = data.totalTTC;
    const montantPaye = data.montantPaye || 0;
    const resteAPayer = totalTTC - montantPaye;
    const statutPaiement = resteAPayer <= 0 ? "paye" : (montantPaye > 0 ? "partiel" : "en_attente");

    return await runTransaction(db, async (tx) => {
      const docRef = doc(collection(db, COLS.commandesFournisseurs));
      tx.set(docRef, {
        ...data,
        montantPaye,
        resteAPayer,
        statutPaiement,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Si c'est à crédit (reste à payer > 0), on augmente la dette du fournisseur
      if (resteAPayer > 0) {
        const fRef = doc(db, COLS.fournisseurs, data.fournisseurId);
        const fSnap = await tx.get(fRef);
        if (fSnap.exists()) {
          const solde = fSnap.data().soldeDette || 0;
          tx.update(fRef, { soldeDette: solde + resteAPayer });
        }
      }

      return docRef.id;
    });
  },

  async update(id: string, data: Partial<CommandeFournisseur>): Promise<void> {
    await updateDoc(doc(db, COLS.commandesFournisseurs, id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, COLS.commandesFournisseurs, id));
  },

  async getAll(): Promise<CommandeFournisseur[]> {
    const snap = await getDocs(collection(db, COLS.commandesFournisseurs));
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

  onSnapshot(fournisseurId: string, callback: (commandes: CommandeFournisseur[]) => void) {
    const q = query(
      collection(db, COLS.commandesFournisseurs),
      where("fournisseurId", "==", fournisseurId)
    );
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
  },

  // Enregistrer un paiement sur une commande
  async enregistrerPaiement(commandeId: string, montant: number, utilisateurId: string, utilisateurNom: string) {
    if (montant <= 0) throw new Error("Le montant du paiement doit être supérieur à 0");

    await runTransaction(db, async (tx) => {
      const cmdRef = doc(db, COLS.commandesFournisseurs, commandeId);
      const cmdSnap = await tx.get(cmdRef);
      if (!cmdSnap.exists()) throw new Error("Commande introuvable");

      const cmd = cmdSnap.data() as CommandeFournisseur;
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
      const fRef = doc(db, COLS.fournisseurs, cmd.fournisseurId);
      const fSnap = await tx.get(fRef);
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
// CLOTURES DE CAISSE
// ════════════════════════════════════════
export const cloturesService = {
  async enregistrer(data: Omit<ClotureCaisse, "id" | "createdAt">): Promise<string> {
    const ref = await addDoc(collection(db, COLS.clotures), {
      ...data,
      createdAt: serverTimestamp(),
    });

    // Log the closure
    await auditService.enregistrer({
      type: "admin",
      action: "CLOTURE_CAISSE",
      details: `Clôture du ${format(data.date, "dd/MM/yyyy")} par ${data.utilisateurNom}. Total: ${data.totalVentes} F`,
      utilisateurId: data.utilisateurId,
      utilisateurNom: data.utilisateurNom
    });

    return ref.id;
  },

  async getAll(): Promise<ClotureCaisse[]> {
    const snap = await getDocs(query(collection(db, COLS.clotures), orderBy("date", "desc")));
    return snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      date: d.data().date ? toDate(d.data().date) : new Date(),
      createdAt: toDate(d.data().createdAt)
    } as ClotureCaisse));
  }
};

export const inventaireService = {
  async enregistrer(data: Omit<InventaireSession, "id" | "createdAt" | "updatedAt">): Promise<string> {
    const ref = await addDoc(collection(db, COLS.inventaires), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  },

  async getAll(): Promise<InventaireSession[]> {
    const q = query(collection(db, COLS.inventaires), orderBy("createdAt", "desc"));
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
      // 1. Mettre à jour le stock réel de chaque produit
      for (const ligne of inv.lignes) {
        if (ligne.ecart === 0) continue;

        const prodRef = doc(db, COLS.produits, ligne.produitId);
        const prodSnap = await tx.get(prodRef);
        if (!prodSnap.exists()) continue;

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
      }

      // 2. Marquer l'inventaire comme validé
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
