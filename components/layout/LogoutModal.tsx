"use client";
import { LogOut, X, AlertCircle } from "lucide-react";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

export default function LogoutModal({ isOpen, onClose, onConfirm }: Props) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-ink/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div
                className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header with Icon */}
                <div className="relative h-32 bg-zinc-900 flex items-center justify-center overflow-hidden">
                    {/* Decorative elements */}
                    <div className="absolute top-0 left-0 w-full h-full opacity-10">
                        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-gold rounded-full blur-3xl" />
                        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-gold rounded-full blur-3xl" />
                    </div>

                    <div className="relative w-16 h-16 bg-gold/20 rounded-2xl flex items-center justify-center shadow-inner border border-gold/10">
                        <LogOut className="text-gold" size={32} />
                    </div>

                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-all"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 text-center space-y-6">
                    <div className="space-y-2">
                        <h3 className="font-display text-2xl font-bold text-ink">Déconnexion</h3>
                        <p className="text-ink-muted text-sm leading-relaxed px-4">
                            Êtes-vous sûr de vouloir quitter votre session ? Vous devrez vous reconnecter pour accéder au système.
                        </p>
                    </div>

                    <div className="flex flex-col gap-3">
                        <button
                            onClick={onConfirm}
                            className="w-full py-4 bg-zinc-900 text-white font-display font-bold rounded-2xl shadow-xl shadow-zinc-200 hover:bg-black active:scale-[0.98] transition-all"
                        >
                            Se déconnecter
                        </button>
                        <button
                            onClick={onClose}
                            className="w-full py-4 bg-cream text-ink font-display font-bold rounded-2xl hover:bg-cream-dark active:scale-[0.98] transition-all"
                        >
                            Rester connecté
                        </button>
                    </div>
                </div>
            </div>

            {/* Click outside to close */}
            <div className="absolute inset-0 -z-10" onClick={onClose} />
        </div>
    );
}
