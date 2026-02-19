"use client";
import { useState } from "react";
import { X, DollarSign, Wallet } from "lucide-react";

interface Props {
    commandeId: string;
    totalTTC: number;
    montantPaye: number;
    onClose: () => void;
    onSuccess: (montant: number) => Promise<void>;
}

export function PaymentModal({ commandeId, totalTTC, montantPaye, onClose, onSuccess }: Props) {
    const reste = totalTTC - (montantPaye || 0);
    const [montant, setMontant] = useState(reste.toString());
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const val = +montant;
        if (!montant || isNaN(val) || val <= 0) return;

        if (val > reste) {
            alert(`Le montant ne peut pas dépasser le reste à payer (${reste.toLocaleString()} F)`);
            return;
        }

        setLoading(true);
        try {
            await onSuccess(+montant);
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-cream-dark animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-cream-dark flex items-center justify-between bg-cream/20">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-ink rounded-xl flex items-center justify-center shadow-lg shadow-ink/20">
                            <Wallet className="text-gold" size={20} />
                        </div>
                        <div>
                            <h3 className="font-display text-xl font-bold text-ink">Enregistrer un paiement</h3>
                            <p className="text-[10px] text-ink-muted uppercase tracking-widest font-bold">Commande #{commandeId.slice(0, 8)}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-cream rounded-full transition-colors">
                        <X size={20} className="text-ink-muted" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-cream/30 p-4 rounded-2xl border border-cream-dark">
                            <p className="text-[10px] uppercase font-black text-ink-muted mb-1">Total TTC</p>
                            <p className="text-lg font-black text-ink">{totalTTC.toLocaleString()} F</p>
                        </div>
                        <div className="bg-green-50/50 p-4 rounded-2xl border border-green-100">
                            <p className="text-[10px] uppercase font-black text-green-700 mb-1">Déjà payé</p>
                            <p className="text-lg font-black text-green-700">{montantPaye.toLocaleString()} F</p>
                        </div>
                    </div>

                    <div className="bg-red-50/30 p-6 rounded-3xl border border-red-100 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] uppercase font-black text-red-500 mb-1 tracking-tighter">Reste à payer</p>
                            <p className="text-3xl font-black text-red-600 font-display">{reste.toLocaleString()} F</p>
                        </div>
                        <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-200">
                            <DollarSign className="text-white" size={24} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-black text-ink-muted tracking-widest pl-1">Montant du versement</label>
                        <div className="relative group">
                            <input
                                autoFocus
                                type="number"
                                value={montant}
                                onChange={(e) => setMontant(e.target.value)}
                                className="w-full text-3xl font-black font-display bg-cream/10 border-2 border-cream-dark rounded-2xl p-6 focus:border-gold focus:ring-0 transition-all outline-none text-ink group-hover:border-ink/20"
                                placeholder="0"
                                required
                            />
                            <div className="absolute right-6 top-1/2 -translate-y-1/2 text-2xl font-black text-ink-muted">F</div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !montant || +montant <= 0}
                        className="w-full py-5 bg-ink text-gold font-display text-lg font-black rounded-2xl shadow-xl shadow-ink/20 hover:bg-ink/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-3"
                    >
                        {loading ? "Traitement..." : "Confirmer le paiement"}
                    </button>
                </form>
            </div>
        </div>
    );
}
