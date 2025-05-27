// js/views/employeePage.js
document.addEventListener('DOMContentLoaded', function() {
    if (typeof AppLogger === 'undefined') { console.error("AppLogger mangler i employeePage.js!"); return; }
    if (typeof AppServices === 'undefined' || typeof AppServices.auth === 'undefined') {
        AppLogger.error("Nødvendige AppServices (auth) mangler i employeePage.js!");
        return;
    }
    AppLogger.info('employeePage.js lastet og initialiserer.');

    const employeeEmailSpan = document.getElementById('employee-email');
    const logoutButton = document.getElementById('employee-logout-button');

    // Sjekk innloggingsstatus og vis brukerinfo
    AppServices.auth.onAuthStateChanged(firebaseUser => {
        if (firebaseUser) {
            AppLogger.info('EmployeePage: Bruker logget inn (UID:', firebaseUser.uid, ')');
            if (employeeEmailSpan) {
                employeeEmailSpan.textContent = firebaseUser.email || 'Ansatt';
            }
            // Her kan du legge til en rolle-sjekk hvis du vil,
            // f.eks. hvis en admin ved feil havner her, send til admin-dashbord.
            // For nå, enkel visning.
        } else {
            AppLogger.info('EmployeePage: Ingen bruker logget inn. Omdirigerer til login.');
            window.location.href = 'index.html'; // Send til innloggingssiden
        }
    });

    // Utloggingsfunksjonalitet
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            AppLogger.info('EmployeePage: Utloggingsknapp klikket.');
            const result = await AppServices.auth.signOutUser();
            if (result.success) {
                AppLogger.info('EmployeePage: Utlogging vellykket, onAuthStateChanged håndterer omdirigering.');
                // onAuthStateChanged vil nå omdirigere til index.html
            } else {
                AppLogger.error('EmployeePage: Utlogging feilet', result.error);
                alert('Utlogging feilet. Prøv igjen.');
            }
        });
    } else {
        AppLogger.warn('EmployeePage: Utloggingsknapp (#employee-logout-button) ikke funnet.');
    }

    AppLogger.info('EmployeePage: Initialisering fullført.');
});