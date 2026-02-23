"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { mouvementsService, produitsService } from "@/lib/db";
import { useAuth } from "@/lib/auth-context";
import type { Mouvement, Produit } from "@/types";
import { ArrowUpCircle, ArrowDownCircle, RefreshCw, X, Download } from "lucide-react";
import { exportToCSV } from "@/lib/export-utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import toast from "react-hot-toast";
import clsx from "clsx";

export default function StockPage() {
  const { appUser, currentMagasinId } = useAuth();
  const [mouvements, setMouvements] = useState<Mouvement[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filtre, setFiltre] = useState<"tous" | "entree" | "sortie" | "ajustement">("tous");

  const [form, setForm] = useState({
    produitId: "", type: "entree" as "entree" | "sortie" | "ajustement",
    quantite: 1, motif: "",
  });

  useEffect(() => {
    if (!appUser) return;
    if (appUser.role !== "admin" && !currentMagasinId) return;

    const unsubM = mouvementsService.onSnapshot(setMouvements, currentMagasinId);
    const unsubP = produitsService.onSnapshot(setProduits, currentMagasinId);
    return () => { unsubM(); unsubP(); };
  }, [appUser, currentMagasinId]);

  const filtered = mouvements.filter(m => filtre === "tous" || m.type === filtre);

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

        {/* Filtres */}
        <div className="flex gap-2">
          {(["tous", "entree", "sortie", "ajustement"] as const).map(f => (
            <button key={f} onClick={() => setFiltre(f)}
              className={clsx("px-4 py-1.5 rounded-full text-xs font-medium transition-all capitalize",
                filtre === f ? "bg-gold text-white" : "bg-white text-ink-muted border border-cream-dark hover:border-gold"
              )}>
              {f === "tous" ? "Tous" : f === "entree" ? "Entrées" : f === "sortie" ? "Sorties" : "Ajustements"}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cream-dark bg-cream">
                <th className="text-left px-4 py-3 label">Type</th>
                <th className="text-left px-4 py-3 label">Produit</th>
                <th className="text-right px-4 py-3 label">Quantité</th>
                <th className="text-right px-4 py-3 label">Stock avant</th>
                <th className="text-right px-4 py-3 label">Stock après</th>
                <th className="text-left px-4 py-3 label">Motif</th>
                <th className="text-left px-4 py-3 label">Utilisateur</th>
                <th className="text-right px-4 py-3 label">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-dark">
              {filtered.map(m => (
                <tr key={m.id} className="hover:bg-cream/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className={clsx("w-7 h-7 rounded-full flex items-center justify-center",
                      m.type === "entree" ? "bg-green-100" : m.type === "sortie" ? "bg-red-100" : "bg-amber-100"
                    )}>
                      {m.type === "entree"
                        ? <ArrowUpCircle size={15} className="text-green-600" />
                        : m.type === "sortie"
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
                      m.type === "sortie" ? "text-red-600" : "text-amber-600"
                  )}>
                    {m.type === "entree" ? "+" : m.type === "sortie" ? "-" : ""}{m.quantite}
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
                <div className="grid grid-cols-3 gap-2">
                  {(["entree", "sortie", "ajustement"] as const).map(t => (
                    <button key={t} type="button"
                      onClick={() => setForm(f => ({ ...f, type: t }))}
                      className={clsx("py-2 rounded-lg text-xs font-medium capitalize border transition-all",
                        form.type === t ? "bg-gold text-white border-gold" : "border-cream-dark text-ink-muted hover:border-gold"
                      )}>
                      {t === "entree" ? "Entrée" : t === "sortie" ? "Sortie" : "Ajustement"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Produit *</label>
                <select required value={form.produitId} onChange={e => setForm(f => ({ ...f, produitId: e.target.value }))} className="input">
                  <option value="">Sélectionner un produit...</option>
                  {produits.map(p => <option key={p.id} value={p.id}>{p.designation} — stock: {p.stockActuel} {p.unite}</option>)}
                </select>
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
