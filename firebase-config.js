import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, query, onSnapshot, orderBy, updateDoc, arrayUnion, where, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAxU7VpzhQUnMQ1N_pGUjFA4kZmffVS7ck",
    authDomain: "service-a0a29.firebaseapp.com",
    projectId: "service-a0a29",
    storageBucket: "service-a0a29.firebasestorage.app",
    messagingSenderId: "1014022373726",
    appId: "1:1014022373726:web:0a261a7a13325c2ac84fcf",
    measurementId: "G-GD4514XSQ2"
};

const app = initializeApp(firebaseConfig);
window.auth = getAuth(app);
window.db = getFirestore(app);
window.fb = { 
    signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, 
    doc, setDoc, getDoc, collection, getDocs, query, onSnapshot, orderBy, updateDoc, arrayUnion, where, addDoc 
};
