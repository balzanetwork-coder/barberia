// firebase.js — ponlo en C:\Users\xabit\barberia\firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCeoWlbTC0UKlbm-C2x7B4i55tzkyekG_g",
  authDomain: "barberia-claude.firebaseapp.com",
  projectId: "barberia-claude",
  storageBucket: "barberia-claude.firebasestorage.app",
  messagingSenderId: "696874253985",
  appId: "1:696874253985:web:3a87b66c863c605c4bfae0",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
