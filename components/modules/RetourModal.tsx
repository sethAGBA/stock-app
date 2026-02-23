"use client";
import { useState, useEffect } from "react";
import { X, RotateCcw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { retoursService } from "@/lib/db";
import type { Vente, LigneVente, RetourClient } from "@/types";
import { useAuth } from "@/lib/auth-context";
import toast from "react-hot-toast";
import { formatCurrency } from "@/lib/format";
import clsx from "clsx";

interface Props {
    vente: Vente;
    onClose: () => void;
    onSuccess: () => void;
}

export default function RetourModal({ vente, onClose, onSuccess }: Props) {
    const { appUser, currentMagasinId } = useAuth();
    const [lignesRetour, setLignesRetour] = useState<{ [key: string]: number }>({});
    const [motif, setMotif] = useState("");
    const [remboursementMode, setRemboursementMode] = useState<RetourClient["remboursementMode"]>("especes");
    const [loading, setLoading] = useState(false);

    // Initialiser les quantités à 0
    useEffect(() => {
        const initial: { [key: string]: number } = {};
        vente.lignes.forEach(l => {
            initial[l.produitId] = 0;
        });
        setLignesRetour(initial);
    }, [vente]);

    const totalRetour = vente.lignes.reduce((acc, l) => {
        const qte = lignesRetour[l.produitId] || 0;
        return acc + (qte * l.prixUnitaire);
    }, 0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!appUser) return;

        const itemsToReturn = vente.lignes
            .filter(l => (lignesRetour[l.produitId] || 0) > 0)
            .map(l => ({
                produitId: l.produitId,
                produitRef: l.produitRef,
                produitNom: l.produitNom,
                quantite: lignesRetour[l.produitId],
                prixUnitaire: l.prixUnitaire,
                total: (lignesRetour[l.produitId] || 0) * l.prixUnitaire
            }));

        if (itemsToReturn.length === 0) {
            toast.error("Veuillez sélectionner au moins un article à retourner");
            return;
        }

        setLoading(true);
        try {
            await retoursService.enregistrer({
                venteId: vente.id,
                clientId: vente.clientId,
                clientNom: vente.clientNom || "Client passage",
                lignes: itemsToReturn,
                totalHT: totalRetour, // On simplifie HT/TTC ici
                totalTTC: totalRetour,
                remboursementMode,
                motif,
                utilisateurId: appUser.uid,
                utilisateurNom: `${appUser.prenom} ${appUser.nom}`,
                magasinId: currentMagasinId
            });

            toast.success("Retour enregistré avec succès");
            onSuccess();
            onClose();
        } catch (err: any) {
            toast.error(err.message || "Erreur lors de l'enregistrement du retour");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-cream-dark animate-in zoom-in-95 duration-300">
                <div className="p-6 border-b border-cream-dark flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
                            <RotateCcw className="text-gold" size={20} />
                        </div>
                        <div>
                            <h3 className="font-display text-xl font-bold text-ink">Retour Client</h3>
                            <p className="text-[10px] text-ink-muted uppercase tracking-widest font-black">
                                Ticket #{vente.id.slice(0, 8).toUpperCase()}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-cream rounded-full transition-colors">
                        <X size={20} className="text-ink-muted" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                        <table className="w-full text-left">
                            <thead className="text-[10px] uppercase font-black text-ink-muted tracking-widest border-b border-cream-dark">
                                <tr>
                                    <th className="pb-2">Produit</th>
                                    <th className="pb-2 text-center">Acheté</th>
                                    <th className="pb-2 text-center">À retourner</th>
                                    <th className="pb-2 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-cream-dark">
                                {vente.lignes.map(l => (
                                    <tr key={l.produitId} className="group">
                                        <td className="py-3">
                                            <p className="font-bold text-ink text-sm">{l.produitNom}</p>
                                            <p className="text-[10px] text-ink-muted font-mono">{l.produitRef}</p>
                                        </td>
                                        <td className="py-3 text-center text-sm font-medium">{l.quantite}</td>
                                        <td className="py-3 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setLignesRetour(prev => ({ ...prev, [l.produitId]: Math.max(0, prev[l.produitId] - 1) }))}
                                                    className="w-8 h-8 rounded-lg bg-cream hover:bg-cream-dark flex items-center justify-center text-ink transition-colors"
                                                >
                                                    -
                                                </button>
                                                <span className="w-6 text-sm font-bold">{lignesRetour[l.produitId] || 0}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setLignesRetour(prev => ({ ...prev, [l.produitId]: Math.min(l.quantite, prev[l.produitId] + 1) }))}
                                                    className="w-8 h-8 rounded-lg bg-cream hover:bg-cream-dark flex items-center justify-center text-ink transition-colors"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </td>
                                        <td className="py-3 text-right font-bold text-ink">
                                            {formatCurrency((lignesRetour[l.produitId] || 0) * l.prixUnitaire)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] uppercase font-black text-ink-muted tracking-widest pl-1">Motif du retour *</label>
                                <textarea
                                    required
                                    value={motif}
                                    onChange={e => setMotif(e.target.value)}
                                    className="input min-h-[100px] resize-none py-3"
                                    placeholder="Ex: Produit défectueux, Erreur de taille..."
                                />
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] uppercase font-black text-ink-muted tracking-widest pl-1">Mode de remboursement</label>
                                <div className="grid grid-cols-1 gap-2 mt-1">
                                    {[
                                        { id: "especes", label: "Espèces / Cash", icon: CheckCircle2 },
                                        { id: "credit_reduc", label: "Déduction de dette", icon: CheckCircle2 },
                                        { id: "avoir", label: "Avoir (Non implémenté)", icon: CheckCircle2, disabled: true },
                                    ].map(mode => (
                                        <button
                                            key={mode.id}
                                            type="button"
                                            disabled={mode.disabled}
                                            onClick={() => setRemboursementMode(mode.id as any)}
                                            className={clsx(
                                                "flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left",
                                                remboursementMode === mode.id
                                                    ? "border-gold bg-gold/5 text-ink"
                                                    : "border-cream-dark text-ink-muted hover:border-cream-darker",
                                                mode.disabled && "opacity-50 cursor-not-allowed"
                                            )}
                                        >
                                            <mode.icon size={16} className={remboursementMode === mode.id ? "text-gold" : "text-ink-muted"} />
                                            <span className="text-xs font-bold">{mode.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-cream/30 p-4 rounded-2xl flex items-center justify-between">
                        <div>
                            <p className="text-[10px] uppercase font-black text-ink-muted tracking-widest">Total Remboursement</p>
                            <p className="text-2xl font-display font-black text-ink">{formatCurrency(totalRetour)}</p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="btn-secondary px-6"
                            >
                                Annuler
                            </button>
                            <button
                                type="submit"
                                disabled={loading || totalRetour === 0}
                                className="btn-primary px-8 flex items-center gap-2"
                            >
                                {loading ? "Traitement..." : "Confirmer le retour"}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
