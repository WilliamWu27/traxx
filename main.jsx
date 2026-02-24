import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyA7tZeM76MJYZlh-eX2PKrcj77VbR5XsPE",
  authDomain: "trytraxapp.firebaseapp.com",
  projectId: "trytraxapp",
  storageBucket: "trytraxapp.firebasestorage.app",
  messagingSenderId: "312292654300",
  appId: "1:312292654300:web:c0a04772874ea4be67c819",
  measurementId: "G-6BDD662RXP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
