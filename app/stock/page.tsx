"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { mouvementsService, produitsService, utilisateursService } from "@/lib/db";
import { useAuth } from "@/lib/auth-context";
import type { Mouvement, Produit, TypeMouvement, AppUser } from "@/types";
import { ArrowUpCircle, ArrowDownCircle, RefreshCw, X, Download, User } from "lucide-react";
import { exportToCSV } from "@/lib/export-utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import toast from "react-hot-toast";
import clsx from "clsx";
import ProductSearch from "@/components/common/ProductSearch";

export default function StockPage() {
  const { appUser, currentMagasinId } = useAuth();
  const [mouvements, setMouvements] = useState<Mouvement[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filtre, setFiltre] = useState<"tous" | TypeMouvement>("tous");
  const [filtreUtilisateur, setFiltreUtilisateur] = useState<string>("tous");
  const [users, setUsers] = useState<AppUser[]>([]);

  // Filtres de date
  const [dateDebut, setDateDebut] = useState<string>("");
  const [dateFin, setDateFin] = useState<string>("");
  const [isFiltered, setIsFiltered] = useState(false);

  const [form, setForm] = useState({
    produitId: "", type: "entree" as TypeMouvement,
    quantite: 1, motif: "",
  });

  useEffect(() => {
    if (!appUser) return;
    if (appUser.role !== "admin" && !currentMagasinId) return;

    // Si on a un filtre de date, on utilise getByPeriode (non temps-réel)
    if (dateDebut && dateFin) {
      setIsFiltered(true);
      const start = new Date(dateDebut);
      const end = new Date(dateFin);
      end.setHours(23, 59, 59);

      mouvementsService.getByPeriode(start, end, currentMagasinId).then(setMouvements);
      const unsubP = produitsService.onSnapshot(setProduits, currentMagasinId);
      utilisateursService.getAll(currentMagasinId).then(setUsers);
      return () => unsubP();
    } else {
      setIsFiltered(false);
      const unsubM = mouvementsService.onSnapshot(setMouvements, currentMagasinId);
      const unsubP = produitsService.onSnapshot(setProduits, currentMagasinId);
      utilisateursService.getAll(currentMagasinId).then(setUsers);
      return () => { unsubM(); unsubP(); };
    }
  }, [appUser, currentMagasinId, dateDebut, dateFin]);

  const filtered = mouvements.filter(m =>
    (filtre === "tous" || m.type === filtre) &&
    (filtreUtilisateur === "tous" || m.utilisateurId === filtreUtilisateur)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appUser) return;
    setLoading(true);
    try {
      await mouvementsService.enregistrer(
        form.produitId, form.type, form.quantite, form.motif,
        { uid: appUser.uid, nom: `${appUser.prenom} ${appUser.nom}` }
      );
      toast.success("Mouvement enregistré");
      setShowModal(false);
      setForm({ produitId: "", type: "entree", quantite: 1, motif: "" });
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const dataToExport = filtered.map(m => ({
      Type: m.type,
      Produit: m.produitNom,
      Reference: m.produitRef,
      Quantite: m.quantite,
      "Stock Avant": m.stockAvant,
      "Stock Apres": m.stockApres,
      Motif: m.motif,
      Utilisateur: m.utilisateurNom,
      Date: format(m.createdAt, "dd/MM/yyyy HH:mm")
    }));
    exportToCSV(dataToExport, "mouvements_stock");
    toast.success("Exportation terminée");
  };

  const produitSelected = produits.find(p => p.id === form.produitId);

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono tracking-widest text-ink-muted uppercase mb-1">Stock</p>
            <h2 className="font-display text-3xl font-semibold text-ink">Mouvements</h2>
          </div>
          <div className="flex flex-col md:flex-row gap-2 items-end">
            <div className="flex gap-2 items-center bg-white px-3 py-1.5 rounded-xl border border-cream-dark shadow-sm">
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
                  title="Réinitialiser"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex gap-2 items-center bg-white px-3 py-1.5 rounded-xl border border-cream-dark shadow-sm">
              <div className="flex items-center gap-2">
                <User size={14} className="text-ink-muted" />
                <select
                  value={filtreUtilisateur}
                  onChange={e => setFiltreUtilisateur(e.target.value)}
                  className="bg-transparent text-xs font-bold focus:outline-none min-w-[120px] appearance-none cursor-pointer"
                >
                  <option value="tous">Tous les opérateurs</option>
                  {users.map(u => (
                    <option key={u.uid} value={u.uid}>{u.prenom} {u.nom}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleExport}
                className="btn-secondary flex items-center gap-2"
                title="Exporter en CSV"
              >
                <Download size={18} />
                <span className="hidden md:inline">Exporter</span>
              </button>
              {(appUser?.role === "admin" || appUser?.role === "gestionnaire") && (
                <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
                  <RefreshCw size={14} /> Nouveau mouvement
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Filtres */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex gap-2 flex-wrap">
            {(["tous", "entree", "sortie", "usage_interne", "ajustement"] as const).map(f => (
              <button key={f} onClick={() => setFiltre(f)}
                className={clsx("px-4 py-1.5 rounded-full text-xs font-medium transition-all capitalize",
                  filtre === f ? "bg-gold text-white" : "bg-white text-ink-muted border border-cream-dark hover:border-gold"
                )}>
                {f === "tous" ? "Tous" : f === "entree" ? "Entrées" : f === "sortie" ? "Sorties" : f === "usage_interne" ? "Usages Internes" : "Ajustements"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 px-3 py-1 bg-cream/30 rounded-lg border border-cream-dark">
            <div className={clsx("w-2 h-2 rounded-full", isFiltered ? "bg-amber-400" : "bg-green-500 animate-pulse")} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
              {isFiltered ? "Mode Archive (Filtré)" : "Mode Temps Réel (100 derniers)"}
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cream-dark bg-cream">
                <th className="text-left px-4 py-3 text-xs font-mono uppercase tracking-wider text-ink-muted whitespace-nowrap">Action</th>
                <th className="text-left px-4 py-3 text-xs font-mono uppercase tracking-wider text-ink-muted whitespace-nowrap">Article</th>
                <th className="text-right px-4 py-3 text-xs font-mono uppercase tracking-wider text-ink-muted whitespace-nowrap">Quantité</th>
                <th className="text-right px-4 py-3 text-xs font-mono uppercase tracking-wider text-ink-muted whitespace-nowrap">Stock Initial</th>
                <th className="text-right px-4 py-3 text-xs font-mono uppercase tracking-wider text-ink-muted whitespace-nowrap">Stock Final</th>
                <th className="text-left px-4 py-3 text-xs font-mono uppercase tracking-wider text-ink-muted whitespace-nowrap">Motif / Commentaire</th>
                <th className="text-left px-4 py-3 text-xs font-mono uppercase tracking-wider text-ink-muted whitespace-nowrap">Opérateur</th>
                <th className="text-right px-4 py-3 text-xs font-mono uppercase tracking-wider text-ink-muted whitespace-nowrap">Date & Heure</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-dark">
              {filtered.map(m => (
                <tr key={m.id} className="hover:bg-cream/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className={clsx("w-7 h-7 rounded-full flex items-center justify-center",
                      m.type === "entree" ? "bg-green-100" : (m.type === "sortie" || m.type === "usage_interne") ? "bg-red-100" : "bg-amber-100"
                    )}>
                      {m.type === "entree"
                        ? <ArrowUpCircle size={15} className="text-green-600" />
                        : (m.type === "sortie" || m.type === "usage_interne")
                          ? <ArrowDownCircle size={15} className="text-red-600" />
                          : <RefreshCw size={15} className="text-amber-600" />}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{m.produitNom}</p>
                    <p className="text-xs text-ink-muted font-mono">{m.produitRef}</p>
                  </td>
                  <td className={clsx("px-4 py-3 text-right font-bold",
                    m.type === "entree" ? "text-green-600" :
                      (m.type === "sortie" || m.type === "usage_interne") ? "text-red-600" : "text-amber-600"
                  )}>
                    {m.type === "entree" ? "+" : (m.type === "sortie" || m.type === "usage_interne") ? "-" : ""}{m.quantite}
                  </td>
                  <td className="px-4 py-3 text-right text-ink-muted">{m.stockAvant}</td>
                  <td className="px-4 py-3 text-right font-medium text-ink">{m.stockApres}</td>
                  <td className="px-4 py-3 text-ink-muted max-w-[160px] truncate">{m.motif}</td>
                  <td className="px-4 py-3 text-ink-muted text-xs">{m.utilisateurNom}</td>
                  <td className="px-4 py-3 text-right text-xs font-mono text-ink-muted">
                    {format(m.createdAt, "dd/MM/yy HH:mm")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-16 text-ink-muted text-sm">Aucun mouvement</div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-cream-dark">
              <h3 className="font-display text-xl font-semibold">Nouveau mouvement</h3>
              <button onClick={() => setShowModal(false)}><X size={18} className="text-ink-muted" /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div>
                <label className="label">Type de mouvement *</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["entree", "sortie", "usage_interne", "ajustement"] as const).map(t => (
                    <button key={t} type="button"
                      onClick={() => setForm(f => ({ ...f, type: t }))}
                      className={clsx("py-2 rounded-lg text-xs font-medium capitalize border transition-all",
                        form.type === t ? "bg-gold text-white border-gold" : "border-cream-dark text-ink-muted hover:border-gold"
                      )}>
                      {t === "entree" ? "Entrée" : t === "sortie" ? "Sortie" : t === "usage_interne" ? "Usage Interne" : "Ajustement"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Produit *</label>
                <ProductSearch
                  produits={produits}
                  selectedId={form.produitId}
                  onSelect={(p: Produit) => setForm(f => ({ ...f, produitId: p.id }))}
                  required
                />
              </div>
              {produitSelected && (
                <div className="bg-cream rounded-lg px-4 py-3 text-sm">
                  <span className="text-ink-muted">Stock actuel : </span>
                  <span className="font-semibold text-ink">{produitSelected.stockActuel} {produitSelected.unite}</span>
                  <span className="text-ink-muted ml-4">Min : </span>
                  <span className="font-semibold text-ink">{produitSelected.stockMinimum}</span>
                </div>
              )}
              <div>
                <label className="label">Quantité *</label>
                <input type="number" min="1" required value={form.quantite}
                  onChange={e => setForm(f => ({ ...f, quantite: +e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">Motif *</label>
                <input required value={form.motif} onChange={e => setForm(f => ({ ...f, motif: e.target.value }))}
                  className="input" placeholder="Ex: Réception commande fournisseur" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Annuler</button>
                <button type="submit" disabled={loading} className="btn-primary flex-1">
                  {loading ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
