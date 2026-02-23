"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { retoursService } from "@/lib/db";
import type { RetourClient } from "@/types";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { RotateCcw, Search, User, Filter, Calendar } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency } from "@/lib/format";
import clsx from "clsx";

export default function RetoursPage() {
    const { appUser, currentMagasinId } = useAuth();
    const [retours, setRetours] = useState<RetourClient[]>([]);
    const [search, setSearch] = useState("");
    const [filterMode, setFilterMode] = useState<string>("all");

    useEffect(() => {
        if (!appUser) return;
        if (appUser.role !== "admin" && !currentMagasinId) return;
        retoursService.getAll(currentMagasinId).then(setRetours);
    }, [appUser, currentMagasinId]);

    const filteredRetours = retours.filter(r => {
        const matchesSearch = r.clientNom.toLowerCase().includes(search.toLowerCase()) ||
            r.venteId.toLowerCase().includes(search.toLowerCase()) ||
            r.id.toLowerCase().includes(search.toLowerCase());

        const matchesMode = filterMode === "all" || r.remboursementMode === filterMode;

        return matchesSearch && matchesMode;
    });

    return (
        <AppLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="font-display text-3xl font-bold text-ink flex items-center gap-3">
                            <RotateCcw className="text-gold" size={28} />
                            Retours Client
                        </h1>
                        <p className="text-ink-muted text-sm mt-1">Gérez les retours de marchandises et les remboursements.</p>
                    </div>

                    <div className="flex gap-4">
                        <div className="relative w-64">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Client, ticket..."
                                className="input pl-9"
                            />
                        </div>
                        <div className="relative w-48">
                            <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                            <select
                                value={filterMode}
                                onChange={e => setFilterMode(e.target.value)}
                                className="input pl-9"
                            >
                                <option value="all">Tous les modes</option>
                                <option value="especes">Espèces</option>
                                <option value="credit_reduc">Réd. Dette</option>
                                <option value="avoir">Avoir</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="card bg-gold/5 border-gold/20 p-6 flex flex-col justify-between">
                        <p className="text-[10px] uppercase font-black text-gold tracking-widest">Total Retours (30j)</p>
                        <h2 className="text-3xl font-display font-black text-ink mt-2">
                            {formatCurrency(retours.reduce((acc, r) => acc + r.totalTTC, 0))}
                        </h2>
                    </div>
                    <div className="card bg-zinc-900 border-zinc-800 p-6 flex flex-col justify-between">
                        <p className="text-[10px] uppercase font-black text-white/40 tracking-widest">Nombre de retours</p>
                        <h2 className="text-3xl font-display font-black text-white mt-2">
                            {retours.length}
                        </h2>
                    </div>
                </div>

                <div className="card p-0 overflow-hidden border-cream-dark">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-cream/50 text-[10px] uppercase font-black text-ink-muted tracking-widest border-b border-cream-dark">
                                <tr>
                                    <th className="p-4">Date & Heure</th>
                                    <th className="p-4">Retour ID</th>
                                    <th className="p-4">Vente Origine</th>
                                    <th className="p-4">Client</th>
                                    <th className="p-4">Articles</th>
                                    <th className="p-4 text-right">Montant</th>
                                    <th className="p-4 text-center">Remboursement</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-cream-dark text-sm">
                                {filteredRetours.map(retour => (
                                    <tr key={retour.id} className="hover:bg-gold/5 transition-colors group">
                                        <td className="p-4 text-ink font-medium">
                                            {format(retour.createdAt, "dd MMM yyyy HH:mm", { locale: fr })}
                                        </td>
                                        <td className="p-4 font-mono text-ink-muted text-xs">
                                            #{retour.id.slice(0, 8).toUpperCase()}
                                        </td>
                                        <td className="p-4 font-mono font-bold text-gold">
                                            #{retour.venteId.slice(0, 8).toUpperCase()}
                                        </td>
                                        <td className="p-4">
                                            <p className="font-bold text-ink">{retour.clientNom}</p>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col gap-1">
                                                {retour.lignes.map((l, i) => (
                                                    <span key={i} className="text-[10px] text-ink-muted bg-cream px-1.5 py-0.5 rounded">
                                                        {l.quantite}x {l.produitNom}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right font-display font-black text-ink">
                                            {formatCurrency(retour.totalTTC)}
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={clsx(
                                                "px-2 py-1 rounded-full text-[10px] uppercase font-black tracking-widest",
                                                retour.remboursementMode === "especes" ? "bg-green-100 text-green-700" :
                                                    retour.remboursementMode === "credit_reduc" ? "bg-blue-100 text-blue-700" :
                                                        "bg-gray-100 text-gray-700"
                                            )}>
                                                {retour.remboursementMode === "especes" ? "Espèces" :
                                                    retour.remboursementMode === "credit_reduc" ? "Réd. Dette" : "Autre"}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {filteredRetours.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="p-12 text-center text-ink-muted">
                                            Aucun retour enregistré.
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
