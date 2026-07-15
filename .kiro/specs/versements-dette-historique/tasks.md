# Plan d'implémentation : Historique des versements de dette client

## Vue d'ensemble

Implémentation en 6 étapes séquentielles : types TypeScript → service Firestore avec transactions → refactorisation de `payerDette` → index Firestore → composant `HistoriqueVersements` → intégration dans la page clients.

## Tâches

- [x] 1. Ajouter le type `VersementDette` et la constante de collection
  - Dans `types/index.ts`, ajouter l'interface `VersementDette` avec tous les champs du design : `id`, `clientId`, `clientNom`, `montant`, `utilisateurId`, `utilisateurNom`, `magasinId`, `statut` (`"actif" | "annulé"`), champs optionnels d'annulation (`annuléParId`, `annuléParNom`, `annuléMotif`, `annuléAt`), `createdAt`
  - Dans `lib/db.ts`, ajouter `versementsDette: "versements_dette"` dans l'objet `COLS`
  - Ajouter `VersementDette` dans l'import de types en haut de `lib/db.ts`
  - _Exigences : 1.1, 6.1_

- [x] 2. Implémenter `versementsDetteService` dans `lib/db.ts`
  - [x] 2.1 Implémenter la méthode `creer()`
    - Valider que `montant > 0`, sinon lancer `"Le montant doit être supérieur à zéro"` avant toute transaction
    - Exécuter une transaction Firestore atomique : lire le document client, vérifier que `montant <= soldeDette` (sinon lancer `"Le montant dépasse le solde de dette"`), créer un document dans `versements_dette` avec `statut: "actif"`, mettre à jour `soldeDette` du client par soustraction
    - Retourner l'ID du document versement créé
    - _Exigences : 1.1, 1.2, 1.3, 1.4, 1.5, 6.1, 6.2_

  - [ ]* 2.2 Écrire le test de propriété pour `creer()` — Propriété 1 & 2
    - **Propriété 1 : Round-trip et mise à jour du solde** — générer `(soldeDette, montant)` valides, appeler `creer()`, vérifier que `getByClient` retourne le versement avec `montant` et `statut == "actif"`, et que `soldeDette == D - M`
    - **Propriété 2 : Rejet des montants invalides** — générer des montants ≤ 0 et des montants > soldeDette, vérifier qu'une erreur est lancée sans modification du `soldeDette`
    - **Valide : Exigences 1.1, 1.2, 1.4, 1.5**

  - [x] 2.3 Implémenter la méthode `getByClient()`
    - Construire une query Firestore avec `where("clientId", "==", clientId)`, filtre optionnel `where("magasinId", "==", magasinId)`, `orderBy("createdAt", "desc")`, `limit(limitN ?? 10)`
    - Mapper les documents en `VersementDette` avec conversion des timestamps via `toDate()`
    - _Exigences : 2.1, 2.2, 6.4_

  - [ ]* 2.4 Écrire le test de propriété pour `getByClient()` — Propriété 3 & 10
    - **Propriété 3 : Tri et limite** — générer des ensembles de versements avec dates aléatoires, vérifier tri décroissant et retour de max 10 versements sans paramètre `limit`
    - **Propriété 10 : Isolation multi-magasin** — générer deux ensembles de versements avec `magasinId` distincts, vérifier qu'aucun versement du magasin B n'apparaît dans les résultats du magasin A
    - **Valide : Exigences 2.1, 2.2, 6.4**

  - [x] 2.5 Implémenter la méthode `annuler()`
    - Vérifier que `utilisateur.role` est `"admin"` ou `"gestionnaire"`, sinon lancer `"Accès refusé : rôle insuffisant"` avant transaction
    - Exécuter une transaction Firestore atomique : lire le document versement (lancer `"Versement introuvable"` si absent), vérifier `statut !== "annulé"` (sinon lancer `"Ce versement est déjà annulé"`), lire le document client, mettre à jour le versement avec `statut: "annulé"` + champs `annuléParId`, `annuléParNom`, `annuléMotif`, `annuléAt`, re-créditer `soldeDette` du client en ajoutant le montant
    - Après la transaction, appeler `auditService.enregistrer()` avec action `"VERSEMENT_DETTE_ANNULE"` et les détails requis (`clientId`, `clientNom`, `montant`, `motif`, `utilisateurId`, `utilisateurNom`, `magasinId`)
    - _Exigences : 3.1, 3.2, 3.3, 3.4, 3.5, 6.1, 6.3_

  - [ ]* 2.6 Écrire le test de propriété pour `annuler()` — Propriétés 4, 5, 6
    - **Propriété 4 : Invariant de solde et complétude des champs** — générer des versements actifs avec montants aléatoires, appeler `annuler()`, vérifier `statut == "annulé"`, `soldeDette == D + M`, et présence des 4 champs d'annulation
    - **Propriété 5 : Idempotence — double annulation rejetée** — générer des versements avec `statut == "annulé"`, vérifier qu'une erreur est lancée sans modification du `soldeDette`
    - **Propriété 6 : Contrôle d'accès** — générer des utilisateurs avec `role == "vendeur"`, vérifier rejet systématique
    - **Valide : Exigences 3.1, 3.2, 3.4, 3.5**

