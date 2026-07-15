# Document de Exigences — Historique des versements de dette client

## Introduction

Cette fonctionnalité ajoute un historique traçable des versements de dette effectués pour un client, et permet d'annuler un versement saisi par erreur. Actuellement, `payerDette` soustrait directement le `soldeDette` sans créer de document — rendant toute correction impossible. La solution introduit une collection Firestore `versements_dette`, met à jour la méthode `payerDette`, affiche un historique pliable sur chaque carte client, et permet aux admins/gestionnaires d'annuler un versement erroné avec motif obligatoire.

---

## Glossaire

- **Versement_Dette** : Document Firestore représentant un remboursement partiel ou total de dette d'un client. Statut : `actif` ou `annulé`.
- **VersementsService** : Service Firestore gérant la création, la lecture et l'annulation des versements.
- **ClientCard** : Composant carte affiché dans la page `/clients` pour chaque client.
- **HistoriqueVersements** : Section pliable/dépliable à l'intérieur d'une ClientCard listant les versements d'un client.
- **Annulation_Versement** : Opération qui marque un Versement_Dette comme `annulé` et re-crédite le `soldeDette`.
- **Utilisateur_Autorisé** : Utilisateur avec le rôle `admin` ou `gestionnaire`.
- **Vendeur** : Utilisateur avec le rôle `vendeur` — peut créer des versements mais ne peut pas les annuler.
- **Audit_Log** : Document dans `audit_logs` traçant les actions sensibles.
- **soldeDette** : Champ numérique sur le document client représentant la somme totale due.
- **magasinId** : Identifiant de l'espace de vente courant.

---

## Exigences

### Exigence 1 : Création d'un versement avec document Firestore

**User Story :** En tant que vendeur ou gestionnaire, je veux qu'un versement de dette crée un document traçable dans Firestore, afin de pouvoir consulter l'historique et corriger d'éventuelles erreurs de saisie.

#### Critères d'acceptation

1. WHEN un utilisateur appelle `payerDette`, THE VersementsService SHALL créer un document dans la collection `versements_dette` avec les champs : `clientId`, `clientNom`, `montant`, `utilisateurId`, `utilisateurNom`, `magasinId`, `statut` (valeur initiale `"actif"`), `createdAt`.
2. WHEN un versement est créé, THE VersementsService SHALL mettre à jour le `soldeDette` du client en soustrayant le montant versé dans la même transaction Firestore.
3. THE VersementsService SHALL exécuter la création du document versement et la mise à jour du `soldeDette` dans une transaction atomique afin qu'aucune opération ne soit partiellement enregistrée.
4. WHEN le montant du versement est inférieur ou égal à zéro, THEN THE VersementsService SHALL rejeter l'opération avec une erreur explicite.
5. WHEN le montant du versement est supérieur au `soldeDette` actuel du client, THEN THE VersementsService SHALL rejeter l'opération avec une erreur explicite.

---

### Exigence 2 : Lecture de l'historique des versements

**User Story :** En tant que gestionnaire ou vendeur, je veux consulter les versements passés d'un client directement sur sa carte, afin de comprendre l'historique de remboursement sans changer de page.

#### Critères d'acceptation

1. THE VersementsService SHALL exposer une méthode `getByClient(clientId, limit?)` qui retourne les versements d'un client triés par `createdAt` décroissant.
2. WHEN `getByClient` est appelé, THE VersementsService SHALL retourner au maximum 10 versements par défaut si aucune limite n'est fournie.
3. THE HistoriqueVersements SHALL afficher pour chaque versement : la date formatée, le montant, le nom de l'auteur, et le statut (`actif` ou `annulé`).
4. WHEN un versement a le statut `annulé`, THE HistoriqueVersements SHALL afficher le statut de façon visuellement distincte (ex : texte barré, badge rouge) par rapport aux versements actifs.
5. THE ClientCard SHALL afficher un déclencheur (bouton ou chevron) permettant de déplier/replier la section HistoriqueVersements sans rechargement de page.
6. WHEN la section HistoriqueVersements est dépliée pour la première fois pour un client, THE ClientCard SHALL charger les versements de ce client depuis Firestore.

---

### Exigence 3 : Annulation d'un versement

**User Story :** En tant qu'admin ou gestionnaire, je veux pouvoir annuler un versement saisi par erreur, afin de corriger le `soldeDette` du client sans intervention manuelle dans la base de données.

