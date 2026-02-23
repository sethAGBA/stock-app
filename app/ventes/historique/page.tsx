"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { ventesService, etablissementService, utilisateursService } from "@/lib/db";
import type { Vente, Etablissement, AppUser } from "@/types";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Printer, ArrowLeft, Search, User, Download, ChevronDown } from "lucide-react";
import { exportToCSV, exportToExcel } from "@/lib/export";
import Link from "next/link";
import { ReceiptModal } from "@/components/common/ReceiptModal";
import { CancellationModal } from "@/components/stock/CancellationModal";
import { useAuth } from "@/lib/auth-context";
import toast from "react-hot-toast";
import clsx from "clsx";
import { formatPrice, formatCurrency } from "@/lib/format";

export default function HistoriqueVentesPage() {
    const { appUser } = useAuth();
    const [ventes, setVentes] = useState<Vente[]>([]);
    const [search, setSearch] = useState("");
    const [etablissement, setEtablissement] = useState<Etablissement | null>(null);
    const [previewVente, setPreviewVente] = useState<Vente | null>(null);
    const [vendeurs, setVendeurs] = useState<AppUser[]>([]);
    const [selectedVendeur, setSelectedVendeur] = useState<string>("all");
    const [selectedStatus, setSelectedStatus] = useState<string>("all");
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const [venteToCancel, setVenteToCancel] = useState<Vente | null>(null);

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
        const matchesStatus = selectedStatus === "all" || v.statut === selectedStatus;

        return matchesSearch && matchesVendeur && matchesStatus;
    });
    const handleExport = (exportFormat: "csv" | "excel") => {
        setIsExportMenuOpen(false);
        // Aplatir (flatten) les données : 1 ligne = 1 produit vendu
        const dataToExport = filteredVentes.flatMap(v => {
            if (!v.lignes || v.lignes.length === 0) {
                // S'il n'y a pas de lignes de produits, créer au moins une ligne générique pour la vente
                return [{
                    "ID Vente": '#' + v.id.slice(0, 8).toUpperCase(),
                    "Date": format(v.createdAt, "dd/MM/yyyy HH:mm"),
                    "Client": v.clientNom || "Client passage",
                    "Vendeur": (v.utilisateurNom || "").split(' ')[0],
                    "Produit Réf": "-",
                    "Produit": "-",
                    "Quantité": 0,
                    "Prix Unitaire": 0,
                    "Total Ligne": 0,
                    "Mode de paiement": v.modePaiement.replace("_", " "),
                    "Statut": v.resteAPayer > 0 ? "Crédit" : "Payé"
                }];
            }

            return v.lignes.map(l => ({
                "ID Vente": '#' + v.id.slice(0, 8).toUpperCase(),
                "Date": format(v.createdAt, "dd/MM/yyyy HH:mm"),
                "Client": v.clientNom || "Client passage",
                "Vendeur": (v.utilisateurNom || "").split(' ')[0],
                "Produit Réf": l.produitRef,
                "Produit": l.produitNom,
                "Quantité": l.quantite,
                "Prix Unitaire": l.prixUnitaire,
                "Total Ligne": l.total,
                "Mode de paiement": v.modePaiement.replace("_", " "),
                "Statut": v.resteAPayer > 0 ? "Crédit" : "Payé"
            }));
        });

        const timestamp = format(new Date(), "yyyyMMdd_HHmm");
        if (exportFormat === "csv") {
            exportToCSV(dataToExport, `historique_ventes_${timestamp}`);
        } else {
            exportToExcel(dataToExport, `historique_ventes_${timestamp}`, "Ventes");
        }
    };

    const handleAnnuler = async (motif: string) => {
        if (!venteToCancel || !appUser) return;
        try {
            await ventesService.annuler(venteToCancel, motif, { uid: appUser.uid, nom: `${appUser.prenom} ${appUser.nom}` });
            toast.success("Vente annulée avec succès");
            // Rafraîchir la liste
            const updated = await ventesService.getRecent(100);
            setVentes(updated);
        } catch (err: any) {
            toast.error(err.message || "Erreur lors de l'annulation");
        }
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
                            <div className="relative">
                                <button
                                    onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                                    className="btn-secondary flex items-center gap-2"
                                    title="Exporter"
                                >
                                    <Download size={18} />
                                    <span className="hidden md:inline">Exporter</span>
                                    <ChevronDown size={14} className={clsx("transition-transform", isExportMenuOpen && "rotate-180")} />
                                </button>

                                {isExportMenuOpen && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setIsExportMenuOpen(false)}></div>
                                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-cream-dark z-20 overflow-hidden transform origin-top-right transition-all">
                                            <button
                                                onClick={() => handleExport("excel")}
                                                className="w-full text-left px-4 py-3 hover:bg-cream/30 text-sm font-bold text-ink transition-colors flex items-center gap-2"
                                            >
                                                Format Excel (.xlsx)
                                            </button>
                                            <button
                                                onClick={() => handleExport("csv")}
                                                className="w-full text-left px-4 py-3 hover:bg-cream/30 text-sm font-bold text-ink transition-colors border-t border-cream-dark flex items-center gap-2"
                                            >
                                                Format CSV (.csv)
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
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
                        <div className="relative w-48">
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
                            <select
                                value={selectedStatus}
                                onChange={e => setSelectedStatus(e.target.value)}
                                className="input pl-4 pr-10 text-xs appearance-none"
                            >
                                <option value="all">Tous les statuts</option>
                                <option value="valide">Validés</option>
                                <option value="annulee">Annulés</option>
                            </select>
                        </div>
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
                                <th className="p-4 text-center">Statut</th>
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
                                        {formatCurrency(vente.totalTTC)}
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
                                    <td className="p-4 text-center">
                                        <div className="flex flex-col items-center gap-1">
                                            <span className={clsx(
                                                "px-2 py-1 rounded-full text-[10px] uppercase font-black tracking-widest",
                                                vente.statut === "annulee" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                                            )}>
                                                {vente.statut === "annulee" ? "Annulée" : "Validée"}
                                            </span>
                                            {vente.statut === "annulee" && (
                                                <div className="flex flex-col items-center">
                                                    <span className="text-[9px] text-red-600 font-bold max-w-[120px] truncate" title={vente.motifAnnulation}>
                                                        {vente.motifAnnulation}
                                                    </span>
                                                    <span className="text-[8px] text-ink-muted italic">
                                                        par {vente.annuleParNom}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4 text-right flex items-center justify-end gap-1">
                                        <button
                                            onClick={() => setPreviewVente(vente)}
                                            className="p-2 hover:bg-gold/10 text-ink-muted hover:text-gold rounded transition-colors"
                                            title="Réimprimer le ticket"
                                        >
                                            <Printer size={18} />
                                        </button>
                                        {isGestionnaire && vente.statut !== "annulee" && (
                                            <button
                                                onClick={() => setVenteToCancel(vente)}
                                                className="p-2 hover:bg-red-50 text-ink-muted hover:text-red-500 rounded transition-colors"
                                                title="Annuler la vente"
                                            >
                                                <ArrowLeft size={18} className="rotate-45" />
                                            </button>
                                        )}
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

                {venteToCancel && (
                    <CancellationModal
                        commandeId={venteToCancel.id}
                        onClose={() => setVenteToCancel(null)}
                        onConfirm={handleAnnuler}
                    />
                )}
            </div>
        </AppLayout>
    );
}
