"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { sortiesCaisseService } from "@/lib/db";
import type { SortieCaisse } from "@/types";
import { Receipt, Plus, History, Calendar, User, Wallet } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";
import { formatPrice } from "@/lib/format";
import clsx from "clsx";

export default function SortiesCaissePage() {
    const { appUser, currentMagasinId } = useAuth();
    const [sorties, setSorties] = useState<SortieCaisse[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);

    // Form state
    const [montant, setMontant] = useState("");
    const [motif, setMotif] = useState("");
    const [categorie, setCategorie] = useState("Autres charges");
    const [beneficiaire, setBeneficiaire] = useState("");

    const CATEGORIES = [
        "Petit Déjeuner / Repas",
        "Factures (CEET, TDE, Tel)",
        "Loyers & Charges",
        "Salaires & Gratifications",
        "Maintenance & Réparations",
        "Achats Fournitures",
        "Transport",
        "Autres charges"
    ];

    useEffect(() => {
        if (!appUser) return;
        sortiesCaisseService.getAll(currentMagasinId).then(data => {
            setSorties(data);
            setLoading(false);
        });
    }, [appUser, currentMagasinId]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!appUser) return;
        if (!montant || !motif) return toast.error("Veuillez remplir les champs obligatoires");

        setSaving(true);
        try {
            await sortiesCaisseService.enregistrer({
                montant: Number(montant),
                motif,
                categorie,
                beneficiaire,
                utilisateurId: appUser.uid,
                utilisateurNom: `${appUser.prenom} ${appUser.nom}`,
                magasinId: currentMagasinId
            }, currentMagasinId);
            toast.success("Sortie de caisse enregistrée");
            setMontant("");
            setMotif("");
            setBeneficiaire("");
            setShowForm(false);
            const updated = await sortiesCaisseService.getAll(currentMagasinId);
            setSorties(updated);
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
                    <div>
                        <p className="text-[10px] font-mono tracking-widest text-ink-muted uppercase mb-1">Finances & Comptabilité</p>
                        <h2 className="font-display text-3xl font-semibold text-ink">Sorties de Caisse</h2>
                    </div>
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="btn-primary flex items-center gap-2"
                    >
                        <Plus size={18} />
                        Nouvelle Sortie
                    </button>
                </div>

                {showForm && (
                    <div className="card shadow-xl border-gold/20 bg-gold/5 animate-in fade-in slide-in-from-top-4 duration-300">
                        <h3 className="font-display text-lg font-bold text-ink mb-6 flex items-center gap-2">
                            <Wallet size={18} className="text-gold" />
                            Enregistrer une sortie de fonds
                        </h3>
                        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase font-black text-ink-muted tracking-widest pl-1">Montant (F CFA) *</label>
                                <input
                                    type="number"
                                    required
                                    value={montant}
                                    onChange={e => setMontant(e.target.value)}
                                    className="input text-lg font-bold"
                                    placeholder="0"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase font-black text-ink-muted tracking-widest pl-1">Catégorie *</label>
                                <select
                                    required
                                    value={categorie}
                                    onChange={e => setCategorie(e.target.value)}
                                    className="input"
                                >
                                    {CATEGORIES.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase font-black text-ink-muted tracking-widest pl-1">Motif / Justification *</label>
                                <input
                                    type="text"
                                    required
                                    value={motif}
                                    onChange={e => setMotif(e.target.value)}
                                    className="input"
                                    placeholder="Ex: Facture CEET, Petit déjeuner..."
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase font-black text-ink-muted tracking-widest pl-1">Bénéficiaire (Optionnel)</label>
                                <input
                                    type="text"
                                    value={beneficiaire}
                                    onChange={e => setBeneficiaire(e.target.value)}
                                    className="input"
                                    placeholder="Nom de la personne"
                                />
                            </div>
                            <div className="md:col-span-3 flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="px-6 py-2 text-sm font-bold text-ink-muted hover:text-ink transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="btn-primary px-8"
                                >
                                    {saving ? "Enregistrement..." : "Confirmer la sortie"}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="card p-0 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-cream/50 border-b border-cream-dark">
                                    <th className="p-4 text-[10px] uppercase font-black text-ink-muted tracking-widest">Date & Heure</th>
                                    <th className="p-4 text-[10px] uppercase font-black text-ink-muted tracking-widest">Catégorie</th>
                                    <th className="p-4 text-[10px] uppercase font-black text-ink-muted tracking-widest">Motif</th>
                                    <th className="p-4 text-[10px] uppercase font-black text-ink-muted tracking-widest">Bénéficiaire</th>
                                    <th className="p-4 text-[10px] uppercase font-black text-ink-muted tracking-widest text-right">Montant</th>
                                    <th className="p-4 text-[10px] uppercase font-black text-ink-muted tracking-widest text-right">Responsable</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-cream-dark">
                                {sorties.map(s => (
                                    <tr key={s.id} className="hover:bg-cream/10 transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <Calendar size={14} className="text-gold" />
                                                <span className="text-xs font-bold text-ink">
                                                    {format(s.createdAt, "dd/MM/yyyy HH:mm", { locale: fr })}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-xs font-bold text-ink-muted uppercase tracking-wider">
                                            <span className="px-2 py-1 bg-cream-dark/30 rounded border border-cream-dark/50">
                                                {s.categorie}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm text-ink font-medium">{s.motif}</td>
                                        <td className="p-4 text-sm text-ink-muted">{s.beneficiaire || "-"}</td>
                                        <td className="p-4 text-right">
                                            <span className="text-sm font-black text-red-600">-{formatPrice(s.montant)} F</span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2 text-[10px] text-ink-muted italic">
                                                <User size={12} />
                                                {s.utilisateurNom}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {sorties.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-12 text-center text-ink-muted italic">
                                            <div className="flex flex-col items-center gap-2">
                                                <Receipt size={32} className="opacity-20" />
                                                Aucune sortie de caisse enregistrée
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
