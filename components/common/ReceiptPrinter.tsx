import { forwardRef } from "react";
import type { Vente, Etablissement } from "@/types";
import { format } from "date-fns";

interface ReceiptPrinterProps {
    vente: Vente | null;
    etablissement: Etablissement | null;
    preview?: boolean;
}

export const ReceiptPrinter = forwardRef<HTMLDivElement, ReceiptPrinterProps>(
    ({ vente, etablissement, preview = false }, ref) => {
        if (!vente) return null;

        return (
            <div ref={ref} className={preview ? "text-black font-mono text-[10px] leading-tight" : "hidden print:block print:w-[80mm] print:p-2 text-black font-mono text-[10px] leading-tight"}>
                {/* Header */}
                <div className="text-center mb-4">
                    <h1 className="text-sm font-bold uppercase mb-1">{etablissement?.nom || "Vision+ Consulting"}</h1>
                    {etablissement?.adresse && <p>{etablissement.adresse}</p>}
                    {etablissement?.telephone && <p>Tel: {etablissement.telephone}</p>}
                    {etablissement?.email && <p>{etablissement.email}</p>}
                </div>

                {/* Info Vente */}
                <div className="mb-4 border-b border-black pb-2 border-dashed">
                    <div className="flex justify-between">
                        <span>Date:</span>
                        <span>{format(vente.createdAt, "dd/MM/yyyy HH:mm")}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Ticket:</span>
                        <span>#{vente.id.slice(0, 8).toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Client:</span>
                        <span>{vente.clientNom}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Caissier:</span>
                        <span>{vente.utilisateurNom.split(" ")[0]}</span>
                    </div>
                </div>

                {/* Articles */}
                <table className="w-full mb-4">
                    <thead>
                        <tr className="text-left border-b border-black border-dashed">
                            <th className="py-1">Qte</th>
                            <th className="py-1">Art</th>
                            <th className="py-1 text-right">Mnt</th>
                        </tr>
                    </thead>
                    <tbody>
                        {vente.lignes.map((l, i) => (
                            <tr key={i}>
                                <td className="py-0.5 align-top w-[10%]">{l.quantite}</td>
                                <td className="py-0.5 align-top">{l.produitNom}</td>
                                <td className="py-0.5 align-top text-right whitespace-nowrap">{l.total.toLocaleString("fr-FR")}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Totaux */}
                <div className="border-t border-black border-dashed pt-2 mb-4 space-y-1">
                    <div className="flex justify-between">
                        <span>Total HT</span>
                        <span>{vente.totalHT.toLocaleString("fr-FR")} F</span>
                    </div>
                    {(vente.remise || 0) > 0 && (
                        <div className="flex justify-between">
                            <span>Remise</span>
                            <span>-{(vente.remise || 0).toLocaleString("fr-FR")} F</span>
                        </div>
                    )}
                    <div className="flex justify-between text-sm font-bold border-t border-black border-dashed pt-1 mt-1">
                        <span>NET A PAYER</span>
                        <span>{vente.totalTTC.toLocaleString("fr-FR")} Val</span>
                    </div>
                </div>

                {/* Paiement */}
                <div className="mb-6 space-y-1">
                    <div className="flex justify-between">
                        <span>Mode:</span>
                        <span className="uppercase">{vente.modePaiement.replace("_", " ")}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Reçu:</span>
                        <span>{(vente.montantRecu || 0).toLocaleString("fr-FR")} F</span>
                    </div>
                    {vente.resteAPayer > 0 && (
                        <div className="flex justify-between font-bold text-red-600">
                            <span>Reste à payer:</span>
                            <span>{vente.resteAPayer.toLocaleString("fr-FR")} F</span>
                        </div>
                    )}
                    <div className="flex justify-between">
                        <span>Rendu:</span>
                        <span>{(vente.monnaie || 0).toLocaleString("fr-FR")} F</span>
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center space-y-2">
                    <p className="italic">{etablissement?.piedDePage || "Merci de votre visite !"}</p>
                    <p className="text-[8px] mt-4">Logiciel: Vision+ Consulting (TOGOCARE)</p>
                </div>
            </div>
        );
    }
);

ReceiptPrinter.displayName = "ReceiptPrinter";
