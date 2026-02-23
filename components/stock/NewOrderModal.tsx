"use client";
import { useState, useEffect } from "react";
import { X, Plus, Trash2, Save, Search } from "lucide-react";
import { produitsService, commandesFournisseursService } from "@/lib/db";
import type { Produit, CommandeFournisseur } from "@/types";
import { useAuth } from "@/lib/auth-context";
import toast from "react-hot-toast";
import { formatPrice } from "@/lib/format";

interface Props {
    fournisseurId: string;
    fournisseurNom: string;
    onClose: () => void;
    onSuccess: () => void;
    magasinId?: string | null;
}

export function NewOrderModal({ fournisseurId, fournisseurNom, onClose, onSuccess, magasinId }: Props) {
    const { appUser } = useAuth();
    const [produits, setProduits] = useState<Produit[]>([]);
    const [search, setSearch] = useState("");
    const [lignes, setLignes] = useState<CommandeFournisseur["lignes"]>([]);
    const [loading, setLoading] = useState(false);
    const [dateEcheance, setDateEcheance] = useState("");

    useEffect(() => {
        // Charger uniquement les produits de ce magasin (et éventuellement filtrés par fournisseur)
        produitsService.getAll(magasinId).then(all => {
            setProduits(all);
        });
    }, [fournisseurId, magasinId]);

    const filteredProduits = produits.filter(p =>
        p.designation.toLowerCase().includes(search.toLowerCase()) ||
        p.reference.toLowerCase().includes(search.toLowerCase())
    );

    const addLigne = (produit: Produit) => {
        if (lignes.find(l => l.produitId === produit.id)) return;
        setLignes([...lignes, {
            produitId: produit.id,
            produitNom: produit.designation,
            quantite: 1,
            prixAchat: produit.prixAchat,
            total: produit.prixAchat
        }]);
        setSearch("");
    };

    const updateLigne = (index: number, field: "quantite" | "prixAchat", value: number) => {
        const newLignes = [...lignes];
        newLignes[index][field] = value;
        newLignes[index].total = newLignes[index].quantite * newLignes[index].prixAchat;
        setLignes(newLignes);
    };

    const removeLigne = (index: number) => {
        setLignes(lignes.filter((_, i) => i !== index));
    };

    const totalHT = lignes.reduce((acc, l) => acc + l.total, 0);

    const handleSubmit = async () => {
        if (lignes.length === 0) return toast.error("Ajoutez au moins un produit");
        setLoading(true);
        try {
            await commandesFournisseursService.create({
                fournisseurId,
                fournisseurNom,
                date: new Date(),
                statut: "brouillon",
                lignes,
                totalHT,
                totalTTC: totalHT,
                montantPaye: 0,
                resteAPayer: totalHT,
                statutPaiement: "en_attente",
                createdBy: appUser?.uid || "SYSTEM",
                createdByName: appUser ? `${appUser.prenom} ${appUser.nom}` : "Système",
                createdAt: new Date(),
                updatedAt: new Date(),
                dateEcheance: dateEcheance ? new Date(dateEcheance) : null
            } as any, { uid: appUser!.uid, nom: `${appUser!.prenom} ${appUser!.nom}` }, magasinId);
            toast.success("Commande créée (brouillon)");
            onSuccess();
            onClose();
        } catch (e) {
            console.error(e);
            toast.error("Erreur création commande");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-cream-dark">
                    <div>
                        <h2 className="font-display text-xl font-bold text-ink">Nouvelle Commande</h2>
                        <p className="text-sm text-ink-muted">Fournisseur : <span className="font-semibold text-gold">{fournisseurNom}</span></p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-cream rounded-full text-ink-muted"><X size={20} /></button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Products Selector */}
                    <div className="w-1/3 border-r border-cream-dark flex flex-col bg-gray-50">
                        <div className="p-4 border-b border-cream-dark">
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                                <input
                                    autoFocus
                                    placeholder="Chercher produit..."
                                    className="input pl-9 w-full bg-white"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                            {filteredProduits.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => addLigne(p)}
                                    disabled={!!lignes.find(l => l.produitId === p.id)}
                                    className="w-full text-left p-3 rounded-lg bg-white border border-transparent hover:border-gold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed group transition-all"
                                >
                                    <div className="flex justify-between items-start">
                                        <span className="font-medium text-sm text-ink group-hover:text-gold transition-colors line-clamp-2">{p.designation}</span>
                                    </div>
                                    <div className="text-xs text-ink-muted mt-1 flex justify-between">
                                        <span>Ref: {p.reference}</span>
                                        <span className="font-mono">{p.stockActuel} en stock</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Order Lines */}
                    <div className="flex-1 flex flex-col bg-white">
                        <div className="flex-1 overflow-y-auto p-6">
                            {lignes.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-ink-muted opacity-50">
                                    <Plus size={48} className="mb-4" />
                                    <p>Ajoutez des produits depuis la liste de gauche</p>
                                </div>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead className="bg-cream/50 text-xs uppercase text-ink-muted font-bold text-left sticky top-0">
                                        <tr>
                                            <th className="p-3 pl-4">Produit</th>
                                            <th className="p-3 w-24">Prix Achat</th>
                                            <th className="p-3 w-20">Qté</th>
                                            <th className="p-3 w-28 text-right">Total</th>
                                            <th className="p-3 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-cream-dark">
                                        {lignes.map((ligne, i) => (
                                            <tr key={ligne.produitId} className="group hover:bg-cream/10">
                                                <td className="p-3 pl-4">
                                                    <div className="font-medium text-ink">{ligne.produitNom}</div>
                                                </td>
                                                <td className="p-3">
                                                    <input
                                                        type="number" min="0"
                                                        className="input h-8 text-right w-full"
                                                        value={ligne.prixAchat}
                                                        onChange={e => updateLigne(i, "prixAchat", +e.target.value)}
                                                    />
                                                </td>
                                                <td className="p-3">
                                                    <input
                                                        type="number" min="1"
                                                        className="input h-8 text-center w-full"
                                                        value={ligne.quantite}
                                                        onChange={e => updateLigne(i, "quantite", +e.target.value)}
                                                    />
                                                </td>
                                                <td className="p-3 text-right font-mono font-medium">
                                                    {formatPrice(ligne.total)} F
                                                </td>
                                                <td className="p-3 text-right">
                                                    <button onClick={() => removeLigne(i)} className="text-red-400 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100 transition-all">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Footer Totals */}
                        <div className="p-6 bg-cream/20 border-t border-cream-dark space-y-4">
                            <div className="flex justify-between items-end">
                                <div className="space-y-2">
                                    <label className="text-xs uppercase font-bold text-ink-muted">Échéance de paiement (optionnel)</label>
                                    <input
                                        type="date"
                                        className="input bg-white w-48"
                                        value={dateEcheance}
                                        onChange={e => setDateEcheance(e.target.value)}
                                    />
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-ink-muted mb-1">Total Commande</p>
                                    <p className="text-3xl font-display font-bold text-gold">{formatPrice(totalHT)} <span className="text-base text-ink">FCFA</span></p>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-cream-dark/50">
                                <button onClick={onClose} className="btn-secondary">Annuler</button>
                                <button onClick={handleSubmit} disabled={loading || lignes.length === 0} className="btn-primary w-48 flex items-center justify-center gap-2">
                                    {loading ? "..." : <><Save size={18} /> Enregistrer</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
