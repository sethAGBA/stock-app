"use client";
import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { mouvementsService, produitsService, etablissementService, ventesService, clientsService } from "@/lib/db";
import type { Produit, Mouvement, Client } from "@/types";
import { FileText, Download, Table } from "lucide-react";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { formatPrice, formatCurrency } from "@/lib/format";

import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Cell
} from "recharts";
import { useAuth } from "@/lib/auth-context";

export default function RapportsPage() {
  const { appUser } = useAuth();
  const [dateDebut, setDateDebut] = useState(format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd"));
  const [dateFin, setDateFin] = useState(format(new Date(), "yyyy-MM-dd"));
  const [loading, setLoading] = useState<string | null>(null);
  const [stats, setStats] = useState<{ totalVentes: number; caTotal: number; topProduits: any[]; evolutionCA: any[] } | null>(null);
  const [totalCreances, setTotalCreances] = useState(0);

  const exportPDF = async () => {
    setLoading("pdf");
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const debut = new Date(dateDebut);
      const fin = new Date(dateFin); fin.setHours(23, 59, 59);
      const [mouvements, etablissement] = await Promise.all([
        mouvementsService.getByPeriode(debut, fin),
        etablissementService.get()
      ]);

      const doc = new jsPDF();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("Rapport des Mouvements de Stock", 14, 20);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(120);
      doc.text(`Période : ${format(debut, "dd/MM/yyyy")} — ${format(fin, "dd/MM/yyyy")}`, 14, 30);
      doc.text(`Généré le : ${format(new Date(), "dd/MM/yyyy à HH:mm")}`, 14, 36);

      const nomEtablissement = etablissement?.nom || "Vision+ Consulting";
      doc.text(`${nomEtablissement} — TogoStock`, 14, 42);

      autoTable(doc, {
        startY: 50,
        head: [["Date", "Produit", "Type", "Quantité", "Stock avant", "Stock après", "Motif"]],
        body: mouvements.map(m => [
          format(m.createdAt, "dd/MM/yy HH:mm"),
          m.produitNom,
          m.type === "entree" ? "Entrée" : m.type === "sortie" ? "Sortie" : "Ajustement",
          m.quantite,
          m.stockAvant,
          m.stockApres,
          m.motif,
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [184, 147, 90], textColor: 255 },
        alternateRowStyles: { fillColor: [250, 248, 244] },
      });

      doc.save(`rapport-stock-${format(debut, "yyyy-MM")}.pdf`);
      toast.success("PDF exporté");
    } catch (e) {
      toast.error("Erreur export PDF");
    } finally { setLoading(null); }
  };

  const exportExcel = async () => {
    setLoading("excel");
    try {
      const XLSX = await import("xlsx");
      const debut = new Date(dateDebut);
      const fin = new Date(dateFin); fin.setHours(23, 59, 59);
      const mouvements = await mouvementsService.getByPeriode(debut, fin);
      const produits = await produitsService.getAll();

      const wb = XLSX.utils.book_new();
      const mvtData = mouvements.map(m => ({
        "Date": format(m.createdAt, "dd/MM/yyyy HH:mm"),
        "Référence": m.produitRef,
        "Produit": m.produitNom,
        "Type": m.type,
        "Quantité": m.quantite,
        "Stock avant": m.stockAvant,
        "Stock après": m.stockApres,
        "Motif": m.motif,
        "Utilisateur": m.utilisateurNom,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mvtData), "Mouvements");

      const valData = produits.map(p => ({
        "Référence": p.reference,
        "Désignation": p.designation,
        "Stock actuel": p.stockActuel,
        "Unité": p.unite,
        "Prix achat": p.prixAchat,
        "Valeur stock": p.stockActuel * p.prixAchat,
        "Statut": p.stockActuel <= p.stockMinimum ? "ALERTE" : "OK",
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(valData), "Valorisation");

      XLSX.writeFile(wb, `rapport-stock-${format(debut, "yyyy-MM")}.xlsx`);
      toast.success("Excel exporté");
    } catch (e) {
      toast.error("Erreur export Excel");
    } finally { setLoading(null); }
  };

  useEffect(() => {
    const fetchStats = async () => {
      if (!appUser) return;
      const debut = new Date(dateDebut);
      const fin = new Date(dateFin); fin.setHours(23, 59, 59);
      const data = await ventesService.getStats(debut, fin);
      setStats(data);

      const clients = await clientsService.getAll();
      setTotalCreances(clients.reduce((acc, c) => acc + (c.soldeDette || 0), 0));
    };
    fetchStats();
  }, [dateDebut, dateFin, appUser]);

  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono tracking-widest text-ink-muted uppercase mb-1">Business Intelligence</p>
            <h2 className="font-display text-4xl font-black text-ink">Analyses & Rapports</h2>
          </div>
        </div>

        {/* Période & Exports */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card bg-white border-l-4 border-gold flex flex-col justify-center">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-[10px] uppercase font-bold text-ink-muted mb-1 block">Début de période</label>
                <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} className="input" />
              </div>
              <div className="flex-1">
                <label className="text-[10px] uppercase font-bold text-ink-muted mb-1 block">Fin de période</label>
                <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} className="input" />
              </div>
            </div>
          </div>
          <div className="flex gap-4">
            <button onClick={exportPDF} disabled={!!loading} className="flex-1 card flex flex-col items-center justify-center gap-2 hover:border-red-200 transition-all group">
              <FileText className="text-red-500 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] uppercase font-bold">Export PDF</span>
            </button>
            <button onClick={exportExcel} disabled={!!loading} className="flex-1 card flex flex-col items-center justify-center gap-2 hover:border-green-200 transition-all group">
              <Table className="text-green-600 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] uppercase font-bold">Export Excel</span>
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="card bg-ink text-white border-none shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
            <p className="text-[10px] uppercase text-gold font-black tracking-widest mb-2">Chiffre d'Affaires</p>
            <p className="text-3xl font-display font-black">
              {stats ? formatPrice(stats.caTotal) : "-"} <span className="text-xs font-normal text-cream/50">F</span>
            </p>
          </div>
          <div className="card bg-white border-cream-dark shadow-sm">
            <p className="text-[10px] uppercase text-ink-muted font-black tracking-widest mb-2">Créances Clients</p>
            <p className="text-3xl font-display font-black text-red-600">
              {formatPrice(totalCreances)} <span className="text-xs font-normal text-ink-muted">F</span>
            </p>
          </div>
          <div className="card bg-white border-cream-dark shadow-sm">
            <p className="text-[10px] uppercase text-ink-muted font-black tracking-widest mb-2">Volume Ventes</p>
            <p className="text-3xl font-display font-black text-ink">
              {stats ? stats.totalVentes : "-"}
            </p>
          </div>
          <div className="card bg-white border-cream-dark shadow-sm">
            <p className="text-[10px] uppercase text-ink-muted font-black tracking-widest mb-2">Panier Moyen</p>
            <p className="text-3xl font-display font-black text-gold">
              {stats && stats.totalVentes > 0 ? formatPrice(stats.caTotal / stats.totalVentes) : "-"} <span className="text-xs font-normal text-ink-muted">F</span>
            </p>
          </div>
        </div>

        {/* Graphique Evolution CA */}
        <div className="card p-6 bg-white min-h-[400px] flex flex-col">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-display text-xl font-bold text-ink">Évolution du Chiffre d'Affaires</h3>
            <div className="flex items-center gap-2 text-[10px] font-bold text-ink-muted">
              <span className="w-3 h-3 rounded-full bg-gold" /> Ventes journalières (FCFA)
            </div>
          </div>
          <div className="flex-1 w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.evolutionCA || []}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#B8935A" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#B8935A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1EFE9" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#6B6B6B' }}
                  tickFormatter={(str) => format(new Date(str), "dd MMM")}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#6B6B6B' }}
                  tickFormatter={(val) => `${val / 1000}k`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  labelFormatter={(label) => format(new Date(label), "dd MMMM yyyy")}
                />
                <Area type="monotone" dataKey="total" stroke="#B8935A" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Produits */}
          <div className="card p-0 overflow-hidden bg-white shadow-sm">
            <div className="p-6 border-b border-cream-dark">
              <h3 className="font-display text-xl font-bold text-ink">Performance Produits</h3>
            </div>
            <div className="p-6">
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats?.topProduits || []} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis dataKey="nom" type="category" width={100} tick={{ fontSize: 10, fill: '#6B6B6B' }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'transparent' }} />
                    <Bar dataKey="qte" radius={[0, 4, 4, 0]}>
                      {stats?.topProduits.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#B8935A', '#2D2D2D', '#6B6B6B', '#D4AF37', '#E5E4E2'][index % 5]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="card p-0 overflow-hidden bg-white shadow-sm flex flex-col">
            <div className="p-6 border-b border-cream-dark">
              <h3 className="font-display text-xl font-bold text-ink">Top 5 Classement</h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-cream/20 text-[10px] uppercase text-ink-muted font-black text-left">
                  <tr>
                    <th className="p-4">Désignation</th>
                    <th className="p-4 text-center">Volume</th>
                    <th className="p-4 text-right">CA Généré</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-dark">
                  {stats?.topProduits.map((p, i) => (
                    <tr key={i} className="hover:bg-cream/10 transition-colors">
                      <td className="p-4 font-medium text-ink">{p.nom}</td>
                      <td className="p-4 text-center">
                        <span className="bg-cream px-2 py-0.5 rounded-full font-bold text-[10px]">{p.qte}</span>
                      </td>
                      <td className="p-4 text-right font-black text-ink">{formatCurrency(p.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
