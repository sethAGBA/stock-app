# Plan d'implémentation : Annulation de Dette Client

## Vue d'ensemble

Implémentation de la fonctionnalité d'annulation de dette client en TypeScript/Next.js. L'approche suit l'ordre de dépendance naturel : fonctions pures et service en premier (couche données), puis le modal (couche UI), puis l'intégration dans la page clients, et enfin les tests property-based.

## Tâches

- [x] 1. Extraire les fonctions de validation pures
  - [x] 1.1 Créer `lib/validation-annulation.ts` avec les fonctions exportées
    - Implémenter `validateMontant(montant: number, soldeDette: number): string | null`
    - Implémenter `validateMotif(motif: string): string | null`
    - Implémenter `calculerSoldeRestant(soldeDette: number, montant: number): number`
    - Exporter les trois fonctions pour usage dans le modal et dans les tests
    - _Requirements: 3.2, 3.3, 3.4, 4.2, 4.3_

  - [ ]* 1.2 Écrire les tests de propriété pour `validateMontant` (Property 1)
    - **Propriété 1 : validateMontant rejette les montants invalides**
    - Tester que tout `m ≤ 0` ou `m > soldeDette` retourne une erreur non-nulle
    - Tester que tout `0 < m ≤ soldeDette` retourne `null`
    - Utiliser fast-check avec au moins 100 itérations
    - **Valide : Requirements 3.2, 3.3**

  - [ ]* 1.3 Écrire les tests de propriété pour `validateMotif` (Property 2)
    - **Propriété 2 : validateMotif rejette les motifs invalides**
    - Tester les chaînes vides, les chaînes blanches, les chaînes > 300 chars
    - Tester que les motifs valides (1–300 chars non-blancs) retournent `null`
    - Utiliser fast-check avec au moins 100 itérations
    - **Valide : Requirements 4.2, 4.3**

  - [ ]* 1.4 Écrire les tests de propriété pour `calculerSoldeRestant` (Property 3)
    - **Propriété 3 : calculerSoldeRestant est exact**
    - Tester que `calculerSoldeRestant(d, m) === d - m` pour tout `0 < m ≤ d`
    - Utiliser fast-check avec au moins 100 itérations
    - **Valide : Requirements 3.4**

- [x] 2. Ajouter `annulerDette` au service clients

  - [x] 2.1 Implémenter `clientsService.annulerDette` dans `lib/db.ts`
    - Ajouter la méthode à l'objet `clientsService` existant
    - Vérification du rôle en entrée (`admin` ou `gestionnaire`, sinon `throw new Error("Accès refusé : rôle insuffisant")`)
    - Transaction Firestore atomique : lire le document client, vérifier `soldeDette >= montant`, calculer `nouveauSolde = soldeDette - montant`, mettre à jour `soldeDette` et `updatedAt: serverTimestamp()`
    - Après la transaction : appeler `auditService.enregistrer` avec `type: "client"`, `action: "DETTE_ANNULEE"`, details contenant clientId, nom, montant, solde avant, solde après, motif
    - Signature : `async annulerDette(clientId, montant, motif, utilisateur: { uid, nom, role }, magasinId?): Promise<number>`
    - _Requirements: 1.3, 5.1, 6.1, 6.2, 6.3_

  - [ ]* 2.2 Écrire les tests de propriété pour l'atomicité du service (Property 4)
    - **Propriété 4 : atomicité du service — le soldeDette résultant est correct**
    - Extraire la logique pure de calcul (`annulerDetteLogique`) et la tester avec un mock Firestore
    - Tester que pour tout `(d, m)` valide, `soldeDette` résultant est exactement `d - m`
    - Utiliser fast-check avec au moins 100 itérations
    - **Valide : Requirements 5.1**

  - [ ]* 2.3 Écrire les tests de propriété pour la complétude de l'audit (Property 5)
    - **Propriété 5 : complétude de l'entrée d'audit**
    - Extraire `buildAuditEntry` et tester que tous les champs obligatoires sont présents et non-vides
    - Vérifier : `type === "client"`, `action === "DETTE_ANNULEE"`, `utilisateurId`, `utilisateurNom`, `details` contenant clientId, nom client, montant, motif
    - Utiliser fast-check avec au moins 100 itérations
    - **Valide : Requirements 6.1, 6.2**

