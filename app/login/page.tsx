"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import toast from "react-hot-toast";

import { etablissementService } from "@/lib/db";
import type { Etablissement } from "@/types";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [etablissement, setEtablissement] = useState<Etablissement | null>(null);
  const { login } = useAuth();
  const router = useRouter();

  useEffect(() => {
    etablissementService.get().then(setEtablissement);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err: any) {
      toast.error("Email ou mot de passe incorrect");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#111] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-10">
          <p className="text-[10px] tracking-[.3em] uppercase text-gold font-mono mb-3">
            {etablissement?.nom || "Vision+ Consulting"}
          </p>
          <h1 className="text-white font-display text-4xl font-light leading-tight">
            Gestion de<br /><span className="italic text-gold">Stock</span>
          </h1>
          <p className="text-white/30 text-xs mt-3">Développé par TOGOCARE</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] tracking-[.2em] uppercase text-white/40 font-mono mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-gold transition-colors"
              placeholder="vous@example.com"
            />
          </div>
          <div>
            <label className="block text-[10px] tracking-[.2em] uppercase text-white/40 font-mono mb-1.5">
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-gold transition-colors"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gold text-white rounded-lg text-sm font-medium hover:bg-gold-light transition-colors disabled:opacity-50 mt-2"
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        {/* Bottom rule */}
        <div className="mt-10 pt-6 border-t border-white/10 text-center">
          <p className="text-white/20 text-[10px] font-mono">TOGOCARE © 2025 · v1.0</p>
        </div>
      </div>
    </div>
  );
}
