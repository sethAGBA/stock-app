
const { initializeApp } = require("firebase/app");
const { getFirestore, doc, getDoc, collection, getDocs } = require("firebase/firestore");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");
const fs = require('fs');
const path = require('path');

// Load .env.local manually
const envPath = path.resolve(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            process.env[key.trim()] = value.trim();
        }
    });
}

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function checkAdmin() {
    try {
        // 1. Lister tous les utilisateurs pour trouver l'admin présumé
        console.log("Listing users...");
        const snapshot = await getDocs(collection(db, "utilisateurs"));

        if (snapshot.empty) {
            console.log("Aucun utilisateur trouvé dans Firestore.");
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            console.log(`User [${doc.id}]: ${data.prenom} ${data.nom} - Role: ${data.role} - Actif: ${data.actif}`);
        });

    } catch (error) {
        console.error("Error:", error);
    }
}

checkAdmin();
