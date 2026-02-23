"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { utilisateursService, magasinsService } from "@/lib/db";
import type { AppUser, Magasin } from "@/types";

interface AuthContextType {
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
  currentMagasinId: string | null;
  currentMagasin: Magasin | null;
  magasins: Magasin[];
  setMagasinById: (id: string | null) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [magasins, setMagasins] = useState<Magasin[]>([]);
  const [manualMagasinId, setManualMagasinId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const profile = await utilisateursService.getById(u.uid);
        setAppUser(profile);

        // Always load all magasins for state management
        const allMagasins = await magasinsService.getAll();
        setMagasins(allMagasins);

        // Set manual ID from profile if any
        if (profile?.magasinId) {
          setManualMagasinId(profile.magasinId);
        }

        // Set cookie for middleware
        const token = await u.getIdToken();
        document.cookie = `auth-token=${token}; path=/; max-age=3600; SameSite=Lax`;
      } else {
        setAppUser(null);
        setManualMagasinId(null);
        document.cookie = "auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const setMagasinById = (id: string | null) => {
    setManualMagasinId(id);
  };

  const currentMagasinId = manualMagasinId;
  const currentMagasin = magasins.find(m => m.id === currentMagasinId) || null;

  return (
    <AuthContext.Provider value={{
      user, appUser, loading,
      currentMagasinId, currentMagasin, magasins,
      setMagasinById, login, logout
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
