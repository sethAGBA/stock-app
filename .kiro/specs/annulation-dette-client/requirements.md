# Document de Requirements

## Introduction

Cette fonctionnalité permet aux administrateurs et gestionnaires d'annuler tout ou partie de la dette d'un client dans StockApp, sans qu'il y ait un paiement réel ni un retour de marchandise. Elle couvre les cas d'usage commerciaux courants : remise commerciale accordée par le gérant, correction d'une erreur de saisie ayant gonflé la dette, ou geste commercial envers un client fidèle.

L'annulation est intégrée directement dans la page clients existante (`/app/clients`), sous la forme d'un nouveau bouton et d'un modal dédié. Toute annulation est tracée dans les logs d'audit avec le motif, le montant et l'auteur de l'opération.

## Glossaire

- **StockApp** : Application de gestion de stock et de point de vente.
- **Client** : Entité représentant un acheteur enregistré, possédant un `soldeDette` et un `totalAchats`.
- **SoldeDette** : Montant total restant dû par un client à l'établissement.
- **AnnulationDette** : Opération qui réduit le `soldeDette` d'un client sans encaissement d'argent ni retour de marchandise.
- **Modal_Annulation** : Fenêtre modale permettant de saisir le montant et le motif d'une annulation de dette.
- **ClientsService** : Service Firebase (`lib/db.ts`) gérant les opérations CRUD et financières sur les clients.
- **AuditService** : Service Firebase (`lib/db.ts`) qui enregistre les actions sensibles dans la collection `audit_logs`.
- **Gestionnaire** : Utilisateur avec le rôle `gestionnaire` dans AppUser.
- **Admin** : Utilisateur avec le rôle `admin` dans AppUser.
- **Vendeur** : Utilisateur avec le rôle `vendeur` dans AppUser — n'a pas accès à cette fonctionnalité.

---

## Requirements

### Requirement 1 : Contrôle d'accès

**User Story :** En tant qu'administrateur ou gestionnaire, je veux que seuls les utilisateurs autorisés puissent annuler des dettes, afin d'éviter tout abus ou modification non contrôlée des soldes clients.

#### Acceptance Criteria

1. WHILE `appUser.role` est `admin` ou `gestionnaire`, THE **StockApp** SHALL afficher le bouton d'annulation de dette sur les fiches client dont le `soldeDette` est supérieur à zéro.
2. WHILE `appUser.role` est `vendeur`, THE **StockApp** SHALL masquer le bouton d'annulation de dette.
3. IF un utilisateur non autorisé tente d'appeler `clientsService.annulerDette`, THEN THE **ClientsService** SHALL rejeter l'opération avec une erreur explicite.

---

### Requirement 2 : Déclenchement de l'annulation

**User Story :** En tant que gestionnaire, je veux cliquer sur un bouton dédié sur la fiche client pour ouvrir le modal d'annulation, afin de ne pas confondre cette action avec un versement de paiement.

#### Acceptance Criteria

1. WHILE un client possède un `soldeDette` supérieur à zéro ET que l'utilisateur est admin ou gestionnaire, THE **StockApp** SHALL afficher un bouton "Annuler une dette" distinct du bouton "Enregistrer un versement" sur la fiche client.
2. WHEN l'utilisateur clique sur le bouton "Annuler une dette", THE **StockApp** SHALL ouvrir le **Modal_Annulation** pré-rempli avec le `soldeDette` total du client sélectionné.
3. THE **Modal_Annulation** SHALL afficher le nom complet du client et son `soldeDette` actuel.

---

### Requirement 3 : Saisie du montant d'annulation

**User Story :** En tant que gestionnaire, je veux choisir librement le montant à annuler (partiel ou total), afin de pouvoir gérer aussi bien une remise partielle qu'une remise totale.

#### Acceptance Criteria

1. THE **Modal_Annulation** SHALL proposer un champ numérique pré-rempli avec le `soldeDette` total, modifiable par l'utilisateur.
2. IF le montant saisi est inférieur ou égal à zéro, THEN THE **Modal_Annulation** SHALL afficher un message d'erreur "Le montant doit être supérieur à zéro" et bloquer la soumission.
3. IF le montant saisi est supérieur au `soldeDette` actuel du client, THEN THE **Modal_Annulation** SHALL afficher un message d'erreur "Le montant ne peut pas dépasser le solde de dette actuel" et bloquer la soumission.
4. THE **Modal_Annulation** SHALL afficher en temps réel le solde restant après annulation, calculé comme `soldeDette - montantSaisi`.

