# Document de Design — Annulation de Dette Client

## Vue d'ensemble

Cette fonctionnalité ajoute la capacité d'annuler tout ou partie de la dette d'un client directement depuis la page `/clients`, sans encaissement ni retour de marchandise. Elle est réservée aux rôles `admin` et `gestionnaire` et s'intègre dans la stack existante : Next.js 14, Firebase Firestore, Tailwind CSS, TypeScript.

Trois éléments sont à livrer :

1. **`clientsService.annulerDette`** — méthode de service dans `lib/db.ts`
2. **`AnnulationDetteModal`** — composant modal dans `components/modules/AnnulationDetteModal.tsx`
3. **Intégration** dans `app/clients/page.tsx`

---

## Architecture

```mermaid
flowchart TD
    A[app/clients/page.tsx] -->|selectedClientForAnnulation| B[AnnulationDetteModal]
    B -->|annulerDette(clientId, montant, motif, utilisateur, magasinId)| C[clientsService]
    C -->|runTransaction| D[(Firestore - clients)]
    C -->|enregistrer| E[(Firestore - audit_logs)]
    B -->|onSuccess(clientId, nouveauSolde)| A
    A -->|mise à jour locale setClients| F[UI Liste Clients]
```

Le flux est strictement linéaire et sans état partagé externe : le modal reçoit un client via props, appelle le service, puis notifie la page parente via le callback `onSuccess`. Aucune modification du routeur ou du contexte global n'est nécessaire.

---

## Composants et Interfaces

### 1. Service — `clientsService.annulerDette`

Nouvelle méthode ajoutée à l'objet `clientsService` existant dans `lib/db.ts`.

```typescript
async annulerDette(
  clientId: string,
  montant: number,
  motif: string,
  utilisateur: { uid: string; nom: string; role: string },
  magasinId?: string | null
): Promise<number>  // retourne le nouveau soldeDette
```

**Logique interne :**

1. **Vérification du rôle** (avant toute opération Firestore) :
   ```typescript
   if (utilisateur.role !== "admin" && utilisateur.role !== "gestionnaire") {
     throw new Error("Accès refusé : rôle insuffisant");
   }
   ```

2. **Transaction Firestore atomique** :
   - Lire le document client
   - Vérifier `soldeDette >= montant` (sinon `throw new Error("Montant supérieur au solde de dette")`)
   - Calculer `nouveauSolde = soldeDette - montant`
   - Mettre à jour `soldeDette` et `updatedAt: serverTimestamp()`

3. **Enregistrement audit** (après la transaction) :
   ```typescript
   await auditService.enregistrer({
     type: "client",
     action: "DETTE_ANNULEE",
     details: `Annulation dette ${montant} F pour ${clientNom}. Solde avant: ${soldeAvant} F → après: ${nouveauSolde} F. Motif: ${motif}`,
     utilisateurId: utilisateur.uid,
     utilisateurNom: utilisateur.nom,
     clientId,          // champs additionnels encodés dans details
     montantAnnule: montant,
     soldeAvant,
     soldeApres: nouveauSolde,
     motif,
   }, magasinId);
   ```

4. **Retour** : `nouveauSolde` (number), utilisé par le callback `onSuccess`.

### 2. Composant — `AnnulationDetteModal`

**Fichier :** `components/modules/AnnulationDetteModal.tsx`

```typescript
interface AnnulationDetteModalProps {
  client: Client;
  utilisateur: { uid: string; nom: string; role: string };
  magasinId: string | null;
  onClose: () => void;
  onSuccess: (clientId: string, nouveauSolde: number) => void;
}
```

**État local :**

| État | Type | Valeur initiale |
|---|---|---|
| `montant` | `number` | `client.soldeDette` |
| `motif` | `string` | `""` |
| `loading` | `boolean` | `false` |
| `errors` | `{ montant?: string; motif?: string }` | `{}` |

