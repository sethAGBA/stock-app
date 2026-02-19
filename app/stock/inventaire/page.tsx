"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { produitsService, mouvementsService } from "@/lib/db";
import type { Produit } from "@/types";
import { Search, Save, RotateCcw, AlertCircle, CheckCircle, Package } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";
import clsx from "clsx";

export default function InventairePage() {
    const { appUser } = useAuth();
    const [produits, setProduits] = useState<Produit[]>([]);
    const [search, setSearch] = useState("");
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(false);
    const [motif, setMotif] = useState("Réconciliation d'inventaire");

    useEffect(() => {
        produitsService.getAll().then(setProduits);
    }, []);

    const filtered = produits.filter(p =>
        p.designation.toLowerCase().includes(search.toLowerCase()) ||
        p.reference.toLowerCase().includes(search.toLowerCase())
    );

    const handleCountChange = (id: string, val: string) => {
        const num = parseInt(val);
        if (!isNaN(num)) {
            setCounts(prev => ({ ...prev, [id]: num }));
        } else if (val === "") {
            const newCounts = { ...counts };
            delete newCounts[id];
            setCounts(newCounts);
        }
    };

    const handleSave = async () => {
        const ids = Object.keys(counts);
        if (ids.length === 0) {
            toast.error("Aucun changement saisi");
            return;
        }
        if (!appUser) return;

        setLoading(true);
        try {
            const ajustements = ids.map(id => ({
                produitId: id,
                nouveauStock: counts[id],
                motif
            }));

            await mouvementsService.reconcilier(ajustements, { uid: appUser.uid, nom: `${appUser.prenom} ${appUser.nom}` });

            toast.success(`${ids.length} ajustement(s) enregistré(s)`);
            setCounts({});
            // Re-fetch products to show updated stock
            const updated = await produitsService.getAll();
            setProduits(updated);
        } catch (err: any) {
            toast.error(err.message || "Erreur lors de l'enregistrement");
        } finally {
            setLoading(false);
        }
    };

    const modifiedCount = Object.keys(counts).length;

    return (
        <AppLayout>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <p className="text-[10px] font-mono tracking-widest text-ink-muted uppercase mb-1">Mouvements</p>
                        <h2 className="font-display text-3xl font-semibold text-ink">Inventaire Physique</h2>
                        <p className="text-sm text-ink-muted mt-1">Saisissez les quantités réelles comptées en magasin.</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => { setCounts({}); setSearch(""); }}
                            className="btn-secondary flex items-center gap-2"
                            disabled={loading || modifiedCount === 0}
                        >
                            <RotateCcw size={15} /> Annuler
                        </button>
                        <button
                            onClick={handleSave}
                            className="btn-primary flex items-center gap-2"
                            disabled={loading || modifiedCount === 0}
                        >
                            <Save size={15} /> {loading ? "Enregistrement..." : `Enregistrer (${modifiedCount})`}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main List */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="card p-4 flex items-center gap-4 bg-white">
                            <div className="relative flex-1">
                                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                                <input
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Rechercher un produit à ajuster..."
                                    className="input pl-9"
                                />
                            </div>
                        </div>

                        <div className="card p-0 overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-cream-dark bg-cream">
                                        <th className="text-left px-4 py-3 label">Produit</th>
                                        <th className="text-right px-4 py-3 label">Stock Actuel</th>
                                        <th className="text-center px-4 py-3 label w-32">Compté</th>
                                        <th className="text-right px-4 py-3 label">Écart</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-cream-dark">
                                    {filtered.map(p => {
                                        const counted = counts[p.id];
                                        const diff = counted !== undefined ? counted - p.stockActuel : 0;
                                        return (
                                            <tr key={p.id} className={clsx("hover:bg-cream/20 transition-colors", counted !== undefined && "bg-gold/5")}>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-cream flex items-center justify-center text-gold shrink-0">
                                                            <Package size={14} />
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-ink leading-tight">{p.designation}</p>
                                                            <p className="text-[10px] font-mono text-ink-muted uppercase">{p.reference}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono">{p.stockActuel} {p.unite}</td>
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="number"
                                                        value={counted !== undefined ? counted : ""}
                                                        onChange={e => handleCountChange(p.id, e.target.value)}
                                                        placeholder="--"
                                                        className="w-full h-9 bg-white border border-cream-dark rounded-lg text-center font-bold focus:border-gold focus:ring-1 focus:ring-gold outline-none transition-all"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {counted !== undefined && (
                                                        <span className={clsx(
                                                            "font-bold text-[10px] px-1.5 py-0.5 rounded",
                                                            diff > 0 ? "bg-green-50 text-green-600" : diff < 0 ? "bg-red-50 text-red-600" : "bg-cream text-ink-muted"
                                                        )}>
                                                            {diff > 0 ? "+" : ""}{diff}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {filtered.length === 0 && (
                                <div className="p-12 text-center text-ink-muted opacity-40">
                                    Aucun produit trouvé
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sidebar Info */}
                    <div className="space-y-4">
                        <div className="card p-6 bg-gold/5 border-gold/20">
                            <h3 className="font-display font-semibold text-ink flex items-center gap-2 mb-4">
                                <AlertCircle size={18} className="text-gold" /> Récapitulatif
                            </h3>
                            <div className="space-y-4 mb-6">
                                <div className="flex justify-between items-center text-sm border-b border-cream-dark pb-2">
                                    <span className="text-ink-muted">Modifications</span>
                                    <span className="font-bold text-ink">{modifiedCount} produits</span>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] uppercase tracking-wider text-ink-muted">Motif de l'ajustement</label>
                                    <textarea
                                        value={motif}
                                        onChange={e => setMotif(e.target.value)}
                                        className="w-full bg-white border border-cream-dark rounded-xl p-3 text-sm focus:border-gold outline-none h-24 resize-none transition-all"
                                        placeholder="Pourquoi ajustez-vous le stock ?"
                                    />
                                </div>
                            </div>

                            <div className="p-4 bg-white rounded-xl border border-cream-dark">
                                <div className="flex items-start gap-3">
                                    <CheckCircle size={16} className="text-green-500 mt-0.5 shrink-0" />
                                    <p className="text-[11px] leading-relaxed text-ink-muted">
                                        L'enregistrement créera automatiquement des lignes de mouvements de type <strong>"Ajustement"</strong> pour chaque produit modifié, assurant une traçabilité totale.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
