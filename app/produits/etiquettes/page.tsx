"use client";
import { useEffect, useState, useRef } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { produitsService, etablissementService } from "@/lib/db";
import type { Produit, Etablissement } from "@/types";
import { Printer, ArrowLeft, Search, Plus, Minus, Trash2, Tag } from "lucide-react";
import Link from "next/link";
import JsBarcode from "jsbarcode";
import { useReactToPrint } from "react-to-print";
import clsx from "clsx";

interface LabelItem {
    produitId: string;
    produit: Produit;
    quantite: number;
}

export default function LabelGenerationPage() {
    const [produits, setProduits] = useState<Produit[]>([]);
    const [etablissement, setEtablissement] = useState<Etablissement | null>(null);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [selectedItems, setSelectedItems] = useState<LabelItem[]>([]);
    const printRef = useRef(null);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: "Etiquettes_Produits",
        onAfterPrint: () => console.log("Impression terminée"),
        onPrintError: (error) => console.error("Erreur d'impression:", error),
    });

    useEffect(() => {
        Promise.all([
            produitsService.getAll(),
            etablissementService.get()
        ]).then(([p, e]) => {
            setProduits(p);
            setEtablissement(e);
            setLoading(false);
        });
    }, []);

    const filteredProduits = produits.filter(p =>
        p.designation.toLowerCase().includes(search.toLowerCase()) ||
        p.reference.toLowerCase().includes(search.toLowerCase())
    );

    const addItem = (p: Produit) => {
        setSelectedItems(prev => {
            const existing = prev.find(item => item.produitId === p.id);
            if (existing) {
                return prev.map(item =>
                    item.produitId === p.id ? { ...item, quantite: item.quantite + 1 } : item
                );
            }
            return [...prev, { produitId: p.id, produit: p, quantite: 1 }];
        });
    };

    const updateQty = (id: string, delta: number) => {
        setSelectedItems(prev => prev.map(item =>
            item.produitId === id ? { ...item, quantite: Math.max(1, item.quantite + delta) } : item
        ));
    };

    const setQty = (id: string, value: string) => {
        const qty = parseInt(value) || 0;
        setSelectedItems(prev => prev.map(item =>
            item.produitId === id ? { ...item, quantite: Math.max(0, qty) } : item
        ));
    };

    const removeItem = (id: string) => {
        setSelectedItems(prev => prev.filter(item => item.produitId !== id));
    };

    if (loading) return <AppLayout><div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-gold border-t-transparent rounded-full animate-spin" /></div></AppLayout>;

    return (
        <AppLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <Link href="/produits" className="flex items-center text-ink-muted hover:text-ink mb-2 text-sm transition-colors">
                            <ArrowLeft size={16} className="mr-1" /> Retour aux produits
                        </Link>
                        <h2 className="font-display text-3xl font-semibold text-ink">Générateur d'Étiquettes</h2>
                    </div>
                    <button
                        onClick={handlePrint}
                        disabled={selectedItems.length === 0}
                        className="btn-primary flex items-center gap-2 px-6 py-3 disabled:opacity-50"
                    >
                        <Printer size={18} />
                        Imprimer les Étiquettes
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Catalogue */}
                    <div className="card h-fit lg:col-span-1 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-display font-bold text-ink">Catalogue</h3>
                            <span className="text-[10px] bg-cream px-2 py-0.5 rounded font-mono text-ink-muted uppercase">{produits.length} réfs</span>
                        </div>
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Rechercher..."
                                className="input pl-9 text-xs py-2"
                            />
                        </div>
                        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                            {filteredProduits.map(p => (
                                <div
                                    key={p.id}
                                    onClick={() => addItem(p)}
                                    className="p-3 border border-cream-dark rounded-xl hover:border-gold hover:bg-gold/5 cursor-pointer transition-all group"
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-xs font-bold text-ink group-hover:text-gold transition-colors">{p.designation}</p>
                                            <p className="text-[10px] text-ink-muted font-mono">{p.reference}</p>
                                        </div>
                                        <Plus size={14} className="text-ink-muted group-hover:text-gold" />
                                    </div>
                                    <p className="text-xs font-black text-ink mt-1">{p.prixVente.toLocaleString()} F</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Sélection */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="card min-h-[400px]">
                            <h3 className="font-display font-bold text-ink mb-6 flex items-center gap-2">
                                <Tag size={18} className="text-gold" />
                                Étiquettes à générer
                            </h3>

                            {selectedItems.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64 text-ink-muted opacity-40">
                                    <Tag size={48} className="mb-4" />
                                    <p className="text-sm">Sélectionnez des produits à gauche</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {selectedItems.map(item => (
                                        <div key={item.produitId} className="flex items-center gap-4 p-4 bg-cream/20 rounded-2xl border border-cream-dark">
                                            <div className="flex-1">
                                                <p className="text-sm font-bold text-ink">{item.produit.designation}</p>
                                                <p className="text-xs text-ink-muted font-mono">{item.produit.reference}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => updateQty(item.produitId, -1)} className="p-1 hover:text-gold bg-cream rounded"><Minus size={14} /></button>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={item.quantite}
                                                    onChange={(e) => setQty(item.produitId, e.target.value)}
                                                    className="w-16 text-center text-sm font-black bg-white border border-cream-dark rounded py-1"
                                                />
                                                <button onClick={() => updateQty(item.produitId, 1)} className="p-1 hover:text-gold bg-cream rounded"><Plus size={14} /></button>
                                            </div>
                                            <button onClick={() => removeItem(item.produitId)} className="p-2 text-ink-muted hover:text-red-500 transition-colors">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Zone d'impression (Invisible à l'écran, visible par l'imprimante) */}
                        <div className="opacity-0 pointer-events-none absolute -left-[9999px] top-0">
                            <div ref={printRef} className="p-8 print-container">
                                <div className="grid grid-cols-3 gap-8">
                                    {selectedItems.map(item => (
                                        Array.from({ length: item.quantite }).map((_, i) => (
                                            <BarcodeLabel
                                                key={`${item.produitId}-${i}`}
                                                produit={item.produit}
                                                etablissement={etablissement}
                                            />
                                        ))
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                @media print {
                    @page { size: A4; margin: 10mm; }
                    .print-container { padding: 0 !important; }
                }
            `}</style>
        </AppLayout>
    );
}

function BarcodeLabel({ produit, etablissement }: { produit: Produit, etablissement: Etablissement | null }) {
    const svgRef = useRef(null);

    useEffect(() => {
        if (svgRef.current) {
            JsBarcode(svgRef.current, produit.reference, {
                format: "CODE128",
                width: 1.5,
                height: 40,
                displayValue: true,
                fontSize: 10,
                margin: 0
            });
        }
    }, [produit.reference]);

    return (
        <div className="w-full border border-gray-300 p-3 flex flex-col items-center justify-center bg-white rounded-lg" style={{ height: "120px" }}>
            <p className="text-[10px] font-black uppercase text-center truncate w-full mb-1">{etablissement?.nom || "Boutique"}</p>
            <p className="text-xs font-bold text-center line-clamp-1 w-full mb-1">{produit.designation}</p>
            <svg ref={svgRef} className="max-w-full"></svg>
            <p className="text-sm font-black mt-1">{produit.prixVente.toLocaleString()} F</p>
        </div>
    );
}