**Comportement clé :**
- Header `bg-orange-600` (distinctif du modal de versement en `bg-gold`)
- Champ montant : validation en temps réel via `validateMontant`
- Champ motif : `autoFocus`, max 300 chars, validation via `validateMotif`
- Affichage dynamique du solde restant : `client.soldeDette - montant`
- Fermeture : bouton Annuler, touche Échap (listener `keydown`), clic sur l'overlay
- Avertissement irréversibilité : bandeau `AlertTriangle` avant le bouton de confirmation
- Pendant le traitement : bouton désactivé + spinner

### 3. Fonctions de validation pures (exportées pour les tests)

Ces fonctions sont extraites dans le composant et potentiellement dans un module `lib/validation.ts` pour être testables de manière isolée :

```typescript
export function validateMontant(montant: number, soldeDette: number): string | null {
  if (montant <= 0) return "Le montant doit être supérieur à zéro";
  if (montant > soldeDette) return "Le montant ne peut pas dépasser le solde de dette actuel";
  return null;
}

export function validateMotif(motif: string): string | null {
  if (!motif || motif.trim().length === 0) return "Le motif est obligatoire";
  if (motif.length > 300) return "Le motif ne peut pas dépasser 300 caractères";
  return null;
}

export function calculerSoldeRestant(soldeDette: number, montant: number): number {
  return soldeDette - montant;
}
```

### 4. Intégration dans `app/clients/page.tsx`

**Ajouts dans le composant :**

```typescript
const [selectedClientForAnnulation, setSelectedClientForAnnulation] = useState<Client | null>(null);

const handleAnnulationSuccess = (clientId: string, nouveauSolde: number) => {
  setClients(prev =>
    prev.map(c => c.id === clientId ? { ...c, soldeDette: nouveauSolde } : c)
  );
  setSelectedClientForAnnulation(null);
};
```

**Bouton conditionnel dans la carte client :**

```tsx
{c.soldeDette > 0 && isGestionnaire && (
  <button
    onClick={() => setSelectedClientForAnnulation(c)}
    className="w-full flex items-center justify-center gap-2 py-2 bg-orange-50 text-orange-600 rounded-xl hover:bg-orange-600 hover:text-white transition-all font-bold text-xs border border-orange-200"
  >
    <Ban size={14} />
    Annuler une dette
  </button>
)}
```

**Rendu du modal :**

```tsx
{selectedClientForAnnulation && (
  <AnnulationDetteModal
    client={selectedClientForAnnulation}
    utilisateur={{ uid: appUser!.uid, nom: `${appUser!.prenom} ${appUser!.nom}`, role: appUser!.role }}
    magasinId={currentMagasinId}
    onClose={() => setSelectedClientForAnnulation(null)}
    onSuccess={handleAnnulationSuccess}
  />
)}
```

---

## Modèles de données

### Client (existant, pas de modification de schéma)

```typescript
interface Client {
  id: string;
  nom: string;
  prenom?: string;
  soldeDette: number;  // mis à jour par annulerDette
  // ...autres champs inchangés
}
```

### AuditLog (existant)

L'entrée d'audit pour `DETTE_ANNULEE` suit le schéma `AuditLog` existant. Les informations spécifiques à l'annulation (montant, soldes avant/après, motif, clientId) sont encodées dans le champ `details` sous forme de chaîne lisible, conformément au pattern de l'application.

```typescript
{
  type: "client",
  action: "DETTE_ANNULEE",
  details: "Annulation dette 5000 F pour Jean Dupont. Solde avant: 12000 F → après: 7000 F. Motif: Remise commerciale",
  utilisateurId: string,
  utilisateurNom: string,
  magasinId: string | null,
  createdAt: serverTimestamp()
}
```

---

## Propriétés de correction

*Une propriété est une caractéristique ou un comportement qui doit rester vrai pour toutes les exécutions valides d'un système — essentiellement, un énoncé formel de ce que le système doit faire. Les propriétés servent de pont entre les spécifications lisibles par l'humain et les garanties de correction vérifiables par machine.*

