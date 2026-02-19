"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { categoriesService, unitesService, etablissementService } from "@/lib/db";
import type { Categorie, Unite } from "@/types";
import { Plus, Edit2, Trash2, X, Settings, Ruler, Tag, Building2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import toast from "react-hot-toast";
import clsx from "clsx";

type Tab = "categories" | "unites" | "etablissement";

export default function ConfigurationPage() {
    const { appUser } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>("categories");
    const [categories, setCategories] = useState<Categorie[]>([]);
    const [unites, setUnites] = useState<Unite[]>([]);
    const [etablissement, setEtablissement] = useState<any>({}); // Use Partial<Etablissement>
    const [loading, setLoading] = useState(true);

    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formLoading, setFormLoading] = useState(false);

    // Form state
    const [nom, setNom] = useState("");
    const [description, setDescription] = useState(""); // Pour catégorie
    const [abreviation, setAbreviation] = useState(""); // Pour unité

    const isGestionnaire = appUser?.role === "admin" || appUser?.role === "gestionnaire";

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true); // Don't block whole UI if just refreshing one
        try {
            // Parallel load
            const [cats, units, etab] = await Promise.all([
                categoriesService.getAll(),
                unitesService.getAll(),
                import("@/lib/db").then(m => m.etablissementService.get())
            ]);
            setCategories(cats);
            setUnites(units);
            if (etab) setEtablissement(etab);
        } catch (err) {
            console.error(err);
            toast.error("Erreur de chargement");
        } finally {
            setLoading(false);
        }
    };

    const openCreate = () => {
        setEditingId(null);
        setNom("");
        setDescription("");
        setAbreviation("");
        setShowModal(true);
    };

    const openEdit = (item: Categorie | Unite) => {
        setEditingId(item.id);
        setNom(item.nom);
        if (activeTab === "categories") {
            setDescription((item as Categorie).description || "");
        } else {
            setAbreviation((item as Unite).abreviation || "");
        }
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormLoading(true);
        try {
            if (activeTab === "categories") {
                if (editingId) {
                    await categoriesService.update(editingId, { nom, description });
                    toast.success("Catégorie modifiée");
                } else {
                    await categoriesService.create({ nom, description });
                    toast.success("Catégorie créée");
                }
            } else {
                if (editingId) {
                    await unitesService.update(editingId, { nom, abreviation });
                    toast.success("Unité modifiée");
                } else {
                    await unitesService.create({ nom, abreviation });
                    toast.success("Unité créée");
                }
            }
            await loadData();
            setShowModal(false);
        } catch (err: any) {
            toast.error(err.message || "Une erreur est survenue");
        } finally {
            setFormLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Êtes-vous sûr de vouloir supprimer cet élément ?")) return;
        try {
            if (activeTab === "categories") {
                await categoriesService.delete(id);
                toast.success("Catégorie supprimée");
            } else {
                await unitesService.delete(id);
                toast.success("Unité supprimée");
            }
            loadData();
        } catch (err) {
            toast.error("Erreur lors de la suppression");
        }
    };

    // Redirection si non autorisé (optionnel, déjà géré par middleware globalement mais bon pour UX)
    // if (!isGestionnaire && !loading) return <AppLayout><div className="p-8">Accès non autorisé</div></AppLayout>;

    return (
        <AppLayout>
            <div className="space-y-6 max-w-5xl mx-auto">
                <div>
                    <p className="text-[10px] font-mono tracking-widest text-ink-muted uppercase mb-1">Système</p>
                    <h2 className="font-display text-3xl font-semibold text-ink flex items-center gap-3">
                        <Settings className="text-gold" /> Configuration
                    </h2>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-cream-dark space-x-6">
                    <button
                        onClick={() => setActiveTab("categories")}
                        className={clsx(
                            "pb-3 text-sm font-medium transition-colors flex items-center gap-2",
                            activeTab === "categories" ? "text-gold border-b-2 border-gold" : "text-ink-muted hover:text-ink"
                        )}
                    >
                        <Tag size={16} /> Catégories Produits
                    </button>
                    <button
                        onClick={() => setActiveTab("unites")}
                        className={clsx(
                            "pb-3 text-sm font-medium transition-colors flex items-center gap-2",
                            activeTab === "unites" ? "text-gold border-b-2 border-gold" : "text-ink-muted hover:text-ink"
                        )}
                    >
                        <Ruler size={16} /> Unités de Mesure
                    </button>
                    <button
                        onClick={() => setActiveTab("etablissement")}
                        className={clsx(
                            "pb-3 text-sm font-medium transition-colors flex items-center gap-2",
                            activeTab === "etablissement" ? "text-gold border-b-2 border-gold" : "text-ink-muted hover:text-ink"
                        )}
                    >
                        <Building2 size={16} /> Établissement
                    </button>
                </div>

                {/* Content */}
                <div className="card min-h-[400px]">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-semibold">
                            {activeTab === "categories" ? "Liste des catégories" : activeTab === "unites" ? "Liste des unités" : "Informations de l'établissement"}
                        </h3>
                        {isGestionnaire && activeTab !== "etablissement" && (
                            <button onClick={openCreate} className="btn-primary flex items-center gap-2">
                                <Plus size={15} /> Nouveau
                            </button>
                        )}
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" /></div>
                    ) : activeTab === "etablissement" ? (
                        <ConfigurationEtablissement etablissement={etablissement} onSave={async (data) => {
                            setLoading(true);
                            try {
                                await etablissementService.save(data);
                                setEtablissement({ ...etablissement, ...data });
                                toast.success("Informations enregistrées");
                            } catch (e) {
                                toast.error("Erreur d'enregistrement");
                            } finally {
                                setLoading(false);
                            }
                        }} isGestionnaire={isGestionnaire} />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-ink-muted uppercase bg-cream/50">
                                    <tr className="border-b border-cream-dark">
                                        <th className="px-4 py-3">Nom</th>
                                        <th className="px-4 py-3">{activeTab === "categories" ? "Description" : "Abréviation"}</th>
                                        {isGestionnaire && <th className="px-4 py-3 text-right">Actions</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-cream-dark">
                                    {(activeTab === "categories" ? categories : unites).map((item: any) => (
                                        <tr key={item.id} className="hover:bg-cream/30">
                                            <td className="px-4 py-3 font-medium">{item.nom}</td>
                                            <td className="px-4 py-3 text-ink-muted">
                                                {activeTab === "categories" ? item.description : <span className="font-mono bg-cream px-2 py-1 rounded text-xs">{item.abreviation}</span>}
                                            </td>
                                            {isGestionnaire && (
                                                <td className="px-4 py-3 text-right space-x-2">
                                                    <button onClick={() => openEdit(item)} className="p-1.5 hover:bg-gold/10 text-ink-muted hover:text-gold rounded transition-colors">
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button onClick={() => handleDelete(item.id)} className="p-1.5 hover:bg-red-50 text-ink-muted hover:text-red-600 rounded transition-colors">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                    {(activeTab === "categories" ? categories : unites).length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="px-4 py-8 text-center text-ink-muted">Aucune donnée</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-cream-dark">
                            <h3 className="font-display text-lg font-semibold">
                                {editingId ? "Modifier" : "Ajouter"} {activeTab === "categories" ? "une catégorie" : "une unité"}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-ink-muted hover:text-ink"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="label">Nom *</label>
                                <input required value={nom} onChange={e => setNom(e.target.value)}
                                    className="input" placeholder={activeTab === "categories" ? "Ex: Boissons" : "Ex: Kilogramme"} />
                            </div>

                            {activeTab === "categories" ? (
                                <div>
                                    <label className="label">Description</label>
                                    <textarea value={description} onChange={e => setDescription(e.target.value)}
                                        className="input min-h-[80px]" placeholder="Optionnel..." />
                                </div>
                            ) : (
                                <div>
                                    <label className="label">Abréviation (sur les tickets) *</label>
                                    <input required value={abreviation} onChange={e => setAbreviation(e.target.value)}
                                        className="input font-mono" placeholder="Ex: kg" maxLength={5} />
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Annuler</button>
                                <button type="submit" disabled={formLoading} className="btn-primary flex-1">
                                    {formLoading ? "Enregistrement..." : "Valider"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}

function ConfigurationEtablissement({ etablissement, onSave, isGestionnaire }: { etablissement: any, onSave: (data: any) => void, isGestionnaire: boolean }) {
    const [formData, setFormData] = useState({
        nom: "", adresse: "", telephone: "", email: "",
        devise: "XOF", tva: 0, piedDePage: ""
    });

    useEffect(() => {
        if (etablissement) {
            setFormData({
                nom: etablissement.nom || "",
                adresse: etablissement.adresse || "",
                telephone: etablissement.telephone || "",
                email: etablissement.email || "",
                devise: etablissement.devise || "XOF",
                tva: etablissement.tva || 0,
                piedDePage: etablissement.piedDePage || ""
            });
        }
    }, [etablissement]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    if (!isGestionnaire) return <div className="p-8 text-center text-ink-muted">Lecture seule</div>;

    return (
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="label">Nom de l'établissement *</label>
                    <input required name="nom" value={formData.nom} onChange={handleChange} className="input" placeholder="Ma Boutique" />
                </div>
                <div>
                    <label className="label">Téléphone</label>
                    <input name="telephone" value={formData.telephone} onChange={handleChange} className="input" placeholder="+228 90..." />
                </div>
                <div className="md:col-span-2">
                    <label className="label">Adresse</label>
                    <input name="adresse" value={formData.adresse} onChange={handleChange} className="input" placeholder="Lomé, Quartier..." />
                </div>
                <div>
                    <label className="label">Email</label>
                    <input type="email" name="email" value={formData.email} onChange={handleChange} className="input" placeholder="contact@maboutique.com" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="label">Devise</label>
                        <select name="devise" value={formData.devise} onChange={handleChange} className="input">
                            <option value="XOF">FCFA (XOF)</option>
                            <option value="EUR">Euro (€)</option>
                            <option value="USD">Dollar ($)</option>
                            <option value="CDF">Franc Congolais (CDF)</option>
                            <option value="GNF">Franc Guinéen (GNF)</option>
                        </select>
                    </div>
                    <div>
                        <label className="label">TVA (%)</label>
                        <input type="number" name="tva" value={formData.tva} onChange={handleChange} className="input" min="0" max="100" />
                    </div>
                </div>
                <div className="md:col-span-2">
                    <label className="label">Message pied de page (Ticket)</label>
                    <textarea name="piedDePage" value={formData.piedDePage} onChange={handleChange} className="input min-h-[80px]" placeholder="Merci de votre visite ! Les articles ne sont ni repris ni échangés." />
                </div>
            </div>
            <div className="flex justify-end pt-4 border-t border-cream-dark">
                <button type="submit" className="btn-primary flex items-center gap-2">
                    <Settings size={16} /> Enregistrer les modifications
                </button>
            </div>
        </form>
    );
}
