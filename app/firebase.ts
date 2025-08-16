"use client"// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBbfPmdPCrpOHO9h9d55pXp6YDgjiw63MI",
  authDomain: "second-skin-4704a.firebaseapp.com",
  projectId: "second-skin-4704a",
  storageBucket: "second-skin-4704a.firebasestorage.app",
  messagingSenderId: "940887616333",
  appId: "1:940887616333:web:5158dd448c495b7667a504",
  measurementId: "G-1SW04YW4GC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);
export const db = getFirestore(app);
export const storage = getStorage(app);