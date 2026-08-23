// firebase Enable Authentication 

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBsOE85m0SXhJb_w1hbThcPDHvBB0VI5sQ",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "enterprise-form-builder.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "enterprise-form-builder",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "enterprise-form-builder.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "119859210062",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:119859210062:web:2e25f8ccee62ba3e88201f"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
