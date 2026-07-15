"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { etablissementService } from "@/lib/db";
import type { Etablissement } from "@/types";
import { ShieldCheck, Calendar, Clock, CreditCard, Save, RefreshCw, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";
import clsx from "clsx";

export default function LicenceAdminPage() {
  const router = useRouter();
  const { appUser } = useAuth();
  const [licence, setLicence] = useState<Etablissement | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!appUser) return;
    
    // Protection SuperAdmin
    if (appUser.role === 'admin' && !appUser.isSuperAdmin) {
      toast.error("Accès réservé au Super-Administrateur");
      router.push("/dashboard");
      return;
    }

    etablissementService.get().then(l => {
      setLicence(l);
      setLoading(false);
    });
  }, [appUser, router]);

  const handleUpdateLicense = async (status: "active" | "trial" | "expired", monthsToAdd: number = 0, specificDate?: Date) => {
    if (!licence || !appUser) return;
    setSaving(true);
    try {
      // S'assurer de partir d'une date valide (si Invalid Date, prendre aujourd'hui)
      const baseDate = isNaN(licence.licenseExpiryDate.getTime()) ? new Date() : licence.licenseExpiryDate;
      let newExpiry = new Date(baseDate);
      
      if (specificDate) {
        newExpiry = specificDate;
      } else if (monthsToAdd !== 0) {
        newExpiry.setMonth(newExpiry.getMonth() + monthsToAdd);
      }

      const { id, updatedAt, ...cleanData } = licence;

      await etablissementService.save({
        ...cleanData,
        licenseStatus: status,
        licenseExpiryDate: newExpiry,
        lastPaymentDate: new Date()
      }, { uid: appUser.uid, nom: `${appUser.prenom} ${appUser.nom}` });

      const updated = await etablissementService.get();
      setLicence(updated);
      toast.success("Licence mise à jour avec succès");
    } catch (err: any) {
      console.error("Activation Error:", err);
      toast.error(`Erreur: ${err.message || "Problème inconnu"}`);
    } finally {
      setSaving(false);
    }
  };

  const daysLeft = licence 
    ? Math.ceil((licence.licenseExpiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="text-gold animate-spin" size={24} />
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <p className="text-[10px] font-mono tracking-widest text-ink-muted uppercase mb-1">Super Administration</p>
          <h2 className="font-display text-3xl font-semibold text-ink">Activation du Logiciel</h2>
          <p className="text-sm text-ink-muted mt-2">Gérez la période de validité et le statut de l'abonnement de ce client.</p>
        </div>

        {/* Status Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card border-none bg-ink text-white p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <ShieldCheck size={80} />
            </div>
            <p className="text-[10px] uppercase font-black tracking-[0.2em] text-gold mb-4">Statut Actuel</p>
            <h3 className="text-3xl font-display font-black capitalize">{licence?.licenseStatus}</h3>
            <div className="mt-6 flex items-center gap-2">
               <div className={clsx("w-2 h-2 rounded-full animate-pulse", daysLeft > 0 ? "bg-green-500" : "bg-red-500")} />
               <span className="text-xs text-white/60">{daysLeft > 0 ? `${daysLeft} jours restants` : "Expiré"}</span>
            </div>
          </div>

          <div className="card p-6 flex flex-col justify-between">
            <div className="flex items-center gap-3 text-ink-muted mb-4 text-[10px] uppercase font-black tracking-widest">
              <Calendar size={14} className="text-gold" />
              Date d'Expiration
            </div>
            <p className="text-xl font-bold text-ink">
              {licence?.licenseExpiryDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>

          <div className="card p-6 flex flex-col justify-between">
            <div className="flex items-center gap-3 text-ink-muted mb-4 text-[10px] uppercase font-black tracking-widest">
              <Clock size={14} className="text-gold" />
              Dernier Paiement
            </div>
            <p className="text-xl font-bold text-ink">
              {licence?.lastPaymentDate?.toLocaleDateString('fr-FR') || "Jamais"}
            </p>
          </div>
        </div>

        {/* Actions Section */}
        <div className="space-y-6">
          <h3 className="font-display text-xl font-bold text-ink flex items-center gap-2">
            <CreditCard size={20} className="text-gold" />
            Actions de Renouvellement
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button 
              onClick={() => handleUpdateLicense("active", 12)}
              disabled={saving}
              className="p-8 border-2 border-cream hover:border-gold hover:bg-gold/5 rounded-[2rem] text-left transition-all group active:scale-[0.98]"
            >
              <div className="w-12 h-12 bg-gold/10 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-gold group-hover:text-white transition-colors">
                <ShieldCheck size={24} />
              </div>
              <h4 className="font-bold text-lg text-ink">Activer pour 1 an</h4>
              <p className="text-xs text-ink-muted mt-1">Ajoute 12 mois à la date d'expiration actuelle et passe le statut en "Actif".</p>
            </button>

            <button 
              onClick={() => handleUpdateLicense("active", 1)}
              disabled={saving}
              className="p-8 border-2 border-cream hover:border-gold hover:bg-gold/5 rounded-[2rem] text-left transition-all group active:scale-[0.98]"
            >
              <div className="w-12 h-12 bg-gold/10 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-gold group-hover:text-white transition-colors">
                <RefreshCw size={24} />
              </div>
              <h4 className="font-bold text-lg text-ink">Prolonger de 1 mois</h4>
              <p className="text-xs text-ink-muted mt-1">Solution temporaire pour dépannage ou paiement mensuel.</p>
            </button>
          </div>

          {/* Manual Adjustment */}
          <div className="card p-8 border-2 border-cream bg-white rounded-[2rem] space-y-6">
            <h4 className="font-bold text-lg text-ink flex items-center gap-2">
              <Calendar size={18} className="text-gold" />
              Ajustement Manuel de la Date
            </h4>
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 space-y-2">
                <label className="text-[10px] uppercase font-black tracking-widest text-ink-muted">Nouvelle date d'expiration</label>
                <input 
                  type="date" 
                  value={licence?.licenseExpiryDate.toISOString().split('T')[0]}
                  onChange={(e) => {
                    const d = new Date(e.target.value);
                    if (!isNaN(d.getTime())) {
                      setLicence({ ...licence!, licenseExpiryDate: d });
                    }
                  }}
                  className="w-full bg-cream border-none rounded-xl px-4 py-3 text-sm font-bold text-ink outline-none focus:ring-2 focus:ring-gold/20 transition-all"
                />
              </div>
              <button 
                onClick={() => handleUpdateLicense("active", 0, licence?.licenseExpiryDate)}
                disabled={saving}
                className="btn-primary py-3 px-8 shadow-xl shadow-gold/20"
              >
                Appliquer la Date
              </button>
            </div>
            <p className="text-[10px] text-ink-muted leading-relaxed italic">
              * Utilisez cet outil pour corriger les erreurs de saisie ou définir une date spécifique non prévue par les boutons ci-dessus.
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-100 p-6 rounded-[2rem] flex gap-4">
             <AlertCircle className="text-amber-600 shrink-0" size={24} />
             <div>
               <p className="text-sm font-bold text-amber-900">Attention</p>
               <p className="text-xs text-amber-700 leading-relaxed mt-1">
                 En cas de besoin d'assistance pour le renouvellement, contactez le support par email à <strong>visionplusconsulting742@gmail.com</strong> ou par WhatsApp au <strong>+228 93005981</strong>.
                 Ces actions sont définitives et seront tracées dans les logs d'audit.
               </p>
             </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
