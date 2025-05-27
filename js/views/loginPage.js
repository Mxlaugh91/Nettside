// js/views/loginPage.js
document.addEventListener('DOMContentLoaded', function() {
    // ... (eksisterende sjekker for AppLogger, AppServices.auth, AppServices.users) ...
    AppLogger.info('loginPage.js lastet og klar for rollebasert omdirigering.');

    const loginForm = document.getElementById('login-form');
    const loginErrorMsg = document.getElementById('login-error');

    async function handleLoginOrAuthStateChange(firebaseUser) {
        if (!firebaseUser) {
            AppLogger.info('handleLoginOrAuthStateChange: Ingen Firebase-bruker, gjør ingenting med omdirigering.');
            return;
        }
        AppLogger.info('handleLoginOrAuthStateChange: Bruker funnet (UID:', firebaseUser.uid, '), henter brukerdata og rolle...');
        try {
            // ensureUserData vil hente eksisterende data, eller opprette med default rolle "employee"
            const userData = await AppServices.users.ensureUserData(firebaseUser.uid, firebaseUser.email, firebaseUser.displayName);

            if (userData) {
                AppLogger.info('Brukerdata (inkl. rolle) hentet:', userData);
                if (userData.role === 'admin') {
                    AppLogger.info('Rolle er admin, omdirigerer til admin-dashboard.html');
                    window.location.href = 'admin-dashboard.html';
                } else {
                    AppLogger.info('Rolle er employee (eller ukjent, default), omdirigerer til employee-dashboard.html');
                    window.location.href = 'employee-dashboard.html';
                }
            } else {
                AppLogger.warn('Kunne ikke hente/sikre brukerdata, omdirigerer til employee-dashboard.html som fallback.');
                window.location.href = 'employee-dashboard.html';
            }
        } catch (error) {
            AppLogger.error('Feil under henting av brukerrolle for omdirigering:', error);
            loginErrorMsg.textContent = 'Kunne ikke verifisere brukerrolle. Prøv igjen.';
            loginErrorMsg.style.display = 'block';
            // Fallback: send til ansatt-siden hvis noe uventet skjer
            // window.location.href = 'employee-dashboard.html';
        }
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            AppLogger.info('Innloggingsskjema sendt.');
            const email = loginForm.email.value;
            const password = loginForm.password.value;

            // ... (din eksisterende validering for tomme felt) ...
            loginErrorMsg.style.display = 'none';

            const result = await AppServices.auth.signIn(email, password);

            if (result.success && result.user) {
                await handleLoginOrAuthStateChange(result.user);
            } else {
                // ... (din eksisterende feilhåndtering for mislykket innlogging) ...
            }
        });
    } else { AppLogger.warn('Element med ID "login-form" ikke funnet.'); }

    AppServices.auth.onAuthStateChanged(async firebaseUser => {
        const currentPage = window.location.pathname.split("/").pop();
        if (firebaseUser) {
            // Hvis brukeren er på login-siden (index.html) og allerede er logget inn.
            if (currentPage === 'index.html' || currentPage === '') {
                AppLogger.info('Bruker er allerede logget inn på index-siden, behandler omdirigering.');
                await handleLoginOrAuthStateChange(firebaseUser);
            }
        } else {
            AppLogger.info('Ingen bruker logget inn (onAuthStateChanged).');
            // Logikk for å sende bruker til index.html hvis de er på en beskyttet side
            // vil ligge i scriptene for de beskyttede sidene (adminPage.js, employeePage.js)
        }
    });
});