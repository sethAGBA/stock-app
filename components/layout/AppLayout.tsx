"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useNotifications } from "@/lib/notification-context";
import NotificationDrawer from "./NotificationDrawer";
import LogoutModal from "./LogoutModal";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Package, ArrowLeftRight, Users,
  Truck, FileBarChart, LogOut, Bell, ChevronRight, ShoppingCart, Save, Settings, Receipt, Store, RotateCcw
} from "lucide-react";
import clsx from "clsx";

const NAV = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/produits", label: "Produits", icon: Package },
  { href: "/stock", label: "Mouvements", icon: ArrowLeftRight },
  { href: "/inventaire", label: "Inventaire", icon: Save, gestionnaireOnly: true },
  { href: "/ventes", label: "Ventes (POS)", icon: ShoppingCart },
  { href: "/retours", label: "Retours Client", icon: RotateCcw },
  { href: "/rapports/sorties", label: "Sorties de Caisse", icon: Receipt },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/fournisseurs", label: "Fournisseurs", icon: Truck },
  { href: "/rapports", label: "Rapports", icon: FileBarChart, gestionnaireOnly: true },
  { href: "/rapports/cloture", label: "Caisse (Z)", icon: Save },
  { href: "/admin/logs", label: "Audit Logs", icon: FileBarChart, adminOnly: true },
  { href: "/utilisateurs", label: "Utilisateurs", icon: Users, adminOnly: true },
  { href: "/admin/magasins", label: "Magasins", icon: Store, adminOnly: true },
  { href: "/configuration", label: "Configuration", icon: Settings, adminOnly: true },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { appUser, logout, currentMagasin, currentMagasinId, magasins, setMagasinById } = useAuth();
  const { unreadCount } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    await logout();
    router.push("/login");
  };

  const navItems = NAV.filter(n => {
    if (!appUser) return false;
    const role = appUser.role;

    // Admin has access to everything
    if (role === "admin") return true;

    // Direct Admin-only pages
    if (n.adminOnly) return false;

    // Gestionnaire logic
    if (n.gestionnaireOnly) {
      return role === "gestionnaire";
    }

    // Role-specific restrictions
    if (role === "vendeur") {
      const allowedPaths = [
        "/produits", "/stock", "/ventes",
        "/retours", "/clients"
      ];
      return allowedPaths.includes(n.href);
    }

    if (role === "lecteur") {
      const forbiddenPaths = ["/ventes", "/admin/logs", "/utilisateurs", "/admin/magasins", "/configuration"];
      return !forbiddenPaths.includes(n.href);
    }

    return true;
  });

  return (
    <div className="flex h-screen bg-cream overflow-hidden">
      {/* ── Sidebar ── */}
      {/* ... (keep sidebar) */}
      <aside className="w-64 bg-[#111] flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-6 py-6 border-b border-white/10">
          <p className="text-[10px] tracking-[.3em] uppercase text-gold mb-1 font-mono">Vision+ Consulting</p>
          <h1 className="text-white font-display text-xl font-semibold leading-tight">Gestion<br />de Stock</h1>
        </div>

        {/* Store Info / Switcher */}
        <div className="px-6 py-4 border-b border-white/5">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-white/40 uppercase text-[9px] font-black tracking-widest">
              <Store size={10} className="text-gold" />
              <span>Magasin</span>
            </div>
            {!mounted ? (
              <div className="h-7 bg-white/5 rounded animate-pulse" />
            ) : appUser?.role === "admin" ? (
              <select
                value={currentMagasinId || ""}
                onChange={(e) => setMagasinById(e.target.value || null)}
                className="bg-zinc-900 text-white text-[11px] font-bold py-1.5 px-2 rounded border border-white/10 focus:border-gold outline-none w-full"
              >
                <option value="">Tous les magasins</option>
                {magasins.map(m => (
                  <option key={m.id} value={m.id}>{m.nom}</option>
                ))}
              </select>
            ) : (
              <p className="text-white text-xs font-bold truncate">
                {currentMagasin?.nom || "Non assigné"}
              </p>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          {!mounted ? (
            <div className="space-y-2 px-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-10 bg-white/5 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link key={href} href={href}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group",
                  active
                    ? "bg-gold text-white"
                    : "text-white/50 hover:text-white hover:bg-white/5"
                )}
              >
                <Icon size={16} />
                <span className="flex-1">{label}</span>
                {active && <ChevronRight size={12} />}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-4 py-4 border-t border-white/10">
          {!mounted ? (
            <div className="flex items-center gap-3 mb-3 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-white/10" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-white/10 rounded w-20" />
                <div className="h-2 bg-white/10 rounded w-12" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center">
                <span className="text-gold text-xs font-bold">
                  {appUser?.prenom?.[0]}{appUser?.nom?.[0]}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-medium truncate">{appUser?.prenom} {appUser?.nom}</p>
                <p className="text-white/40 text-[10px] capitalize">{appUser?.role}</p>
              </div>
            </div>
          )}
          <button onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-white/40 hover:text-white hover:bg-white/5 rounded-lg text-xs transition-all">
            <LogOut size={13} />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-14 bg-white border-b border-cream-dark px-6 flex items-center justify-between shrink-0">
          <div>
            <p className="text-xs text-ink-muted font-mono">
              {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <button
            onClick={() => setShowNotifications(true)}
            className="relative p-2 text-ink-muted hover:text-ink transition-colors"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
            )}
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-y-auto p-6">
          {children}
        </div>
      </main>

      <NotificationDrawer isOpen={showNotifications} onClose={() => setShowNotifications(false)} />
      <LogoutModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={confirmLogout}
      />
    </div>
  );
}
