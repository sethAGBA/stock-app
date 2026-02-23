"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { produitsService, clientsService, ventesService } from "@/lib/db";
import type { Produit, Client, Vente, LigneVente } from "@/types";
import { Search, ShoppingCart, User, CreditCard, Trash2, Plus, Minus, CheckCircle, Receipt, Camera, ArrowDown } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";
import clsx from "clsx";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ReceiptModal } from "@/components/common/ReceiptModal";
import { etablissementService } from "@/lib/db";
import type { Etablissement } from "@/types";
import { formatPrice, formatCurrency } from "@/lib/format";

const Scanner = dynamic(() => import("@/components/common/Scanner"), { ssr: false });

export default function POSPage() {
    const { appUser } = useAuth();
    const [produits, setProduits] = useState<Produit[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [search, setSearch] = useState("");
    const [cart, setCart] = useState<LigneVente[]>([]);
    const [selectedClientId, setSelectedClientId] = useState("");
    const [modePaiement, setModePaiement] = useState<Vente["modePaiement"]>("especes");
    const [remise, setRemise] = useState(0);
    const [montantRecu, setMontantRecu] = useState(0);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState<string | null>(null);
    const [showScanner, setShowScanner] = useState(false);
    const [clientSearch, setClientSearch] = useState("");
    const [showClientList, setShowClientList] = useState(false);

    // Receipt preview
    const [etablissement, setEtablissement] = useState<Etablissement | null>(null);
    const [previewVente, setPreviewVente] = useState<Vente | null>(null);
    const [lastVente, setLastVente] = useState<Vente | null>(null);

    useEffect(() => {
        if (!appUser) return;
        const unsub = produitsService.onSnapshot(setProduits);
        clientsService.getAll().then(setClients);
        etablissementService.get().then(setEtablissement);
        return unsub;
    }, [appUser]);


    const handleScan = (decodedText: string) => {
        // On cherche un produit par sa référence exacte
        const p = produits.find(item => item.reference.toLowerCase() === decodedText.toLowerCase());
        if (p) {
            addToCart(p);
            toast.success(`${p.designation} ajouté au panier`);
            // On ferme le scanner après un scan réussi pour éviter les doublons accidentels immédiats ?
            // Pour une caisse rapide, on préfère peut-être le laisser ouvert.
            // On ajoute un petit "vibreur" visuel ?
            setShowScanner(false);
        } else {
            toast.error(`Code inconnu : ${decodedText}`);
        }
    };

    const filteredProduits = produits.filter(p =>
        p.designation.toLowerCase().includes(search.toLowerCase()) ||
        p.reference.toLowerCase().includes(search.toLowerCase())
    );

    const addToCart = (p: Produit) => {
        if (p.stockActuel <= 0) {
            toast.error("Rupture de stock !");
            return;
        }

        setCart(prev => {
            const existing = prev.find(item => item.produitId === p.id);
            if (existing) {
                if (existing.quantite >= p.stockActuel) {
                    toast.error("Stock maximum atteint");
                    return prev;
                }
                return prev.map(item =>
                    item.produitId === p.id
                        ? { ...item, quantite: item.quantite + 1, total: (item.quantite + 1) * item.prixUnitaire }
                        : item
                );
            }
            return [...prev, {
                produitId: p.id,
                produitRef: p.reference,
                produitNom: p.designation,
                quantite: 1,
                prixUnitaire: p.prixVente,
                prixAchat: p.prixAchat, // Capturer le prix d'achat à l'instant T
                typePrix: "detail",
                total: p.prixVente
            }];
        });
    };

    const togglePriceType = (id: string) => {
        setCart(cart.map(item => {
            if (item.produitId === id) {
                const prod = produits.find(p => p.id === id);
                if (!prod) return item;

                const newType = item.typePrix === "detail" ? "gros" : "detail";
                const newPrice = newType === "gros" && prod.prixVenteGros ? prod.prixVenteGros : prod.prixVente;

                if (newType === "gros" && !prod.prixVenteGros) {
                    toast.error("Prix de gros non défini pour ce produit");
                    return item;
                }

                return { ...item, typePrix: newType, prixUnitaire: newPrice, total: item.quantite * newPrice };
            }
            return item;
        }));
    };

    const updateQty = (id: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.produitId === id) {
                const prod = produits.find(p => p.id === id);
                const newQty = Math.max(1, item.quantite + delta);
                if (prod && newQty > prod.stockActuel) {
                    toast.error("Stock insuffisant");
                    return item;
                }
                return { ...item, quantite: newQty, total: newQty * item.prixUnitaire };
            }
            return item;
        }));
    };

    const removeFromCart = (id: string) => {
        setCart(prev => prev.filter(item => item.produitId !== id));
    };

    const totalHT = cart.reduce((sum, item) => sum + item.total, 0);
    const totalTTC = Math.max(0, totalHT - remise);
    const resteAPayer = Math.max(0, totalTTC - (montantRecu || 0));
    const monnaieARendre = montantRecu > totalTTC ? montantRecu - totalTTC : 0;

    const filteredClients = clients.filter(c =>
        c.nom.toLowerCase().includes(clientSearch.toLowerCase()) ||
        c?.prenom?.toLowerCase().includes(clientSearch.toLowerCase()) ||
        c.telephone?.includes(clientSearch)
    );

    const handleCheckout = async () => {
        if (cart.length === 0) return;
        if (!appUser) return;

        if (resteAPayer > 0 && !selectedClientId) {
            return toast.error("Veuillez sélectionner un client pour une vente à crédit");
        }

        setLoading(true);
        try {
            const client = clients.find(c => c.id === selectedClientId);
            const venteData = {
                clientId: selectedClientId || null,
                clientNom: client ? `${client.prenom} ${client.nom}` : "Client passage",
                lignes: cart,
                totalHT,
                remise,
                totalTTC,
                montantRecu: montantRecu || (totalTTC - resteAPayer),
                monnaie: monnaieARendre,
                resteAPayer,
                modePaiement: resteAPayer > 0 ? "credit" : modePaiement,
                utilisateurId: appUser.uid,
                utilisateurNom: `${appUser.prenom} ${appUser.nom}`
            };

            const venteRef = await ventesService.enregistrer(venteData);

            // Open receipt preview modal
            const newVente = {
                id: venteRef,
                createdAt: new Date(),
                ...venteData
            } as Vente;

            setPreviewVente(newVente);
            setLastVente(newVente);

            setSuccess("Vente enregistrée avec succès !");
            setCart([]);
            setSelectedClientId("");
            setRemise(0);
            setMontantRecu(0);
            setModePaiement("especes");
        } catch (err: any) {
            toast.error(err.message || "Erreur lors de la vente");
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <AppLayout>
                <div className="h-full flex flex-col items-center justify-center space-y-6">
                    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                        <CheckCircle size={40} />
                    </div>
                    <div className="text-center">
                        <h2 className="text-2xl font-display font-semibold text-ink">{success}</h2>
                        <p className="text-ink-muted mt-2">Le stock a été mis à jour automatiquement.</p>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={() => setSuccess(null)} className="btn-primary">
                            Nouvelle vente
                        </button>
                        <button onClick={() => lastVente && setPreviewVente(lastVente)} className="btn-secondary flex items-center gap-2">
                            <Receipt size={16} /> Voir le ticket
                        </button>
                    </div>
                </div>

                {previewVente && (
                    <ReceiptModal
                        vente={previewVente}
                        etablissement={etablissement}
                        onClose={() => setPreviewVente(null)}
                    />
                )}
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="h-full flex gap-6 overflow-hidden">
                {/* Left: Product Selection */}
                <div className="flex-1 flex flex-col min-w-0">
                    <div className="mb-6 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-mono tracking-widest text-ink-muted uppercase mb-1">Point de vente</p>
                            <h2 className="font-display text-3xl font-semibold text-ink">Vente Directe</h2>
                        </div>
                        <div className="relative w-64 flex gap-2">
                            <div className="relative flex-1">
                                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." className="input pl-9" />
                            </div>
                            <button
                                onClick={() => setShowScanner(true)}
                                className="p-3 bg-gold/10 text-gold rounded-xl hover:bg-gold/20 transition-colors"
                                title="Scanner un code-barres"
                            >
                                <Camera size={18} />
                            </button>
                            <Link href="/ventes/historique" className="p-3 bg-cream text-ink-muted rounded-xl hover:bg-cream-dark transition-colors" title="Historique">
                                <Receipt size={18} />
                            </Link>
                        </div>
                    </div>

                    {showScanner && (
                        <Scanner onScan={handleScan} onClose={() => setShowScanner(false)} />
                    )}

                    <div className="flex-1 overflow-auto pr-2 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 content-start">
                        {filteredProduits.map(p => (
                            <button key={p.id} onClick={() => addToCart(p)} disabled={p.stockActuel <= 0}
                                className={clsx(
                                    "card p-4 text-left flex flex-col justify-between hover:border-gold/40 transition-all active:scale-[0.98]",
                                    p.stockActuel <= 0 && "opacity-60 grayscale cursor-not-allowed"
                                )}
                            >
                                <div>
                                    <p className="text-[10px] font-mono text-ink-muted mb-1">{p.reference}</p>
                                    <h3 className="font-semibold text-ink text-sm leading-tight line-clamp-2">{p.designation}</h3>
                                </div>
                                <div className="mt-4 flex flex-col gap-1">
                                    <div className="flex items-end justify-between">
                                        <p className="text-gold font-bold">{formatCurrency(p.prixVente)}</p>
                                        <p className={clsx("text-[10px] px-1.5 py-0.5 rounded", p.stockActuel <= 5 ? "bg-red-50 text-red-600" : "bg-cream text-ink-muted")}>
                                            Stock: {p.stockActuel}
                                        </p>
                                    </div>
                                    {p.prixVenteGros && (
                                        <p className="text-[10px] text-ink-muted italic">Gros: {formatCurrency(p.prixVenteGros || 0)}</p>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Right: Cart & Checkout */}
                <div className="w-[420px] flex flex-col shrink-0 min-h-0 overflow-y-auto">
                    <div className="card flex-1 p-0 flex flex-col shadow-xl min-h-[600px]">
                        <div className="p-4 border-b border-cream-dark flex items-center justify-between bg-cream/30">
                            <div className="flex items-center gap-2">
                                <ShoppingCart size={20} className="text-gold" />
                                <h3 className="font-semibold text-ink text-base">Panier ({cart.length})</h3>
                            </div>
                            <button onClick={() => setCart([])} className="text-sm text-red-500 hover:underline">Vider</button>
                        </div>

                        {/* Cart Items */}
                        <div className="flex-1 overflow-y-auto pr-2 divide-y divide-cream-dark min-h-[150px] bg-white">
                            {cart.map(item => (
                                <div key={item.produitId} className="p-4 flex flex-col gap-3 group">
                                    <div className="flex justify-between items-start">
                                        <h4 className="text-sm font-medium text-ink flex-1 pr-2 leading-tight">{item.produitNom}</h4>
                                        <button onClick={() => removeFromCart(item.produitId)} className="text-ink-muted hover:text-red-500 transition-opacity opacity-0 group-hover:opacity-100 p-1">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1 bg-cream rounded-xl p-1">
                                            <button
                                                onClick={() => togglePriceType(item.produitId)}
                                                className={clsx(
                                                    "px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase transition-all",
                                                    item.typePrix === "detail" ? "bg-white text-gold shadow-md" : "text-ink-muted hover:text-ink"
                                                )}
                                            >
                                                Détail
                                            </button>
                                            <button
                                                onClick={() => togglePriceType(item.produitId)}
                                                className={clsx(
                                                    "px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase transition-all",
                                                    item.typePrix === "gros" ? "bg-white text-gold shadow-md" : "text-ink-muted hover:text-ink"
                                                )}
                                            >
                                                Gros
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-3 bg-cream/50 rounded-xl p-1">
                                            <button onClick={() => updateQty(item.produitId, -1)}
                                                className="p-2 rounded-lg bg-white shadow-sm ring-1 ring-black/5 hover:bg-gold/10 text-gold transition-colors">
                                                <Minus size={14} />
                                            </button>
                                            <span className="text-base font-bold font-mono w-8 text-center text-ink">{item.quantite}</span>
                                            <button onClick={() => updateQty(item.produitId, 1)}
                                                className="p-2 rounded-lg bg-white shadow-sm ring-1 ring-black/5 hover:bg-gold/10 text-gold transition-colors">
                                                <Plus size={14} />
                                            </button>
                                        </div>
                                        <p className="text-base font-bold text-ink whitespace-nowrap">{formatCurrency(item.total)}</p>
                                    </div>
                                </div>
                            ))}
                            {cart.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center p-8 text-center text-ink-muted">
                                    <ShoppingCart size={32} className="opacity-10 mb-2" />
                                    <p className="text-sm">Le panier est vide</p>
                                </div>
                            )}
                        </div>

                        {/* Checkout Form */}
                        <div className="p-4 bg-cream/30 border-t border-cream-dark space-y-3">
                            <div>
                                <label className="text-[10px] uppercase tracking-wider text-ink-muted mb-1 block">Client</label>
                                <div className="relative">
                                    <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                                    <input
                                        type="text"
                                        placeholder="Rechercher un client..."
                                        value={clientSearch}
                                        onChange={e => {
                                            setClientSearch(e.target.value);
                                            setShowClientList(true);
                                        }}
                                        onFocus={() => setShowClientList(true)}
                                        className="input pl-9 text-xs py-2"
                                    />
                                    {selectedClientId && (
                                        <button
                                            onClick={() => {
                                                setSelectedClientId("");
                                                setClientSearch("");
                                            }}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-ink-muted hover:text-red-500"
                                        >
                                            <Minus size={12} />
                                        </button>
                                    )}

                                    {showClientList && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border border-cream-dark rounded-xl shadow-2xl max-h-48 overflow-auto animate-in fade-in zoom-in-95 duration-200">
                                            <div
                                                className="p-3 text-xs hover:bg-cream cursor-pointer border-b border-cream-dark flex items-center justify-between"
                                                onClick={() => {
                                                    setSelectedClientId("");
                                                    setClientSearch("");
                                                    setShowClientList(false);
                                                }}
                                            >
                                                <span className="font-bold text-ink-muted italic">Client de passage</span>
                                            </div>
                                            {filteredClients.map(c => (
                                                <div
                                                    key={c.id}
                                                    onClick={() => {
                                                        setSelectedClientId(c.id);
                                                        setClientSearch(`${c.prenom} ${c.nom}`);
                                                        setShowClientList(false);
                                                    }}
                                                    className={clsx(
                                                        "p-3 text-xs hover:bg-cream cursor-pointer flex flex-col gap-0.5 transition-colors",
                                                        selectedClientId === c.id ? "bg-gold/10 border-l-2 border-gold" : ""
                                                    )}
                                                >
                                                    <span className="font-bold text-ink">{c.prenom} {c.nom}</span>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] text-ink-muted">{c.telephone || "Pas de téléphone"}</span>
                                                        {c.soldeDette > 0 && (
                                                            <span className="text-[9px] font-black text-red-500 uppercase">Dette: {formatCurrency(c.soldeDette || 0)}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                            {filteredClients.length === 0 && (
                                                <div className="p-4 text-center text-xs text-ink-muted">Aucun client trouvé</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {showClientList && (
                                    <div className="fixed inset-0 z-0" onClick={() => setShowClientList(false)} />
                                )}
                            </div>

                            <div>
                                <label className="text-[10px] uppercase tracking-wider text-ink-muted mb-1 block">Paiement</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { id: "especes", label: "Espèces", icon: CreditCard },
                                        { id: "mobile_money", label: "Mobile", icon: CreditCard },
                                        { id: "carte", label: "Carte", icon: CreditCard },
                                        { id: "credit", label: "Crédit", icon: User },
                                        { id: "autre", label: "Autre", icon: CreditCard },
                                    ].map(m => (
                                        <button
                                            key={m.id}
                                            onClick={() => setModePaiement(m.id as any)}
                                            className={clsx(
                                                "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all",
                                                modePaiement === m.id
                                                    ? "bg-gold text-white border-gold shadow-md"
                                                    : "bg-white border-cream-dark text-ink-muted hover:border-gold hover:text-ink"
                                            )}
                                        >
                                            <m.icon size={14} />
                                            {m.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-2 border-t border-cream-dark space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-ink-muted">Sous-total</span>
                                    <span className="font-medium text-ink">{formatCurrency(totalHT)}</span>
                                </div>
                                <div className="flex items-center justify-between bg-gold/5 rounded-lg p-2">
                                    <span className="text-xs font-medium text-gold/80">Rabais / Ristourne</span>
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="number"
                                            min="0"
                                            value={remise}
                                            onChange={e => setRemise(Number(e.target.value))}
                                            className="w-20 text-right bg-transparent border-b border-gold/30 focus:border-gold outline-none font-bold text-ink text-sm"
                                        />
                                        <ArrowDown size={12} className="text-gold" />
                                    </div>
                                </div>
                                <div className="flex justify-between items-baseline pt-1">
                                    <span className="text-lg font-bold text-ink">Total à payer</span>
                                    <span className="text-xl font-display font-bold text-gold">{formatCurrency(totalTTC)}</span>
                                </div>
                            </div>

                            {/* Reste du formulaire paiement */}
                            {/* Reste du formulaire paiement */}
                            {(modePaiement === "especes" || modePaiement === "credit") && (
                                <div className={clsx(
                                    "grid grid-cols-2 gap-3 mt-2 p-3 rounded-xl border transition-colors",
                                    resteAPayer > 0 ? "bg-red-50 border-red-100" : "bg-cream/50 border-cream-dark"
                                )}>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[10px] uppercase font-bold text-ink-muted">Montant Perçu</span>
                                        <div className="flex items-center gap-1 bg-white border border-cream-dark rounded p-1 focus-within:border-gold">
                                            <input
                                                type="number"
                                                min="0"
                                                value={montantRecu}
                                                onChange={e => {
                                                    const val = Number(e.target.value);
                                                    setMontantRecu(val);
                                                    if (val < totalTTC) setModePaiement("credit");
                                                    else if (modePaiement === "credit") setModePaiement("especes");
                                                }}
                                                className="w-full text-right text-sm font-bold text-ink outline-none"
                                                placeholder="0"
                                            />
                                            <span className="text-[10px] text-ink-muted">F</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1 items-end">
                                        {resteAPayer > 0 ? (
                                            <>
                                                <span className="text-[10px] uppercase font-bold text-red-500">Reste à payer</span>
                                                <span className="text-lg font-bold text-red-600 font-mono">
                                                    {formatCurrency(resteAPayer)}
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <span className="text-[10px] uppercase font-bold text-green-600">Rendre</span>
                                                <span className="text-lg font-bold text-green-600 font-mono">
                                                    {formatCurrency(monnaieARendre)}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={handleCheckout}
                                disabled={cart.length === 0 || loading}
                                className={clsx(
                                    "w-full btn-primary py-3 text-lg font-bold shadow-xl mt-2 transition-all",
                                    resteAPayer > 0 ? "bg-red-600 hover:bg-red-700 shadow-red-200 border-red-700" : "shadow-gold/20"
                                )}
                            >
                                {loading ? "Traitement..." : resteAPayer > 0 ? "Valider le Crédit" : "Encaisser"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {previewVente && (
                <ReceiptModal
                    vente={previewVente}
                    etablissement={etablissement}
                    onClose={() => setPreviewVente(null)}
                />
            )}
        </AppLayout>
    );
}