- [x] 3. Checkpoint — couche service
  - Vérifier que TypeScript compile sans erreurs (`tsc --noEmit`)
  - S'assurer que tous les tests de propriété de la tâche 2 passent
  - Demander à l'utilisateur si des questions se posent avant de continuer

- [x] 4. Refactoriser `clientsService.payerDette` pour déléguer à `versementsDetteService`
  - Étendre la signature de `payerDette` dans `lib/db.ts` pour accepter deux nouveaux paramètres optionnels : `utilisateur?: { uid: string; nom: string }` et `magasinId?: string | null` et `clientNom?: string`
  - Dans le corps, si `utilisateur` est fourni, déléguer à `versementsDetteService.creer(clientId, clientNom ?? "", montant, utilisateur, magasinId ?? null)` ; sinon conserver l'ancienne logique de transaction directe pour assurer la rétrocompatibilité
  - _Exigences : 1.1, 1.2, 1.3_

- [x] 5. Ajouter l'index composite Firestore pour `versements_dette`
  - Dans `firestore.indexes.json`, ajouter un nouvel objet dans le tableau `"indexes"` avec `collectionGroup: "versements_dette"`, `queryScope: "COLLECTION"`, et les trois champs : `clientId` (ASCENDING), `magasinId` (ASCENDING), `createdAt` (DESCENDING)
  - _Exigences : 2.1, 6.4_

- [x] 6. Créer le composant `HistoriqueVersements`
  - [x] 6.1 Créer le fichier `components/modules/HistoriqueVersements.tsx` avec les props `{ client, utilisateur, magasinId, onSoldeUpdate }`
    - Déclarer les états internes : `ouvert`, `versements`, `chargement`, `chargé`, `versementAnnuler`, `motifAnnulation`, `annulationEnCours`, `erreurChargement`
    - Implémenter la logique de toggle : au premier dépliage (`!chargé`), appeler `versementsDetteService.getByClient()` avec spinner, puis marquer `chargé = true` ; aux dépliages suivants, ne pas refetch
    - _Exigences : 2.6, 5.1_

  - [x] 6.2 Implémenter l'affichage de la liste des versements
    - En-tête cliquable avec chevron (`ChevronDown`/`ChevronUp`) affichant "Historique des versements" et le nombre de versements chargés
    - Panneau pliable conditionnel sur `ouvert`
    - Pendant le chargement : afficher un spinner centré
    - En cas d'erreur de chargement : message d'erreur inline (pas de toast)
    - Si aucun versement : message "Aucun versement enregistré pour ce client."
    - Pour chaque versement : date formatée (`dd/MM/yyyy HH:mm`), montant en `formatCurrency()`, nom de l'auteur, badge statut (vert `actif` / rouge `annulé` avec texte barré via `line-through`)
    - _Exigences : 2.3, 2.4, 5.2_

  - [ ]* 6.3 Écrire les tests de propriété pour l'affichage — Propriétés 7 & 9
    - **Propriété 7 : Affichage conditionnel des boutons d'annulation** — générer des listes de versements avec rôles `admin`/`gestionnaire`/`vendeur`, vérifier présence des boutons pour admin/gestionnaire et absence pour vendeur
    - **Propriété 9 : Déclencheur conditionnel** — générer des clients avec `soldeDette ≤ 0` et 0 versements, vérifier absence du déclencheur ; générer des clients avec `soldeDette > 0` OU versements > 0, vérifier présence du déclencheur
    - **Valide : Exigences 4.1, 4.5, 5.3**

  - [x] 6.4 Implémenter le mini-modal d'annulation inline
    - Afficher un bouton "Annuler" sur chaque versement avec `statut == "actif"` uniquement si `utilisateur.role` est `"admin"` ou `"gestionnaire"`
    - Au clic, mettre `versementAnnuler = versement` pour ouvrir le mini-modal inline dans le composant (pas un composant séparé)
    - Mini-modal : titre, résumé du versement (montant + date), `<textarea>` pour le motif (obligatoire), bouton "Confirmer l'annulation" (désactivé si `motifAnnulation.trim() === ""` ou `annulationEnCours`)
    - Sur confirmation : appeler `versementsDetteService.annuler()`, mettre à jour `versements` localement (statut + champs annulation), appeler `onSoldeUpdate(client.id, nouveauSolde)`, afficher un toast de succès
    - En cas d'erreur : afficher un toast d'erreur via `react-hot-toast`
    - _Exigences : 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 6.5 Écrire le test de propriété pour la validation du motif — Propriété 8
    - **Propriété 8 : Validation du motif d'annulation** — générer des chaînes composées uniquement de whitespace (espaces, tabs, newlines), vérifier que `motifAnnulation.trim() === ""` bloque la soumission et qu'un message d'erreur est visible
    - **Valide : Exigence 4.3**

