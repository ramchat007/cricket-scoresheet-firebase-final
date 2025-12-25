// src/firebase.js - paste your Firebase config here
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAlcVByG7jmq_LpkXGooPmoJz_Tc6uYk0c",
  authDomain: "cricket-scoresheet.firebaseapp.com",
  databaseURL: "https://cricket-scoresheet-default-rtdb.firebaseio.com",
  projectId: "cricket-scoresheet",
  storageBucket: "cricket-scoresheet.firebasestorage.app",
  messagingSenderId: "300141386643",
  appId: "1:300141386643:web:9eb5592949cbcba61d2666",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