### Propriété 1 : validateMontant rejette les montants invalides

*Pour tout* montant `m ≤ 0` ou tout montant `m > soldeDette`, `validateMontant(m, soldeDette)` doit retourner un message d'erreur non nul (non-`null`). Pour tout montant `0 < m ≤ soldeDette`, elle doit retourner `null`.

**Valide : Requirements 3.2, 3.3**

### Propriété 2 : validateMotif rejette les motifs invalides

*Pour tout* motif composé uniquement d'espaces (chaîne vide ou blanche), `validateMotif(motif)` doit retourner une erreur. *Pour tout* motif dont la longueur dépasse 300 caractères, `validateMotif(motif)` doit retourner une erreur. *Pour tout* motif non-vide d'au plus 300 caractères, `validateMotif(motif)` doit retourner `null`.

**Valide : Requirements 4.2, 4.3**

### Propriété 3 : calculerSoldeRestant est exact

*Pour tout* couple `(soldeDette d, montant m)` avec `0 < m ≤ d`, `calculerSoldeRestant(d, m)` doit être exactement égal à `d - m`.

**Valide : Requirements 3.4**

### Propriété 4 : atomicité du service — le soldeDette résultant est correct

*Pour tout* client avec un `soldeDette d` et tout montant valide `m` tel que `0 < m ≤ d`, après l'appel réussi de `clientsService.annulerDette(clientId, m, motif, utilisateurAuthorisé)`, le `soldeDette` enregistré en base doit être exactement `d - m`.

**Valide : Requirements 5.1**

### Propriété 5 : complétude de l'entrée d'audit

*Pour tout* appel réussi à `clientsService.annulerDette`, l'entrée d'audit créée doit contenir tous les champs obligatoires suivants avec des valeurs non vides/non nulles : `type` (= `"client"`), `action` (= `"DETTE_ANNULEE"`), `utilisateurId`, `utilisateurNom`, `details` (contenant le clientId, le nom du client, le montant annulé, le solde avant, le solde après et le motif).

**Valide : Requirements 6.1, 6.2**

---

## Gestion des erreurs

| Scénario | Comportement |
|---|---|
| Rôle insuffisant (`vendeur`) | `annulerDette` lève `Error("Accès refusé : rôle insuffisant")` ; le modal affiche l'erreur via `toast.error` |
| Montant ≤ 0 | `validateMontant` retourne une erreur ; la soumission est bloquée |
| Montant > soldeDette | `validateMontant` retourne une erreur ; la soumission est bloquée |
| Motif vide/blancs | `validateMotif` retourne une erreur ; la soumission est bloquée |
| Motif > 300 chars | `validateMotif` retourne une erreur ; la soumission est bloquée |
| Client introuvable (Firestore) | La transaction lève une erreur ; `toast.error("Erreur lors de l'annulation. Veuillez réessayer.")` |
| Erreur réseau Firestore | La transaction échoue, le solde reste inchangé ; `toast.error(...)` |
| Modification concurrente du soldeDette | La transaction Firestore relit le solde en cours de transaction, garantissant la cohérence |

---

## Stratégie de test

### Tests unitaires (exemples)

- Affichage conditionnel du bouton (admin/gestionnaire avec dette > 0 vs vendeur)
- Pré-remplissage du champ montant avec `soldeDette`
- Fermeture du modal via Échap et clic overlay
- Désactivation du bouton pendant le chargement
- Affichage du message d'avertissement irréversibilité
- Focus automatique sur le champ motif à l'ouverture

### Tests de propriétés (property-based testing avec fast-check)

