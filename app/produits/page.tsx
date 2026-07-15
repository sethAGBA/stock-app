"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { produitsService, categoriesService, fournisseursService, unitesService, utilisateursService } from "@/lib/db";
import type { Produit, Categorie, Fournisseur, Unite, AppUser } from "@/types";
import { Plus, Search, Edit2, Trash2, AlertTriangle, X, Camera, Tag, Download, ChevronDown, User } from "lucide-react";
import { exportToCSV, exportToExcel } from "@/lib/export";
import { useAuth } from "@/lib/auth-context";
import toast from "react-hot-toast";
import clsx from "clsx";
import dynamic from "next/dynamic";
import Link from "next/link";
import { formatPrice, formatCurrency } from "@/lib/format";

const Scanner = dynamic(() => import("@/components/common/Scanner"), { ssr: false });

export default function ProduitsPage() {
  const { appUser, currentMagasinId, magasins } = useAuth();
  const [produits, setProduits] = useState<Produit[]>([]);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [unites, setUnites] = useState<Unite[]>([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [editing, setEditing] = useState<Produit | null>(null);
  const [loading, setLoading] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<"search" | "form">("search");
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  // Filtres
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [filtreUtilisateur, setFiltreUtilisateur] = useState("tous");
  const [users, setUsers] = useState<AppUser[]>([]);

  const [form, setForm] = useState({
    reference: "", designation: "", description: "",
    categorieId: "", fournisseurId: "", unite: "pièce",
    magasinId: "",
    prixAchat: 0, prixVente: 0, prixVenteGros: 0,
    stockMinimum: 5, marque: "", emplacement: "",
    datePeremption: "",
  });

  const isGestionnaire = appUser?.role === "admin" || appUser?.role === "gestionnaire";
  const isAdmin = appUser?.role === "admin";

  useEffect(() => {
    if (!appUser) return;
    // Pour les non-admins, on attend d'avoir un magasinId avant de souscrire
    // pour éviter l'erreur de permission sur la requête globale.
    if (appUser.role !== "admin" && !currentMagasinId) return;

    const unsub = produitsService.onSnapshot(setProduits, currentMagasinId);
    categoriesService.getAll().then(setCategories);
    fournisseursService.getAll().then(setFournisseurs);
    unitesService.getAll().then(setUnites);
    utilisateursService.getAll(currentMagasinId).then(setUsers);
    return unsub;
  }, [appUser, currentMagasinId]);

  const handleScan = (decodedText: string) => {
    if (scannerTarget === "form") {
      setForm(f => ({ ...f, reference: decodedText }));
      toast.success(`Code scanné : ${decodedText}`);
    } else {
      setSearch(decodedText);
      toast.success(`Recherche de : ${decodedText}`);
    }
    setShowScanner(false);
  };

  const generateRef = () => {
    const prefix = "ART";
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    const newRef = `${prefix}-${timestamp}${random}`;
    setForm(f => ({ ...f, reference: newRef }));
    toast.success("Référence générée");
  };

  const filtered = produits.filter(p => {
    const matchSearch = p.designation.toLowerCase().includes(search.toLowerCase()) ||
      p.reference.toLowerCase().includes(search.toLowerCase());

    const matchUser = filtreUtilisateur === "tous" || p.utilisateurId === filtreUtilisateur;

    let matchDate = true;
    if (dateDebut && dateFin) {
      const start = new Date(dateDebut);
      const end = new Date(dateFin);
      end.setHours(23, 59, 59);
      const created = new Date(p.createdAt);
      matchDate = created >= start && created <= end;
    }

    return matchSearch && matchUser && matchDate;
  });

  const openCreate = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    const newRef = `ART-${timestamp}${random}`;

    setEditing(null);
    setForm({
      reference: newRef,
      designation: "", description: "",
      categorieId: "", fournisseurId: "", unite: "pièce",
      magasinId: currentMagasinId || "",
      prixAchat: 0, prixVente: 0, prixVenteGros: 0,
      stockMinimum: 5, marque: "", emplacement: "",
      datePeremption: ""
    });
    setShowModal(true);
  };

  const openEdit = (p: Produit) => {
    setEditing(p);
    const dateObj = p.datePeremption ? new Date(p.datePeremption) : null;
    const dateStr = (dateObj && !isNaN(dateObj.getTime()))
      ? dateObj.toISOString().split('T')[0]
      : "";

    setForm({
      reference: p.reference, designation: p.designation,
      description: p.description || "", categorieId: p.categorieId,
      fournisseurId: p.fournisseurId, unite: p.unite,
      magasinId: p.magasinId || currentMagasinId || "",
      prixAchat: p.prixAchat, prixVente: p.prixVente,
      prixVenteGros: p.prixVenteGros || 0,
      stockMinimum: p.stockMinimum,
      marque: p.marque || "",
      emplacement: p.emplacement || "",
      datePeremption: dateStr
    });
    setShowModal(true);
  };

  const handleExport = (exportFormat: "csv" | "excel") => {
    setIsExportMenuOpen(false);
    const dataToExport = filtered.map(p => ({
      Reference: p.reference,
      Designation: p.designation,
      Categorie: p.categorie || "",
      Fournisseur: p.fournisseur || "",
      Unite: p.unite,
      'Prix Achat': p.prixAchat,
      'Prix Vente': p.prixVente,
      'Stock Actuel': p.stockActuel,
      'Stock Minimum': p.stockMinimum,
      'Date Peremption': p.datePeremption ? new Date(p.datePeremption).toLocaleDateString() : ""
    }));

    if (exportFormat === "csv") {
      exportToCSV(dataToExport, "stock_produits");
    } else {
      exportToExcel(dataToExport, "stock_produits", "Stocks");
    }
    toast.success("Exportation terminée");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const cat = categories.find(c => c.id === form.categorieId);
      const four = fournisseurs.find(f => f.id === form.fournisseurId);
      const data = {
        ...form,
        categorie: cat?.nom || "",
        fournisseur: four?.nom || "",
        datePeremption: form.datePeremption ? new Date(form.datePeremption) : null,
        magasinId: form.magasinId || currentMagasinId || null
      };
      if (editing) {
        await produitsService.update(editing.id, data as any, { uid: appUser!.uid, nom: `${appUser!.prenom} ${appUser!.nom}` });
        toast.success("Produit modifié");
      } else {
        await produitsService.create(data as any, { uid: appUser!.uid, nom: `${appUser!.prenom} ${appUser!.nom}` }, form.magasinId || currentMagasinId);
        toast.success("Produit créé");
      }
      setShowModal(false);
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const p = produits.find(item => item.id === id);
    if (!p || !confirm(`Supprimer le produit "${p.designation}" ?`)) return;
    await produitsService.delete(id, p.designation, { uid: appUser!.uid, nom: `${appUser!.prenom} ${appUser!.nom}` });
    toast.success("Produit supprimé");
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono tracking-widest text-ink-muted uppercase mb-1">Catalogue</p>
            <h2 className="font-display text-3xl font-semibold text-ink">Produits</h2>
          </div>
          <div className="flex gap-2">
            <Link href="/produits/etiquettes" className="btn-secondary flex items-center gap-2">
              <Tag size={15} /> Étiquettes
            </Link>
            {isGestionnaire && (
              <div className="flex gap-2">
                <div className="relative">
                  <button
                    onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                    className="btn-secondary flex items-center gap-2 whitespace-nowrap"
                    title="Exporter"
                  >
                    <Download size={18} />
                    <span className="hidden md:inline">Exporter</span>
                    <ChevronDown size={14} className={clsx("transition-transform", isExportMenuOpen && "rotate-180")} />
                  </button>

                  {isExportMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setIsExportMenuOpen(false)}></div>
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-cream-dark z-20 overflow-hidden transform origin-top-right transition-all">
                        <button
                          onClick={() => handleExport("excel")}
                          className="w-full text-left px-4 py-3 hover:bg-cream/30 text-sm font-bold text-ink transition-colors flex items-center gap-2"
                        >
                          Format Excel (.xlsx)
                        </button>
                        <button
                          onClick={() => handleExport("csv")}
                          className="w-full text-left px-4 py-3 hover:bg-cream/30 text-sm font-bold text-ink transition-colors border-t border-cream-dark flex items-center gap-2"
                        >
                          Format CSV (.csv)
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <button onClick={openCreate} className="btn-primary flex items-center gap-2 whitespace-nowrap">
                  <Plus size={18} />
                  <span className="hidden md:inline">Article</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="relative flex-1 flex gap-2 w-full">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher par référence ou nom..." className="input pl-9" />
              </div>
              <button
                onClick={() => { setScannerTarget("search"); setShowScanner(true); }}
                className="p-3 bg-gold/10 text-gold rounded-xl hover:bg-gold/20 transition-colors"
                title="Scanner un code-barres"
              >
                <Camera size={18} />
              </button>
            </div>

            <div className="flex flex-col md:flex-row gap-2 items-end w-full md:w-auto">
              {/* Filtre Date */}
              <div className="flex gap-2 items-center bg-white px-3 py-1.5 rounded-xl border border-cream-dark shadow-sm w-full md:w-auto">
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase font-black text-ink-muted px-1">Du</span>
                  <input
                    type="date"
                    value={dateDebut}
                    onChange={e => setDateDebut(e.target.value)}
                    className="bg-transparent text-xs font-bold focus:outline-none"
                  />
                </div>
                <div className="w-px h-6 bg-cream-dark mx-1" />
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase font-black text-ink-muted px-1">Au</span>
                  <input
                    type="date"
                    value={dateFin}
                    onChange={e => setDateFin(e.target.value)}
                    className="bg-transparent text-xs font-bold focus:outline-none"
                  />
                </div>
                {(dateDebut || dateFin) && (
                  <button
                    onClick={() => { setDateDebut(""); setDateFin(""); }}
                    className="p-1 hover:bg-red-50 text-red-500 rounded-md transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Filtre Utilisateur */}
              <div className="flex gap-2 items-center bg-white px-3 py-1.5 rounded-xl border border-cream-dark shadow-sm w-full md:w-auto">
                <div className="flex items-center gap-2">
                  <User size={14} className="text-ink-muted" />
                  <select
                    value={filtreUtilisateur}
                    onChange={e => setFiltreUtilisateur(e.target.value)}
                    className="bg-transparent text-xs font-bold focus:outline-none min-w-[120px] appearance-none cursor-pointer"
                  >
                    <option value="tous">Tous les auteurs</option>
                    {users.map(u => (
                      <option key={u.uid} value={u.uid}>{u.prenom} {u.nom}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {showScanner && (
          <Scanner onScan={handleScan} onClose={() => setShowScanner(false)} />
        )}

        {/* Table */}
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cream-dark bg-cream">
                <th className="text-left px-4 py-3 text-xs font-mono uppercase tracking-wider text-ink-muted whitespace-nowrap">Référence</th>
                <th className="text-left px-4 py-3 text-xs font-mono uppercase tracking-wider text-ink-muted whitespace-nowrap">Désignation</th>
                <th className="text-left px-4 py-3 text-xs font-mono uppercase tracking-wider text-ink-muted whitespace-nowrap">Catégorie</th>
                <th className="text-right px-4 py-3 text-xs font-mono uppercase tracking-wider text-ink-muted whitespace-nowrap">Stock actuel</th>
                <th className="text-right px-4 py-3 text-xs font-mono uppercase tracking-wider text-ink-muted whitespace-nowrap">Prix de Vente</th>
                <th className="text-right px-4 py-3 text-xs font-mono uppercase tracking-wider text-ink-muted whitespace-nowrap">Statut</th>
                {(isGestionnaire || isAdmin) && <th className="px-4 py-3"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-dark">
              {filtered.map(p => {
                const alerteStock = p.stockActuel <= p.stockMinimum;
                const expiration = p.datePeremption ? new Date(p.datePeremption) : null;
                const isExpired = expiration ? expiration < new Date() : false;
                const isNearExpiry = expiration ? (expiration.getTime() - new Date().getTime()) < (30 * 24 * 60 * 60 * 1000) : false;

                return (
                  <tr key={p.id} className="hover:bg-cream/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                      {p.reference}
                      {p.emplacement && <div className="text-[9px] text-gold uppercase mt-0.5">{p.emplacement}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{p.designation}</div>
                      {p.marque && <div className="text-[10px] text-ink-muted uppercase">{p.marque}</div>}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{p.categorie}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      <span className={alerteStock ? "text-red-600" : "text-ink"}>{p.stockActuel}</span>
                      <span className="text-ink-muted text-xs ml-1">{p.unite}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-ink">{formatPrice(p.prixVente)} F</div>
                      {p.prixVenteGros && <div className="text-[10px] text-ink-muted">Gros: {formatPrice(p.prixVenteGros)} F</div>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col items-end gap-1">
                        {alerteStock && <span className="badge-alerte flex items-center gap-1 justify-end"><AlertTriangle size={10} /> Stock</span>}
                        {isExpired && <span className="bg-red-600 text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase">Périmé</span>}
                        {isNearExpiry && !isExpired && <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Expire bientôt</span>}
                        {!alerteStock && !isExpired && !isNearExpiry && <span className="badge-ok">OK</span>}
                      </div>
                    </td>
                    {(isGestionnaire || isAdmin) && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          {isGestionnaire && (
                            <button onClick={() => openEdit(p)} className="p-1.5 text-ink-muted hover:text-gold transition-colors rounded-md hover:bg-gold/10">
                              <Edit2 size={13} />
                            </button>
                          )}
                          {isAdmin && (
                            <button onClick={() => handleDelete(p.id)} className="p-1.5 text-ink-muted hover:text-red-500 transition-colors rounded-md hover:bg-red-50">
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-16 text-ink-muted">
              <p className="text-sm">Aucun produit trouvé</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-cream-dark">
              <h3 className="font-display text-xl font-semibold">{editing ? "Modifier le produit" : "Nouveau produit"}</h3>
              <button onClick={() => setShowModal(false)} className="text-ink-muted hover:text-ink"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label text-xs">Référence (Code-barres) *</label>
                  <div className="flex gap-2">
                    <input required value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                      className="input flex-1" placeholder="REF-001" />
                    <button type="button" onClick={() => { setScannerTarget("form"); setShowScanner(true); }}
                      className="p-3 bg-cream hover:bg-gold/10 text-gold rounded-xl transition-colors" title="Scanner">
                      <Camera size={16} />
                    </button>
                    <button type="button" onClick={generateRef}
                      className="p-3 bg-cream hover:bg-gold/10 text-gold rounded-xl transition-colors text-[10px] font-bold" title="Générer">
                      AUTO
                    </button>
                  </div>
                </div>
                <div>
                  <label className="label">Unité *</label>
                  <select value={form.unite} onChange={e => setForm(f => ({ ...f, unite: e.target.value }))} className="input">
                    {unites.length > 0 ? (
                      unites.map(u => <option key={u.id} value={u.nom}>{u.nom} ({u.abreviation})</option>)
                    ) : (
                      <option value="pièce">pièce (Défaut)</option>
                    )}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Désignation *</label>
                <input required value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} className="input" placeholder="Nom du produit" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Catégorie</label>
                  <select value={form.categorieId} onChange={e => setForm(f => ({ ...f, categorieId: e.target.value }))} className="input">
                    <option value="">Sélectionner...</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Fournisseur</label>
                  <select value={form.fournisseurId} onChange={e => setForm(f => ({ ...f, fournisseurId: e.target.value }))} className="input">
                    <option value="">Sélectionner...</option>
                    {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="label">Magasin (affectation)</label>
                  <select value={form.magasinId} onChange={e => setForm(f => ({ ...f, magasinId: e.target.value }))} className="input">
                    <option value="">Aucun (Global)</option>
                    {magasins.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
                  </select>
                  <p className="text-[9px] text-ink-muted italic px-1 mt-1">Laisser vide pour rendre cet article disponible globalement.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Marque / Fabricant</label>
                  <input value={form.marque} onChange={e => setForm(f => ({ ...f, marque: e.target.value }))} className="input" placeholder="ex: FanMilk, Toyota..." />
                </div>
                <div>
                  <label className="label">Emplacement (Stock)</label>
                  <input value={form.emplacement} onChange={e => setForm(f => ({ ...f, emplacement: e.target.value }))} className="input" placeholder="ex: Rayon A, Étagère 3" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">Prix achat (F)</label>
                  <input type="number" min="0" value={form.prixAchat} onChange={e => setForm(f => ({ ...f, prixAchat: +e.target.value }))} className="input" />
                </div>
                <div>
                  <label className="label">Prix Détail (F)</label>
                  <input type="number" min="0" value={form.prixVente} onChange={e => setForm(f => ({ ...f, prixVente: +e.target.value }))} className="input" />
                </div>
                <div>
                  <label className="label">Prix Gros (F)</label>
                  <input type="number" min="0" value={form.prixVenteGros} onChange={e => setForm(f => ({ ...f, prixVenteGros: +e.target.value }))} className="input" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Stock min.</label>
                  <input type="number" min="0" value={form.stockMinimum} onChange={e => setForm(f => ({ ...f, stockMinimum: +e.target.value }))} className="input" />
                </div>
                <div>
                  <label className="label">Date de péremption</label>
                  <input type="date" value={form.datePeremption} onChange={e => setForm(f => ({ ...f, datePeremption: e.target.value }))} className="input" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Annuler</button>
                <button type="submit" disabled={loading} className="btn-primary flex-1">{loading ? "Enregistrement..." : "Enregistrer"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
