"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { magasinsService, utilisateursService } from "@/lib/db";
import type { Magasin, AppUser } from "@/types";
import { Store, Plus, Edit2, Trash2, X, Users, CheckCircle, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import clsx from "clsx";
import { useAuth } from "@/lib/auth-context";

export default function MagasinsPage() {
    const { appUser } = useAuth();
    const [magasins, setMagasins] = useState<Magasin[]>([]);
    const [utilisateurs, setUtilisateurs] = useState<AppUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<Magasin | null>(null);
    const [form, setForm] = useState({ nom: "", adresse: "", telephone: "" });
    const [selectedMagasin, setSelectedMagasin] = useState<Magasin | null>(null);

    useEffect(() => {
        if (!appUser) return;
        Promise.all([magasinsService.getAll(), utilisateursService.getAll()])
            .then(([m, u]) => {
                setMagasins(m);
                setUtilisateurs(u);
                setLoading(false);
            });
    }, [appUser]);

    const reload = async () => {
        const [m, u] = await Promise.all([magasinsService.getAll(), utilisateursService.getAll()]);
        setMagasins(m);
        setUtilisateurs(u);
    };

    const openCreate = () => {
        setEditing(null);
        setForm({ nom: "", adresse: "", telephone: "" });
        setShowModal(true);
    };

    const openEdit = (m: Magasin) => {
        setEditing(m);
        setForm({ nom: m.nom, adresse: m.adresse || "", telephone: m.telephone || "" });
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.nom) return toast.error("Le nom est obligatoire");
        setSaving(true);
        try {
            if (editing) {
                await magasinsService.update(editing.id, form);
                toast.success("Magasin modifié");
            } else {
                await magasinsService.create({ nom: form.nom, adresse: form.adresse, telephone: form.telephone, actif: true });
                toast.success("Magasin créé");
            }
            await reload();
            setShowModal(false);
        } catch (err: any) {
            toast.error(err.message || "Erreur");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (m: Magasin) => {
        if (!confirm(`Supprimer le magasin "${m.nom}" ?`)) return;
        await magasinsService.delete(m.id);
        toast.success("Magasin supprimé");
        await reload();
    };

    const handleAssignUser = async (userId: string, magasinId: string | null) => {
        await magasinsService.assignUserToMagasin(userId, magasinId);
        toast.success("Affectation mise à jour");
        await reload();
    };

    const usersForMagasin = (magasinId: string) =>
        utilisateurs.filter(u => u.magasinId === magasinId);

    const unassignedUsers = utilisateurs.filter(u => !u.magasinId && u.role !== "admin");

    if (loading) return (
        <AppLayout>
            <div className="flex items-center justify-center h-64">
                <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
            </div>
        </AppLayout>
    );

    return (
        <AppLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-mono tracking-widest text-ink-muted uppercase mb-1">Administration</p>
                        <h2 className="font-display text-3xl font-semibold text-ink">Gestion des Magasins</h2>
                    </div>
                    <button onClick={openCreate} className="btn-primary flex items-center gap-2">
                        <Plus size={16} /> Nouveau Magasin
                    </button>
                </div>

                {/* Stores Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {magasins.map(m => (
                        <div
                            key={m.id}
                            className={clsx(
                                "card hover:border-gold/40 transition-all cursor-pointer",
                                selectedMagasin?.id === m.id && "border-gold shadow-lg"
                            )}
                            onClick={() => setSelectedMagasin(selectedMagasin?.id === m.id ? null : m)}
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
                                    <Store size={20} className="text-gold" />
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={e => { e.stopPropagation(); openEdit(m); }} className="p-1.5 text-ink-muted hover:text-gold hover:bg-gold/10 rounded-md">
                                        <Edit2 size={13} />
                                    </button>
                                    <button onClick={e => { e.stopPropagation(); handleDelete(m); }} className="p-1.5 text-ink-muted hover:text-red-500 hover:bg-red-50 rounded-md">
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>

                            <h3 className="font-display text-lg font-bold text-ink">{m.nom}</h3>
                            {m.adresse && <p className="text-xs text-ink-muted mt-1">{m.adresse}</p>}
                            {m.telephone && <p className="text-xs text-ink-muted">{m.telephone}</p>}

                            <div className="mt-4 pt-3 border-t border-cream-dark flex items-center gap-2">
                                <Users size={12} className="text-gold" />
                                <span className="text-xs text-ink-muted">
                                    {usersForMagasin(m.id).length} utilisateur(s) assigné(s)
                                </span>
                                <span className={clsx("ml-auto text-[10px] font-black uppercase px-2 py-0.5 rounded-full", m.actif ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500")}>
                                    {m.actif ? "Actif" : "Inactif"}
                                </span>
                            </div>
                        </div>
                    ))}

                    {magasins.length === 0 && (
                        <div className="col-span-full py-20 text-center text-ink-muted">
                            <Store size={40} className="mx-auto opacity-20 mb-3" />
                            <p>Aucun magasin créé</p>
                        </div>
                    )}
                </div>

                {/* User Assignment Panel */}
                {selectedMagasin && (
                    <div className="card border-gold/20 bg-gold/5 animate-in fade-in slide-in-from-top-4 duration-300">
                        <h3 className="font-display text-lg font-bold text-ink mb-4 flex items-center gap-2">
                            <Users size={18} className="text-gold" />
                            Utilisateurs — {selectedMagasin.nom}
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Assigned */}
                            <div>
                                <p className="text-[10px] uppercase font-black text-ink-muted tracking-widest mb-3">Assignés à ce magasin</p>
                                <div className="space-y-2">
                                    {usersForMagasin(selectedMagasin.id).map(u => (
                                        <div key={u.uid} className="flex items-center justify-between p-3 bg-white rounded-xl border border-cream-dark">
                                            <div>
                                                <p className="text-sm font-bold text-ink">{u.prenom} {u.nom}</p>
                                                <p className="text-[10px] text-ink-muted uppercase">{u.role}</p>
                                            </div>
                                            <button
                                                onClick={() => handleAssignUser(u.uid, null)}
                                                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                title="Retirer du magasin"
                                            >
                                                <XCircle size={16} />
                                            </button>
                                        </div>
                                    ))}
                                    {usersForMagasin(selectedMagasin.id).length === 0 && (
                                        <p className="text-xs text-ink-muted italic">Aucun utilisateur assigné</p>
                                    )}
                                </div>
                            </div>

                            {/* Unassigned */}
                            <div>
                                <p className="text-[10px] uppercase font-black text-ink-muted tracking-widest mb-3">Utilisateurs disponibles</p>
                                <div className="space-y-2">
                                    {unassignedUsers.map(u => (
                                        <div key={u.uid} className="flex items-center justify-between p-3 bg-white rounded-xl border border-cream-dark">
                                            <div>
                                                <p className="text-sm font-bold text-ink">{u.prenom} {u.nom}</p>
                                                <p className="text-[10px] text-ink-muted uppercase">{u.role}</p>
                                            </div>
                                            <button
                                                onClick={() => handleAssignUser(u.uid, selectedMagasin.id)}
                                                className="p-1.5 text-green-500 hover:text-green-700 hover:bg-green-50 rounded-lg transition-all"
                                                title="Assigner à ce magasin"
                                            >
                                                <CheckCircle size={16} />
                                            </button>
                                        </div>
                                    ))}
                                    {unassignedUsers.length === 0 && (
                                        <p className="text-xs text-ink-muted italic">Tous les utilisateurs sont assignés</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-cream-dark">
                            <h3 className="font-display text-xl font-semibold">{editing ? "Modifier le magasin" : "Nouveau magasin"}</h3>
                            <button onClick={() => setShowModal(false)} className="text-ink-muted hover:text-ink"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                            <div>
                                <label className="label">Nom du magasin *</label>
                                <input required value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} className="input" placeholder="Ex: Boutique Centre-Ville" autoFocus />
                            </div>
                            <div>
                                <label className="label">Adresse</label>
                                <input value={form.adresse} onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))} className="input" placeholder="Ex: Rue du Commerce, Lomé" />
                            </div>
                            <div>
                                <label className="label">Téléphone</label>
                                <input value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} className="input" placeholder="+228 XX XX XX XX" />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Annuler</button>
                                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? "Enregistrement..." : "Enregistrer"}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
