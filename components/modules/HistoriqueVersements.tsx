"use client";
import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Loader2, X, Ban } from "lucide-react";
import { format } from "date-fns";
import toast from "react-hot-toast";
import clsx from "clsx";
import { versementsDetteService } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import { validateMotif } from "@/lib/validation-annulation";
import type { Client, VersementDette } from "@/types";

interface HistoriqueVersementsProps {
    client: Client;
    utilisateur: { uid: string; nom: string; role: string };
    magasinId: string | null;
    onSoldeUpdate: (clientId: string, nouveauSolde: number) => void;
}

export default function HistoriqueVersements({
    client,
    utilisateur,
    magasinId,
    onSoldeUpdate,
}: HistoriqueVersementsProps) {
    const [afficherSection, setAfficherSection] = useState(client.soldeDette > 0);
    const [ouvert, setOuvert] = useState(false);
    const [versements, setVersements] = useState<VersementDette[]>([]);
    const [chargement, setChargement] = useState(false);
    const [chargé, setChargé] = useState(false);
    const [erreurChargement, setErreurChargement] = useState<string | null>(null);
    const [versementAnnuler, setVersementAnnuler] = useState<VersementDette | null>(null);
    const [motifAnnulation, setMotifAnnulation] = useState("");
    const [erreurMotif, setErreurMotif] = useState<string | null>(null);
    const [annulationEnCours, setAnnulationEnCours] = useState(false);

    const peutAnnuler = utilisateur.role === "admin" || utilisateur.role === "gestionnaire";

    useEffect(() => {
        if (client.soldeDette > 0) {
            setAfficherSection(true);
            return;
        }

        let annulé = false;
        versementsDetteService
            .getByClient(client.id, magasinId, 1)
            .then(results => {
                if (!annulé && results.length > 0) {
                    setAfficherSection(true);
                }
            })
            .catch(() => {});

        return () => { annulé = true; };
    }, [client.id, client.soldeDette, magasinId]);

    useEffect(() => {
        if (!chargé || !ouvert) return;
        versementsDetteService
            .getByClient(client.id, magasinId)
            .then(setVersements)
            .catch(() => {});
    }, [client.soldeDette, chargé, ouvert, client.id, magasinId]);

    const chargerVersements = async () => {
        setChargement(true);
        setErreurChargement(null);
        try {
            const results = await versementsDetteService.getByClient(client.id, magasinId);
            setVersements(results);
            setChargé(true);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Erreur de chargement";
            setErreurChargement(message);
        } finally {
            setChargement(false);
        }
    };

    const handleToggle = async () => {
        const nouvelEtat = !ouvert;
        setOuvert(nouvelEtat);

        if (nouvelEtat && !chargé) {
            await chargerVersements();
        }
    };

    const handleMotifChange = (value: string) => {
        setMotifAnnulation(value);
        const err = validateMotif(value);
        setErreurMotif(err);
    };

    const handleConfirmerAnnulation = async () => {
        const motifErr = validateMotif(motifAnnulation);
        if (motifErr) {
            setErreurMotif(motifErr);
            return;
        }
        if (!versementAnnuler) return;

        setAnnulationEnCours(true);
        try {
            await versementsDetteService.annuler(
                versementAnnuler.id,
                client.id,
                motifAnnulation.trim(),
                utilisateur,
                magasinId
            );

            const nouveauSolde = client.soldeDette + versementAnnuler.montant;
            setVersements(prev =>
                prev.map(v =>
                    v.id === versementAnnuler.id
                        ? {
                            ...v,
                            statut: "annulé" as const,
                            annuléParId: utilisateur.uid,
                            annuléParNom: utilisateur.nom,
                            annuléMotif: motifAnnulation.trim(),
                            annuléAt: new Date(),
                        }
                        : v
                )
            );
            onSoldeUpdate(client.id, nouveauSolde);
            toast.success("Versement annulé avec succès");
            setVersementAnnuler(null);
            setMotifAnnulation("");
            setErreurMotif(null);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Erreur lors de l'annulation";
            toast.error(message);
        } finally {
            setAnnulationEnCours(false);
        }
    };

    if (!afficherSection) return null;

    return (
        <div className="border-t border-cream-dark pt-3 mt-3">
            <button
                type="button"
                onClick={handleToggle}
                className="w-full flex items-center justify-between text-left py-1.5 group/hist"
            >
                <span className="text-[10px] uppercase font-black text-ink-muted tracking-widest group-hover/hist:text-gold transition-colors">
                    Historique des versements
                    {chargé && versements.length > 0 && (
                        <span className="ml-2 text-gold">({versements.length})</span>
                    )}
                </span>
                {ouvert ? (
                    <ChevronUp size={14} className="text-ink-muted group-hover/hist:text-gold" />
                ) : (
                    <ChevronDown size={14} className="text-ink-muted group-hover/hist:text-gold" />
                )}
            </button>

            {ouvert && (
                <div className="mt-2 space-y-2">
                    {chargement && (
                        <div className="flex justify-center py-4">
                            <Loader2 size={18} className="animate-spin text-gold" />
                        </div>
                    )}

                    {erreurChargement && (
                        <p className="text-xs text-red-500 text-center py-2">{erreurChargement}</p>
                    )}

                    {!chargement && !erreurChargement && chargé && versements.length === 0 && (
                        <p className="text-xs text-ink-muted text-center py-2 italic">
                            Aucun versement enregistré pour ce client.
                        </p>
                    )}

                    {!chargement && versements.map(v => (
                        <div
                            key={v.id}
                            className={clsx(
                                "flex items-center justify-between gap-2 p-2 rounded-lg bg-cream/30 text-xs",
                                v.statut === "annulé" && "opacity-70"
                            )}
                        >
                            <div className={clsx("flex-1 min-w-0", v.statut === "annulé" && "line-through")}>
                                <div className="font-bold text-ink">
                                    {formatCurrency(v.montant)}
                                </div>
                                <div className="text-ink-muted truncate">
                                    {format(v.createdAt, "dd/MM/yyyy HH:mm")} · {v.utilisateurNom}
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                                <span
                                    className={clsx(
                                        "text-[9px] font-black uppercase px-1.5 py-0.5 rounded",
                                        v.statut === "actif"
                                            ? "bg-green-100 text-green-700"
                                            : "bg-red-100 text-red-600"
                                    )}
                                >
                                    {v.statut}
                                </span>

                                {v.statut === "actif" && peutAnnuler && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setVersementAnnuler(v);
                                            setMotifAnnulation("");
                                            setErreurMotif(null);
                                        }}
                                        className="p-1 text-orange-500 hover:bg-orange-50 rounded transition-colors"
                                        title="Annuler ce versement"
                                    >
                                        <Ban size={12} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}

                    {versementAnnuler && (
                        <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-xl space-y-3">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-[10px] uppercase font-black text-orange-600 tracking-widest">
                                        Annuler le versement
                                    </p>
                                    <p className="text-xs text-ink-muted mt-1">
                                        {formatCurrency(versementAnnuler.montant)} du{" "}
                                        {format(versementAnnuler.createdAt, "dd/MM/yyyy HH:mm")}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setVersementAnnuler(null);
                                        setMotifAnnulation("");
                                        setErreurMotif(null);
                                    }}
                                    className="text-ink-muted hover:text-ink"
                                >
                                    <X size={14} />
                                </button>
                            </div>

                            <div>
                                <label className="text-[10px] uppercase font-black text-ink-muted tracking-widest">
                                    Motif (obligatoire)
                                </label>
                                <textarea
                                    value={motifAnnulation}
                                    onChange={e => handleMotifChange(e.target.value)}
                                    rows={2}
                                    className="input w-full mt-1 text-xs resize-none"
                                    placeholder="Ex : Erreur de saisie"
                                />
                                {erreurMotif && (
                                    <p className="text-[10px] text-red-500 mt-1">{erreurMotif}</p>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={handleConfirmerAnnulation}
                                disabled={motifAnnulation.trim() === "" || annulationEnCours}
                                className="w-full py-2 bg-orange-600 text-white rounded-lg text-xs font-bold hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                {annulationEnCours ? "Annulation..." : "Confirmer l'annulation"}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
