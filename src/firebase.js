import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBGwNe8RrK2eut4ShmMz353SdeHgOktheI",
  authDomain: "hackerrank-test.firebaseapp.com",
  projectId: "hackerrank-test",
  storageBucket: "hackerrank-test.firebasestorage.app",
  messagingSenderId: "600060020205",
  appId: "1:600060020205:web:e686a448247d4d414353e4",
  measurementId: "G-FPLSE2VK5T"
};

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
