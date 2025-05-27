// js/services/userService.js
var AppServices = AppServices || {};

AppServices.users = (function() {
    if (typeof AppLogger === 'undefined') { console.error("AppLogger mangler i userService.js!"); }
    if (typeof firestoreDB === 'undefined') { console.error("firestoreDB mangler i userService.js!"); }
	if (typeof AppLogger === 'undefined') { console.error("AppLogger mangler i userService.js!"); }
    if (typeof firestoreDB === 'undefined') { console.error("firestoreDB mangler i userService.js!"); }
    if (typeof firebaseAuth === 'undefined') { console.error("firebaseAuth (Firebase Auth service) mangler i userService.js!"); }
    if (typeof firebase === 'undefined' || typeof firebase.firestore === 'undefined' || typeof firebase.firestore.FieldValue === 'undefined') {
        console.error("Firebase FieldValue (for serverTimestamp) mangler! Sørg for at Firebase SDK er fullstendig lastet.");
    }

    async function getUserData(userId) {
        if (!userId) {
            AppLogger.warn('userService: Ingen userId oppgitt for getUserData.');
            return null;
        }
        AppLogger.info('userService: Henter brukerdata for userId:', userId);
        try {
            const userDocRef = firestoreDB.collection('users').doc(userId);
            const docSnap = await userDocRef.get();

            // KORREKT SJEKK HER: docSnap.exists (uten parenteser)
            if (docSnap.exists) { 
                const userData = { id: docSnap.id, ...docSnap.data() };
                AppLogger.info('userService: Brukerdata funnet:', userData);
                return userData;
            } else {
                AppLogger.warn('userService: Ingen brukerdata funnet for userId:', userId, "- vil forsøke å sikre brukerdata.");
                return null;
            }
        } catch (error) {
            AppLogger.error('userService: Feil ved henting av brukerdata:', error);
            throw error;
        }
    }

    async function ensureUserData(userId, email, displayName) {
        if (!userId) {
            AppLogger.error('userService: ensureUserData kalt uten userId.');
            return null;
        }
        AppLogger.info('userService: Sikrer brukerdata for', userId, email);
        const userDocRef = firestoreDB.collection('users').doc(userId);
        try {
            let docSnap = await userDocRef.get();

            // KORREKT SJEKK HER: !docSnap.exists (uten parenteser)
            if (!docSnap.exists) { 
                AppLogger.info('userService: Oppretter nytt brukerdokument for', userId);
                const newUserPayload = {
                    email: email,
                    displayName: displayName || email.split('@')[0],
                    role: 'employee', 
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                await userDocRef.set(newUserPayload);
                AppLogger.info('userService: Nytt brukerdokument opprettet med rolle "employee".', newUserPayload);
                docSnap = await userDocRef.get();
                return { id: docSnap.id, ...docSnap.data() };
            } else {
                const existingData = docSnap.data();
                // KORREKT SJEKK HER (hvis du vil sjekke om existingData finnes, men docSnap.exists dekker allerede dette)
                if (typeof existingData.role === 'undefined') { 
                    AppLogger.warn('userService: Bruker', userId, 'mangler rolle. Setter til "employee".');
                    await userDocRef.update({ role: 'employee' });
                    docSnap = await userDocRef.get();
                    return { id: docSnap.id, ...docSnap.data() };
                }
                AppLogger.info('userService: Eksisterende brukerdata funnet for', userId, existingData);
                return { id: docSnap.id, ...existingData };
            }
        } catch (error) {
            AppLogger.error('userService: Feil ved sikring/opprettelse av brukerdata:', error);
            throw error;
        }
    }
	
	    // NYTT: Funksjon for å legge til en ny ansatt (Auth + Firestore)
    /**
     * Oppretter en ny ansattbruker i Firebase Authentication og et tilhørende dokument i Firestore.
     * @param {string} name - Den ansattes fulle navn.
     * @param {string} email - Den ansattes e-post.
     * @param {string} password - Det midlertidige passordet for den ansatte.
     * @returns {Promise<object>} Et objekt som indikerer suksess og brukerdata, 
     * eller suksess false med en feilmelding.
     * Eks. suksess: { success: true, user: { uid, email, displayName, role } }
     * Eks. feil:    { success: false, message: "Feilmelding", error?: errorObject }
     */
    async function addEmployee(name, email, password) {
        AppLogger.info(`userService: Forsøker å opprette ny ansatt: ${name}, E-post: ${email}`);
        
        // Enkel validering (kan utvides)
        if (!name || !email || !password) {
            const errorMsg = 'Navn, e-post og passord må oppgis for å legge til ansatt.';
            AppLogger.error('userService: ' + errorMsg);
            return { success: false, message: errorMsg };
        }
        if (password.length < 6) { // Firebase krever minst 6 tegn
            const errorMsg = 'Passordet er for svakt. Det må være minst 6 tegn.';
            AppLogger.error('userService: ' + errorMsg);
            return { success: false, message: errorMsg };
        }

        try {
            // Steg 1: Opprett bruker i Firebase Authentication
            // Viktig: createUserWithEmailAndPassword logger automatisk inn den nye brukeren i _denne nettleserøkten_.
            // Dette er vanligvis ikke et problem for en admin som oppretter brukere, men greit å vite.
            // Admin forblir innlogget som seg selv etterpå pga. onAuthStateChanged.
            const userCredential = await firebaseAuth.createUserWithEmailAndPassword(email, password);
            const authUser = userCredential.user;
            AppLogger.info('userService: Firebase Auth bruker opprettet med UID:', authUser.uid);

            // Steg 2: Opprett dokument i Firestore 'users' collection
            const userDocRef = firestoreDB.collection('users').doc(authUser.uid);
            const newUserProfile = {
                uid: authUser.uid, // Lagrer UID også i dokumentet for enklere referanse
                email: email,
                displayName: name,
                role: 'employee', // Alle brukere opprettet av admin blir 'employee' som standard
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                // Du kan legge til 'createdByAdminUid: firebaseAuth.currentUser.uid' for å logge hvem som opprettet brukeren
                // (hvis admin er innlogget når denne funksjonen kalles)
            };
            await userDocRef.set(newUserProfile);
            AppLogger.info('userService: Firestore brukerdokument opprettet for ansatt:', newUserProfile);
            
            // Returnerer suksess og den nyopprettede brukerprofilen
            return { success: true, user: newUserProfile };

        } catch (error) {
            AppLogger.error('userService: Feil ved opprettelse av ansatt:', { code: error.code, message: error.message });
            let userFriendlyMessage = 'En ukjent feil oppstod under opprettelse av ansatt.';
            if (error.code === 'auth/email-already-in-use') {
                userFriendlyMessage = 'E-postadressen er allerede registrert.';
            } else if (error.code === 'auth/weak-password') {
                userFriendlyMessage = 'Passordet er for svakt. Det må være minst 6 tegn.';
            } else if (error.code === 'auth/invalid-email') {
                userFriendlyMessage = 'E-postadressen er har et ugyldig format.';
            }
            // TODO: Vurder å sende e-post til den nye brukeren med innloggingsdetaljer eller instruksjoner? (Mer avansert)
            return { success: false, message: userFriendlyMessage, error: error };
        }
    }

    return {
        getUserData: getUserData,
        ensureUserData: ensureUserData,
		addEmployee: addEmployee // NYTT: Gjør addEmployee tilgjengelig
    };
})();

console.log('DEBUG: userService.js har kjørt. AppServices.users er nå av type:', typeof AppServices.users);