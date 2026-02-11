import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, set, onValue, get, child } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyDNGXuGVRTtDam0HJgEEDJJzHdmvgXdFbk",
    authDomain: "studysmart-5a8c9.firebaseapp.com",
    projectId: "studysmart-5a8c9",
    storageBucket: "studysmart-5a8c9.firebasestorage.app",
    messagingSenderId: "371848789071",
    appId: "1:371848789071:web:49fb9658506d242f933e3a",
    measurementId: "G-HG3SVFKT05"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const provider = new GoogleAuthProvider();

export { auth, db, provider, signInWithPopup, signOut, onAuthStateChanged, ref, set, onValue, get, child };