La bibliothèque choisie est **fast-check** (déjà cohérente avec l'écosystème TypeScript/Next.js).
Chaque test est configuré avec un minimum de **100 itérations**.

**Balise de référence format :** `Feature: annulation-dette-client, Property {N}: {texte}`

#### Test P1 — `validateMontant` rejette les montants invalides

```typescript
// Feature: annulation-dette-client, Property 1: validateMontant rejette les montants invalides
fc.assert(
  fc.property(
    fc.float({ min: 0.01, max: 1_000_000 }),  // soldeDette
    fc.oneof(
      fc.float({ max: 0 }),                   // m <= 0
      fc.float({ min: 0.01 }).map(delta => soldeDette + delta)  // m > soldeDette
    ),
    (soldeDette, montant) => {
      return validateMontant(montant, soldeDette) !== null;
    }
  ),
  { numRuns: 100 }
);
```

#### Test P2 — `validateMotif` rejette les motifs invalides

```typescript
// Feature: annulation-dette-client, Property 2: validateMotif rejette les motifs invalides
fc.assert(
  fc.property(
    fc.oneof(
      fc.constant(""),
      fc.stringOf(fc.constant(" "), { minLength: 1, maxLength: 50 }),
      fc.string({ minLength: 301, maxLength: 600 })
    ),
    (motif) => validateMotif(motif) !== null
  ),
  { numRuns: 100 }
);
```

#### Test P3 — `calculerSoldeRestant` est exact

```typescript
// Feature: annulation-dette-client, Property 3: calculerSoldeRestant est exact
fc.assert(
  fc.property(
    fc.integer({ min: 1, max: 1_000_000 }).chain(d =>
      fc.tuple(fc.constant(d), fc.integer({ min: 1, max: d }))
    ),
    ([soldeDette, montant]) => {
      return calculerSoldeRestant(soldeDette, montant) === soldeDette - montant;
    }
  ),
  { numRuns: 100 }
);
```

#### Test P4 — Atomicité du service (soldeDette résultant = d - m)

```typescript
// Feature: annulation-dette-client, Property 4: atomicité service - soldeDette résultant = d - m
// Utilise un mock Firestore pour tester la logique pure sans appels réseau
fc.assert(
  fc.property(
    fc.integer({ min: 1, max: 1_000_000 }).chain(d =>
      fc.tuple(fc.constant(d), fc.integer({ min: 1, max: d }))
    ),
    async ([soldeDette, montant]) => {
      const mockClient = { soldeDette };
      const result = await annulerDetteLogique(mockClient, montant);
      return result.soldeDette === soldeDette - montant;
    }
  ),
  { numRuns: 100 }
);
```

#### Test P5 — Complétude de l'entrée d'audit

```typescript
// Feature: annulation-dette-client, Property 5: complétude audit - tous les champs obligatoires présents
fc.assert(
  fc.property(
    fc.record({
      clientId: fc.string({ minLength: 1 }),
      clientNom: fc.string({ minLength: 1 }),
      soldeDette: fc.integer({ min: 1, max: 1_000_000 }),
      montant: fc.integer({ min: 1 }).chain(m =>
        fc.integer({ min: m, max: 1_000_000 }).map(d => ({ montant: m, soldeDette: d }))
      ),
      motif: fc.string({ minLength: 1, maxLength: 300 }),
      utilisateur: fc.record({
        uid: fc.string({ minLength: 1 }),
        nom: fc.string({ minLength: 1 }),
        role: fc.constant("gestionnaire" as const)
      })
    }),
    (params) => {
      const auditEntry = buildAuditEntry(params);
      return (
        auditEntry.type === "client" &&
        auditEntry.action === "DETTE_ANNULEE" &&
        !!auditEntry.utilisateurId &&
        !!auditEntry.utilisateurNom &&
        auditEntry.details.includes(params.clientId) &&
        auditEntry.details.includes(params.motif)
      );
    }
  ),
  { numRuns: 100 }
);
```

### Tests d'intégration

- `clientsService.annulerDette` avec un client Firestore réel (ou émulateur) : vérification que le solde est mis à jour et l'entrée d'audit créée
- Scénario bout-en-bout : ouverture du modal → saisie → confirmation → vérification de la mise à jour locale sans rechargement
