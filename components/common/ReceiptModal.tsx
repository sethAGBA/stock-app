"use client";
import { useRef } from "react";
import type { Vente, Etablissement } from "@/types";
import { useReactToPrint } from "react-to-print";
import { ReceiptPrinter } from "./ReceiptPrinter";
import { X, Printer, FileDown } from "lucide-react";
import { format } from "date-fns";
import jsPDF from "jspdf";

interface ReceiptModalProps {
    vente: Vente;
    etablissement: Etablissement | null;
    onClose: () => void;
}

export function ReceiptModal({ vente, etablissement, onClose }: ReceiptModalProps) {
    const printRef = useRef<HTMLDivElement>(null);

    const handlePrint = useReactToPrint({
        content: () => printRef.current,
    } as any);

    const handleDownloadPDF = () => {
        const doc = new jsPDF({
            unit: "mm",
            format: [80, 200], // 80mm wide thermal receipt
            orientation: "portrait",
        });

        const nomEtab = etablissement?.nom || "Vision+ Consulting";
        const adresse = etablissement?.adresse || "";
        const tel = etablissement?.telephone || "";
        const piedPage = etablissement?.piedDePage || "Merci de votre visite !";

        let y = 10;
        const centerX = 40;
        const margin = 5;

        // Header
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(nomEtab.toUpperCase(), centerX, y, { align: "center" });
        y += 5;
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        if (adresse) { doc.text(adresse, centerX, y, { align: "center" }); y += 4; }
        if (tel) { doc.text(`Tel: ${tel}`, centerX, y, { align: "center" }); y += 4; }

        // Separator
        y += 2;
        doc.setLineDashPattern([1, 1], 0);
        doc.line(margin, y, 80 - margin, y);
        y += 4;

        // Info
        doc.setFontSize(8);
        doc.text(`Date: ${format(vente.createdAt, "dd/MM/yyyy HH:mm")}`, margin, y); y += 4;
        doc.text(`Ticket: #${vente.id.slice(0, 8).toUpperCase()}`, margin, y); y += 4;
        doc.text(`Client: ${vente.clientNom || "Client passage"}`, margin, y); y += 4;
        doc.text(`Caissier: ${(vente.utilisateurNom || "").split(" ")[0]}`, margin, y); y += 4;

        // Separator
        doc.line(margin, y, 80 - margin, y);
        y += 4;

        // Articles
        doc.setFont("helvetica", "bold");
        doc.text("Qte", margin, y);
        doc.text("Article", margin + 10, y);
        doc.text("Montant", 80 - margin, y, { align: "right" });
        y += 2;
        doc.setLineDashPattern([1, 1], 0);
        doc.line(margin, y, 80 - margin, y);
        y += 4;

        doc.setFont("helvetica", "normal");
        for (const ligne of vente.lignes) {
            const montantStr = `${ligne.total.toLocaleString("fr-FR")} F`;
            doc.text(`${ligne.quantite}`, margin, y);
            // Wrap long product names
            const maxWidth = 42;
            const splitName = doc.splitTextToSize(ligne.produitNom, maxWidth);
            doc.text(splitName, margin + 10, y);
            doc.text(montantStr, 80 - margin, y, { align: "right" });
            y += splitName.length > 1 ? splitName.length * 4 : 4;
        }

        // Totals
        y += 2;
        doc.line(margin, y, 80 - margin, y);
        y += 4;
        doc.text(`Total HT: ${vente.totalHT.toLocaleString("fr-FR")} F`, margin, y); y += 4;
        if ((vente.remise || 0) > 0) {
            doc.text(`Remise: -${(vente.remise || 0).toLocaleString("fr-FR")} F`, margin, y); y += 4;
        }
        doc.setFont("helvetica", "bold");
        doc.text(`NET A PAYER: ${vente.totalTTC.toLocaleString("fr-FR")} F`, margin, y); y += 6;

        // Payment
        doc.setFont("helvetica", "normal");
        doc.text(`Mode: ${vente.modePaiement.replace("_", " ").toUpperCase()}`, margin, y); y += 4;
        doc.text(`Reçu: ${(vente.montantRecu || 0).toLocaleString("fr-FR")} F`, margin, y); y += 4;
        if ((vente.resteAPayer || 0) > 0) {
            doc.setFont("helvetica", "bold");
            doc.setTextColor(200, 0, 0); // Red
            doc.text(`RESTE A PAYER: ${(vente.resteAPayer || 0).toLocaleString("fr-FR")} F`, margin, y); y += 5;
            doc.setTextColor(0, 0, 0); // Reset black
            doc.setFont("helvetica", "normal");
        }
        doc.text(`Rendu: ${(vente.monnaie || 0).toLocaleString("fr-FR")} F`, margin, y); y += 6;

        // Footer
        doc.setLineDashPattern([1, 1], 0);
        doc.line(margin, y, 80 - margin, y);
        y += 4;
        doc.setFontSize(7);
        doc.text(piedPage, centerX, y, { align: "center" }); y += 4;
        doc.text("Logiciel: Vision+ Consulting (TOGOCARE)", centerX, y, { align: "center" });

        doc.save(`ticket-${vente.id.slice(0, 8).toUpperCase()}.pdf`);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-sm mx-4 max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-cream-dark">
                    <h3 className="font-semibold text-ink">Aperçu du ticket</h3>
                    <button onClick={onClose} className="p-2 hover:bg-cream rounded-lg transition-colors text-ink-muted">
                        <X size={18} />
                    </button>
                </div>

                {/* Receipt Preview */}
                <div className="flex-1 overflow-auto bg-gray-100 p-4">
                    <div className="bg-white shadow-md mx-auto max-w-[300px] rounded p-4">
                        <div ref={printRef}>
                            <ReceiptPrinter
                                ref={null}
                                vente={vente}
                                etablissement={etablissement}
                                preview={true}
                            />
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="p-4 border-t border-cream-dark flex gap-3">
                    <button
                        onClick={() => handlePrint()}
                        className="flex-1 btn-secondary flex items-center justify-center gap-2"
                    >
                        <Printer size={16} /> Imprimer
                    </button>
                    <button
                        onClick={handleDownloadPDF}
                        className="flex-1 btn-primary flex items-center justify-center gap-2"
                    >
                        <FileDown size={16} /> PDF
                    </button>
                </div>
            </div>
        </div>
    );
}
