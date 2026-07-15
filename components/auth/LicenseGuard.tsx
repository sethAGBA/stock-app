"use client";
import { useAuth } from "@/lib/auth-context";
import { ShieldAlert, CreditCard, Mail, MessageSquare, AlertTriangle, Key } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { licenceService } from "@/lib/db";
import toast from "react-hot-toast";

export function LicenseGuard({ children }: { children: React.ReactNode }) {
  const { isExpired, licenseDaysLeft, loading, appUser } = useAuth();
  const [key, setKey] = useState("");
  const [activating, setActivating] = useState(false);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim() || !appUser) return;
    
    setActivating(true);
    try {
      await licenceService.validerEtActiver(key, { uid: appUser.uid, nom: `${appUser.prenom} ${appUser.nom}` });
      toast.success("Licence activée avec succès ! Redémarrage...");
      setTimeout(() => window.location.reload(), 2000);
    } catch (err: any) {
      toast.error(err.message || "Erreur d'activation");
    } finally {
      setActivating(false);
    }
  };

  const pathname = usePathname();

  // On ne bloque pas la page de login ni le setup
  const isPublicPage = pathname === "/login" || pathname === "/setup";
  
  if (loading || isPublicPage) return <>{children}</>;

  if (isExpired) {
    return (
      <div className="fixed inset-0 bg-ink z-[9999] flex items-center justify-center p-6 overflow-y-auto">
        <div className="max-w-md w-full space-y-8 text-center animate-in fade-in zoom-in duration-500">
          <div className="relative group">
            <div className="absolute inset-0 bg-red-500 blur-3xl opacity-20 group-hover:opacity-40 transition-opacity" />
            <div className="relative w-24 h-24 bg-red-600 rounded-[2rem] mx-auto flex items-center justify-center shadow-2xl rotate-12 group-hover:rotate-0 transition-transform duration-500">
              <ShieldAlert className="text-white" size={48} />
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="text-white font-display text-4xl font-black tracking-tight">
              Abonnement Expiré
            </h1>
            <p className="text-white/40 text-lg leading-relaxed">
              Votre accès à <span className="text-white">StockApp</span> a été suspendu suite à l'expiration de votre contrat annuel.
            </p>
          </div>

          <div className="space-y-4">
            {/* Formulaire d'activation */}
            <form onSubmit={handleActivate} className="space-y-3">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/20">
                  <Key size={18} />
                </div>
                <input 
                  type="text" 
                  value={key}
                  onChange={(e) => setKey(e.target.value.toUpperCase())}
                  placeholder="SAISISSEZ VOTRE CLÉ D'ACTIVATION"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white text-xs font-mono tracking-widest placeholder:text-white/10 outline-none focus:border-gold transition-all"
                />
              </div>
              <button 
                type="submit"
                disabled={activating || !key.trim()}
                className="w-full bg-gold hover:bg-gold-light text-white font-display font-black rounded-2xl py-4 text-sm shadow-xl shadow-gold/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {activating ? "VÉRIFICATION..." : "ACTIVER MON LOGICIEL"}
              </button>
            </form>

            <div className="card bg-white/5 border-white/10 p-6 backdrop-blur-xl text-left space-y-6">
              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <CreditCard className="text-gold" size={20} />
                </div>
                <div>
                  <p className="text-white font-bold text-sm">Action Requise</p>
                  <p className="text-white/40 text-xs mt-1">Veuillez régulariser votre situation pour débloquer vos données et reprendre vos ventes.</p>
                </div>
              </div>

              <div className="flex gap-4 items-start pt-4 border-t border-white/5">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <Mail className="text-gold" size={20} />
                </div>
                <div>
                  <p className="text-white font-bold text-sm">Email Support</p>
                  <p className="text-white/40 text-xs mt-1">visionplusconsulting742@gmail.com</p>
                </div>
              </div>

              <div className="flex gap-4 items-start pt-4 border-t border-white/5">
                <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center shrink-0">
                  <MessageSquare className="text-green-500" size={20} />
                </div>
                <div>
                  <p className="text-white font-bold text-sm">WhatsApp Support</p>
                  <p className="text-white/40 text-xs mt-1">+228 93005981</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => window.location.href = "mailto:visionplusconsulting742@gmail.com?subject=Renouvellement StockApp"}
                className="btn-secondary py-4 text-sm border-white/10 text-white hover:bg-white/5"
              >
                Par Email
              </button>
              <button 
                onClick={() => window.location.href = "https://wa.me/22893005981?text=Bonjour,%20je%20souhaite%20renouveler%20mon%20abonnement%20StockApp"}
                className="bg-green-600 hover:bg-green-700 text-white font-display font-black rounded-2xl py-4 text-sm shadow-xl shadow-green-900/20 transition-all active:scale-[0.98]"
              >
                Par WhatsApp
              </button>
            </div>
          </div>

          <p className="text-white/20 text-[10px] uppercase tracking-widest font-mono">
            Identifiant Client: {appUser?.email}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      {licenseDaysLeft > 0 && licenseDaysLeft <= 7 && (
        <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-right duration-500">
          <div className="bg-amber-500 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-4 max-w-sm border border-amber-400">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <AlertTriangle className="text-white" size={20} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest">Attention</p>
              <p className="text-sm font-bold">Votre abonnement expire dans {licenseDaysLeft} jours.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
