"use client";
import { useEffect, useState } from "react";
import { categoriesService } from "@/lib/db";
import type { Categorie } from "@/types";
import { Plus, Edit2, Trash2, Tag, X } from "lucide-react";
import toast from "react-hot-toast";

// Ce composant peut être intégré dans une page dédiée ou dans la page produits
export function CategoriesManager() {
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Categorie | null>(null);
  const [form, setForm] = useState({ nom: "", description: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => { categoriesService.getAll().then(setCategories); }, []);

  const reload = () => categoriesService.getAll().then(setCategories);

  const openCreate = () => { setEditing(null); setForm({ nom: "", description: "" }); setShowModal(true); };
  const openEdit = (c: Categorie) => { setEditing(c); setForm({ nom: c.nom, description: c.description || "" }); setShowModal(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editing) { await categoriesService.update(editing.id, form); toast.success("Catégorie modifiée"); }
      else { await categoriesService.create(form as any); toast.success("Catégorie créée"); }
      await reload(); setShowModal(false);
    } catch { toast.error("Erreur"); } finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette catégorie ?")) return;
    await categoriesService.delete(id); toast.success("Supprimée"); await reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-ink">Catégories ({categories.length})</h3>
        <button onClick={openCreate} className="btn-primary flex items-center gap-1.5 text-xs py-1.5">
          <Plus size={13} /> Ajouter
        </button>
      </div>

      <div className="space-y-2">
        {categories.map(c => (
          <div key={c.id} className="flex items-center justify-between p-3 bg-cream rounded-xl group">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 bg-gold/10 rounded-lg flex items-center justify-center">
                <Tag size={13} className="text-gold" />
              </div>
              <div>
                <p className="text-sm font-medium text-ink">{c.nom}</p>
                {c.description && <p className="text-xs text-ink-muted">{c.description}</p>}
              </div>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => openEdit(c)} className="p-1 text-ink-muted hover:text-gold transition-colors"><Edit2 size={12} /></button>
              <button onClick={() => handleDelete(c.id)} className="p-1 text-ink-muted hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
            </div>
          </div>
        ))}
        {categories.length === 0 && <p className="text-sm text-ink-muted text-center py-4">Aucune catégorie</p>}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-cream-dark">
              <h3 className="font-display text-lg font-semibold">{editing ? "Modifier" : "Nouvelle catégorie"}</h3>
              <button onClick={() => setShowModal(false)}><X size={16} className="text-ink-muted" /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
              <div>
                <label className="label">Nom *</label>
                <input required value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} className="input" placeholder="Ex: Fournitures de bureau" />
              </div>
              <div>
                <label className="label">Description</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input" placeholder="Optionnel" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Annuler</button>
                <button type="submit" disabled={loading} className="btn-primary flex-1">{loading ? "..." : "Enregistrer"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
