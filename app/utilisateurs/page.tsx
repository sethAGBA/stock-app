"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { utilisateursService } from "@/lib/db";
import type { AppUser, UserRole, Magasin } from "@/types";
import { useAuth } from "@/lib/auth-context";
import { UserPlus, Mail, Shield, CheckCircle2, XCircle, Search, Edit2, Key, Trash2, Store } from "lucide-react";
import toast from "react-hot-toast";
import { initializeApp, getApps, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import clsx from "clsx";

// On récupère la config pour l'auth secondaire
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export default function UtilisateursPage() {
  const [utilisateurs, setUtilisateurs] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  const [form, setForm] = useState({
    nom: "", prenom: "", email: "", password: "", role: "vendeur" as UserRole, magasinId: ""
  });
  const { appUser, magasins } = useAuth();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const data = await utilisateursService.getAll();
      setUtilisateurs(data);
    } catch (err) {
      toast.error("Erreur lors de la récupération des utilisateurs");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalLoading(true);

    let secondaryApp;
    try {
      // Trick : Initialiser une app secondaire pour créer l'utilisateur sans déconnecter l'admin
      const appName = `secondary-${Date.now()}`;
      secondaryApp = initializeApp(firebaseConfig, appName);
      const secondaryAuth = getAuth(secondaryApp);

      // 1. Créer le compte Auth
      const cred = await createUserWithEmailAndPassword(secondaryAuth, form.email, form.password);

      // 2. Créer le profil Firestore
      await utilisateursService.create(cred.user.uid, {
        nom: form.nom,
        prenom: form.prenom,
        email: form.email,
        role: form.role,
        magasinId: form.magasinId || null,
        actif: true,
      }, { uid: appUser!.uid, nom: `${appUser!.prenom} ${appUser!.nom}` });

      toast.success("Utilisateur créé avec succès");
      setShowModal(false);
      setForm({ nom: "", prenom: "", email: "", password: "", role: "vendeur", magasinId: "" });
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la création");
    } finally {
      if (secondaryApp) await deleteApp(secondaryApp);
      setModalLoading(false);
    }
  };

  const toggleStatus = async (user: AppUser) => {
    try {
      await utilisateursService.update(user.uid, { actif: !user.actif }, { uid: appUser!.uid, nom: `${appUser!.prenom} ${appUser!.nom}` });
      toast.success(`Utilisateur ${user.actif ? "désactivé" : "activé"}`);
      fetchUsers();
    } catch (err) {
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const filtered = utilisateurs.filter(u =>
    u.nom.toLowerCase().includes(search.toLowerCase()) ||
    u.prenom.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-mono tracking-widest text-ink-muted uppercase mb-1">Administration</p>
            <h2 className="font-display text-3xl font-semibold text-ink">Équipe & Utilisateurs</h2>
            <p className="text-sm text-ink-muted mt-1">Gérez les accès et les rôles de vos collaborateurs.</p>
          </div>

          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
            <UserPlus size={18} /> Nouvel utilisateur
          </button>
        </div>

        {/* Filters */}
        <div className="card p-4 flex items-center gap-4 bg-white">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un membre de l'équipe..."
              className="input pl-10"
            />
          </div>
        </div>

        {/* Users Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(user => (
              <div key={user.uid} className={clsx("card p-6 bg-white border transition-all", !user.actif && "opacity-60")}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-cream flex items-center justify-center text-gold font-bold text-lg">
                      {user.prenom[0]}{user.nom[0]}
                    </div>
                    <div>
                      <h4 className="font-semibold text-ink leading-tight">{user.prenom} {user.nom}</h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Mail size={12} className="text-ink-muted" />
                        <span className="text-xs text-ink-muted truncate max-w-[140px]">{user.email}</span>
                      </div>
                    </div>
                  </div>
                  <div className={clsx(
                    "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
                    user.role === "admin" ? "bg-gold/10 text-gold" :
                      user.role === "gestionnaire" ? "bg-blue-50 text-blue-600" :
                        user.role === "vendeur" ? "bg-green-50 text-green-600" : "bg-cream text-ink-muted"
                  )}>
                    {user.role}
                  </div>
                </div>

                {user.magasinId && (
                  <div className="flex items-center gap-2 mb-4 text-[10px] font-bold text-ink-muted p-2 bg-cream/30 rounded-lg">
                    <Store size={12} className="text-gold" />
                    <span className="truncate">
                      {magasins.find(m => m.id === user.magasinId)?.nom || "Magasin inconnu"}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-cream-dark mt-auto">
                  <div className="flex items-center gap-2">
                    {user.actif ? (
                      <span className="flex items-center gap-1 text-[10px] font-medium text-green-600">
                        <CheckCircle2 size={12} /> Actif
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-medium text-red-600">
                        <XCircle size={12} /> Inactif
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleStatus(user)} className="p-2 hover:bg-cream rounded-lg transition-colors text-ink-muted" title={user.actif ? "Désactiver" : "Activer"}>
                      <Shield size={16} />
                    </button>
                    {/* Pour l'UI, on met des boutons placeholders pour edit/delete */}
                    <button className="p-2 hover:bg-cream rounded-lg transition-colors text-ink-muted">
                      <Edit2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="p-6 border-b border-cream-dark bg-cream/30 flex items-center justify-between">
                <h3 className="font-display font-semibold text-xl">Nouvel Utilisateur</h3>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-cream rounded-full text-ink-muted">
                  <XCircle size={20} />
                </button>
              </div>
              <form onSubmit={handleCreateUser} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-ink-muted px-1">Prénom</label>
                    <input required className="input" placeholder="Marc" value={form.prenom} onChange={e => setForm({ ...form, prenom: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-ink-muted px-1">Nom</label>
                    <input required className="input" placeholder="Lavoine" value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-ink-muted px-1">Email</label>
                  <input type="email" required className="input" placeholder="marc@vision.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-ink-muted px-1">Mot de passe provisoire</label>
                  <input type="password" required minLength={6} className="input" placeholder="••••••••" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-ink-muted px-1">Rôle</label>
                  <select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value as UserRole })}>
                    <option value="vendeur">Vendeur (POS uniquement)</option>
                    <option value="gestionnaire">Gestionnaire (Stock & Catalog)</option>
                    <option value="admin">Administrateur (Tout accès)</option>
                    <option value="lecteur">Lecteur (Consultation seule)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-ink-muted px-1">Magasin Assigné</label>
                  <select className="input" value={form.magasinId} onChange={e => setForm({ ...form, magasinId: e.target.value })}>
                    <option value="">Aucun (Accès global Admin)</option>
                    {magasins.map(m => (
                      <option key={m.id} value={m.id}>{m.nom}</option>
                    ))}
                  </select>
                  <p className="text-[9px] text-ink-muted italic px-1 mt-1">Obligatoire pour les Vendeurs et Gestionnaires.</p>
                </div>
                <button type="submit" disabled={modalLoading} className="w-full btn-primary py-3 mt-4">
                  {modalLoading ? "Création en cours..." : "Créer le compte"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
