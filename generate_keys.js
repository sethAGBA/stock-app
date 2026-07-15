const { initializeApp } = require("firebase/app");
const { getFirestore, collection, addDoc, getDocs } = require("firebase/firestore");
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load .env.local
const envPath = path.resolve(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) process.env[key.trim()] = value.trim();
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

function generateKey() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid O, 0, I, 1
    const part = () => Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `STK-${part()}-${part()}-${part()}`;
}

async function run() {
    const keys = [];
    const count = 50;
    
    console.log(`Génération de ${count} clés...`);
    
    for (let i = 0; i < count; i++) {
        const code = generateKey();
        keys.push(code);
        
        await addDoc(collection(db, "licences"), {
            cle: code,
            type: "annuel",
            utilise: false,
            createdAt: new Date()
        });
        
        console.log(`Clé ${i+1}/${count} créée : ${code}`);
    }
    
    const filePath = path.join(__dirname, 'licences_disponibles.txt');
    fs.writeFileSync(filePath, "LISTE DES 50 CLÉS DE LICENCE (1 AN)\n\n" + keys.join('\n'));
    
    console.log(`\nSuccès ! Les clés ont été enregistrées dans Firestore et dans ${filePath}`);
    process.exit(0);
}

run().catch(console.error);
