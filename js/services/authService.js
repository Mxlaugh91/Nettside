// js/services/authService.js
var AppServices = AppServices || {};

AppServices.auth = (function() {
    if (typeof AppLogger === 'undefined') { console.error("AppLogger mangler!"); }
    if (typeof firebaseAuth === 'undefined') { console.error("firebaseAuth mangler!"); }

    async function signIn(email, password) {
        AppLogger.info('authService: Forsøker innlogging for', email);
        try {
            const userCredential = await firebaseAuth.signInWithEmailAndPassword(email, password);
            AppLogger.info('authService: Innlogging vellykket for', userCredential.user.email);
            return { success: true, user: userCredential.user };
        } catch (error) {
            AppLogger.error('authService: Innloggingsfeil', error.code, error.message);
            return { success: false, error: error };
        }
    }

    async function signOutUser() {
        AppLogger.info('authService: Forsøker utlogging.');
        try {
            await firebaseAuth.signOut();
            AppLogger.info('authService: Utlogging vellykket.');
            return { success: true };
        } catch (error) {
            AppLogger.error('authService: Utloggingsfeil', error.code, error.message);
            return { success: false, error: error };
        }
    }

    function onAuthStateChanged(callback) {
        AppLogger.info('authService: Setter opp onAuthStateChanged lytter.');
        return firebaseAuth.onAuthStateChanged(callback); // Returnerer unsubscribe-funksjonen
    }

    return {
        signIn: signIn,
        signOutUser: signOutUser,
        onAuthStateChanged: onAuthStateChanged
    };
})();

console.log('DEBUG: authService.js har kjørt. AppServices.auth er nå av type:', typeof AppServices.auth);