- [x] 3. Checkpoint — Valider la couche service
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Créer le composant `AnnulationDetteModal`

  - [x] 4.1 Créer `components/modules/AnnulationDetteModal.tsx`
    - Définir et implémenter l'interface `AnnulationDetteModalProps` : `client`, `utilisateur`, `magasinId`, `onClose`, `onSuccess`
    - État local : `montant` (initialisé à `client.soldeDette`), `motif` (vide), `loading` (false), `errors` (`{}`)
    - Header `bg-orange-600` avec icône `Ban` et nom du client (distinct du modal de versement `bg-gold`)
    - Champ montant numérique avec validation en temps réel via `validateMontant` importée de `lib/validation-annulation.ts`
    - Champ motif avec `autoFocus`, `maxLength={300}`, placeholder d'exemples, validation via `validateMotif`
    - Affichage du solde restant en temps réel via `calculerSoldeRestant`
    - Bandeau d'avertissement irréversibilité avec icône `AlertTriangle`
    - _Requirements: 2.3, 3.1, 3.4, 4.1, 4.4, 7.1, 7.2, 7.3_

  - [x] 4.2 Implémenter la logique de soumission et de fermeture dans `AnnulationDetteModal`
    - `handleSubmit` : valider montant et motif, appeler `clientsService.annulerDette`, appeler `onSuccess(clientId, nouveauSolde)` en cas de succès, `toast.error(...)` en cas d'échec
    - Fermeture via bouton "Annuler" (`onClose`), touche Échap (listener `keydown` sur `useEffect`), clic sur l'overlay
    - Désactivation du bouton de confirmation et affichage du spinner pendant `loading === true`
    - _Requirements: 1.3, 5.1, 5.2, 5.3, 5.4, 7.4, 7.5_

- [x] 5. Checkpoint — Valider le composant modal
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Intégrer le modal dans `app/clients/page.tsx`

  - [x] 6.1 Ajouter l'état et le callback d'annulation dans `app/clients/page.tsx`
    - Ajouter `selectedClientForAnnulation` state : `const [selectedClientForAnnulation, setSelectedClientForAnnulation] = useState<Client | null>(null)`
    - Ajouter `handleAnnulationSuccess(clientId: string, nouveauSolde: number)` : mise à jour optimiste locale via `setClients(prev => prev.map(c => c.id === clientId ? { ...c, soldeDette: nouveauSolde } : c))`, puis `setSelectedClientForAnnulation(null)`
    - Importer `AnnulationDetteModal` et l'icône `Ban` de `lucide-react`
    - _Requirements: 5.2_

  - [x] 6.2 Ajouter le bouton conditionnel et le rendu du modal dans `app/clients/page.tsx`
    - Dans la carte client, ajouter le bouton "Annuler une dette" conditionnel : `c.soldeDette > 0 && isGestionnaire`
    - Style : `bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white border border-orange-200`
    - Bouton distinct du bouton "Enregistrer un versement" existant
    - Ajouter le rendu conditionnel du `<AnnulationDetteModal>` avec les props `client`, `utilisateur`, `magasinId`, `onClose`, `onSuccess`
    - _Requirements: 1.1, 1.2, 2.1, 2.2_

- [ ] 7. Checkpoint final — Valider l'intégration complète
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Les tâches marquées `*` sont optionnelles et peuvent être sautées pour un MVP rapide
- Chaque tâche référence les requirements spécifiques pour la traçabilité
- Les checkpoints garantissent une validation incrémentale
- Les tests de propriété utilisent **fast-check** (cohérent avec l'écosystème TypeScript/Next.js), configurés avec `numRuns: 100`
- Les tests unitaires valident des exemples spécifiques ; les tests de propriété valident des invariants universels
- La couche service (`lib/db.ts`) est modifiée en ajout uniquement — aucun code existant n'est modifié

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "4.1"] },
    { "id": 3, "tasks": ["4.2"] },
    { "id": 4, "tasks": ["6.1"] },
    { "id": 5, "tasks": ["6.2"] }
  ]
}
```
