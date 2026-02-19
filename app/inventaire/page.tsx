"use client";
import { useEffect, useState, useRef } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { produitsService, inventaireService, categoriesService } from "@/lib/db";
import type { Produit, InventaireSession, Categorie } from "@/types";
import { useAuth } from "@/lib/auth-context";
import {
    Search, Plus, Save, History, CheckCircle2,
    AlertCircle, ArrowRight, ClipboardList, Camera, Trash2
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import toast from "react-hot-toast";
import clsx from "clsx";
import dynamic from "next/dynamic";

const Scanner = dynamic(() => import("@/components/common/Scanner"), { ssr: false });

interface LigneInventaire {
    produitId: string;
    produitRef: string;
    produitNom: string;
    stockTheorique: number;
    stockReel: number;
    ecart: number;
}

export default function InventairePage() {
    const { appUser } = useAuth();
    const [produits, setProduits] = useState<Produit[]>([]);
    const [categories, setCategories] = useState<Categorie[]>([]);
    const [history, setHistory] = useState<InventaireSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<"nouveau" | "historique">("nouveau");
    const [search, setSearch] = useState("");
    const [showScanner, setShowScanner] = useState(false);

    // Form state
    const [lignes, setLignes] = useState<LigneInventaire[]>([]);
    const [notes, setNotes] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        Promise.all([
            produitsService.getAll(),
            categoriesService.getAll(),
            inventaireService.getAll()
        ]).then(([p, c, h]) => {
            setProduits(p);
            setCategories(c);
            setHistory(h);
            setLoading(false);
        });
    }, []);

    const addToInventaire = (p: Produit) => {
        if (lignes.find(l => l.produitId === p.id)) {
            toast.error("Déjà dans la liste");
            return;
        }
        const nouvelleLigne: LigneInventaire = {
            produitId: p.id,
            produitRef: p.reference,
            produitNom: p.designation,
            stockTheorique: p.stockActuel,
            stockReel: p.stockActuel, // Par défaut on suppose que c'est bon
            ecart: 0
        };
        setLignes(prev => [nouvelleLigne, ...prev]);
        setSearch("");
    };

    const updateStockReel = (id: string, val: string) => {
        const reel = parseInt(val) || 0;
        setLignes(prev => prev.map(l => {
            if (l.produitId === id) {
                return { ...l, stockReel: reel, ecart: reel - l.stockTheorique };
            }
            return l;
        }));
    };

    const removeLigne = (id: string) => {
        setLignes(prev => prev.filter(l => l.produitId !== id));
    };

    const handleSave = async () => {
        if (lignes.length === 0) return toast.error("Ajoutez des produits au comptage");
        if (!appUser) return;

        setIsSaving(true);
        try {
            await inventaireService.enregistrer({
                date: new Date(),
                utilisateurId: appUser.uid,
                utilisateurNom: `${appUser.prenom} ${appUser.nom}`,
                statut: "en_cours",
                lignes,
                notes
            });
            toast.success("Inventaire de session enregistré");
            // Refresh history
            inventaireService.getAll().then(setHistory);
            // Reset for next
            setLignes([]);
            setNotes("");
            setView("historique");
        } catch (err: any) {
            toast.error(err.message || "Erreur de sauvegarde");
        } finally {
            setIsSaving(false);
        }
    };

    const handleValider = async (inv: InventaireSession) => {
        if (!confirm("Voulez-vous valider cet inventaire ? Cela mettra à jour les stocks réels et créera des mouvements d'ajustement.")) return;
        if (!appUser) return;

        setLoading(true);
        try {
            await inventaireService.valider(inv.id, appUser.uid, `${appUser.prenom} ${appUser.nom}`);
            toast.success("Stocks mis à jour avec succès");
            inventaireService.getAll().then(setHistory);
        } catch (err: any) {
            toast.error(err.message || "Erreur de validation");
        } finally {
            setLoading(false);
        }
    };

    const filteredProduits = produits.filter(p =>
        p.designation.toLowerCase().includes(search.toLowerCase()) ||
        p.reference.toLowerCase().includes(search.toLowerCase())
    ).slice(0, 10);

    if (loading) return <AppLayout><div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-gold border-t-transparent rounded-full animate-spin" /></div></AppLayout>;

    return (
        <AppLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-mono tracking-widest text-ink-muted uppercase mb-1">Opérations</p>
                        <h2 className="font-display text-3xl font-semibold text-ink">Inventaire & Comptage</h2>
                    </div>
                    <div className="flex bg-cream p-1 rounded-xl">
                        <button
                            onClick={() => {
                                if (view === "nouveau") toast.success("Vous êtes déjà sur le formulaire de comptage");
                                setView("nouveau");
                            }}
                            className={clsx("px-4 py-2 rounded-lg text-sm font-medium transition-all", view === "nouveau" ? "bg-white text-gold shadow-sm" : "text-ink-muted hover:text-ink")}
                        >
                            <Plus size={16} className="inline mr-2" /> Nouveau
                        </button>
                        <button
                            onClick={() => setView("historique")}
                            className={clsx("px-4 py-2 rounded-lg text-sm font-medium transition-all", view === "historique" ? "bg-white text-gold shadow-sm" : "text-ink-muted hover:text-ink")}
                        >
                            <History size={16} className="inline mr-2" /> Historique
                        </button>
                    </div>
                </div>

                {view === "nouveau" ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Selector */}
                        <div className="lg:col-span-1 space-y-4">
                            <div className="card h-fit">
                                <h3 className="font-display font-bold text-ink mb-4 flex items-center gap-2">
                                    <Search size={18} className="text-gold" /> Chercher un produit
                                </h3>
                                <div className="space-y-3">
                                    <div className="relative">
                                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                                        <input
                                            value={search}
                                            onChange={e => setSearch(e.target.value)}
                                            placeholder="Référence ou nom..."
                                            className="input pl-10"
                                        />
                                        <button
                                            onClick={() => setShowScanner(true)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-cream hover:bg-gold/10 text-ink-muted hover:text-gold rounded-lg transition-colors"
                                        >
                                            <Camera size={16} />
                                        </button>
                                    </div>

                                    {search.length > 0 && (
                                        <div className="border border-cream-dark rounded-xl overflow-hidden divide-y divide-cream-dark bg-white shadow-xl animate-in fade-in slide-in-from-top-2">
                                            {filteredProduits.map(p => (
                                                <div
                                                    key={p.id}
                                                    onClick={() => addToInventaire(p)}
                                                    className="p-3 hover:bg-cream cursor-pointer flex justify-between items-center transition-colors group"
                                                >
                                                    <div>
                                                        <p className="text-xs font-bold text-ink group-hover:text-gold">{p.designation}</p>
                                                        <p className="text-[10px] text-ink-muted font-mono">{p.reference}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[10px] text-ink-muted uppercase">Stock: <span className="font-bold text-ink">{p.stockActuel}</span></p>
                                                    </div>
                                                </div>
                                            ))}
                                            {filteredProduits.length === 0 && <div className="p-4 text-center text-xs text-ink-muted">Aucun produit trouvé</div>}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="card bg-gold/5 border-gold/20">
                                <h4 className="text-xs font-black uppercase text-gold mb-2">Conseils</h4>
                                <ul className="text-[11px] text-ink-muted space-y-2 list-disc pl-4">
                                    <li>Scannez vos produits pour les ajouter rapidement.</li>
                                    <li>L'écart est calculé automatiquement (Réel - Théorique).</li>
                                    <li>Pensez à sauvegarder régulièrement votre session.</li>
                                </ul>
                            </div>
                        </div>

                        {/* List */}
                        <div className="lg:col-span-2 space-y-4">
                            <div className="card min-h-[500px] flex flex-col">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="font-display font-bold text-ink flex items-center gap-2">
                                        <ClipboardList size={20} className="text-gold" />
                                        Session de comptage ({lignes.length})
                                    </h3>
                                    {lignes.length > 0 && (
                                        <button onClick={() => setLignes([])} className="text-xs text-red-500 hover:text-red-700 underline font-medium">Tout vider</button>
                                    )}
                                </div>

                                <div className="flex-1 overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-cream/50 text-[10px] font-black uppercase tracking-widest text-ink-muted border-b border-cream-dark">
                                            <tr>
                                                <th className="px-4 py-3">Produit</th>
                                                <th className="px-4 py-3 text-center">Théorique</th>
                                                <th className="px-4 py-3 text-center">Réel</th>
                                                <th className="px-4 py-3 text-center">Écart</th>
                                                <th className="px-4 py-3 text-right"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-cream-dark">
                                            {lignes.map(l => (
                                                <tr key={l.produitId} className="hover:bg-cream/10 transition-colors">
                                                    <td className="px-4 py-4">
                                                        <p className="text-sm font-bold text-ink leading-tight">{l.produitNom}</p>
                                                        <p className="text-[10px] text-ink-muted font-mono">{l.produitRef}</p>
                                                    </td>
                                                    <td className="px-4 py-4 text-center font-mono text-ink-muted">{l.stockTheorique}</td>
                                                    <td className="px-4 py-4 text-center">
                                                        <input
                                                            type="number"
                                                            value={l.stockReel}
                                                            onChange={e => updateStockReel(l.produitId, e.target.value)}
                                                            className="w-20 text-center bg-white border border-cream-dark rounded-lg py-1.5 text-sm font-black focus:border-gold focus:ring-1 focus:ring-gold"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-4 text-center">
                                                        <span className={clsx(
                                                            "px-2 py-1 rounded-md text-[10px] font-black font-mono",
                                                            l.ecart > 0 ? "bg-green-100 text-green-700" :
                                                                l.ecart < 0 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"
                                                        )}>
                                                            {l.ecart > 0 ? `+${l.ecart}` : l.ecart}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-4 text-right">
                                                        <button onClick={() => removeLigne(l.produitId)} className="p-2 text-ink-muted hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {lignes.length === 0 && (
                                                <tr>
                                                    <td colSpan={5} className="py-20 text-center text-ink-muted italic opacity-50">
                                                        <ClipboardList size={48} className="mx-auto mb-4" />
                                                        Aucun produit ajouté à l'inventaire
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="mt-6 pt-6 border-t border-cream-dark space-y-4">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-ink-muted mb-2 block">Notes de session</label>
                                        <textarea
                                            value={notes}
                                            onChange={e => setNotes(e.target.value)}
                                            placeholder="Ex: Comptage rayon frais, écarts dus à..."
                                            className="input min-h-[80px]"
                                        />
                                    </div>
                                    <button
                                        disabled={lignes.length === 0 || isSaving}
                                        onClick={handleSave}
                                        className="btn-primary w-full py-4 flex items-center justify-center gap-3 text-base shadow-xl disabled:opacity-50"
                                    >
                                        <Save size={20} />
                                        Enregistrer l'inventaire
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="card p-0 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-cream/50 text-[10px] font-black uppercase tracking-widest text-ink-muted border-b border-cream-dark">
                                    <tr>
                                        <th className="px-6 py-4">Date & Session</th>
                                        <th className="px-6 py-4">Utilisateur</th>
                                        <th className="px-6 py-4">Produits</th>
                                        <th className="px-6 py-4 text-center">Statut</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-cream-dark">
                                    {history.map(inv => (
                                        <tr key={inv.id} className="hover:bg-cream/10 transition-colors group">
                                            <td className="px-6 py-4">
                                                <p className="text-sm font-bold text-ink">#{inv.id.slice(0, 8).toUpperCase()}</p>
                                                <p className="text-[10px] text-ink-muted">{format(inv.date, "dd MMMM yyyy HH:mm", { locale: fr })}</p>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-ink">{inv.utilisateurNom}</td>
                                            <td className="px-6 py-4 text-sm text-ink-muted">{inv.lignes.length} réfs</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={clsx(
                                                    "px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                                                    inv.statut === "valide" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                                                )}>
                                                    {inv.statut === "valide" ? "Validé" : "En cours"}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {inv.statut === "en_cours" && (
                                                    <button
                                                        onClick={() => handleValider(inv)}
                                                        className="btn-primary flex items-center gap-2 text-[10px] px-3 py-2 ml-auto"
                                                    >
                                                        <CheckCircle2 size={12} /> Valider les écarts
                                                    </button>
                                                )}
                                                {inv.statut === "valide" && (
                                                    <span className="text-xs text-green-600 font-medium flex items-center justify-end gap-1">
                                                        <CheckCircle2 size={14} /> Stocks à jour
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {history.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="py-20 text-center text-ink-muted italic opacity-50">Aucun historique d'inventaire</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {showScanner && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 p-4">
                        <div className="bg-white rounded-3xl p-6 w-full max-w-lg relative">
                            <button onClick={() => setShowScanner(false)} className="absolute -top-12 right-0 text-white hover:text-gold transition-colors">
                                <Plus size={32} className="rotate-45" />
                            </button>
                            <h3 className="font-display text-xl font-bold mb-4 text-center">Scanner un produit</h3>
                            <Scanner
                                onScan={(text) => {
                                    const prod = produits.find(p => p.reference === text);
                                    if (prod) {
                                        addToInventaire(prod);
                                        toast.success(`Produit trouvé: ${prod.designation}`);
                                    } else {
                                        toast.error(`Aucun produit avec la référence ${text}`);
                                    }
                                    setShowScanner(false);
                                }}
                                onClose={() => setShowScanner(false)}
                            />
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
