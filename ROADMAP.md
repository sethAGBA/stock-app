# 🗺️ Roadmap du Projet : StockApp

Ce document sert de guide de référence pour l'évolution du logiciel de gestion de stock. Il répertorie l'ensemble des fonctionnalités implémentées et à venir.

## 🟢 Phase 1 : Cœur du Système (Terminé)
- [x] **Architecture Technique** : Intégration Next.js 14 + Tailwind CSS + Firebase.
- [x] **Base de Données** : Modélisation Firestore (Produits, Mouvements, Fournisseurs).
- [x] **Authentification** : Système de connexion sécurisé via Firebase Auth.
- [x] **Gestion du Stock** : Logique de transaction pour entrées, sorties et ajustements.
- [x] **Tableau de Bord** : Vue d'ensemble en temps réel avec graphiques analytiques.
- [x] **Gestion Documentaire** : Exports des rapports de stock en formats PDF et Excel.

## 🟡 Phase 2 : Sécurité & Administratif (En cours)
- [x] **Middleware & RBAC** : Gestion fine des droits d'accès.
- [x] **Gestion des Utilisateurs** : Rôles Admin, Gestionnaire, Vendeur, Lecteur.
- [x] **Logs d'Audit** : Traçabilité de chaque modification.
- [x] **Setup Wizard** : Initialisation simplifiée du premier administrateur.
- [/] **Configuration** : Gestion des Catégories, Unités et Infos Établissement.

## 🟠 Phase 3 : Ventes & Point de Vente (POS) [NOUVEAU]
- [x] **Interface de Vente (POS)** : Panier rapide et encaissement simplifié.
- [x] **Gestion des Clients** : Fichier client, historique d'achats et fidélité.
- [ ] **Facturation Automatique** : Génération de tickets de caisse et factures à chaque vente.
- [ ] **Remises & Promotions** : Gestion des tarifs préférentiels et soldes.
- [x] **Modes de Paiement** : Suivi des paiements (Espèces, Mobile Money, Carte).

## 🔵 Phase 4 : Productivité & Mobilité
- [x] **Scanner Mobile Hybride** : Lecture via caméra smartphone et support des douchettes USB/Bluetooth.
- [x] **Ajustements de Masse** : Interface pour mettre à jour le stock de plusieurs produits simultanément.
- [x] **Notifications Contextuelles** :
    *   Push notifications pour les ruptures imminentes.
    *   Emails journaliers de résumé d'activité.
- [x] **Mode Hors-Ligne** : Support PWA (Progressive Web App) avec synchronisation Firebase.

## 🟠 Phase 4 : Finance & Approvisionnements
- [ ] **Gestion des Achats** : Création et suivi des bons de commande fournisseur.
- [ ] **Facturation de base** : Génération de factures ou bons de livraison pour les sorties.
- [ ] **Valorisation Comptable** : Méthodes FIFO/LIFO pour le calcul de la valeur du stock.
- [ ] **Suivi des Coûts** : Historique des prix d'achat pour analyser l'inflation des fournisseurs.

## 🟣 Phase 5 : Inventaire & Qualité
- [ ] **Gestion des Lots & Séries** : Traçabilité des numéros de série et dates de péremption.
- [ ] **Gestion des Retours (RMA)** : Flux spécifique pour les produits défectueux ou retours client.
- [ ] **Inventaires Tournants** : Programmation de comptages périodiques par zone ou catégorie.
- [ ] **Étiquetage** : Génération et impression d'étiquettes avec codes-barres intégrés.

## ⚪ Phase 6 : Analytique & Intégrations
- [ ] **Business Intelligence** : Tableaux de bord de performance (Rotation de stock, top ventes).
- [ ] **API Rest** : Ouverture de l'application pour synchronisation avec d'autres outils.
- [ ] **Exports Comptables** : Formats compatibles avec les logiciels de comptabilité standard.
- [ ] **Multi-Dépôts & Transferts** : Gestion des mouvements entre différents entrepôts.

## 🔴 Phase 7 : Finalisation & Sécurité
- [x] **Audit Logs** : Journalisation de chaque action utilisateur pour une traçabilité totale.
- [ ] **Optimisation SEO & Web Vitals** : Performance maximale et indexation contrôlée.
- [ ] **Sauvegardes Automatiques** : Export périodique des données Firestore vers un stockage externe.
- [ ] **Documentation & Formation** : Tutoriels vidéo et manuel PDF complet.

---

*Dernière mise à jour : Février 2026. Ce document est le référentiel de vision à long terme du projet.*



💡 Idées pour la Phase 2
Voici ce qui serait logique comme prochaines étapes pour un logiciel de caisse africain :

Fonctionnalité	Priorité
Rapports & statistiques (CA par jour/semaine, top produits)	🔴 Haute
Gestion des fournisseurs (commandes, dettes fournisseurs)	🔴 Haute
Comptes clients (soldes, crédit, paiements différés)	🟡 Moyenne
Multi-caisse / multi-utilisateur (suivi par vendeur)	🟡 Moyenne
Export Excel/CSV des ventes et du stock	🟡 Moyenne
Mode hors-ligne (PWA avec sync Firebase)	🟢 Long terme


1. 💳 Crédit Client & Dettes (Priorité Haute)
Tout comme nous l'avons fait pour les fournisseurs, beaucoup de commerces ont besoin de suivre les "ardoises" des clients.

Idée : Permettre de vendre à crédit dans le POS.
Détails : Suivre le solde dû par chaque client, enregistrer des remboursements partiels et voir le total des dettes clients sur le tableau de bord.
2. 🧾 Facturation & Tickets de Caisse (Priorité Haute)
Améliorer le module de vente pour qu'il soit professionnel jusqu'au bout.

Idée : Génération de tickets de caisse au format "80mm" (imprimante thermique) ou factures PDF propres.
Détails : Ajouter un bouton "Imprimer" après chaque vente et un historique pour ré-imprimer les anciens tickets.
3. 🏷️ Étiquetage & Inventaire (Priorité Moyenne)
Idée : Générer des codes-barres pour les produits qui n'en ont pas.
Détails : Une page pour imprimer des planches d'étiquettes à coller sur les rayons ou les produits.
Journal d'Audit (Logs) 🛡️ : Pour la sécurité, enregistrer chaque action sensible (suppression d'une vente, modification manuelle de stock, changement de prix). Indispensable pour éviter les erreurs ou fraudes.
Clôture de Caisse (Rapport Z) 💰 : Un module pour faire le bilan de la journée : total espèces, total crédit, total mobile money, et validation du montant en caisse avant de fermer.
Valorisation du Stock 📈 : Calculer automatiquement la valeur financière totale de votre stock actuel (prix d'achat vs prix de vente) pour voir combien d'argent "dort" sur vos étagères.
