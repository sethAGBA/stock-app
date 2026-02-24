"use client";
import { useState, useRef, useEffect } from "react";
import { Search, Package, Check } from "lucide-react";
import type { Produit } from "@/types";
import clsx from "clsx";

interface ProductSearchProps {
    produits: Produit[];
    selectedId: string;
    onSelect: (produit: Produit) => void;
    placeholder?: string;
    required?: boolean;
}

export default function ProductSearch({
    produits,
    selectedId,
    onSelect,
    placeholder = "Rechercher un produit...",
    required = false
}: ProductSearchProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const selectedProduit = produits.find(p => p.id === selectedId);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filtered = produits.filter(p =>
        p.designation.toLowerCase().includes(search.toLowerCase()) ||
        p.reference.toLowerCase().includes(search.toLowerCase())
    ).slice(0, 10); // Limit to 10 results for performance and UI

    const handleSelect = (p: Produit) => {
        onSelect(p);
        setSearch("");
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={containerRef}>
            <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">
                    <Search size={14} />
                </div>
                <input
                    ref={inputRef}
                    type="text"
                    className="input pl-9 pr-10"
                    placeholder={selectedProduit ? `${selectedProduit.designation}` : placeholder}
                    value={isOpen ? search : (selectedProduit?.designation || "")}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => {
                        setIsOpen(true);
                        setSearch("");
                    }}
                    required={required && !selectedId}
                    readOnly={!isOpen && !!selectedId}
                />
                {selectedId && !isOpen && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gold">
                        <Check size={16} />
                    </div>
                )}
            </div>

            {isOpen && (
                <div className="absolute z-[60] mt-1 w-full bg-white border border-cream-dark rounded-xl shadow-2xl max-h-64 overflow-auto animate-in fade-in zoom-in-95 duration-200">
                    {filtered.length > 0 ? (
                        <div className="p-1">
                            {filtered.map((p) => (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => handleSelect(p)}
                                    className={clsx(
                                        "w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors",
                                        selectedId === p.id ? "bg-gold/10" : "hover:bg-cream"
                                    )}
                                >
                                    <div className="w-8 h-8 rounded-lg bg-cream flex items-center justify-center text-gold shrink-0">
                                        <Package size={14} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-ink text-sm truncate">{p.designation}</p>
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] font-mono text-ink-muted uppercase">{p.reference}</p>
                                            <p className="text-[10px] font-bold text-gold">Stock: {p.stockActuel} {p.unite}</p>
                                        </div>
                                    </div>
                                    {selectedId === p.id && <Check size={14} className="text-gold" />}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="p-4 text-center text-ink-muted text-sm">
                            Aucun produit trouvé
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
