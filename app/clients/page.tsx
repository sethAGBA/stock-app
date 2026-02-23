"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { clientsService } from "@/lib/db";
import type { Client } from "@/types";
import { Plus, Search, Edit2, Trash2, X, Phone, Mail, MapPin, DollarSign, Clock, ArrowRight, Wallet, User, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import clsx from "clsx";
import { formatPrice, formatCurrency } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";

export default function ClientsPage() {
    const { appUser } = useAuth();
    const [clients, setClients] = useState<Client[]>([]);
    const [search, setSearch] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<Client | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedClientForPayment, setSelectedClientForPayment] = useState<Client | null>(null);
    const [paymentAmount, setPaymentAmount] = useState<number>(0);

    const [form, setForm] = useState({
        nom: "", prenom: "", email: "", telephone: "", adresse: ""
    });

    const isGestionnaire = appUser?.role === "admin" || appUser?.role === "gestionnaire";
    const isAdmin = appUser?.role === "admin";

    useEffect(() => {
        if (!appUser) return;
        clientsService.getAll().then(setClients);
    }, [appUser]);

    const reload = () => clientsService.getAll().then(setClients);

    const filtered = clients.filter(c =>
        c.nom.toLowerCase().includes(search.toLowerCase()) ||
        c.prenom?.toLowerCase().includes(search.toLowerCase()) ||
        c.telephone?.includes(search)
    );

    const openCreate = () => {
        setEditing(null);
        setForm({ nom: "", prenom: "", email: "", telephone: "", adresse: "" });
        setShowModal(true);
    };

    const openEdit = (c: Client) => {
        setEditing(c);
        setForm({
            nom: c.nom,
            prenom: c.prenom || "",
            email: c.email || "",
            telephone: c.telephone || "",
            adresse: c.adresse || ""
        });
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (editing) {
                await clientsService.update(editing.id, form, { uid: appUser!.uid, nom: `${appUser!.prenom} ${appUser!.nom}` });
                toast.success("Client modifié");
            } else {
                await clientsService.create(form as any, { uid: appUser!.uid, nom: `${appUser!.prenom} ${appUser!.nom}` });
                toast.success("Client créé");
            }
            await reload();
            setShowModal(false);
        } catch (err: any) {
            toast.error(err.message || "Erreur");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        const c = clients.find(item => item.id === id);
        if (!c || !confirm(`Supprimer le client "${c.prenom} ${c.nom}" ?`)) return;
        await clientsService.delete(id, `${c.prenom} ${c.nom}`, { uid: appUser!.uid, nom: `${appUser!.prenom} ${appUser!.nom}` });
        toast.success("Client supprimé");
        await reload();
    };

    const handleDebtPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClientForPayment || paymentAmount <= 0) return;

        setLoading(true);
        try {
            await clientsService.payerDette(selectedClientForPayment.id, paymentAmount);
            toast.success("Versement enregistré");
            await reload();
            setSelectedClientForPayment(null);
            setPaymentAmount(0);
        } catch (err: any) {
            toast.error(err.message || "Erreur");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AppLayout>
            <div className="space-y-5">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-mono tracking-widest text-ink-muted uppercase mb-1">Relation Client</p>
                        <h2 className="font-display text-3xl font-semibold text-ink">Clients</h2>
                    </div>
                    {isGestionnaire && (
                        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
                            <Plus size={15} /> Nouveau client
                        </button>
                    )}
                </div>

                {/* Search */}
                <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un client..." className="input pl-9" />
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map(c => (
                        <div key={c.id} className="card hover:border-gold/30 transition-all group">
                            <div className="flex items-start justify-between mb-4">
                                <div className="w-10 h-10 rounded-full bg-cream flex items-center justify-center text-gold">
                                    <User size={20} />
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {isGestionnaire && (
                                        <button onClick={() => openEdit(c)} className="p-1.5 text-ink-muted hover:text-gold hover:bg-gold/10 rounded-md">
                                            <Edit2 size={13} />
                                        </button>
                                    )}
                                    {isAdmin && (
                                        <button onClick={() => handleDelete(c.id)} className="p-1.5 text-ink-muted hover:text-red-500 hover:bg-red-50 rounded-md">
                                            <Trash2 size={13} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <h3 className="font-semibold text-ink text-lg">{c.prenom} {c.nom}</h3>
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-xs text-ink-muted">Achats : {formatCurrency(c.totalAchats)}</p>
                                {c.soldeDette > 0 && (
                                    <div className="flex items-center gap-1 bg-red-50 text-red-600 px-2 py-1 rounded-lg border border-red-100 animate-pulse">
                                        <AlertCircle size={10} />
                                        <span className="text-[10px] font-black uppercase">Dette : {formatCurrency(c.soldeDette)}</span>
                                    </div>
                                )}
                            </div>

                            {c.soldeDette > 0 && isGestionnaire && (
                                <button
                                    onClick={() => {
                                        setSelectedClientForPayment(c);
                                        setPaymentAmount(c.soldeDette);
                                    }}
                                    className="w-full mb-4 flex items-center justify-center gap-2 py-2 bg-gold/10 text-gold rounded-xl hover:bg-gold hover:text-white transition-all font-bold text-xs"
                                >
                                    <Wallet size={14} />
                                    Enregistrer un versement
                                </button>
                            )}

                            <div className="space-y-2 text-sm text-ink-muted border-t border-cream-dark pt-4">
                                {c.telephone && (
                                    <div className="flex items-center gap-2">
                                        <Phone size={12} className="text-gold" />
                                        <span>{c.telephone}</span>
                                    </div>
                                )}
                                {c.email && (
                                    <div className="flex items-center gap-2">
                                        <Mail size={12} className="text-gold" />
                                        <span className="truncate">{c.email}</span>
                                    </div>
                                )}
                                {c.adresse && (
                                    <div className="flex items-center gap-2">
                                        <MapPin size={12} className="text-gold" />
                                        <span className="truncate">{c.adresse}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {filtered.length === 0 && (
                        <div className="col-span-full py-20 text-center text-ink-muted">
                            <p>Aucun client trouvé</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-cream-dark">
                            <h3 className="font-display text-xl font-semibold">{editing ? "Modifier le client" : "Nouveau client"}</h3>
                            <button onClick={() => setShowModal(false)} className="text-ink-muted hover:text-ink"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Prénom</label>
                                    <input value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))} className="input" placeholder="Jean" />
                                </div>
                                <div>
                                    <label className="label">Nom *</label>
                                    <input required value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} className="input" placeholder="Dupont" />
                                </div>
                            </div>
                            <div>
                                <label className="label">Téléphone</label>
                                <input value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} className="input" placeholder="+228 XX XX XX XX" />
                            </div>
                            <div>
                                <label className="label">Email</label>
                                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="input" placeholder="client@example.com" />
                            </div>
                            <div>
                                <label className="label">Adresse</label>
                                <input value={form.adresse} onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))} className="input" placeholder="Lomé, Togo" />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Annuler</button>
                                <button type="submit" disabled={loading} className="btn-primary flex-1">{loading ? "Enregistrement..." : "Enregistrer"}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {selectedClientForPayment && (
                <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-gold p-6 text-white text-center">
                            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                <Wallet size={24} />
                            </div>
                            <h3 className="font-display text-xl font-bold">Remboursement de Dette</h3>
                            <p className="text-gold-light text-xs opacity-80 mt-1 uppercase tracking-widest font-bold">
                                {selectedClientForPayment.prenom} {selectedClientForPayment.nom}
                            </p>
                        </div>

                        <form onSubmit={handleDebtPayment} className="p-8 space-y-6">
                            <div className="bg-cream/30 p-4 rounded-2xl text-center">
                                <span className="text-[10px] uppercase font-black text-ink-muted tracking-widest block mb-1">Dette actuelle</span>
                                <span className="text-2xl font-black text-ink">{formatCurrency(selectedClientForPayment.soldeDette)}</span>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] uppercase font-black text-ink-muted tracking-widest pl-1">Montant du versement</label>
                                <div className="relative">
                                    <input
                                        autoFocus
                                        required
                                        type="number"
                                        max={selectedClientForPayment.soldeDette}
                                        min="1"
                                        value={paymentAmount}
                                        onChange={e => setPaymentAmount(Number(e.target.value))}
                                        className="w-full text-2xl font-black bg-cream/10 border-2 border-cream-dark rounded-2xl p-4 pr-12 focus:border-gold focus:ring-0 transition-all outline-none text-gold"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gold font-bold">F</span>
                                </div>
                                <p className="text-[10px] text-ink-muted italic pl-1">
                                    Le solde restant sera de {formatCurrency(selectedClientForPayment.soldeDette - paymentAmount)}
                                </p>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setSelectedClientForPayment(null)} className="flex-1 py-4 text-ink-muted font-bold hover:bg-cream rounded-2xl transition-all">
                                    Annuler
                                </button>
                                <button type="submit" disabled={loading} className="flex-[2] btn-primary py-4 text-lg font-black shadow-xl shadow-gold/20">
                                    {loading ? "Chargement..." : "Confirmer"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
