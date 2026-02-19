"use client";
import React, { createContext, useContext, useState, useEffect } from "react";
import { produitsService } from "@/lib/db";
import type { Produit } from "@/types";
import { useAuth } from "@/lib/auth-context";

interface Notification {
    id: string;
    type: "stock_alerte";
    message: string;
    produitId: string;
    date: Date;
    read: boolean;
}

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);

    useEffect(() => {
        if (!user) {
            setNotifications([]);
            return;
        }

        // Surveillance en temps réel des stocks
        const unsub = produitsService.onSnapshot((produits) => {
            const now = new Date();
            const thirtyDays = 30 * 24 * 60 * 60 * 1000;

            const alerts = produits.flatMap(p => {
                const list = [];

                // Alerte Stock
                if (p.stockActuel <= p.stockMinimum) {
                    list.push({
                        id: `alerte-stock-${p.id}`,
                        type: "stock_alerte" as const,
                        message: `Stock critique : ${p.designation} (${p.stockActuel} ${p.unite} restant)`,
                        produitId: p.id,
                        date: new Date(),
                        read: false,
                    });
                }

                // Alerte Péremption
                if (p.datePeremption) {
                    const expiration = p.datePeremption instanceof Date ? p.datePeremption : new Date(p.datePeremption);

                    if (!isNaN(expiration.getTime())) {
                        const diff = expiration.getTime() - now.getTime();

                        if (diff < 0) {
                            list.push({
                                id: `alerte-perime-${p.id}`,
                                type: "stock_alerte" as const,
                                message: `PRODUIT PÉRIMÉ : ${p.designation} (depuis le ${expiration.toLocaleDateString()})`,
                                produitId: p.id,
                                date: new Date(),
                                read: false,
                            });
                        } else if (diff < thirtyDays) {
                            list.push({
                                id: `alerte-expire-${p.id}`,
                                type: "stock_alerte" as const,
                                message: `Expiration proche : ${p.designation} (le ${expiration.toLocaleDateString()})`,
                                produitId: p.id,
                                date: new Date(),
                                read: false,
                            });
                        }
                    }
                }

                return list;
            });

            setNotifications(prev => {
                // Fusion simple pour cet exercice
                return alerts.sort((a, b) => b.date.getTime() - a.date.getTime());
            });
        });

        return unsub;
    }, [user]);

    const unreadCount = notifications.filter(n => !n.read).length;

    const markAsRead = (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    };

    const markAllAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    return (
        <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead }}>
            {children}
        </NotificationContext.Provider>
    );
}

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) throw new Error("useNotifications must be used within NotificationProvider");
    return context;
};