#### Critères d'acceptation

1. WHEN un Utilisateur_Autorisé demande l'annulation d'un versement actif, THE VersementsService SHALL mettre à jour le statut du document versement à `"annulé"` et re-créditer le montant au `soldeDette` du client dans une transaction atomique.
2. THE VersementsService SHALL enregistrer sur le document versement annulé les champs : `annuléParId`, `annuléParNom`, `annuléMotif`, `annuléAt`.
3. WHEN l'annulation est confirmée, THE VersementsService SHALL créer un Audit_Log avec l'action `"VERSEMENT_DETTE_ANNULE"` contenant : `clientId`, `clientNom`, `montant`, `motif`, `utilisateurId`, `utilisateurNom`, `magasinId`.
4. IF un versement a déjà le statut `"annulé"`, THEN THE VersementsService SHALL rejeter toute nouvelle demande d'annulation avec une erreur explicite.
5. WHILE un utilisateur a le rôle `vendeur`, THE VersementsService SHALL rejeter toute demande d'annulation de versement avec une erreur d'autorisation.

---

### Exigence 4 : Interface d'annulation dans la fiche client

**User Story :** En tant qu'admin ou gestionnaire, je veux qu'un bouton d'annulation soit accessible sur chaque versement actif dans l'historique, afin de pouvoir corriger une saisie erronée directement depuis la page clients.

#### Critères d'acceptation

1. WHEN la section HistoriqueVersements est affichée et que l'utilisateur est un Utilisateur_Autorisé, THE HistoriqueVersements SHALL afficher un bouton d'annulation sur chaque versement avec le statut `actif`.
2. WHEN un Utilisateur_Autorisé clique sur le bouton d'annulation d'un versement, THE ClientCard SHALL ouvrir un modal de confirmation demandant un motif obligatoire.
3. WHEN le motif fourni dans le modal est vide ou contient uniquement des espaces, THEN THE ClientCard SHALL bloquer la soumission et afficher un message d'erreur.
4. WHEN l'annulation est confirmée avec un motif valide, THE ClientCard SHALL appeler `VersementsService.annulerVersement` puis mettre à jour localement l'affichage du `soldeDette` et du statut du versement sans rechargement complet de la page.
5. WHEN l'utilisateur courant a le rôle `vendeur`, THE HistoriqueVersements SHALL masquer le bouton d'annulation sur tous les versements.

---

### Exigence 5 : Intégration dans la page clients existante

**User Story :** En tant qu'utilisateur, je veux que la fonctionnalité d'historique des versements soit intégrée dans la page clients existante, afin de ne pas avoir à naviguer vers une nouvelle page dédiée.

#### Critères d'acceptation

1. THE ClientCard SHALL intégrer la section HistoriqueVersements à l'intérieur de la carte client existante dans `/app/clients/page.tsx`, sans créer de nouvelle route.
2. WHEN un client n'a aucun versement enregistré, THE HistoriqueVersements SHALL afficher un message indiquant l'absence d'historique.
3. THE ClientCard SHALL afficher le déclencheur de la section HistoriqueVersements uniquement pour les clients dont le `soldeDette` est supérieur à zéro OU qui ont au moins un versement enregistré.
4. WHEN une annulation de versement re-crédite le `soldeDette` à une valeur positive, THE ClientCard SHALL mettre à jour localement l'affichage du `soldeDette` du client sans rechargement complet de la liste.

---

### Exigence 6 : Cohérence des données (intégrité transactionnelle)

**User Story :** En tant qu'administrateur système, je veux que les opérations de versement et d'annulation soient atomiques, afin d'éviter toute incohérence entre le `soldeDette` du client et les documents de versement.

#### Critères d'acceptation

1. THE VersementsService SHALL utiliser des transactions Firestore pour toute opération modifiant à la fois un document `versements_dette` et le champ `soldeDette` du client.
2. IF la transaction Firestore échoue lors de la création d'un versement, THEN THE VersementsService SHALL lancer une erreur sans modifier le `soldeDette` ni créer de document versement.
3. IF la transaction Firestore échoue lors de l'annulation d'un versement, THEN THE VersementsService SHALL lancer une erreur sans modifier le `soldeDette` ni changer le statut du versement.
4. THE VersementsService SHALL filtrer les versements par `magasinId` pour garantir l'isolation des données entre magasins.
