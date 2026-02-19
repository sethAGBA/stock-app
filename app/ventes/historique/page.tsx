"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { ventesService, etablissementService, utilisateursService } from "@/lib/db";
import type { Vente, Etablissement, AppUser } from "@/types";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Printer, ArrowLeft, Search, User, Download } from "lucide-react";
import { exportToCSV } from "@/lib/export-utils";
import Link from "next/link";
import { ReceiptModal } from "@/components/common/ReceiptModal";
import { useAuth } from "@/lib/auth-context";
import clsx from "clsx";

export default function HistoriqueVentesPage() {
    const { appUser } = useAuth();
    const [ventes, setVentes] = useState<Vente[]>([]);
    const [search, setSearch] = useState("");
    const [etablissement, setEtablissement] = useState<Etablissement | null>(null);
    const [previewVente, setPreviewVente] = useState<Vente | null>(null);
    const [vendeurs, setVendeurs] = useState<AppUser[]>([]);
    const [selectedVendeur, setSelectedVendeur] = useState<string>("all");

    const isGestionnaire = appUser?.role === "admin" || appUser?.role === "gestionnaire";

    useEffect(() => {
        ventesService.getRecent(100).then(setVentes);
        etablissementService.get().then(setEtablissement);
        if (isGestionnaire) {
            utilisateursService.getAll().then(setVendeurs);
        }
    }, [isGestionnaire]);

    const filteredVentes = ventes.filter(v => {
        const matchesSearch = v.id.includes(search) ||
            (v.clientNom || "").toLowerCase().includes(search.toLowerCase()) ||
            (v.utilisateurNom || "").toLowerCase().includes(search.toLowerCase());

        const matchesVendeur = selectedVendeur === "all" || v.utilisateurId === selectedVendeur;

        return matchesSearch && matchesVendeur;
    });

    const handleExport = () => {
        const dataToExport = filteredVentes.map(v => ({
            ID: v.id,
            Date: format(v.createdAt, "dd/MM/yyyy HH:mm"),
            Client: v.clientNom || "Client passage",
            Vendeur: v.utilisateurNom,
            Total: v.totalTTC,
            Regne: v.montantRecu,
            Monnaie: v.monnaie,
            Mode: v.modePaiement,
            Statut: v.resteAPayer > 0 ? "Credit" : "Payé"
        }));
        exportToCSV(dataToExport, "historique_ventes");
    };

    return (
        <AppLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <Link href="/ventes" className="flex items-center text-ink-muted hover:text-ink mb-2 text-sm transition-colors">
                            <ArrowLeft size={16} className="mr-1" /> Retour au POS
                        </Link>
                        <h2 className="font-display text-3xl font-semibold text-ink">Historique des Ventes</h2>
                    </div>
                    <div className="flex gap-4">
                        {isGestionnaire && (
                            <button
                                onClick={handleExport}
                                className="btn-secondary flex items-center gap-2"
                                title="Exporter en CSV"
                            >
                                <Download size={18} />
                                <span className="hidden md:inline">Exporter</span>
                            </button>
                        )}
                        {isGestionnaire && (
                            <div className="relative w-48">
                                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                                <select
                                    value={selectedVendeur}
                                    onChange={e => setSelectedVendeur(e.target.value)}
                                    className="input pl-9 text-xs appearance-none"
                                >
                                    <option value="all">Tous les vendeurs</option>
                                    {vendeurs.map(v => (
                                        <option key={v.uid} value={v.uid}>{v.prenom} {v.nom}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div className="relative w-64">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Rechercher (ticket, client)..."
                                className="input pl-9"
                            />
                        </div>
                    </div>
                </div>

                <div className="card p-0 overflow-hidden">
                    <table className="w-full text-left bg-white">
                        <thead className="bg-cream/50 text-xs uppercase text-ink-muted font-bold tracking-wider">
                            <tr>
                                <th className="p-4">Date</th>
                                <th className="p-4">Ticket</th>
                                <th className="p-4">Client</th>
                                <th className="p-4">Vendeur</th>
                                <th className="p-4 text-right">Montant</th>
                                <th className="p-4 text-center">Paiement</th>
                                <th className="p-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-cream-dark text-sm">
                            {filteredVentes.map(vente => (
                                <tr key={vente.id} className="hover:bg-cream/20 transition-colors">
                                    <td className="p-4 font-mono text-ink-muted">
                                        {format(vente.createdAt, "dd/MM/yy HH:mm", { locale: fr })}
                                    </td>
                                    <td className="p-4 font-mono font-bold text-ink">
                                        #{vente.id.slice(0, 8).toUpperCase()}
                                    </td>
                                    <td className="p-4 text-ink">{vente.clientNom || "Client passage"}</td>
                                    <td className="p-4 text-ink-muted">{(vente.utilisateurNom || "").split(' ')[0]}</td>
                                    <td className="p-4 text-right font-bold text-ink">
                                        {vente.totalTTC.toLocaleString("fr-FR")} F
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={clsx(
                                            "px-2 py-1 rounded text-[10px] uppercase font-bold",
                                            vente.modePaiement === "especes" ? "bg-green-100 text-green-700" :
                                                vente.modePaiement === "mobile_money" ? "bg-blue-100 text-blue-700" :
                                                    "bg-gray-100 text-gray-700"
                                        )}>
                                            {vente.modePaiement.replace("_", " ")}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <button
                                            onClick={() => setPreviewVente(vente)}
                                            className="p-2 hover:bg-gold/10 text-ink-muted hover:text-gold rounded transition-colors"
                                            title="Réimprimer le ticket"
                                        >
                                            <Printer size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredVentes.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-ink-muted">
                                        Aucune vente trouvée.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {previewVente && (
                    <ReceiptModal
                        vente={previewVente}
                        etablissement={etablissement}
                        onClose={() => setPreviewVente(null)}
                    />
                )}
            </div>
        </AppLayout>
    );
}
