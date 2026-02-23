"use client";
import { useState, useEffect } from "react";
import { WifiOff, Wifi } from "lucide-react";
import clsx from "clsx";

export default function ConnectionStatus() {
    const [isOnline, setIsOnline] = useState(true);
    const [show, setShow] = useState(false);

    useEffect(() => {
        // Initial state
        setIsOnline(navigator.onLine);

        const handleOnline = () => {
            setIsOnline(true);
            setShow(true);
            // Automatically hide the "Online" message after 3 seconds
            const timer = setTimeout(() => setShow(false), 3000);
            return () => clearTimeout(timer);
        };

        const handleOffline = () => {
            setIsOnline(false);
            setShow(true);
        };

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    if (!show && isOnline) return null;

    return (
        <div
            className={clsx(
                "fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 transition-all duration-500 transform",
                isOnline ? "bg-green-600 text-white translate-y-0" : "bg-red-600 text-white translate-y-0 scale-105",
                !show && isOnline && "opacity-0 translate-y-10"
            )}
        >
            {isOnline ? (
                <>
                    <Wifi size={16} />
                    <span className="text-xs font-bold uppercase tracking-wider">Connexion rétablie</span>
                </>
            ) : (
                <>
                    <WifiOff size={16} className="animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider">Mode Hors-ligne</span>
                </>
            )}
        </div>
    );
}
