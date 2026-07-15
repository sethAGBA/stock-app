/**
 * Fonctions de validation pures pour l'annulation de dette client.
 * Ces fonctions sont exportées pour être utilisées dans le modal et dans les tests.
 */

/**
 * Valide le montant d'annulation par rapport au solde de dette.
 * @returns Un message d'erreur si invalide, null si valide.
 */
export function validateMontant(montant: number, soldeDette: number): string | null {
  if (montant <= 0) return "Le montant doit être supérieur à zéro";
  if (montant > soldeDette) return "Le montant ne peut pas dépasser le solde de dette actuel";
  return null;
}

/**
 * Valide le motif d'annulation.
 * @returns Un message d'erreur si invalide, null si valide.
 */
export function validateMotif(motif: string): string | null {
  if (!motif || motif.trim().length === 0) return "Le motif est obligatoire";
  if (motif.length > 300) return "Le motif ne peut pas dépasser 300 caractères";
  return null;
}

/**
 * Calcule le solde restant après annulation.
 */
export function calculerSoldeRestant(soldeDette: number, montant: number): number {
  return soldeDette - montant;
}
