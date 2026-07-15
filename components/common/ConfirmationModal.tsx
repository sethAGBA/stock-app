"use client";
import { X, AlertTriangle, AlertCircle, Trash2, Info } from "lucide-react";
import clsx from "clsx";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "info";
  isLoading?: boolean;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  variant = "danger",
  isLoading = false
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const variants = {
    danger: {
      icon: <Trash2 size={24} />,
      iconBg: "bg-red-500",
      accent: "text-red-700",
      bgAccent: "bg-red-50",
      borderAccent: "border-red-100",
      btnConfirm: "bg-red-600 hover:bg-red-700 text-white shadow-red-200",
    },
    warning: {
      icon: <AlertTriangle size={24} />,
      iconBg: "bg-amber-500",
      accent: "text-amber-700",
      bgAccent: "bg-amber-50",
      borderAccent: "border-amber-100",
      btnConfirm: "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-200",
    },
    info: {
      icon: <Info size={24} />,
      iconBg: "bg-gold",
      accent: "text-ink",
      bgAccent: "bg-cream/30",
      borderAccent: "border-cream-dark",
      btnConfirm: "bg-gold hover:bg-gold-dark text-white shadow-gold/20",
    }
  };

  const v = variants[variant];

  return (
    <div className="fixed inset-0 bg-ink/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div 
        className={clsx(
          "bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border animate-in zoom-in-95 duration-300",
          v.borderAccent
        )}
      >
        {/* Header */}
        <div className={clsx("p-6 flex items-center justify-between", v.bgAccent)}>
          <div className="flex items-center gap-4">
            <div className={clsx("w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg", v.iconBg)}>
              {v.icon}
            </div>
            <div>
              <h3 className={clsx("font-display text-xl font-bold leading-tight", v.accent)}>{title}</h3>
              <p className={clsx("text-[10px] font-black uppercase tracking-[0.2em] opacity-60", v.accent)}>
                Validation Requise
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-white/50 rounded-full transition-colors opacity-40 hover:opacity-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-8">
          <div className={clsx("p-5 rounded-2xl border mb-8 flex gap-4", v.bgAccent, v.borderAccent)}>
            <div className={clsx("mt-0.5", v.accent)}>
              <AlertCircle size={20} />
            </div>
            <p className="text-sm font-medium leading-relaxed text-ink/80">
              {message}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="py-4 bg-cream text-ink-muted font-display font-bold rounded-2xl hover:bg-cream-dark transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className={clsx(
                "py-4 font-display font-black rounded-2xl shadow-xl transition-all active:scale-[0.98] disabled:opacity-50",
                v.btnConfirm
              )}
            >
              {isLoading ? "Traitement..." : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