- [x] 7. Checkpoint — composant HistoriqueVersements
  - Vérifier que TypeScript compile sans erreurs (`tsc --noEmit`)
  - S'assurer que tous les tests de propriété de la tâche 6 passent
  - Demander à l'utilisateur si des questions se posent avant de continuer

- [x] 8. Mettre à jour `app/clients/page.tsx`
  - [x] 8.1 Mettre à jour l'appel à `clientsService.payerDette` dans `handleDebtPayment`
    - Passer les nouveaux paramètres optionnels : `{ uid: appUser!.uid, nom: \`${appUser!.prenom} ${appUser!.nom}\` }` comme `utilisateur`, `currentMagasinId` comme `magasinId`, et `\`${selectedClientForPayment.prenom} ${selectedClientForPayment.nom}\`` comme `clientNom`
    - _Exigences : 1.1, 5.1_

  - [x] 8.2 Intégrer `<HistoriqueVersements>` dans chaque carte client
    - Importer `HistoriqueVersements` depuis `@/components/modules/HistoriqueVersements`
    - Implémenter le callback `handleSoldeUpdate(clientId: string, nouveauSolde: number)` qui met à jour `clients` dans le state local : `setClients(prev => prev.map(c => c.id === clientId ? { ...c, soldeDette: nouveauSolde } : c))`
    - Rendre `<HistoriqueVersements>` à l'intérieur de chaque carte client, après les boutons d'action existants, uniquement si `c.soldeDette > 0` ou si la section doit être accessible
    - Passer les props : `client={c}`, `utilisateur={{ uid: appUser!.uid, nom: ..., role: appUser!.role }}`, `magasinId={currentMagasinId}`, `onSoldeUpdate={handleSoldeUpdate}`
    - _Exigences : 5.1, 5.3, 5.4_

- [x] 9. Checkpoint final — Vérifier que tous les tests passent
  - Exécuter `tsc --noEmit` pour vérifier l'absence d'erreurs TypeScript
  - Exécuter la suite de tests complète
  - Demander à l'utilisateur si des questions se posent avant de clore l'implémentation.

## Notes

- Les tâches marquées `*` sont optionnelles et peuvent être sautées pour un MVP plus rapide
- Chaque tâche référence les exigences spécifiques pour la traçabilité
- La rétrocompatibilité de `payerDette` est assurée par les paramètres optionnels (tâche 4)
- Le composant `HistoriqueVersements` est autonome — il gère son propre état de chargement et le mini-modal inline
- L'index Firestore (tâche 5) doit être déployé avant que `getByClient` avec `magasinId` ne fonctionne en production
- Les tests de propriété utilisent **fast-check** (déjà disponible ou à installer via `npm install --save-dev fast-check`)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "2.3", "5"] },
    { "id": 2, "tasks": ["2.2", "2.4", "2.5"] },
    { "id": 3, "tasks": ["2.6", "4"] },
    { "id": 4, "tasks": ["6.1"] },
    { "id": 5, "tasks": ["6.2", "6.4"] },
    { "id": 6, "tasks": ["6.3", "6.5"] },
    { "id": 7, "tasks": ["8.1", "8.2"] }
  ]
}
```
