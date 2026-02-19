"use client";
import React from "react";
import { X, Bell, Trash2, Package, ChevronRight } from "lucide-react";
import { useNotifications } from "@/lib/notification-context";
import clsx from "clsx";
import Link from "next/link";

interface NotificationDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function NotificationDrawer({ isOpen, onClose }: NotificationDrawerProps) {
    const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

    return (
        <>
            {/* Overlay */}
            <div
                className={clsx(
                    "fixed inset-0 bg-black/20 z-[60] transition-opacity duration-300",
                    isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={onClose}
            />

            {/* Drawer */}
            <aside
                className={clsx(
                    "fixed top-0 right-0 h-full w-full max-w-sm bg-white shadow-2xl z-[70] transform transition-transform duration-300 ease-in-out flex flex-col",
                    isOpen ? "translate-x-0" : "translate-x-full"
                )}
            >
                {/* Header */}
                <div className="p-6 border-b border-cream-dark flex items-center justify-between bg-cream/30">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Bell size={20} className="text-ink" />
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                    {unreadCount}
                                </span>
                            )}
                        </div>
                        <h3 className="font-display font-semibold text-lg">Notifications</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-cream rounded-full transition-colors text-ink-muted">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-4 space-y-3">
                    {notifications.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-20">
                            <Bell size={48} className="mb-4" />
                            <p className="text-sm">Aucune notification pour le moment</p>
                        </div>
                    ) : (
                        notifications.map((n) => (
                            <div
                                key={n.id}
                                className={clsx(
                                    "p-4 rounded-xl border transition-all relative group",
                                    n.read ? "bg-white border-cream-dark opacity-60" : "bg-gold/5 border-gold/20 shadow-sm"
                                )}
                            >
                                {!n.read && (
                                    <span className="absolute top-4 right-4 w-2 h-2 bg-gold rounded-full" />
                                )}
                                <div className="flex gap-3">
                                    <div className="mt-1 w-8 h-8 rounded-lg bg-white border border-cream-dark flex items-center justify-center shrink-0">
                                        <Package size={14} className="text-gold" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-ink leading-tight mb-1">{n.message}</p>
                                        <p className="text-[10px] text-ink-muted">{new Date(n.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>
                                    </div>
                                </div>

                                <div className="mt-3 flex gap-2">
                                    <Link
                                        href="/produits"
                                        onClick={() => { markAsRead(n.id); onClose(); }}
                                        className="text-[10px] font-bold text-gold hover:underline flex items-center gap-1"
                                    >
                                        Voir le produit <ChevronRight size={10} />
                                    </Link>
                                    {!n.read && (
                                        <button
                                            onClick={() => markAsRead(n.id)}
                                            className="text-[10px] font-medium text-ink-muted hover:text-ink ml-auto"
                                        >
                                            Marquer comme lu
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                {notifications.length > 0 && (
                    <div className="p-4 border-t border-cream-dark">
                        <button
                            onClick={markAllAsRead}
                            className="w-full btn-secondary py-3 text-xs flex items-center justify-center gap-2"
                        >
                            <Trash2 size={13} />
                            Tout marquer comme lu
                        </button>
                    </div>
                )}
            </aside>
        </>
    );
}
