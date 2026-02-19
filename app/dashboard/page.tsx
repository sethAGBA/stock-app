"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { produitsService, mouvementsService, clientsService, ventesService, fournisseursService, commandesFournisseursService } from "@/lib/db";
import type { Produit, Mouvement, Client, Vente, Fournisseur, CommandeFournisseur } from "@/types";
import { Package, AlertTriangle, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, DollarSign, PieChart, Clock } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import clsx from "clsx";

export default function DashboardPage() {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [mouvements, setMouvements] = useState<Mouvement[]>([]);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [ventes, setVentes] = useState<Vente[]>([]);
  const [commandes, setCommandes] = useState<CommandeFournisseur[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubP = produitsService.onSnapshot(p => { setProduits(p); setLoading(false); });
    const unsubM = mouvementsService.onSnapshot(m => setMouvements(m));
    clientsService.getAll().then(setClients);
    ventesService.getAll().then(setVentes);
    fournisseursService.getAll().then(setFournisseurs);
    commandesFournisseursService.getAll().then(setCommandes);
    return () => { unsubP(); unsubM(); };
  }, []);

  // Alertes et Valuations
  const alertes = produits.filter(p => p.stockActuel <= p.stockMinimum);
  const valeurStockAchat = produits.reduce((acc, p) => acc + (p.stockActuel || 0) * (p.prixAchat || 0), 0);
  const valeurStockVente = produits.reduce((acc, p) => acc + (p.stockActuel || 0) * (p.prixVente || 0), 0);
  const totalCreances = clients.reduce((acc, c) => acc + (c.soldeDette || 0), 0);
  const totalDetteFournisseurs = commandes.reduce((acc, c) =>
    c.statut !== "annulee" ? acc + (c.resteAPayer || 0) : acc, 0);

  // Alertes Expiration
  const now = new Date();
  const alertLimit = new Date();
  alertLimit.setDate(now.getDate() + 30); // 30 jours

  const expiries = produits.filter(p => p.datePeremption && p.datePeremption < now);
  const prochesExpiration = produits.filter(p =>
    p.datePeremption &&
    p.datePeremption >= now &&
    p.datePeremption <= alertLimit
  );

  // Calcul du profit réalisé (sur toutes les ventes chargées)
  const totalVentesTTC = ventes.reduce((acc, v) => acc + v.totalTTC, 0);
  const totalCoutVentes = ventes.reduce((acc, v) =>
    acc + v.lignes.reduce((lAcc, l) => lAcc + (l.prixAchat || 0) * l.quantite, 0), 0);
  const profitTotal = totalVentesTTC - totalCoutVentes - ventes.reduce((acc, v) => acc + (v.remise || 0), 0);
  const margeMoyenne = totalVentesTTC > 0 ? (profitTotal / totalVentesTTC) * 100 : 0;

  const today = new Date().toDateString();
  const mvtToday = mouvements.filter(m => m.createdAt.toDateString() === today);
  const entreesToday = mvtToday.filter(m => m.type === "entree").reduce((a, m) => a + m.quantite, 0);
  const sortiesToday = mvtToday.filter(m => m.type === "sortie").reduce((a, m) => a + m.quantite, 0);

  // Profit d'aujourd'hui
  const ventesToday = ventes.filter(v => v.createdAt.toDateString() === today);
  const profitToday = ventesToday.reduce((acc, v) =>
    acc + v.lignes.reduce((lAcc, l) => lAcc + (l.prixUnitaire - (l.prixAchat || 0)) * l.quantite, 0) - (v.remise || 0), 0
  );

  // Données graphique (7 derniers jours)
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const ds = d.toDateString();
    const mvts = mouvements.filter(m => m.createdAt.toDateString() === ds);
    return {
      jour: format(d, "EEE", { locale: fr }),
      entrées: mvts.filter(m => m.type === "entree").reduce((a, m) => a + m.quantite, 0),
      sorties: mvts.filter(m => m.type === "sortie").reduce((a, m) => a + m.quantite, 0),
    };
  });

  const fmt = (n: number) => n.toLocaleString("fr-FR");

  if (loading) return <AppLayout><div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page title */}
        <div>
          <p className="text-[10px] font-mono tracking-widest text-ink-muted uppercase mb-1">Vue d'ensemble</p>
          <h2 className="font-display text-3xl font-semibold text-ink">Tableau de bord</h2>
        </div>

        {/* Valeurs de stock & Profitabilité (Nouveau) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="card p-6 border-l-4 border-l-gold shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-br from-white to-cream/10">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gold mb-1">Stock au Prix d'Achat</p>
                <h3 className="text-3xl font-display font-black text-ink">{fmt(valeurStockAchat)} <span className="text-sm font-sans font-medium text-ink-muted">F</span></h3>
                <p className="text-xs text-ink-muted mt-2">Capital actuellement immobilisé</p>
              </div>
              <div className="w-12 h-12 bg-gold/10 rounded-2xl flex items-center justify-center text-gold">
                <Package size={24} />
              </div>
            </div>
          </div>

          <div className="card p-6 border-l-4 border-l-blue-500 shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-br from-white to-blue-50/20">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 mb-1">Bénéfice Réalisé (Total)</p>
                <h3 className="text-3xl font-display font-black text-ink">{fmt(profitTotal)} <span className="text-sm font-sans font-medium text-ink-muted">F</span></h3>
                <p className="text-xs text-ink-muted mt-2">Profit net sur toutes les ventes</p>
              </div>
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                <DollarSign size={24} />
              </div>
            </div>
          </div>

          <div className="card p-6 border-l-4 border-l-purple-500 shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-br from-white to-purple-50/20">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-600 mb-1">Marge Moyenne</p>
                <h3 className="text-3xl font-display font-black text-ink">{margeMoyenne.toFixed(1)} <span className="text-sm font-sans font-medium text-ink-muted">%</span></h3>
                <p className="text-xs text-ink-muted mt-2">Performance commerciale globale</p>
              </div>
              <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600">
                <PieChart size={24} />
              </div>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard icon={Package} label="Produits" value={produits.length.toString()} sub="références actives" color="gold" />
          <KPICard icon={AlertTriangle} label="Alertes stock" value={alertes.length.toString()} sub="sous seuil minimum" color={alertes.length > 0 ? "red" : "green"} />
          <KPICard icon={AlertTriangle} label="Expirés" value={expiries.length.toString()} sub="produits périmés" color={expiries.length > 0 ? "red" : "green"} />
          <KPICard icon={Clock} label="Bientôt périmés" value={prochesExpiration.length.toString()} sub="sous 30 jours" color={prochesExpiration.length > 0 ? "amber" : "green"} />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard icon={TrendingUp} label="Profit jour" value={fmt(profitToday)} sub="Bénéfice Net 24h" color="green" />
          <KPICard icon={TrendingUp} label="Entrées jour" value={fmt(entreesToday)} sub="unités reçues" color="green" />
          <KPICard icon={TrendingDown} label="Sorties jour" value={fmt(sortiesToday)} sub="unités sorties" color="amber" />
          <KPICard icon={AlertTriangle} label="Dettes Fournisseurs" value={fmt(totalDetteFournisseurs)} sub="soldes dus" color="red" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Graphique mouvements */}
          <div className="card">
            <p className="label mb-4">Mouvements — 7 derniers jours</p>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gradE" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#B8935A" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#B8935A" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradS" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="jour" tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e0d8" }} />
                <Area type="monotone" dataKey="entrées" stroke="#B8935A" strokeWidth={2} fill="url(#gradE)" />
                <Area type="monotone" dataKey="sorties" stroke="#ef4444" strokeWidth={2} fill="url(#gradS)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Alertes */}
          <div className="card">
            <p className="label mb-4">Produits en alerte ({alertes.length})</p>
            {alertes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-ink-muted">
                <Package size={32} className="mb-2 opacity-30" />
                <p className="text-sm">Aucune alerte — tout est en ordre</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-auto">
                {alertes.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-ink">{p.designation}</p>
                      <p className="text-xs text-ink-muted font-mono">{p.reference}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-600">{p.stockActuel} {p.unite}</p>
                      <p className="text-xs text-ink-muted">min: {p.stockMinimum}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Derniers mouvements */}
        <div className="card">
          <p className="label mb-4">Derniers mouvements</p>
          <div className="divide-y divide-cream-dark">
            {mouvements.slice(0, 8).map(m => (
              <div key={m.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className={clsx("w-7 h-7 rounded-full flex items-center justify-center",
                    m.type === "entree" ? "bg-green-100" : m.type === "sortie" ? "bg-red-100" : "bg-amber-100"
                  )}>
                    {m.type === "entree" ? <ArrowUpRight size={13} className="text-green-600" /> : <ArrowDownRight size={13} className="text-red-600" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink">{m.produitNom}</p>
                    <p className="text-xs text-ink-muted">{m.motif}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={clsx("text-sm font-bold", m.type === "entree" ? "text-green-600" : "text-red-600")}>
                    {m.type === "entree" ? "+" : "-"}{m.quantite}
                  </p>
                  <p className="text-[10px] text-ink-muted font-mono">
                    {format(m.createdAt, "dd/MM HH:mm")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function KPICard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: string; sub: string;
  color: "gold" | "red" | "green" | "amber";
}) {
  const colors = {
    gold: { bg: "bg-gold/10", text: "text-gold", icon: "text-gold" },
    red: { bg: "bg-red-50", text: "text-red-600", icon: "text-red-500" },
    green: { bg: "bg-green-50", text: "text-green-600", icon: "text-green-500" },
    amber: { bg: "bg-amber-50", text: "text-amber-600", icon: "text-amber-500" },
  }[color];

  return (
    <div className="card">
      <div className={clsx("w-9 h-9 rounded-lg flex items-center justify-center mb-3", colors.bg)}>
        <Icon size={17} className={colors.icon} />
      </div>
      <p className="label">{label}</p>
      <p className={clsx("text-2xl font-display font-semibold", colors.text)}>{value}</p>
      <p className="text-xs text-ink-muted mt-0.5">{sub}</p>
    </div>
  );
}
