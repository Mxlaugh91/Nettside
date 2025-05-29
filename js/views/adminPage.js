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
    }    AppLogger.info('adminPage.js lastet og initialiserer.');    // --- Helper Functions ---    // Funksjon for å laste administrer lokasjoner med riktig timing
    function loadAdministrerLokasjoner() {
        console.log('loadAdministrerLokasjoner() called');
        const maxAttempts = 10;
        let attempts = 0;
          function tryLoad() {
            attempts++;
            console.log(`loadAdministrerLokasjoner attempt ${attempts}`);
            
            try {
                // Prøv å bruke ensureAdministrerLokasjoner hvis tilgjengelig
                if (typeof ensureAdministrerLokasjoner !== 'undefined') {
                    console.log('Using ensureAdministrerLokasjoner');
                    const adminLokInstance = ensureAdministrerLokasjoner();
                    if (adminLokInstance) {
                        console.log('AdministrerLokasjoner instance found, calling loadAllLocations');
                        adminLokInstance.loadAllLocations();
                        return;
                    }
                }
                
                // Fallback til direkte tilgang
                if (typeof administrerLokasjoner !== 'undefined' && administrerLokasjoner) {
                    console.log('Using direct administrerLokasjoner access');
                    administrerLokasjoner.loadAllLocations();
                    return;
                }
                
                if (attempts < maxAttempts) {
                    setTimeout(tryLoad, 100); // Prøv igjen etter 100ms
                } else {
                    console.error('AdministrerLokasjoner objektet kunne ikke lastes etter', maxAttempts, 'forsøk');
                }
            } catch (error) {
                console.error('Feil ved lasting av administrer lokasjoner:', error);
                if (attempts < maxAttempts) {
                    setTimeout(tryLoad, 100);
                }
            }
        }
        
        tryLoad();
    }

    // --- DOM Element-referanser ---    
    const adminEmailSpan = document.getElementById('admin-email');
    const logoutButton = document.getElementById('logout-button');
    const addLocationForm = document.getElementById('add-location-form');
    const locationNameInput = document.getElementById('location-name');
    const locationAddressInput = document.getElementById('location-address');
    const locationEstimatedTimeInput = document.getElementById('location-estimated-time');
    const addLocationFeedback = document.getElementById('add-location-feedback');
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

    // --- Logikk for Arkivseksjonen (uten modal) ---
    async function loadAndDisplayArchivedLocations() {
        if (!archivedLocationsListContainer) {
            AppLogger.error('AdminPage: Container for arkivertliste (#archived-locations-list-container) ikke funnet.');
            return;
        }
        archivedLocationsListContainer.innerHTML = '<p style="padding:1rem; text-align:center;">Laster arkiverte steder...</p>';
        AppLogger.info('AdminPage: Laster og viser arkiverte steder i arkivseksjonen.');
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
                            <td>
                                <button class="button button-restore" data-id="${location.id}">Gjenopprett</button>
                                <button class="button button-delete" data-id="${location.id}" title="Slett permanent" style="margin-left:0.5em; padding:0.3em 0.5em;">
                                    <svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' style='vertical-align:middle;'><polyline points='3 6 5 6 21 6'></polyline><path d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2'></path><line x1='10' y1='11' x2='10' y2='17'></line><line x1='14' y1='11' x2='14' y2='17'></line></svg>
                                </button>
                            </td>
                          </tr>`;
            }
            // Legg til "Slett alle arkiverte steder"-knapp hvis det finnes arkiverte steder
            if (archivedLocations && archivedLocations.length > 0) {
                tableHTML += `</tbody></table>`;
                tableHTML += `<button id="delete-all-archived-btn" class="button button-danger" style="margin-top:1.5rem;">Slett alle arkiverte steder</button>`;
            } else {
                tableHTML += `</tbody></table>`;
            }
            archivedLocationsListContainer.innerHTML = tableHTML;
            AppLogger.info('AdminPage: Arkiverte steder vist i arkivseksjonen.');

            // Sett opp event listener for masse-sletting
            const deleteAllBtn = document.getElementById('delete-all-archived-btn');
            if (deleteAllBtn) {
                deleteAllBtn.addEventListener('click', async () => {
                    if (confirm('Er du sikker på at du vil slette ALLE arkiverte steder permanent? Dette kan ikke angres!')) {
                        try {
                            let allSuccess = true;
                            for (const location of archivedLocations) {
                                const success = await AppServices.locations.deleteLocation(location.id);
                                if (!success) allSuccess = false;
                            }
                            if (allSuccess) {
                                showFeedback('Alle arkiverte steder ble slettet permanent!', 'success', addLocationFeedback);
                            } else {
                                showFeedback('Noen steder kunne ikke slettes. Prøv igjen.', 'error', addLocationFeedback);
                            }
                            loadAndDisplayArchivedLocations();
                            if (AppViews && AppViews.weekly && typeof AppViews.weekly.refreshActiveView === 'function') {
                                AppViews.weekly.refreshActiveView();
                            }
                        } catch (error) {
                            AppLogger.error('AdminPage: Feil under masse-sletting av arkiverte steder:', error);
                            showFeedback('En feil oppstod ved sletting av alle arkiverte steder.', 'error', addLocationFeedback);
                        }
                    }
                });
            }
        } catch (error) {
            AppLogger.error('AdminPage: Feil under lasting av arkiverte steder for arkivseksjonen:', error);
            archivedLocationsListContainer.innerHTML = '<p style="color:red; padding:1rem; text-align:center;">Kunne ikke laste arkiverte steder.</p>';
        }
    }
    
async function handleRestoreButtonClick(event) {
    if (event.target && event.target.classList.contains('button-restore')) {
        const locationId = event.target.getAttribute('data-id');
        let locationName = 'dette stedet';
        const tableRow = event.target.closest('tr');
        if (tableRow && tableRow.cells && tableRow.cells.length > 0) {
            locationName = `"${tableRow.cells[0].textContent}"`;
        }
        if (confirm(`Er du sikker på at du vil gjenopprett ${locationName}?`)) {
            try {
                const success = await AppServices.locations.restoreLocation(locationId);
                if (success) {
                    AppLogger.info('AdminPage: Sted gjenopprettet. Oppdaterer visning.');
                    showFeedback(`Stedet ${locationName} ble gjenopprettet!`, 'success', addLocationFeedback);
                    // Oppdater både arkiv og aktive steder
                    loadAndDisplayArchivedLocations();
                    if (AppViews && AppViews.weekly && typeof AppViews.weekly.refreshActiveView === 'function') {
                        AppViews.weekly.refreshActiveView();
                    }
                } else {
                    showFeedback(`Kunne ikke gjenopprett ${locationName}.`, 'error', addLocationFeedback);
                }
            } catch (error) {
                AppLogger.error('AdminPage: Feil under gjenoppretting av sted:', error);
                showFeedback(`En feil oppstod ved gjenoppretting.`, 'error', addLocationFeedback);
            }
        }
    }
}

    async function handleDeleteButtonClick(event) {
        if (event.target && (event.target.classList.contains('button-delete') || (event.target.closest('button') && event.target.closest('button').classList.contains('button-delete')))) {
            const button = event.target.closest('button');
            const locationId = button.getAttribute('data-id');
            let locationName = 'dette stedet';
            const tableRow = button.closest('tr');
            if (tableRow && tableRow.cells && tableRow.cells.length > 0) {
                locationName = `"${tableRow.cells[0].textContent}"`;
            }
            if (confirm(`Er du sikker på at du vil slette ${locationName} permanent? Dette kan ikke angres!`)) {
                try {
                    const success = await AppServices.locations.deleteLocation(locationId);
                    if (success) {
                        AppLogger.info('AdminPage: Sted slettet. Oppdaterer visning.');
                        showFeedback(`Stedet ${locationName} ble slettet permanent!`, 'success', addLocationFeedback);
                        loadAndDisplayArchivedLocations();
                        if (AppViews && AppViews.weekly && typeof AppViews.weekly.refreshActiveView === 'function') {
                            AppViews.weekly.refreshActiveView();
                        }
                    } else {
                        showFeedback(`Kunne ikke slette ${locationName}.`, 'error', addLocationFeedback);
                    }
                } catch (error) {
                    AppLogger.error('AdminPage: Feil under sletting av sted:', error);
                    showFeedback(`En feil oppstod ved sletting.`, 'error', addLocationFeedback);
                }
            }
        }
    }

    // --- Event Listeners for Arkivseksjonen (og ikke bare modal) ---
    if (archivedLocationsListContainer) {
        archivedLocationsListContainer.addEventListener('click', handleRestoreButtonClick);
        archivedLocationsListContainer.addEventListener('click', handleDeleteButtonClick);
        AppLogger.info('AdminPage: Event listener for Gjenopprett-knapper er aktivert på containeren #archived-locations-list-container (også for arkivseksjonen).');    } else { AppLogger.warn('AdminPage: #archivedLocationsListContainer ikke funnet for gjenopprett-lytter.'); }

    // --- Navigasjonslogikk: Vis kun valgt seksjon ---
    function showSectionByNav(navId) {
        const sections = document.querySelectorAll('.dashboard-main-content > section');
        sections.forEach(section => section.style.display = 'none');
        const navItems = document.querySelectorAll('.admin-navbar .nav-item');
        navItems.forEach(item => item.classList.remove('active'));
        if (navId === 'oversikt') {
            document.getElementById('oversikt').style.display = '';
            navItems[0].classList.add('active');
        } else if (navId === 'steder') {
            document.getElementById('steder').style.display = '';
            navItems[1].classList.add('active');        } else if (navId === 'administrer-lokasjoner') {
            document.getElementById('administrer-lokasjoner').style.display = '';
            navItems[2].classList.add('active');
            // Last inn data for administrer lokasjoner når objektet er klart
            loadAdministrerLokasjoner();
        } else if (navId === 'ansatte') {
            document.getElementById('ansatte').style.display = '';
            navItems[3].classList.add('active');
        } else if (navId === 'arkiv') {
            document.getElementById('arkiv').style.display = '';
            navItems[4].classList.add('active');
            loadAndDisplayArchivedLocations();
        } else if (navId === 'kostnadsoversikt') {
            document.getElementById('kostnadsoversikt').style.display = '';
            navItems[5].classList.add('active');
        }
    }
    // Sett opp event listeners for nav
    document.querySelectorAll('.admin-navbar .nav-item a').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const href = this.getAttribute('href').replace('#', '');
            showSectionByNav(href);
        });
    });
    // Vis "Steder" som standard
    showSectionByNav('steder');
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
    if (addLocationForm && locationNameInput && locationAddressInput && locationEstimatedTimeInput) {
        addLocationForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            const locationName = locationNameInput.value.trim();
            const locationAddress = locationAddressInput.value.trim();
            const estimatedTime = parseFloat(locationEstimatedTimeInput.value);
            
            // Validering
            if (locationName === '') {
				showFeedback('Stedsnavn kan ikke være tomt.', 'error', addLocationFeedback); 
                return;
            }
            if (locationAddress === '') {
				showFeedback('Adresse kan ikke være tom.', 'error', addLocationFeedback); 
                return;
            }
            if (isNaN(estimatedTime) || estimatedTime <= 0) {
				showFeedback('Estimert tid må være et gyldig tall større enn 0.', 'error', addLocationFeedback); 
                return;
            }
            
            showFeedback(`Legger til "${locationName}"...`, 'pending', addLocationFeedback, 0);
            try {
                const locationData = { 
                    name: locationName,
                    address: locationAddress,
                    estimatedTime: estimatedTime
                };
                const result = await AppServices.locations.addLocation(locationData);
                if (result && result.id) {
                    AppLogger.info('AdminPage: Sted lagt til. Ber AppViews.weekly om å oppdatere.');
                    showFeedback(`Stedet "${locationName}" ble lagt til!`, 'success', addLocationFeedback);
                    locationNameInput.value = ''; 
                    locationAddressInput.value = '';
                    locationEstimatedTimeInput.value = '';
                    if (AppViews && AppViews.weekly && typeof AppViews.weekly.refreshActiveView === 'function') {
                        AppViews.weekly.refreshActiveView();
                    }
                    // Oppdater også administrer lokasjoner visningen
                    loadAdministrerLokasjoner();
                } else {
                    AppLogger.error('AdminPage: Kunne ikke legge til sted via service.');
                    showFeedback('En feil oppstod. Stedet ble ikke lagt til.', 'error', addLocationFeedback);
                }
            } catch (error) {
                AppLogger.error('AdminPage: Kritisk feil ved kall til addLocation service:', error);
                showFeedback('En systemfeil oppstod. Stedet ble ikke lagt til.', 'error', addLocationFeedback);
            }
        });
    } else { AppLogger.warn('AdminPage: Skjemaelementer for "Legg til Sted" ikke funnet. Sjekk ID-er: #add-location-form, #location-name, #location-address, #location-estimated-time'); }
	
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