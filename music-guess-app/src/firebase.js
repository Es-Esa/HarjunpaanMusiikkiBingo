import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration (otettu käyttäjän viestistä)
const firebaseConfig = {
  apiKey: "AIzaSyCMkiFFn3zPR3a691KMtZ-wM4vKV-YLOQQ", // HUOM: Tämä paljastaa API-avaimen lähdekoodissa.
                                             // Tuotantoympäristössä harkitse ympäristömuuttujia tai App Checkiä.
  authDomain: "songgame-15d99.firebaseapp.com",
  projectId: "songgame-15d99",
  storageBucket: "songgame-15d99.appspot.com", // Varmista tämä vs firebaseapp.com
  messagingSenderId: "223294335530",
  appId: "1:223294335530:web:5ed0bd39f5529d487c3153"
};

let db;
let initializationError = null;

try {
  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  console.log("Firebase App initialized successfully.");

  // Initialize Cloud Firestore and get a reference to the service
  db = getFirestore(app);
  console.log("Firestore DB instance obtained:", db);

} catch (error) {
  console.error("!!! Firebase Initialization Error !!!:", error);
  initializationError = error;
  // Asetetaan db nulliksi, jotta virhe huomataan App.js:ssä
  db = null;
}

// Vie Firestore-instanssi tai null, jos alustus epäonnistui
export { db, initializationError }; 