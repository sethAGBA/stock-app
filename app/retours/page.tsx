"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { retoursService, utilisateursService } from "@/lib/db";
import type { RetourClient, AppUser } from "@/types";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { RotateCcw, Search, User, Filter, Calendar, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency } from "@/lib/format";
import clsx from "clsx";

export default function RetoursPage() {
    const { appUser, currentMagasinId } = useAuth();
    const [retours, setRetours] = useState<RetourClient[]>([]);
    const [search, setSearch] = useState("");
    const [filterMode, setFilterMode] = useState<string>("all");

    // Nouveaux filtres
    const [dateDebut, setDateDebut] = useState<string>("");
    const [dateFin, setDateFin] = useState<string>("");
    const [filtreUtilisateur, setFiltreUtilisateur] = useState<string>("all");
    const [users, setUsers] = useState<AppUser[]>([]);

    useEffect(() => {
        if (!appUser) return;
        if (appUser.role !== "admin" && !currentMagasinId) return;

        if (dateDebut && dateFin) {
            const start = new Date(dateDebut);
            const end = new Date(dateFin);
            end.setHours(23, 59, 59);
            retoursService.getForDateRange(start, end, undefined, currentMagasinId).then(setRetours);
        } else {
            retoursService.getAll(currentMagasinId).then(setRetours);
        }

        utilisateursService.getAll(currentMagasinId).then(setUsers);
    }, [appUser, currentMagasinId, dateDebut, dateFin]);

    const filteredRetours = retours.filter(r => {
        const matchesSearch = r.clientNom.toLowerCase().includes(search.toLowerCase()) ||
            r.venteId.toLowerCase().includes(search.toLowerCase()) ||
            r.id.toLowerCase().includes(search.toLowerCase());

        const matchesMode = filterMode === "all" || r.remboursementMode === filterMode;
        const matchesUser = filtreUtilisateur === "all" || r.utilisateurId === filtreUtilisateur;

        return matchesSearch && matchesMode && matchesUser;
    });

    return (
        <AppLayout>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="font-display text-3xl font-bold text-ink flex items-center gap-3">
                            <RotateCcw className="text-gold" size={28} />
                            Retours Client
                        </h1>
                        <p className="text-ink-muted text-sm mt-1">Gérez les retours de marchandises et les remboursements.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="card bg-gold/5 border-gold/20 p-4 flex flex-col justify-between">
                        <p className="text-[10px] uppercase font-black text-gold tracking-widest">
                            {dateDebut && dateFin ? "Total sur la période" : "Total Retours (récents)"}
                        </p>
                        <h2 className="text-2xl font-display font-black text-ink mt-2">
                            {formatCurrency(filteredRetours.reduce((acc, r) => acc + r.totalTTC, 0))}
                        </h2>
                    </div>
                    <div className="card bg-zinc-900 border-zinc-800 p-4 flex flex-col justify-between">
                        <p className="text-[10px] uppercase font-black text-white/40 tracking-widest">Nombre de retours</p>
                        <h2 className="text-2xl font-display font-black text-white mt-2">
                            {filteredRetours.length}
                        </h2>
                    </div>

                    {/* Toolbar / Filters Card */}
                    <div className="md:col-span-2 lg:col-span-2 card bg-white p-4 border-cream-dark shadow-sm flex flex-col gap-4">
                        <div className="flex flex-col md:flex-row gap-4 items-end">
                            {/* Search */}
                            <div className="relative flex-1 w-full">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                                <input
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Rechercher (ticket, client)..."
                                    className="input pl-9 w-full bg-cream/20 border-none"
                                />
                            </div>

                            {/* Date Filter */}
                            <div className="flex gap-2 items-center bg-cream/20 px-3 py-1.5 rounded-xl border-none w-full md:w-auto self-stretch">
                                <div className="flex flex-col">
                                    <span className="text-[8px] uppercase font-black text-ink-muted px-1">Du</span>
                                    <input
                                        type="date"
                                        value={dateDebut}
                                        onChange={e => setDateDebut(e.target.value)}
                                        className="bg-transparent text-[10px] font-bold focus:outline-none"
                                    />
                                </div>
                                <div className="w-px h-5 bg-cream-dark mx-1" />
                                <div className="flex flex-col">
                                    <span className="text-[8px] uppercase font-black text-ink-muted px-1">Au</span>
                                    <input
                                        type="date"
                                        value={dateFin}
                                        onChange={e => setDateFin(e.target.value)}
                                        className="bg-transparent text-[10px] font-bold focus:outline-none"
                                    />
                                </div>
                                {(dateDebut || dateFin) && (
                                    <button
                                        onClick={() => { setDateDebut(""); setDateFin(""); }}
                                        className="p-1 hover:bg-white text-red-500 rounded-md transition-colors"
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {/* User Filter */}
                            <div className="relative">
                                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                                <select
                                    value={filtreUtilisateur}
                                    onChange={e => setFiltreUtilisateur(e.target.value)}
                                    className="bg-cream/20 text-[10px] font-bold py-1.5 pl-8 pr-6 rounded-lg appearance-none cursor-pointer border-none focus:ring-1 focus:ring-gold"
                                >
                                    <option value="all">Tous les auteurs</option>
                                    {users.map(u => (
                                        <option key={u.uid} value={u.uid}>{u.prenom} {u.nom}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Mode Filter */}
                            <div className="relative">
                                <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                                <select
                                    value={filterMode}
                                    onChange={e => setFilterMode(e.target.value)}
                                    className="bg-cream/20 text-[10px] font-bold py-1.5 pl-8 pr-6 rounded-lg appearance-none cursor-pointer border-none focus:ring-1 focus:ring-gold"
                                >
                                    <option value="all">Tous les modes</option>
                                    <option value="especes">Espèces</option>
                                    <option value="credit_reduc">Réd. Dette</option>
                                    <option value="avoir">Avoir</option>
                                </select>
                            </div>
                        </div>
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
