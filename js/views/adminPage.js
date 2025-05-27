// js/views/adminPage.js
document.addEventListener('DOMContentLoaded', function() {
    // --- Innledende Sjekker ---
    if (typeof AppLogger === 'undefined') { 
        console.error("Kritisk feil: AppLogger mangler i adminPage.js!"); 
        alert("En kritisk feil oppstod (AppLogger). Sjekk konsollen.");
        return; 
    }
    if (typeof AppServices === 'undefined' || 
        typeof AppServices.auth === 'undefined' || 
        typeof AppServices.users === 'undefined' ||
        typeof AppServices.locations === 'undefined') {
        AppLogger.error("Kritisk feil: Nødvendige AppServices (auth, users, locations) mangler i adminPage.js!");
        alert("En kritisk feil oppstod (AppServices). Sjekk konsollen.");
        return;
    }
    // NYTT: Sjekk for AppViews.weekly
    if (typeof AppViews === 'undefined' || typeof AppViews.weekly === 'undefined') {
        AppLogger.error("Kritisk feil: AppViews.weekly (fra adminWeeklyView.js) mangler! Sjekk script-rekkefølge og filnavn.");
        // return; // Vurder om siden skal stoppe helt her
    }
	
	   if (typeof AppServices.users.addEmployee === 'undefined') { // NYTT: Sjekk for den nye funksjonen
        AppLogger.error("Kritisk feil: AppServices.users.addEmployee mangler i userService.js eller er ikke eksportert!");
        // Vurder å returnere her for å unngå ytterligere feil
    }
    AppLogger.info('adminPage.js lastet og initialiserer.');

    // --- DOM Element-referanser ---
    const adminEmailSpan = document.getElementById('admin-email');
    const logoutButton = document.getElementById('logout-button');
    
    const addLocationForm = document.getElementById('add-location-form');
    const locationNameInput = document.getElementById('location-name');
    const addLocationFeedback = document.getElementById('add-location-feedback');
        
    const showArchivedButton = document.getElementById('show-archived-button');
    const archivedLocationsModal = document.getElementById('archived-locations-modal');
    const closeArchivedModalButton = document.getElementById('close-archived-modal-button');
    const cancelArchivedModalButton = document.getElementById('cancel-archived-modal-button');
    const archivedLocationsListContainer = document.getElementById('archived-locations-list-container');
	const addEmployeeForm = document.getElementById('add-employee-form');
    const employeeNameInput = document.getElementById('employee-name');
    const employeeEmailInput = document.getElementById('employee-email');
    const employeePasswordInput = document.getElementById('employee-password');
    const addEmployeeFeedback = document.getElementById('add-employee-feedback');

    // --- Hjelpefunksjon for å vise feedback-meldinger ---
    function showFeedback(message, type = 'info', feedbackElement = addLocationFeedback, duration = 4000) {
        if (!feedbackElement) {
            AppLogger.warn("Feedback-element ikke funnet eller ikke oppgitt, kan ikke vise melding:", message);
            // Fallback til å bruke console.log hvis feedbackElement mangler helt
            AppLogger[type === 'error' ? 'error' : 'info'](`Feedback: ${message} (Type: ${type})`);
            if (type === 'error') alert(`Feil: ${message}`); // Enkel alert som fallback for feil
            return;
        }
        feedbackElement.textContent = message;
        feedbackElement.className = `feedback-message ${type}`; // type kan være 'success', 'error', 'pending', 'info'
        feedbackElement.style.display = 'block';

        if (duration > 0) {
            setTimeout(() => {
                // Kun skjul hvis det er samme melding (for å unngå å skjule en ny melding for tidlig)
                if (feedbackElement.textContent === message) { 
                    feedbackElement.style.display = 'none';
                }
            }, duration);
        }
    }


    // --- Logikk for Modal for Arkiverte Steder (Beholdes her) ---
    function openArchivedModal() {
        if (archivedLocationsModal && typeof AppViews.weekly !== 'undefined') { // Sjekk at AppViews.weekly er tilgjengelig
            AppLogger.info('AdminPage: Åpner modal for arkiverte steder.');
            archivedLocationsModal.classList.add('active');
            loadAndDisplayArchivedLocations(); 
        } else {
            AppLogger.error('AdminPage: Modal-elementet eller AppViews.weekly ikke funnet for openArchivedModal.');
        }
    }

    function closeArchivedModal() {
        if (archivedLocationsModal) {
            AppLogger.info('AdminPage: Lukker modal for arkiverte steder.');
            archivedLocationsModal.classList.remove('active');
        }
    }

    async function loadAndDisplayArchivedLocations() {
        if (!archivedLocationsListContainer) {
            AppLogger.error('AdminPage: Container for arkivertliste (#archived-locations-list-container) ikke funnet.');
            return;
        }
        archivedLocationsListContainer.innerHTML = '<p style="padding:1rem; text-align:center;">Laster arkiverte steder...</p>';
        AppLogger.info('AdminPage: Laster og viser arkiverte steder i modal.');
        try {
            const archivedLocations = await AppServices.locations.getArchivedLocations();
            AppLogger.debug('AdminPage: Mottatte arkiverte steder:', archivedLocations);
            if (!archivedLocations || archivedLocations.length === 0) {
                archivedLocationsListContainer.innerHTML = '<p style="padding:1rem; text-align:center;">Ingen arkiverte steder funnet.</p>';
                return;
            }
            let tableHTML = `<table class="data-table"><thead><tr>
                                <th>Sted</th><th>Total Tid Brukt</th><th>Antall Klipp (Uker)</th>
                                <th>Arkivert Dato</th><th>Handlinger</th>
                             </tr></thead><tbody>`;
            for (const location of archivedLocations) {
                const timeEntries = await AppServices.locations.getTimeEntriesForLocation(location.id);
                let totalHours = 0;
                const uniqueWeeks = new Set();
                timeEntries.forEach(entry => {
                    if (entry.hoursWorked && typeof entry.hoursWorked === 'number') {
                        totalHours += entry.hoursWorked;
                    }
                    if (entry.year && entry.weekNumber) {
                        uniqueWeeks.add(`${entry.year}-W${entry.weekNumber}`);
                    }
                });
                const archivedDate = location.archivedAt && location.archivedAt.seconds 
                                    ? new Date(location.archivedAt.seconds * 1000).toLocaleDateString('no-NO') 
                                    : '-';
                tableHTML += `<tr data-id="${location.id}">
                                <td>${location.name || 'Ukjent Navn'}</td>
                                <td>${totalHours.toFixed(1)} t</td>
                                <td>${uniqueWeeks.size}</td>
                                <td>${archivedDate}</td>
                                <td><button class="button button-restore" data-id="${location.id}">Gjenopprett</button></td>
                              </tr>`;
            }
            tableHTML += `</tbody></table>`;
            archivedLocationsListContainer.innerHTML = tableHTML;
            AppLogger.info('AdminPage: Arkiverte steder vist i modal.');
        } catch (error) {
            AppLogger.error('AdminPage: Feil under lasting av arkiverte steder for modal:', error);
            archivedLocationsListContainer.innerHTML = '<p style="color:red; padding:1rem; text-align:center;">Kunne ikke laste arkiverte steder.</p>';
        }
    }
    
async function handleRestoreButtonClick(event) {
    // ENDRET: Korrekt struktur for try...catch og if/else
    if (event.target && event.target.classList.contains('button-restore')) {
        const locationId = event.target.getAttribute('data-id');
        let locationName = 'dette stedet'; // Default navn
        const tableRow = event.target.closest('tr');
        if (tableRow && tableRow.cells && tableRow.cells.length > 0) {
            locationName = `"${tableRow.cells[0].textContent}"`;
        }

        AppLogger.info('AdminPage: Gjenopprett-knapp klikket for ID:', locationId, "Navn:", locationName);
        
        if (confirm(`Er du sikker på at du vil gjenopprett stedet ${locationName}?`)) {
            AppLogger.info('AdminPage: Starter gjenoppretting av sted:', locationId);
            // Bruk showFeedback-funksjonen som vi definerte tidligere
            // Anta at addLocationFeedback er det globale feedback-elementet for nå
            showFeedback(`Gjenoppretter ${locationName}...`, 'pending', addLocationFeedback, 0); 

            try { // START på try-blokk
                const success = await AppServices.locations.restoreLocation(locationId);
                if (success) {
                    AppLogger.info('AdminPage: Sted gjenopprettet. Lukker modal og ber weeklyView oppdatere.');
                    showFeedback(`Stedet ${locationName} ble gjenopprettet!`, 'success', addLocationFeedback);
                    closeArchivedModal();       
                    if (AppViews && AppViews.weekly && typeof AppViews.weekly.refreshActiveView === 'function') {
                        AppViews.weekly.refreshActiveView(); 
                    } else {
                        AppLogger.warn('AdminPage: AppViews.weekly.refreshActiveView() er ikke tilgjengelig for å oppdatere aktive steder.');
                        // Fallback hvis weeklyView ikke kan refreshe direkte, last hele listen på nytt her
                        // displayActiveLocations(); // Hvis du hadde beholdt denne funksjonen i adminPage.js
                    }
                } else {
                    AppLogger.error('AdminPage: Gjenoppretting av sted feilet (service returnerte false) for ID:', locationId);
                    showFeedback(`Feil: Kunne ikke gjenopprette ${locationName}.`, 'error', addLocationFeedback);
                }
            } catch (error) { // SLUTT på try-blokk, START på catch-blokk
                AppLogger.error('AdminPage: Kritisk feil/unntak ved kall til restoreLocation service:', error);
                // ENDRET: Sørg for at du bruker riktig variabel for feedback-elementet
                showFeedback(`En systemfeil oppstod under gjenoppretting av ${locationName}.`, 'error', addLocationFeedback);
            } // SLUTT på catch-blokk
        } else { // Denne 'else' hører til 'if (confirm(...))'
            AppLogger.info('AdminPage: Gjenoppretting avbrutt av bruker.');
        } // SLUTT på 'if (confirm(...))' blokken
    } // SLUTT på 'if (event.target ...)' blokken
} // SLUTT på handleRestoreButtonClick funksjonen

    // --- Event Listeners for Modal ---
    if (showArchivedButton) {
        showArchivedButton.addEventListener('click', openArchivedModal);
    } else { AppLogger.warn('AdminPage: Knappen #show-archived-button ikke funnet.'); }

    if (closeArchivedModalButton) {
        closeArchivedModalButton.addEventListener('click', closeArchivedModal);
    }
    if (cancelArchivedModalButton) {
        cancelArchivedModalButton.addEventListener('click', closeArchivedModal);
    }
    if (archivedLocationsModal) {
        archivedLocationsModal.addEventListener('click', function(event) {
            if (event.target === archivedLocationsModal) { 
                closeArchivedModal();
            }
        });
        // Event listener for gjenopprett-knapper er festet til containeren
        if (archivedLocationsListContainer) {
            archivedLocationsListContainer.addEventListener('click', handleRestoreButtonClick);
            AppLogger.info('AdminPage: Event listener for Gjenopprett-knapper er aktivert på containeren #archivedLocationsListContainer.');
        } else { AppLogger.warn('AdminPage: #archivedLocationsListContainer ikke funnet for gjenopprett-lytter.');}
    } else { AppLogger.warn('AdminPage: Modal-elementet #archived-locations-modal ikke funnet.'); }


    // --- Sidebeskyttelse, Rolle-sjekk og Initiering ---
    AppServices.auth.onAuthStateChanged(async firebaseUser => {
        if (firebaseUser) {
            try {
                const userData = await AppServices.users.ensureUserData(firebaseUser.uid, firebaseUser.email, firebaseUser.displayName);
                if (userData && userData.role === 'admin') {
                    AppLogger.info('AdminPage: Bruker er bekreftet admin.');
                    if (adminEmailSpan) adminEmailSpan.textContent = firebaseUser.email || 'Admin';
                    
                    // NYTT: Initialiser weeklyView-modulen
                    if (AppViews && AppViews.weekly && typeof AppViews.weekly.init === 'function') {
                        AppLogger.info('AdminPage: Initialiserer AppViews.weekly.');
                        AppViews.weekly.init({
                            weekSelectId: 'week-select', // ID for uke-dropdown
                            activeLocationsTableBodyId: 'active-locations-table-body', // ID for tbody for aktive steder
                            selectedWeekDisplayId: 'selected-week-display' // ID for span i tabelloverskrift
                        });
                    } else {
                        AppLogger.error('AdminPage: Kunne ikke initialisere AppViews.weekly. Sjekk at adminWeeklyView.js er lastet FØR adminPage.js og at AppViews.weekly.init er definert.');
                    }
                } else { 
                    AppLogger.warn('AdminPage: Bruker er IKKE admin. Omdirigerer til innlogging.');
                    window.location.href = 'index.html';
                }
            } catch (error) {
                AppLogger.error('AdminPage: Feil ved henting/sikring av brukerdata for rolle-sjekk:', error);
                showFeedback('Feil ved verifisering av brukerrettigheter.', 'error', 0); 
                setTimeout(() => { window.location.href = 'index.html'; }, 3000); // Omdiriger etter å ha vist feil
            }
        } else { 
            AppLogger.info('AdminPage: Ingen bruker logget inn. Omdirigerer til login.');
            window.location.href = 'index.html';
        }
    });

    // --- Utloggingsfunksjonalitet ---
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            AppLogger.info('AdminPage: Utloggingsknapp klikket.');
            const result = await AppServices.auth.signOutUser();
            if (!result.success) {
                AppLogger.error('AdminPage: Utlogging feilet', result.error);
                showFeedback('Utlogging feilet. Prøv igjen.', 'error');
            }
            // onAuthStateChanged håndterer omdirigering
        });
    } else { AppLogger.warn("AdminPage: Utloggingsknapp #logout-button ikke funnet."); }
    
    // --- Håndter "Legg til Nytt Sted"-skjema ---
    if (addLocationForm && locationNameInput) {
        addLocationForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            const locationName = locationNameInput.value.trim();
            if (locationName === '') {
				showFeedback('Stedsnavn kan ikke være tomt.', 'error', addLocationFeedback); 
                return;
            }
            showFeedback(`Legger til "${locationName}"...`, 'pending', addLocationFeedback, 0);
            try {
                const result = await AppServices.locations.addLocation({ name: locationName });
                if (result && result.id) {
                    AppLogger.info('AdminPage: Sted lagt til. Ber AppViews.weekly om å oppdatere.');
                    showFeedback(`Stedet "${locationName}" ble lagt til!`, 'success', addLocationFeedback);
                    locationNameInput.value = ''; 
                    if (AppViews && AppViews.weekly && typeof AppViews.weekly.refreshActiveView === 'function') {
                        AppViews.weekly.refreshActiveView();
                    }
                } else {
                    AppLogger.error('AdminPage: Kunne ikke legge til sted via service.');
                    showFeedback('En feil oppstod. Stedet ble ikke lagt til.', 'error', addLocationFeedback);
                }
            } catch (error) {
                AppLogger.error('AdminPage: Kritisk feil ved kall til addLocation service:', error);
                showFeedback('En systemfeil oppstod. Stedet ble ikke lagt til.', 'error', addLocationFeedback);
            }
        });
    } else { AppLogger.warn('AdminPage: Skjemaelementer #add-location-form eller #location-name ikke funnet.'); }
	
	if (addEmployeeForm && employeeNameInput && employeeEmailInput && employeePasswordInput && addEmployeeFeedback) {
        addEmployeeForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            AppLogger.info('AdminPage: "Legg til Ansatt"-skjema sendt.');

            const name = employeeNameInput.value.trim();
            const email = employeeEmailInput.value.trim();
            const password = employeePasswordInput.value; // Passord skal ikke trimmes

            if (!name || !email || !password) {
                showFeedback('Alle felt (navn, e-post, passord) må fylles ut.', 'error', addEmployeeFeedback);
                return;
            }
            if (password.length < 6) {
                showFeedback('Passordet må være minst 6 tegn.', 'error', addEmployeeFeedback);
                return;
            }

            showFeedback(`Oppretter ansatt "${name}"...`, 'pending', addEmployeeFeedback, 0); // Viser "jobber..."

            const result = await AppServices.users.addEmployee(name, email, password);

            if (result.success && result.user) {
                AppLogger.info('AdminPage: Ansatt opprettet:', result.user);
                showFeedback(`Ansatt "${name}" (${email}) ble opprettet! De kan nå logge inn med det oppgitte passordet.`, 'success', addEmployeeFeedback, 8000); // Vis meldingen litt lenger
                addEmployeeForm.reset(); // Tøm skjemaet
                // TODO: Her kan du vurdere å oppdatere en eventuell liste over ansatte hvis du har en slik visning.
            } else {
                AppLogger.error('AdminPage: Kunne ikke opprette ansatt:', result.message, result.error || '');
                showFeedback(`Feil: ${result.message || 'Ukjent feil ved opprettelse av ansatt.'}`, 'error', addEmployeeFeedback);
            }
        });
    } else {
        AppLogger.warn('AdminPage: Ett eller flere skjemaelementer for "Legg til Ansatt" ble ikke funnet. Sjekk ID-er: #add-employee-form, #employee-name, #employee-email, #employee-password, #add-employee-feedback.');
    }


    // FJernet: Den gamle displayActiveLocations() funksjonen.
    // FJernet: Den gamle event listener for activeLocationsTableBody for 'button-archive'.
    //          Dette ansvaret vil nå ligge i adminWeeklyView.js.

    AppLogger.info('AdminPage: Initialisering fullført.');
}); // SLUTT PÅ DOMContentLoaded