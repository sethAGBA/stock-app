"use client";
import { useEffect, useState } from "react";
import { produitsService } from "@/lib/db";
import type { Produit } from "@/types";

export function useAlertes() {
  const [alertes, setAlertes] = useState<Produit[]>([]);

  useEffect(() => {
    const unsub = produitsService.onSnapshot(produits => {
      setAlertes(produits.filter(p => p.stockActuel <= p.stockMinimum));
    });
    return unsub;
  }, []);

  return alertes;
}
