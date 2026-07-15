"use client";
import { useState, useEffect } from "react";
import { X, Ban, AlertTriangle } from "lucide-react";
import { clientsService } from "@/lib/db";
import type { Client } from "@/types";
import toast from "react-hot-toast";
import { formatCurrency } from "@/lib/format";
import {
    validateMontant,
    validateMotif,
    calculerSoldeRestant,
} from "@/lib/validation-annulation";

interface AnnulationDetteModalProps {
    client: Client;
    utilisateur: { uid: string; nom: string; role: string };
    magasinId: string | null;
    onClose: () => void;
    onSuccess: (clientId: string, nouveauSolde: number) => void;
}

const SUGGESTION_CHIPS = ["Remise commerciale", "Erreur de saisie", "Geste commercial"];

export default function AnnulationDetteModal({
    client,
    utilisateur,
    magasinId,
    onClose,
    onSuccess,
}: AnnulationDetteModalProps) {
    const [montant, setMontant] = useState<number>(client.soldeDette);
    const [motif, setMotif] = useState("");
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<{ montant?: string; motif?: string }>({});

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    const soldeRestant = calculerSoldeRestant(client.soldeDette, montant);

    const handleMontantChange = (value: number) => {
        setMontant(value);
        const err = validateMontant(value, client.soldeDette);
        setErrors(prev => ({ ...prev, montant: err ?? undefined }));
    };

    const handleMotifChange = (value: string) => {
        setMotif(value);
        const err = validateMotif(value);
        setErrors(prev => ({ ...prev, motif: err ?? undefined }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const montantErr = validateMontant(montant, client.soldeDette);
        const motifErr = validateMotif(motif);

        if (montantErr || motifErr) {
            setErrors({ montant: montantErr ?? undefined, motif: motifErr ?? undefined });
            return;
        }

        setLoading(true);
        try {
            const nouveauSolde = await clientsService.annulerDette(
                client.id,
                montant,
                motif,
                utilisateur,
                magasinId
            );
            toast.success("Dette annulée avec succès");
            onSuccess(client.id, nouveauSolde);
        } catch (err: any) {
            toast.error(err.message || "Erreur lors de l'annulation. Veuillez réessayer.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-cream-dark animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="bg-orange-600 p-6 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                                <Ban size={20} />
                            </div>
                            <div>
                                <h3 className="font-display text-xl font-bold">Annulation de Dette</h3>
                                <p className="text-white/70 text-xs uppercase tracking-widest font-bold mt-0.5">
                                    {client.prenom} {client.nom}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-full transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Current debt display */}
                    <div className="bg-cream/30 p-4 rounded-2xl text-center">
                        <span className="text-[10px] uppercase font-black text-ink-muted tracking-widest block mb-1">
                            Dette actuelle
                        </span>
                        <span className="text-2xl font-black text-ink">
                            {formatCurrency(client.soldeDette)}
                        </span>
                    </div>

                    {/* Montant field */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-black text-ink-muted tracking-widest pl-1">
                            Montant à annuler
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                min={1}
                                max={client.soldeDette}
                                value={montant}
                                onChange={e => handleMontantChange(Number(e.target.value))}
                                className={`w-full text-2xl font-black bg-cream/10 border-2 rounded-2xl p-4 pr-12 focus:ring-0 transition-all outline-none ${
                                    errors.montant
                                        ? "border-red-400 focus:border-red-500 text-red-600"
                                        : "border-cream-dark focus:border-orange-500 text-orange-600"
                                }`}
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-orange-500 font-bold">F</span>
                        </div>
                        {errors.montant && (
                            <p className="text-xs text-red-500 pl-1">{errors.montant}</p>
                        )}
                        <p className="text-[10px] text-ink-muted italic pl-1">
                            Solde restant après annulation :{" "}
                            <span className={`font-bold ${soldeRestant < 0 ? "text-red-500" : "text-ink"}`}>
                                {formatCurrency(Math.max(0, soldeRestant))}
                            </span>
                        </p>
                    </div>

                    {/* Motif field */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-black text-ink-muted tracking-widest pl-1">
                            Motif <span className="text-orange-500">*</span>
                        </label>
                        <textarea
                            autoFocus
                            maxLength={300}
                            value={motif}
                            onChange={e => handleMotifChange(e.target.value)}
                            rows={3}
                            className={`w-full bg-cream/10 border-2 rounded-2xl p-4 resize-none focus:ring-0 transition-all outline-none text-sm text-ink ${
                                errors.motif
                                    ? "border-red-400 focus:border-red-500"
                                    : "border-cream-dark focus:border-orange-500"
                            }`}
                            placeholder="Décrivez la raison de cette annulation..."
                        />
                        <div className="flex items-center justify-between pl-1">
                            {errors.motif ? (
                                <p className="text-xs text-red-500">{errors.motif}</p>
                            ) : (
                                <span />
                            )}
                            <span className="text-[10px] text-ink-muted font-mono ml-auto">
                                {motif.length}/300
                            </span>
                        </div>

                        {/* Suggestion chips */}
                        <div className="flex flex-wrap gap-2 pt-1">
                            {SUGGESTION_CHIPS.map(chip => (
                                <button
                                    key={chip}
                                    type="button"
                                    onClick={() => handleMotifChange(chip)}
                                    className="px-3 py-1.5 text-xs font-bold bg-orange-50 text-orange-600 border border-orange-200 rounded-xl hover:bg-orange-100 transition-colors"
                                >
                                    {chip}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Irreversibility warning */}
                    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
                        <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
                        <p className="text-xs text-amber-700 font-medium leading-relaxed">
                            Cette opération est <span className="font-black">irréversible</span>. Le montant
                            annulé sera définitivement déduit du solde de dette du client et enregistré
                            dans les logs d'audit.
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3.5 text-ink-muted font-bold hover:bg-cream rounded-2xl transition-all"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-[2] py-3.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-black rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
                        >
                            {loading ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                    Traitement...
                                </>
                            ) : (
                                <>
                                    <Ban size={16} />
                                    Confirmer l'annulation
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
