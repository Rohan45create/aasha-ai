const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBxoSQZcVvHI_VTvAyiI8VQ_-S7jPYz6q4",
  authDomain: "ashaai-prod.firebaseapp.com",
  projectId: "ashaai-prod",
  storageBucket: "ashaai-prod.firebasestorage.app",
  messagingSenderId: "656463301103",
  appId: "1:656463301103:web:2aa16b06bef89bbf144e1a",
};

const ASHA_IDS = ["asha_lata_001","asha_priya_002","asha_kavita_003","asha_meena_004","asha_anita_005"];

async function main() {
  const firebase = await import('firebase/app');
  const firestoreMod = await import('firebase/firestore');
  
  const { initializeApp } = firebase;
  const { getFirestore, doc, setDoc, Timestamp } = firestoreMod;

  console.log('Connecting to project:', FIREBASE_CONFIG.projectId);

  const app = initializeApp(FIREBASE_CONFIG);

  const db = getFirestore(app);

  await setDoc(doc(db, 'asha_heads', 'head_sunita_001'), {
    name: 'Sunita Sharma',
    phone: '9823456701',
    email: 'admin@asha.gov.in',
    district: 'Beed',
    ashaIds: ASHA_IDS,
    createdAt: Timestamp.fromDate(new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)),
  }, { merge: true });

  console.log('SUCCESS: Updated asha_heads/head_sunita_001 email -> admin@asha.gov.in');
  process.exit(0);
}

main().catch(e => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
