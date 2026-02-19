"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { ventesService, cloturesService, utilisateursService } from "@/lib/db";
import type { Vente, ClotureCaisse, AppUser } from "@/types";
import { Save, Wallet, Calculator, AlertTriangle, CheckCircle2, History, ChevronRight, TrendingUp, User } from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";
import clsx from "clsx";

export default function CashClosurePage() {
    const { appUser } = useAuth();
    const [todaySales, setTodaySales] = useState<Vente[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [montantReel, setMontantReel] = useState<number>(0);
    const [note, setNote] = useState("");
    const [history, setHistory] = useState<ClotureCaisse[]>([]);
    const [activeTab, setActiveTab] = useState<"new" | "history">("new");
    const [vendeurs, setVendeurs] = useState<AppUser[]>([]);
    const [selectedSellerId, setSelectedSellerId] = useState<string>("");

    const isGestionnaire = appUser?.role === "admin" || appUser?.role === "gestionnaire";

    useEffect(() => {
        if (!appUser) return;

        // Initialiser l'utilisateur sélectionné si vide
        if (!selectedSellerId) {
            setSelectedSellerId(appUser.uid);
        }

        const start = startOfDay(new Date());
        const end = endOfDay(new Date());

        setLoading(true);
        Promise.all([
            ventesService.getForDateRange(start, end, selectedSellerId || appUser.uid),
            cloturesService.getAll(),
            isGestionnaire ? utilisateursService.getAll() : Promise.resolve([])
        ]).then(([sales, closures, users]) => {
            setTodaySales(sales);
            setHistory(closures);
            if (users.length > 0) setVendeurs(users);
            setLoading(false);

            // Calculer montant théorique initial (espèces attendues)
            const especes = sales
                .filter(v => v.modePaiement === "especes")
                .reduce((acc, v) => acc + (v.montantRecu || 0) - (v.monnaie || 0), 0);
            setMontantReel(especes);
        });
    }, [appUser, selectedSellerId, isGestionnaire]);

    const totals = {
        especes: todaySales.filter(v => v.modePaiement === "especes").reduce((acc, v) => acc + (v.montantRecu || 0) - (v.monnaie || 0), 0),
        mobile_money: todaySales.filter(v => v.modePaiement === "mobile_money").reduce((acc, v) => acc + v.totalTTC, 0),
        carte: todaySales.filter(v => v.modePaiement === "carte").reduce((acc, v) => acc + v.totalTTC, 0),
        credit: todaySales.filter(v => v.modePaiement === "credit").reduce((acc, v) => acc + v.totalTTC, 0),
        autre: todaySales.filter(v => v.modePaiement === "autre").reduce((acc, v) => acc + v.totalTTC, 0),
    };

    const totalVentes = Object.values(totals).reduce((a, b) => a + b, 0);
    const montantTheorique = totals.especes; // Ce qui doit être en caisse physiquement
    const ecart = montantReel - montantTheorique;

    const handleSave = async () => {
        if (!appUser) return;
        setSaving(true);
        try {
            const closureData: Omit<ClotureCaisse, "id" | "createdAt"> = {
                date: new Date(),
                totalVentes,
                nbVentes: todaySales.length,
                repartition: totals,
                montantTheorique,
                montantReel,
                ecart,
                note,
                utilisateurId: appUser.uid,
                utilisateurNom: `${appUser.prenom} ${appUser.nom}`
            };

            await cloturesService.enregistrer(closureData);
            toast.success("Rapport Z enregistré avec succès");
            setActiveTab("history");
            cloturesService.getAll().then(setHistory);
        } catch (err) {
            toast.error("Erreur lors de l'enregistrement");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <AppLayout><div className="flex items-center justify-center min-h-[400px]"><div className="w-8 h-8 border-4 border-gold border-t-transparent rounded-full animate-spin" /></div></AppLayout>;

    return (
        <AppLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div>
                            <p className="text-[10px] font-mono tracking-widest text-ink-muted uppercase mb-1">Finances & Comptabilité</p>
                            <h2 className="font-display text-3xl font-semibold text-ink">Clôture de Caisse</h2>
                        </div>
                        {activeTab === "new" && isGestionnaire && (
                            <div className="relative w-56 mt-4">
                                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gold" />
                                <select
                                    value={selectedSellerId}
                                    onChange={(e) => setSelectedSellerId(e.target.value)}
                                    className="input pl-9 text-xs border-gold/30 bg-gold/5 font-bold"
                                >
                                    <option value="">Sélectionner un vendeur</option>
                                    {vendeurs.map(v => (
                                        <option key={v.uid} value={v.uid}>{v.prenom} {v.nom}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                    <div className="flex bg-cream p-1 rounded-xl">
                        <button
                            onClick={() => setActiveTab("new")}
                            className={clsx("px-4 py-2 text-xs font-bold rounded-lg transition-all", activeTab === "new" ? "bg-white text-gold shadow-sm" : "text-ink-muted")}
                        >
                            Nouvelle Clôture
                        </button>
                        <button
                            onClick={() => setActiveTab("history")}
                            className={clsx("px-4 py-2 text-xs font-bold rounded-lg transition-all", activeTab === "history" ? "bg-white text-gold shadow-sm" : "text-ink-muted")}
                        >
                            Historique
                        </button>
                    </div>
                </div>

                {activeTab === "new" ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Summary & Form */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <ClosureKPI label="Total Ventes" value={totalVentes} color="gold" />
                                <ClosureKPI label="En Espèces" value={totals.especes} color="green" />
                                <ClosureKPI label="Mobile Money" value={totals.mobile_money} color="blue" />
                                <ClosureKPI label="Ventes Crédit" value={totals.credit} color="red" />
                            </div>

                            <div className="card shadow-xl border-cream-dark">
                                <h3 className="font-display text-lg font-bold text-ink mb-6 flex items-center gap-2">
                                    <Calculator size={18} className="text-gold" />
                                    Vérification du Fond de Caisse
                                </h3>

                                <div className="space-y-8">
                                    <div className="flex flex-col md:flex-row gap-8 items-center justify-between p-6 bg-cream/20 rounded-2xl border-2 border-dashed border-cream-dark">
                                        <div className="text-center md:text-left">
                                            <p className="text-[10px] uppercase font-black text-ink-muted tracking-widest mb-1">Montant Théorique (Espèces)</p>
                                            <p className="text-3xl font-black text-ink">{montantTheorique.toLocaleString()} F</p>
                                        </div>
                                        <div className="text-gold hidden md:block"><ChevronRight /></div>
                                        <div className="w-full md:w-48">
                                            <p className="text-[10px] uppercase font-black text-gold tracking-widest mb-1 text-center md:text-left">Montant Réel en Caisse</p>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    value={montantReel}
                                                    onChange={e => setMontantReel(Number(e.target.value))}
                                                    className="w-full text-2xl font-black bg-white border-2 border-gold rounded-xl p-3 focus:ring-0 outline-none text-gold"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-gold">F</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className={clsx(
                                        "p-6 rounded-2xl flex items-center justify-between",
                                        ecart === 0 ? "bg-green-50 border border-green-200" :
                                            ecart > 0 ? "bg-blue-50 border border-blue-200" : "bg-red-50 border border-red-200"
                                    )}>
                                        <div className="flex items-center gap-4">
                                            <div className={clsx(
                                                "w-10 h-10 rounded-full flex items-center justify-center",
                                                ecart === 0 ? "bg-green-100 text-green-600" :
                                                    ecart > 0 ? "bg-blue-100 text-blue-600" : "bg-red-100 text-red-600"
                                            )}>
                                                {ecart === 0 ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-ink">
                                                    {ecart === 0 ? "Caisse équilibrée" : ecart > 0 ? "Excédent de caisse" : "Manquant de caisse"}
                                                </p>
                                                <p className="text-xs text-ink-muted">Différence constatée entre le théorique et le réel</p>
                                            </div>
                                        </div>
                                        <p className={clsx("text-2xl font-black", ecart === 0 ? "text-green-600" : ecart > 0 ? "text-blue-600" : "text-red-600")}>
                                            {ecart > 0 ? "+" : ""}{ecart.toLocaleString()} F
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase font-black text-ink-muted tracking-widest pl-1">Notes / Observations</label>
                                        <textarea
                                            value={note}
                                            onChange={e => setNote(e.target.value)}
                                            placeholder="Ex: Erreur de rendu de monnaie le matin..."
                                            className="input min-h-[100px] py-3"
                                        />
                                    </div>

                                    <button
                                        disabled={saving || todaySales.length === 0}
                                        onClick={handleSave}
                                        className="btn-primary w-full py-4 text-lg font-black flex items-center justify-center gap-3 shadow-xl shadow-gold/20 disabled:opacity-50"
                                    >
                                        <Save size={20} />
                                        {saving ? "Enregistrement..." : "Valider la Clôture (Rapport Z)"}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Recent sales of today */}
                        <div className="space-y-4">
                            <h3 className="font-display font-bold text-ink flex items-center gap-2">
                                <History size={18} className="text-gold" />
                                Ventes du jour ({todaySales.length})
                            </h3>
                            <div className="card p-0 overflow-hidden divide-y divide-cream-dark max-h-[600px] overflow-y-auto">
                                {todaySales.map(v => (
                                    <div key={v.id} className="p-4 hover:bg-cream/10 transition-colors">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-[10px] font-mono text-ink-muted">#{v.id.slice(0, 8)}</span>
                                            <span className="text-xs font-bold text-ink">{v.totalTTC.toLocaleString()} F</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <p className="text-xs text-ink truncate max-w-[120px]">{v.clientNom}</p>
                                            <span className={clsx(
                                                "text-[9px] uppercase font-black px-1.5 py-0.5 rounded",
                                                v.modePaiement === "especes" ? "bg-green-100 text-green-700" :
                                                    v.modePaiement === "credit" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                                            )}>{v.modePaiement.replace("_", " ")}</span>
                                        </div>
                                    </div>
                                ))}
                                {todaySales.length === 0 && (
                                    <div className="p-8 text-center text-ink-muted italic text-sm">
                                        Aucune vente aujourd'hui
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    /* History Tab */
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {history.map(c => (
                                <div key={c.id} className="card hover:border-gold transition-all relative overflow-hidden group">
                                    {c.ecart !== 0 && (
                                        <div className={clsx(
                                            "absolute top-0 right-0 px-3 py-1 text-[10px] font-black uppercase rounded-bl-xl",
                                            c.ecart > 0 ? "bg-blue-500 text-white" : "bg-red-500 text-white"
                                        )}>
                                            Écart: {c.ecart.toLocaleString()} F
                                        </div>
                                    )}
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-12 h-12 bg-cream rounded-2xl flex items-center justify-center text-gold">
                                            <Calculator size={24} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-ink">{format(c.date, "dd MMMM yyyy", { locale: fr })}</p>
                                            <p className="text-xs text-ink-muted font-mono">{format(c.createdAt, "HH:mm")}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div className="bg-cream/30 p-2 rounded-lg">
                                            <p className="text-[10px] text-ink-muted uppercase font-bold">Total Ventes</p>
                                            <p className="text-sm font-black text-ink">{c.totalVentes.toLocaleString()} F</p>
                                        </div>
                                        <div className="bg-cream/30 p-2 rounded-lg">
                                            <p className="text-[10px] text-ink-muted uppercase font-bold">Espèces Réel</p>
                                            <p className="text-sm font-black text-gold">{c.montantReel.toLocaleString()} F</p>
                                        </div>
                                    </div>

                                    <div className="space-y-1 text-[10px] text-ink-muted border-t border-cream-dark pt-4">
                                        <div className="flex justify-between">
                                            <span>Par :</span>
                                            <span className="font-bold">{c.utilisateurNom}</span>
                                        </div>
                                        {c.nbVentes && (
                                            <div className="flex justify-between">
                                                <span>Nb Ventes :</span>
                                                <span className="font-bold">{c.nbVentes}</span>
                                            </div>
                                        )}
                                    </div>

                                    {c.note && (
                                        <p className="mt-3 text-[10px] bg-red-50/50 p-2 rounded-lg border border-red-100 italic text-ink-muted">
                                            "{c.note}"
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

function ClosureKPI({ label, value, color }: { label: string; value: number; color: "gold" | "green" | "blue" | "red" }) {
    const colors = {
        gold: "text-gold bg-gold/5 border-gold/20",
        green: "text-green-600 bg-green-50 border-green-100",
        blue: "text-blue-600 bg-blue-50 border-blue-100",
        red: "text-red-600 bg-red-50 border-red-100",
    }[color];

    return (
        <div className={clsx("card p-4 border flex flex-col items-center text-center", colors)}>
            <p className="text-[9px] uppercase font-black tracking-widest mb-1 opacity-70">{label}</p>
            <p className="text-lg font-black">{value.toLocaleString()} <span className="text-[10px] font-normal">F</span></p>
        </div>
    );
}
