"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { fournisseursService, commandesFournisseursService } from "@/lib/db";
import type { Fournisseur, CommandeFournisseur } from "@/types";
import { Plus, Edit2, Trash2, Truck, X, Search } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import toast from "react-hot-toast";
import clsx from "clsx";
import { formatPrice, formatCurrency } from "@/lib/format";
import { NewOrderModal } from "@/components/stock/NewOrderModal";
import { PaymentModal } from "@/components/stock/PaymentModal";
import { CancellationModal } from "@/components/stock/CancellationModal";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const EMPTY = { nom: "", contact: "", email: "", telephone: "", delaiLivraison: 7 };

export default function FournisseursPage() {
  const { appUser, currentMagasinId } = useAuth();
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Fournisseur | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);

  const isGestionnaire = appUser?.role === "admin" || appUser?.role === "gestionnaire";
  const isAdmin = appUser?.role === "admin";

  useEffect(() => {
    if (!appUser) return;
    fournisseursService.getAll().then(setFournisseurs);
  }, [appUser]);

  const reload = () => fournisseursService.getAll().then(setFournisseurs);

  const filtered = fournisseurs.filter(f =>
    f.nom.toLowerCase().includes(search.toLowerCase()) ||
    f.contact.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setShowModal(true);
  };

  const openEdit = (f: Fournisseur) => {
    setEditing(f);
    setForm({
      nom: f.nom, contact: f.contact,
      email: f.email || "", telephone: f.telephone || "",
      delaiLivraison: f.delaiLivraison || 7,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editing) {
        await fournisseursService.update(editing.id, form, { uid: appUser!.uid, nom: `${appUser!.prenom} ${appUser!.nom}` });
        toast.success("Fournisseur modifié");
      } else {
        await fournisseursService.create(form as any, { uid: appUser!.uid, nom: `${appUser!.prenom} ${appUser!.nom}` });
        toast.success("Fournisseur créé");
      }
      await reload();
      setShowModal(false);
    } catch {
      toast.error("Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const f = fournisseurs.find(item => item.id === id);
    if (!f || !confirm(`Supprimer le fournisseur "${f.nom}" ?`)) return;
    await fournisseursService.delete(id, f.nom, { uid: appUser!.uid, nom: `${appUser!.prenom} ${appUser!.nom}` });
    toast.success("Fournisseur supprimé");
    await reload();
    if (selectedFournisseur?.id === id) setSelectedFournisseur(null);
  };

  const [selectedFournisseur, setSelectedFournisseur] = useState<Fournisseur | null>(null);
  const [activeTab, setActiveTab] = useState<"info" | "commandes">("info");
  const [commandes, setCommandes] = useState<CommandeFournisseur[]>([]);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedCommandeForPayment, setSelectedCommandeForPayment] = useState<CommandeFournisseur | null>(null);
  const [selectedCommandeForCancellation, setSelectedCommandeForCancellation] = useState<CommandeFournisseur | null>(null);

  useEffect(() => {
    if (selectedFournisseur && activeTab === "commandes") {
      const unsub = commandesFournisseursService.onSnapshot(selectedFournisseur.id, setCommandes, currentMagasinId);
      return () => unsub();
    }
  }, [selectedFournisseur, activeTab, currentMagasinId]);

  const handleUpdateStatus = async (id: string, statut: CommandeFournisseur["statut"]) => {
    if (statut === "annulee") {
      const cmd = commandes.find(c => c.id === id);
      if (cmd) setSelectedCommandeForCancellation(cmd);
      return;
    }

    if (!confirm(`Changer le statut en "${statut}" ?`)) return;

    try {
      const userFull = appUser ? `${appUser.prenom} ${appUser.nom}` : "Système";
      const updateData: any = { statut };

      if (statut === "commandee") {
        updateData.orderedBy = appUser?.uid;
        updateData.orderedByName = userFull;
      }

      await commandesFournisseursService.update(id, updateData, { uid: appUser!.uid, nom: `${appUser!.prenom} ${appUser!.nom}` });
      toast.success("Statut mis à jour");
    } catch (e) {
      toast.error("Erreur mise à jour");
    }
  };

  const confirmAnnulation = async (motif: string) => {
    if (!selectedCommandeForCancellation) return;
    try {
      const userFull = appUser ? `${appUser.prenom} ${appUser.nom}` : "Système";
      await commandesFournisseursService.update(selectedCommandeForCancellation.id, {
        statut: "annulee",
        cancelledBy: appUser?.uid,
        cancelledByName: userFull,
        motifAnnulation: motif
      }, { uid: appUser!.uid, nom: `${appUser!.prenom} ${appUser!.nom}` });
      toast.success("Commande annulée");
    } catch (e) {
      toast.error("Erreur lors de l'annulation");
      throw e;
    }
  };

  const handleReception = async (cmd: CommandeFournisseur) => {
    if (!confirm("Confirmer la réception de la commande ? Cela mettra à jour le stock.")) return;
    try {
      const userFull = appUser ? `${appUser.prenom} ${appUser.nom}` : "Système";
      await commandesFournisseursService.receptionner(cmd, cmd.lignes, {
        receivedBy: appUser?.uid || "SYSTEM",
        receivedByName: userFull
      });
      toast.success("Commande réceptionnée et stock mis à jour");
    } catch (e) {
      toast.error("Erreur lors de la réception");
    }
  };

  const handlePaiement = (cmd: CommandeFournisseur) => {
    setSelectedCommandeForPayment(cmd);
  };

  const confirmPaiement = async (montant: number) => {
    if (!selectedCommandeForPayment || !appUser) return;
    try {
      const userFull = `${appUser.prenom} ${appUser.nom}`;
      await commandesFournisseursService.enregistrerPaiement(
        selectedCommandeForPayment.id,
        montant,
        appUser.uid,
        userFull
      );
      toast.success("Paiement enregistré");
      // Mettre à jour le solde du fournisseur localement
      if (selectedFournisseur) {
        setFournisseurs(prev => prev.map(f =>
          f.id === selectedFournisseur.id
            ? { ...f, soldeDette: Math.max(0, (f.soldeDette || 0) - montant) }
            : f
        ));
      }
    } catch (e: any) {
      toast.error(e.message || "Erreur lors du paiement");
      throw e;
    }
  };

  const totalDette = commandes.reduce((acc, c) =>
    c.statut !== "annulee" ? acc + (c.totalTTC - (c.montantPaye || 0)) : acc
    , 0);

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-120px)] gap-6">
        {/* Left: Supplier List */}
        <div className="w-1/3 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-2xl font-semibold text-ink">Fournisseurs</h2>
            </div>
            {isGestionnaire && (
              <button onClick={openCreate} className="btn-secondary p-2 rounded-full shadow-sm">
                <Plus size={18} />
              </button>
            )}
          </div>

          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher..." className="input pl-9" />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {filtered.map(f => (
              <div
                key={f.id}
                onClick={() => setSelectedFournisseur(f)}
                className={clsx(
                  "card p-4 hover:border-gold cursor-pointer transition-all",
                  selectedFournisseur?.id === f.id ? "border-gold bg-gold/5 shadow-md scale-[1.02]" : "hover:shadow-sm"
                )}
              >
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-ink">{f.nom}</h3>
                  {f.delaiLivraison && <span className="text-[10px] font-bold text-ink-muted bg-cream px-2 py-0.5 rounded uppercase tracking-wider">{f.delaiLivraison}j</span>}
                </div>
                <p className="text-sm text-ink-muted mt-1">{f.contact}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Details & Orders */}
        <div className="flex-1 card p-0 overflow-hidden flex flex-col shadow-xl border-cream-dark">
          {selectedFournisseur ? (
            <>
              {/* Header */}
              <div className="p-6 border-b border-cream-dark bg-white">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="font-display text-3xl font-bold text-ink">{selectedFournisseur.nom}</h2>
                    <div className="flex gap-4 mt-1 text-sm text-ink-muted font-medium">
                      <span>{selectedFournisseur.contact}</span>
                      {selectedFournisseur.telephone && <span className="text-gold">•</span>}
                      <span>{selectedFournisseur.telephone}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {isGestionnaire && <button onClick={() => openEdit(selectedFournisseur)} className="btn-secondary py-2">Modifier</button>}
                    {isAdmin && <button onClick={() => handleDelete(selectedFournisseur.id)} className="text-red-400 hover:text-red-600 p-2 transition-colors"><Trash2 size={18} /></button>}
                  </div>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-cream/30 p-3 rounded-xl border border-cream-dark">
                    <p className="text-[10px] uppercase font-bold text-ink-muted tracking-widest mb-1">Commandes</p>
                    <p className="text-xl font-bold text-ink">{commandes.length}</p>
                  </div>
                  <div className="bg-red-50 p-3 rounded-xl border border-red-100">
                    <p className="text-[10px] uppercase font-bold text-red-600 tracking-widest mb-1">Dette Totale</p>
                    <p className="text-xl font-bold text-red-700">{formatPrice(totalDette)} <span className="text-xs">F</span></p>
                  </div>
                  <div className="bg-green-50 p-3 rounded-xl border border-green-100">
                    <p className="text-[10px] uppercase font-bold text-green-600 tracking-widest mb-1">Payé (Historique)</p>
                    <p className="text-xl font-bold text-green-700">{formatCurrency(commandes.reduce((acc, c) => acc + (c.montantPaye || 0), 0))}</p>
                  </div>
                </div>

                <div className="flex gap-8 text-sm font-semibold border-b-2 border-cream-dark">
                  <button
                    onClick={() => setActiveTab("info")}
                    className={clsx("pb-3 border-b-4 -mb-0.5 transition-all outline-none", activeTab === "info" ? "border-gold text-gold" : "border-transparent text-ink-muted hover:text-ink")}
                  >
                    Informations
                  </button>
                  <button
                    onClick={() => setActiveTab("commandes")}
                    className={clsx("pb-3 border-b-4 -mb-0.5 transition-all outline-none", activeTab === "commandes" ? "border-gold text-gold" : "border-transparent text-ink-muted hover:text-ink")}
                  >
                    Historique Commandes
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto bg-gray-50/50 p-6">
                {activeTab === "info" && (
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-xs uppercase font-bold text-ink-muted">Email Pro</label>
                        <p className="text-ink font-medium">{selectedFournisseur.email || "Non renseigné"}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs uppercase font-bold text-ink-muted">Adresse / Localisation</label>
                        <p className="text-ink font-medium">Lomé, Togo (Standard)</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-xs uppercase font-bold text-ink-muted">Téléphone</label>
                        <p className="text-ink font-medium">{selectedFournisseur.telephone || "Non renseigné"}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs uppercase font-bold text-ink-muted">Délai estimé de livraison</label>
                        <p className="text-ink font-medium">{selectedFournisseur.delaiLivraison} jours calendaires</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "commandes" && (
                  <div className="space-y-4">
                    {isGestionnaire && (
                      <button onClick={() => setShowOrderModal(true)} className="btn-primary w-full flex items-center justify-center gap-3 py-4 shadow-lg active:scale-95 transition-all">
                        <Plus size={20} /> Émettre une nouvelle commande
                      </button>
                    )}

                    <div className="space-y-4">
                      {commandes.map(cmd => (
                        <div key={cmd.id} className="bg-white p-5 rounded-2xl border border-cream-dark shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className={clsx(
                                  "text-[10px] uppercase font-black tracking-widest px-2 py-1 rounded",
                                  cmd.statut === "recu" ? "bg-green-100 text-green-700" :
                                    cmd.statut === "annulee" ? "bg-red-100 text-red-700" :
                                      cmd.statut === "commandee" ? "bg-amber-100 text-amber-700" :
                                        "bg-cream text-ink-muted"
                                )}>
                                  {cmd.statut === "recu" ? "Réceptionné" :
                                    cmd.statut === "commandee" ? "En attente" :
                                      cmd.statut === "brouillon" ? "Brouillon" : "Annulée"}
                                </span>
                                {cmd.statutPaiement && (
                                  <span className={clsx(
                                    "text-[10px] uppercase font-black tracking-widest px-2 py-1 rounded",
                                    cmd.statutPaiement === "paye" ? "bg-green-100 text-green-700" :
                                      cmd.statutPaiement === "partiel" ? "bg-blue-100 text-blue-700" :
                                        "bg-red-100 text-red-700"
                                  )}>
                                    {cmd.statutPaiement === "paye" ? "Payé" :
                                      cmd.statutPaiement === "partiel" ? "Partiel" : "Non payé"}
                                  </span>
                                )}
                                <span className="text-[10px] font-mono text-ink-muted">#{cmd.id.slice(0, 8).toUpperCase()}</span>
                              </div>
                              <p className="text-base font-bold text-ink">
                                {format(cmd.date, "dd MMM yyyy", { locale: fr })}
                              </p>

                              {/* Traçabilité */}
                              <div className="pt-2 space-y-1">
                                <p className="text-[10px] text-ink-muted font-medium">Créé par {cmd.createdByName || "Système"}</p>
                                {cmd.orderedByName && <p className="text-[10px] text-amber-600 font-bold">Commandé par {cmd.orderedByName}</p>}
                                {cmd.receivedByName && <p className="text-[10px] text-green-600 font-bold">Réceptionné par {cmd.receivedByName}</p>}
                                {cmd.cancelledByName && <p className="text-[10px] text-red-500 font-bold">Annulé par {cmd.cancelledByName}</p>}
                              </div>

                              {cmd.motifAnnulation && (
                                <div className="mt-2 text-[10px] bg-red-50 text-red-700 p-2 rounded-lg border border-red-100 italic">
                                  " {cmd.motifAnnulation} "
                                </div>
                              )}

                              <p className="text-xs text-ink-muted underline mt-2">
                                {cmd.lignes.length} article(s) • {formatCurrency(cmd.totalTTC)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-black text-ink">{formatPrice(cmd.totalTTC)} <span className="text-xs font-normal">F</span></p>
                              {cmd.montantPaye > 0 && <p className="text-[10px] text-green-600 font-bold tracking-tight">SOLDE PAYÉ : {formatCurrency(cmd.montantPaye)}</p>}
                              {cmd.totalTTC - (cmd.montantPaye || 0) > 0 && cmd.statut !== "annulee" && (
                                <p className="text-[10px] text-red-500 font-bold tracking-tight">RESTE À PAYER : {formatCurrency(cmd.totalTTC - (cmd.montantPaye || 0))}</p>
                              )}
                            </div>
                          </div>

                          {isGestionnaire && (
                            <div className="flex gap-3 mt-5 pt-4 border-t border-cream-dark">
                              {cmd.statut === "brouillon" && (
                                <>
                                  <button
                                    onClick={() => handleUpdateStatus(cmd.id, "commandee")}
                                    className="flex-1 btn-primary py-2 text-xs"
                                  >
                                    Passer commande
                                  </button>
                                  <button
                                    onClick={() => handleUpdateStatus(cmd.id, "annulee")}
                                    className="flex-1 btn-secondary py-2 text-xs text-red-500 border-red-100 hover:bg-red-50"
                                  >
                                    Annuler
                                  </button>
                                </>
                              )}
                              {(cmd.statut === "commandee" || cmd.statut === "recu") && (
                                <>
                                  {cmd.statut === "commandee" && (
                                    <button
                                      onClick={() => handleReception(cmd)}
                                      className="flex-1 btn-primary py-2 text-xs bg-green-600 hover:bg-green-700 border-green-700"
                                    >
                                      Réceptionner
                                    </button>
                                  )}
                                  {cmd.totalTTC - (cmd.montantPaye || 0) > 0 && (
                                    <button
                                      onClick={() => handlePaiement(cmd)}
                                      className="flex-1 btn-secondary py-2 text-xs font-bold text-ink hover:bg-cream"
                                    >
                                      Enregistrer Paiement
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleUpdateStatus(cmd.id, "annulee")}
                                    className="flex-1 btn-secondary py-2 text-xs"
                                  >
                                    Annuler
                                  </button>
                                </>
                              )}
                              {cmd.statut === "recu" && cmd.totalTTC - (cmd.montantPaye || 0) <= 0 && (
                                <div className="w-full text-center text-[10px] text-green-600 font-bold bg-green-50 py-1 rounded">
                                  STOCK MIS À JOUR LE {format(cmd.updatedAt, "dd/MM/yyyy")}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                      {commandes.length === 0 && (
                        <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-cream-dark">
                          <Truck size={40} className="mx-auto mb-3 opacity-10" />
                          <p className="text-ink-muted italic">Aucune commande pour ce fournisseur</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-ink-muted/30">
              <Truck size={80} className="mb-4 animate-pulse" />
              <p className="text-lg font-display font-medium">Sélectionnez un partenaire logistique</p>
              <p className="text-sm">pour voir l'historique des approvisionnements</p>
            </div>
          )
          }
        </div >
      </div >

      {/* Modals */}
      {
        showModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between px-6 py-5 border-b border-cream-dark">
                <h3 className="font-display text-xl font-semibold">
                  {editing ? "Modifier le fournisseur" : "Nouveau fournisseur"}
                </h3>
                <button onClick={() => setShowModal(false)}>
                  <X size={18} className="text-ink-muted" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                <div>
                  <label className="label">Nom du fournisseur *</label>
                  <input required value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                    className="input" placeholder="Ex: Entreprise Koffi" />
                </div>
                <div>
                  <label className="label">Nom du contact *</label>
                  <input required value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))}
                    className="input" placeholder="Prénom Nom du contact" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Email</label>
                    <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      className="input" placeholder="contact@example.com" />
                  </div>
                  <div>
                    <label className="label">Téléphone</label>
                    <input value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))}
                      className="input" placeholder="+228 XX XX XX XX" />
                  </div>
                </div>
                <div>
                  <label className="label">Délai de livraison (jours)</label>
                  <input type="number" min="1" value={form.delaiLivraison}
                    onChange={e => setForm(f => ({ ...f, delaiLivraison: +e.target.value }))}
                    className="input" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                    Annuler
                  </button>
                  <button type="submit" disabled={loading} className="btn-primary flex-1">
                    {loading ? "Enregistrement..." : "Enregistrer"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {
        showOrderModal && selectedFournisseur && (
          <NewOrderModal
            fournisseurId={selectedFournisseur.id}
            fournisseurNom={selectedFournisseur.nom}
            magasinId={currentMagasinId}
            onClose={() => setShowOrderModal(false)}
            onSuccess={() => {
              setShowOrderModal(false);
              toast.success("Commande créée");
            }}
          />
        )
      }

      {selectedCommandeForPayment && <PaymentModal
        commandeId={selectedCommandeForPayment.id}
        totalTTC={selectedCommandeForPayment.totalTTC}
        montantPaye={selectedCommandeForPayment.montantPaye || 0}
        onClose={() => setSelectedCommandeForPayment(null)}
        onSuccess={confirmPaiement}
      />
      }

      {selectedCommandeForCancellation && (
        <CancellationModal
          commandeId={selectedCommandeForCancellation.id}
          onClose={() => setSelectedCommandeForCancellation(null)}
          onConfirm={confirmAnnulation}
        />
      )}
    </AppLayout >
  );
}
