"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { utilisateursService, etablissementService } from "@/lib/db";
import { auth } from "@/lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import toast from "react-hot-toast";

export default function SetupPage() {
    const [loading, setLoading] = useState(true);
    const [formLoading, setFormLoading] = useState(false);
    const [form, setForm] = useState({
        nom: "", prenom: "", email: "", password: "",
    });
    const router = useRouter();

    useEffect(() => {
        utilisateursService.count().then(count => {
            if (count > 0) {
                toast.error("Le système est déjà initialisé");
                router.push("/login");
            } else {
                setLoading(false);
            }
        }).catch(err => {
            console.error("Erreur check init:", err);
            // On laisse l'utilisateur essayer quand même si le check échoue
            setLoading(false);
        });
    }, [router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormLoading(true);
        try {
            // 1. Essayer de créer le compte Firebase Auth
            let uid;
            try {
                const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
                uid = cred.user.uid;
            } catch (authErr: any) {
                // Si l'email existe déjà (cas d'une tentative précédente échouée côté Firestore)
                if (authErr.code === "auth/email-already-in-use") {
                    // On tente de se connecter avec les identifiants fournis
                    const { signInWithEmailAndPassword } = await import("firebase/auth");
                    const userCred = await signInWithEmailAndPassword(auth, form.email, form.password);
                    uid = userCred.user.uid;
                    toast("Compte existant détecté, tentative de réparation...", { icon: "🔧" });
                } else {
                    throw authErr;
                }
            }

            // 2. Créer ou écraser le profil Firestore (Réparation)
            await utilisateursService.create(uid, {
                nom: form.nom,
                prenom: form.prenom,
                email: form.email,
                role: "admin",
                actif: true,
                isSuperAdmin: true,
            }, { uid, nom: `${form.prenom} ${form.nom}` });

            // 3. Initialiser la configuration globale avec une période d'essai
            const trialExpiry = new Date();
            trialExpiry.setDate(trialExpiry.getDate() + 14); // 14 jours d'essai

            await etablissementService.save({
                nom: "Ma Boutique",
                devise: "XOF",
                licenseStatus: "trial",
                licenseExpiryDate: trialExpiry,
            }, { uid, nom: `${form.prenom} ${form.nom}` });

            toast.success("Administrateur et système configurés !");
            router.push("/login"); // Le middleware ou l'auth context devrait prendre le relais
        } catch (err: any) {
            console.error(err);
            if (err.code === "auth/wrong-password") {
                toast.error("Ce compte existe déjà avec un mot de passe différent.");
            } else {
                toast.error(err.message || "Une erreur est survenue");
            }
        } finally {
            setFormLoading(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-cream flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="min-h-screen bg-[#111] flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <p className="text-[10px] tracking-[.3em] uppercase text-gold font-mono mb-3">Initialisation</p>
                    <h1 className="text-white font-display text-3xl font-light">Créer l'administrateur</h1>
                    <p className="text-white/40 text-sm mt-3 px-8">Bienvenue sur StockApp. Avant de commencer, créez votre compte administrateur principal.</p>
                </div>

                <form onSubmit={handleSubmit} className="card bg-white/5 border-white/10 p-8 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label text-white/40">Prénom</label>
                            <input required value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))}
                                className="input bg-white/5 border-white/10 text-white" placeholder="Jean" />
                        </div>
                        <div>
                            <label className="label text-white/40">Nom</label>
                            <input required value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                                className="input bg-white/5 border-white/10 text-white" placeholder="Dupont" />
                        </div>
                    </div>
                    <div>
                        <label className="label text-white/40">Email professionnel</label>
                        <input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                            className="input bg-white/5 border-white/10 text-white" placeholder="admin@vision-consulting.com" />
                    </div>
                    <div>
                        <label className="label text-white/40">Mot de passe (min. 6 caractères)</label>
                        <input type="password" required minLength={6} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                            className="input bg-white/5 border-white/10 text-white" placeholder="••••••••" />
                    </div>

                    <button type="submit" disabled={formLoading}
                        className="w-full btn-primary py-3 text-base mt-4 shadow-xl shadow-gold/20">
                        {formLoading ? "Initialisation..." : "Finaliser l'installation"}
                    </button>
                </form>
            </div>
        </div>
    );
}
