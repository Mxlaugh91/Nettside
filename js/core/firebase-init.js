// Import the functions you need from the SDKs you need
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBQ0dDKjPQe4LCR45P_qMzzjgizzmZqVYA",
  authDomain: "prosjectx.firebaseapp.com",
  projectId: "prosjectx",
  storageBucket: "prosjectx.firebasestorage.app",
  messagingSenderId: "616755392654",
  appId: "1:616755392654:web:338cb689c6c7a42d37d9df"
};


// Globalt tilgjengelige Firebase-instanser
let firebaseApp;
let firebaseAuth;
let firestoreDB;

// Prøv å initialisere Firebase
// Sjekk først om firebase-objektet (fra SDK-scriptene) er lastet
if (typeof firebase !== 'undefined' && typeof firebase.initializeApp === 'function') {
    try {
        firebaseApp = firebase.initializeApp(firebaseConfig);
        firebaseAuth = firebase.auth(); // Bruker compat-versjonens globale firebase.auth()
        firestoreDB = firebase.firestore(); // Bruker compat-versjonens globale firebase.firestore()

        if (typeof AppLogger !== 'undefined') {
            AppLogger.info('Firebase er initialisert og klar.');
        } else {
            console.log('Firebase er initialisert og klar (AppLogger ikke funnet ennå).');
        }
    } catch (error) {
        const initErrorMessage = 'Feil under initialisering av Firebase: ' + error.message;
        if (typeof AppLogger !== 'undefined') {
            AppLogger.error(initErrorMessage, error);
        } else {
            console.error(initErrorMessage, error);
        }
        // Du kan også kaste feilen videre hvis du vil stoppe all videre kjøring
        // throw error;
    }
} else {
    const sdkErrorMessage = 'Firebase SDK ser ikke ut til å være lastet korrekt! Sjekk <script>-taggene for Firebase i HTML-filen din, og at de lastes FØR denne filen (firebase-init.js).';
    if (typeof AppLogger !== 'undefined') {
        AppLogger.error(sdkErrorMessage);
    } else {
        console.error(sdkErrorMessage);
    }
    // For å gjøre det tydelig at noe er fundamentalt galt
    // document.body.innerHTML = `<p style="color:red; font-weight:bold; padding:20px;">${sdkErrorMessage}</p>`;
}