import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
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

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
