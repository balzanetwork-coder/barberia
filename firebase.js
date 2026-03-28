import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBraImm_FZqo0skGlG2iFdzBd7W-ImvttI",
  authDomain: "barberia-claude-a290e.firebaseapp.com",
  projectId: "barberia-claude-a290e",
  storageBucket: "barberia-claude-a290e.firebasestorage.app",
  messagingSenderId: "336094934285",
  appId: "1:336094934285:web:b4e7c8cf9639a6a008ec44"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);