# Logiciel de Gestion de Stock — Vision+ Consulting
> Développé par TOGOCARE · Next.js 14 + Firebase + Vercel

---

## Stack
- **Frontend** : Next.js 14 · TypeScript · Tailwind CSS
- **Backend** : Firebase Firestore · Firebase Auth · Firebase Storage
- **Déploiement** : Vercel

---

## Installation

### 1. Cloner et installer
```bash
npm install
```

### 2. Configurer Firebase
1. Créer un projet sur [console.firebase.google.com](https://console.firebase.google.com)
2. Activer **Firestore**, **Authentication** (email/password), **Storage**
3. Copier `.env.local.example` en `.env.local` et remplir les valeurs

```bash
cp .env.local.example .env.local
```

### 3. Déployer les règles Firestore
```bash
firebase deploy --only firestore:rules
```

### 4. Créer le premier administrateur
Dans la console Firebase → Authentication → Ajouter un utilisateur,
puis dans Firestore → collection `utilisateurs` → ajouter un document avec l'UID :
```json
{
  "nom": "Nom",
  "prenom": "Prénom",
  "email": "admin@example.com",
  "role": "admin",
  "actif": true
}
```

### 5. Lancer en local
```bash
npm run dev
```

---

## Structure du projet
```
app/
├── login/          → Page de connexion
├── dashboard/      → Tableau de bord temps réel
├── produits/       → Gestion catalogue produits
├── stock/          → Mouvements entrées/sorties
├── fournisseurs/   → Gestion fournisseurs
├── rapports/       → Exports PDF & Excel
└── utilisateurs/   → Gestion des comptes (admin)

lib/
├── firebase.ts     → Initialisation Firebase
├── db.ts           → Services Firestore (CRUD)
└── auth-context.tsx → Context authentification

types/
└── index.ts        → Types TypeScript

firestore.rules     → Règles de sécurité Firestore
```

---

## Déploiement Vercel
```bash
npm install -g vercel
vercel
```
Ajouter les variables d'environnement dans le dashboard Vercel.

---

## Modules
| Module | Statut |
|--------|--------|
| Authentification | ✅ |
| Tableau de bord | ✅ |
| Produits (CRUD) | ✅ |
| Mouvements de stock | ✅ |
| Fournisseurs | ✅ |
| Rapports PDF/Excel | ✅ |
| Gestion utilisateurs | ✅ |
| Alertes temps réel | ✅ |
# stock-app
# stock-app