---

### Requirement 4 : Saisie du motif (obligatoire)

**User Story :** En tant qu'administrateur, je veux que chaque annulation comporte un motif obligatoire, afin de garantir la traçabilité et la justification de l'opération dans les audits.

#### Acceptance Criteria

1. THE **Modal_Annulation** SHALL comporter un champ texte "Motif" obligatoire pour la soumission du formulaire.
2. IF le champ motif est vide au moment de la soumission, THEN THE **Modal_Annulation** SHALL afficher un message d'erreur "Le motif est obligatoire" et bloquer la soumission.
3. THE **Modal_Annulation** SHALL limiter le motif à 300 caractères maximum.
4. THE **Modal_Annulation** SHALL afficher des exemples de motifs sous le champ (ex. : "Remise commerciale", "Erreur de saisie", "Geste commercial").

---

### Requirement 5 : Exécution de l'annulation

**User Story :** En tant que gestionnaire, je veux que l'annulation réduise le solde de dette du client de manière fiable et atomique, afin d'éviter toute incohérence de données en cas d'erreur réseau.

#### Acceptance Criteria

1. WHEN l'utilisateur confirme l'annulation, THE **ClientsService** SHALL exécuter la réduction du `soldeDette` dans une transaction Firestore atomique.
2. WHEN la transaction Firestore réussit, THE **StockApp** SHALL mettre à jour l'affichage du `soldeDette` du client dans la liste sans rechargement complet de page.
3. IF la transaction Firestore échoue, THEN THE **StockApp** SHALL afficher un message d'erreur "Erreur lors de l'annulation. Veuillez réessayer." et conserver le solde initial inchangé.
4. WHEN l'annulation est confirmée avec succès, THE **StockApp** SHALL fermer le **Modal_Annulation** et afficher une notification de succès "Dette annulée avec succès".

---

### Requirement 6 : Traçabilité dans les logs d'audit

**User Story :** En tant qu'administrateur, je veux que chaque annulation de dette soit enregistrée dans les logs d'audit avec tous les détails nécessaires, afin de pouvoir auditer les opérations et détecter d'éventuels abus.

#### Acceptance Criteria

1. WHEN une annulation est exécutée avec succès, THE **AuditService** SHALL enregistrer une entrée de type `"client"` avec l'action `"DETTE_ANNULEE"`.
2. THE **AuditService** SHALL inclure dans l'entrée d'audit : l'identifiant du client, le nom complet du client, le montant annulé, le solde avant annulation, le solde après annulation, le motif saisi, l'identifiant de l'utilisateur ayant effectué l'opération, le nom de l'utilisateur, et le `magasinId`.
3. THE **AuditService** SHALL horodater chaque entrée d'audit avec `serverTimestamp()`.

---

### Requirement 7 : Expérience utilisateur et accessibilité

**User Story :** En tant qu'utilisateur, je veux que le modal d'annulation soit clair, rapide à utiliser et visuellement distinct du modal de versement, afin d'éviter toute confusion entre les deux opérations.

#### Acceptance Criteria

1. THE **Modal_Annulation** SHALL utiliser une couleur d'en-tête distincte du modal de versement (orange ou rouge) pour signaler le caractère exceptionnel de l'opération.
2. THE **Modal_Annulation** SHALL afficher un message d'avertissement indiquant que l'opération est irréversible avant la confirmation.
3. WHEN le **Modal_Annulation** est ouvert, THE **StockApp** SHALL placer le focus automatiquement sur le champ de saisie du motif.
4. THE **Modal_Annulation** SHALL être fermable via un bouton "Annuler" et via la touche Echap ou en cliquant en dehors du modal.
5. WHILE une opération d'annulation est en cours de traitement, THE **Modal_Annulation** SHALL désactiver le bouton de confirmation et afficher un indicateur de chargement.
