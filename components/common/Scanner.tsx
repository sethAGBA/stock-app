"use client";
import { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner, Html5QrcodeScannerState } from "html5-qrcode";
import { X, Camera } from "lucide-react";

interface ScannerProps {
    onScan: (decodedText: string) => void;
    onClose: () => void;
    title?: string;
}

export default function Scanner({ onScan, onClose, title = "Scanner un code-barres" }: ScannerProps) {
    const scannerRef = useRef<Html5QrcodeScanner | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Initialisation du scanner
        scannerRef.current = new Html5QrcodeScanner(
            "reader",
            {
                fps: 10,
                qrbox: { width: 250, height: 150 },
                aspectRatio: 1.0,
            },
            false
        );

        const onSuccess = (decodedText: string) => {
            onScan(decodedText);
            // On peut choisir d'arrêter après un scan réussi ou non
            // Ici on continue pour permettre plusieurs scans rapides dans le POS
        };

        const onError = (errorMessage: string) => {
            // Les erreurs de "non-détection" sont fréquentes et ignorables
            if (errorMessage.includes("No MultiFormat Readers were able to decode")) return;
            console.warn("Scanner error:", errorMessage);
        };

        scannerRef.current.render(onSuccess, onError);

        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(err => console.error("Failed to clear scanner:", err));
            }
        };
    }, [onScan]);

    return (
        <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
            <div className="w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="p-5 border-b border-cream-dark flex items-center justify-between bg-white text-ink">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center text-gold">
                            <Camera size={18} />
                        </div>
                        <h3 className="font-display font-semibold">{title}</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-cream rounded-full transition-colors text-ink-muted">
                        <X size={20} />
                    </button>
                </div>

                {/* Scanner Area */}
                <div className="p-4 bg-black aspect-square md:aspect-video flex items-center justify-center relative">
                    <div id="reader" className="w-full h-full overflow-hidden rounded-xl" />

                    {/* Custom Overlay */}
                    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                        <div className="w-64 h-40 border-2 border-gold/50 rounded-lg relative">
                            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-gold" />
                            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-gold" />
                            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-gold" />
                            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-gold" />
                            <div className="absolute top-1/2 left-0 w-full h-[1px] bg-red-500/50 animate-scan-line" />
                        </div>
                        <p className="text-white/60 text-[10px] uppercase tracking-widest mt-6 font-mono">Placez le code dans le cadre</p>
                    </div>
                </div>

                <div className="p-6 bg-white flex flex-col items-center gap-2">
                    <p className="text-sm text-ink-muted text-center max-w-xs">
                        Le scanner détecte automatiquement les codes-barres (EAN, Code128) et les QR codes.
                    </p>
                </div>
            </div>

            <style jsx global>{`
        #reader__dashboard_section_csr button {
          background-color: #D4AF37 !important;
          color: white !important;
          border: none !important;
          padding: 8px 16px !important;
          border-radius: 8px !important;
          font-family: inherit !important;
          font-size: 14px !important;
          font-weight: 500 !important;
          cursor: pointer !important;
          margin-top: 10px !important;
          transition: transform 0.2s !important;
        }
        #reader__dashboard_section_csr button:active {
          transform: scale(0.95) !important;
        }
        #reader__scan_region {
          background: transparent !important;
        }
        #reader img {
          display: none !important;
        }
        @keyframes scan-line {
          0%, 100% { transform: translateY(0); opacity: 0; }
          10% { opacity: 1; }
          50% { transform: translateY(160px); }
          90% { opacity: 1; }
        }
        .animate-scan-line {
          animation: scan-line 2s infinite linear;
        }
      `}</style>
        </div>
    );
}
