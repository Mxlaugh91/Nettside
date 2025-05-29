// js/views/adminWeeklyView.js
var AppViews = AppViews || {};

AppViews.weekly = (function() {
    let _weekSelectElement = null;
    let _activeLocationsTableBodyElement = null;
    let _selectedWeekDisplayElement = null;

    const START_WEEK = 20;
    const END_WEEK = 45;
    const CURRENT_YEAR = new Date().getFullYear();
    // getCurrentWeekNumber() funksjonen her ...
    function getCurrentWeekNumber() {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        return weekNo;
    }
    const CURRENT_WEEK = getCurrentWeekNumber();


    function populateWeekDropdown() {
        if (!_weekSelectElement) {
            AppLogger.warn('adminWeeklyView: Uke-select element ikke funnet, kan ikke fylle uker.');
            return;
        }
        AppLogger.info('adminWeeklyView: Fyller uke-dropdown.');
        _weekSelectElement.innerHTML = ''; 
        for (let week = START_WEEK; week <= END_WEEK; week++) {
            const option = document.createElement('option');
            option.value = week;
            option.textContent = `Uke ${week}`;
            _weekSelectElement.appendChild(option);
        }
        if (CURRENT_WEEK >= START_WEEK && CURRENT_WEEK <= END_WEEK) {
            _weekSelectElement.value = CURRENT_WEEK;
        } else {
            _weekSelectElement.value = START_WEEK;
        }
        updateSelectedWeekDisplay(_weekSelectElement.value); 
        AppLogger.info('adminWeeklyView: Uke-dropdown fylt. Valgt uke:', _weekSelectElement.value);
    }

    function updateSelectedWeekDisplay(week) {
        if (_selectedWeekDisplayElement) {
            _selectedWeekDisplayElement.textContent = week;
        }
    }

    function setupEventListeners() {
        if (_weekSelectElement) {
            _weekSelectElement.addEventListener('change', handleWeekSelectionChange);
            AppLogger.info('adminWeeklyView: Hendelseslytter for ukevalg er satt opp.');
        }
        // Eventuell lytter for _activeLocationsTableBodyElement for 'Arkiver' knapper kommer her senere
    }

    async function handleWeekSelectionChange(event) {
        const selectedWeek = event.target.value;
        AppLogger.info('adminWeeklyView: Uke endret til:', selectedWeek);
        updateSelectedWeekDisplay(selectedWeek);
        // NYTT/ENDRET: Nå kaller vi funksjonen som skal vise data
        // (denne må defineres fullt ut senere for å hente faktiske data)
        await displayActiveLocationsWithWeeklyData(parseInt(selectedWeek), CURRENT_YEAR); 
    }

    // NYTT: Funksjon for å oppdatere completion status indikator
    function updateCompletionStatus(rowsData) {
        const statusTextElement = document.getElementById('status-text');
        const statusContainer = document.getElementById('completion-status');
        
        if (!statusTextElement || !statusContainer || !rowsData) {
            AppLogger.warn('adminWeeklyView: Kunne ikke oppdatere completion status - mangler elementer eller data');
            return;
        }

        const totalLocations = rowsData.length;
        const completedLocations = rowsData.filter(data => data.statusText === "Fullført").length;

        // Oppdater tekst
        statusTextElement.textContent = `${completedLocations} av ${totalLocations} fullført`;

        // Fjern eksisterende status-klasser
        statusContainer.classList.remove('status-none', 'status-partial', 'status-complete');

        // Legg til riktig status-klasse basert på fullføring
        if (completedLocations === 0) {
            statusContainer.classList.add('status-none');
        } else if (completedLocations === totalLocations) {
            statusContainer.classList.add('status-complete');
            // Endre ikon til suksess når alt er fullført
            const statusIcon = statusContainer.querySelector('.status-icon');
            if (statusIcon) {
                statusIcon.textContent = '✅';
            }
        } else {
            statusContainer.classList.add('status-partial');
            // Endre ikon til delvis fullført
            const statusIcon = statusContainer.querySelector('.status-icon');
            if (statusIcon) {
                statusIcon.textContent = '⏳';
            }
        }

        AppLogger.info(`adminWeeklyView: Completion status oppdatert - ${completedLocations}/${totalLocations} fullført`);
    }

    // NYTT: Skjelett for funksjonen som skal vise data (erstatter alert)
    async function displayActiveLocationsWithWeeklyData(week, year) {
        AppLogger.info(`adminWeeklyView: Laster steder og ukedata for uke ${week}, år ${year}.`);
        if (!_activeLocationsTableBodyElement) {
            AppLogger.error("adminWeeklyView: _activeLocationsTableBodyElement er ikke definert for tabellvisning.");
            return;
        }
        _activeLocationsTableBodyElement.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 1rem;">Laster steder og ukedata...</td></tr>`; // ENDRET: colspan til 8 (ny kolonne)

        try {
            const locations = await AppServices.locations.getActiveLocations(); // Henter alle aktive steder
            _activeLocationsTableBodyElement.innerHTML = ''; // Tøm tabellen

            if (!locations || locations.length === 0) {
                _activeLocationsTableBodyElement.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 1rem;">Ingen aktive steder funnet.</td></tr>'; // ENDRET: colspan til 8
                return;
            }

            // NYTT: Bruk Promise.all for å hente ukedata for alle steder parallelt (mer effektivt)
            const locationPromises = locations.map(async (location) => {
                const weeklyTimeEntries = await AppServices.locations.getTimeEntriesForLocationByWeekYear(location.id, week, year);
                AppLogger.debug(`adminWeeklyView: TimeEntries for ${location.name} (uke ${week}/${year}):`, weeklyTimeEntries);

                let statusText = "Gjenstår";
                let DATO_DM = "-";
                let UKEDAG = "-";
                let performedBy = "-";
                let edgingDisplay = "-"; // For "Kanting"-kolonnen
                let weeklyHours = 0;
                let completionEntry = null; // Holder på den timeregistreringen som markerer fullføring

                // Finn en eventuell "fullførende" timeregistrering
                if (weeklyTimeEntries && weeklyTimeEntries.length > 0) {
                    // Sorter etter createdAt desc for å finne den nyeste hvis flere markerer som fullført
                    // eller baser deg på dateOfWork hvis det er mer relevant. Her tar vi den første vi finner.
                    completionEntry = weeklyTimeEntries.find(entry => entry.taskMarkedAsCompleted === true);
                    
                    // Hvis ingen er eksplisitt markert som fullført, men det finnes oppføringer,
                    // kan vi vurdere å ta den siste oppføringen for "Utført Av" etc.
                    // For nå, baserer vi "Fullført Dag" og "Utført Av" på completionEntry.
                    if (!completionEntry && weeklyTimeEntries.length > 0) {
                        // Ta siste entry som "siste aktivitet" hvis ingen er markert fullført
                        // completionEntry = weeklyTimeEntries.sort((a,b) => b.createdAt.seconds - a.createdAt.seconds)[0]; 
                        // For nå lar vi det være slik at kun eksplisitt fullførte gir detaljer.
                    }
                }

                if (completionEntry) {
                    statusText = "Fullført";
                    if (completionEntry.dateOfWork) {
                        let workDate;
                        // Håndter både Firestore Timestamp og ISO-datostreng
                        if (completionEntry.dateOfWork.seconds) { // Firestore Timestamp
                            workDate = new Date(completionEntry.dateOfWork.seconds * 1000);
                        } else { // Anta ISO-streng e.l.
                            workDate = new Date(completionEntry.dateOfWork);
                        }
                        
                        const dayOfMonth = workDate.getDate().toString().padStart(2, '0');
                        const month = (workDate.getMonth() + 1).toString().padStart(2, '0');
                        DATO_DM = `${dayOfMonth}.${month}`;
                        
                        let tempUkedag = workDate.toLocaleDateString('nb-NO', { weekday: 'long' });
                        UKEDAG = tempUkedag.charAt(0).toUpperCase() + tempUkedag.slice(1);
                    }
                    performedBy = completionEntry.employeeName || 'Ukjent';
							if (completionEntry.edgingDone === true) {
								edgingDisplay = "Ja";
							} else {
								// Hvis oppgaven er fullført, men kanting ikke er gjort
										edgingDisplay = "Nei"; 
                    }
                } else if (weeklyTimeEntries && weeklyTimeEntries.length > 0) {
                    // Hvis det er oppføringer, men ingen er markert som "fullført",
                    // kan vi sette status til "Påbegynt" eller lignende.
                    // For nå lar vi den være "Ikke Fullført" hvis ikke eksplisitt markert.
                    // Vi kan fortsatt summere timer.
                }


                // Summer timer for uken uansett status
                if (weeklyTimeEntries && weeklyTimeEntries.length > 0) {
                    weeklyTimeEntries.forEach(entry => {
                        if (entry.hoursWorked && typeof entry.hoursWorked === 'number') {
                            weeklyHours += entry.hoursWorked;
                        }
                    });
                }
                
                // Returner et objekt med data for denne raden
                return {
                    location, // selve steds-objektet
                    statusText,
                    DATO_DM,
                    UKEDAG,
                    performedBy,
                    edgingDisplay,
                    weeklyHours
                };
            });

            // Vent på at all data for alle steder er hentet og bearbeidet
            const rowsData = await Promise.all(locationPromises);            // Nå bygg tabellen med rowsData
            rowsData.forEach(data => {
                const row = _activeLocationsTableBodyElement.insertRow();
                row.setAttribute('data-id', data.location.id);

                row.insertCell().textContent = data.location.name || 'Ukjent Navn';
                const statusCell = row.insertCell();
                statusCell.textContent = data.statusText;
                if (data.statusText === "Fullført") {
                    statusCell.classList.add('status-fullfort');
                    statusCell.setAttribute('data-status', 'fullfort');
                } else if (data.statusText === "Gjenstår") {
                    statusCell.classList.add('status-gjenstar');
                    statusCell.setAttribute('data-status', 'gjenstar');
                }
                row.insertCell().textContent = data.DATO_DM;
                row.insertCell().textContent = data.UKEDAG;
                row.insertCell().textContent = data.edgingDisplay;
                row.insertCell().textContent = `${data.weeklyHours.toFixed(1)} t`;
                row.insertCell().textContent = data.performedBy;
                // Fjernet actionsCell og archiveButton
            });

            AppLogger.info('adminWeeklyView: Aktive steder med ukedata vist i tabellen.');
            
            // NYTT: Oppdater completion status
            updateCompletionStatus(rowsData);
            
            setupArchiveButtonListener();
        } catch (error) {
            AppLogger.error("adminWeeklyView: Feil ved lasting av aktive steder for ukentlig visning:", error);
            _activeLocationsTableBodyElement.innerHTML = '<tr><td colspan="7" style="color:red;">Feil ved lasting av steder.</td></tr>';
        }
    }
      // NYTT: Funksjon for å håndtere arkiver-knapp klikk (flyttet fra adminPage.js)
    async function handleArchiveButtonClick(event) {
        // Find the button element - could be the target itself or a parent
        const button = event.target.closest('.button-archive') || 
                      (event.target.classList && event.target.classList.contains('button-archive') ? event.target : null);
        
        if (button) {
            const locationId = button.getAttribute('data-id');
            let locationName = 'dette stedet';
            const tableRow = button.closest('tr');
            if (tableRow && tableRow.cells && tableRow.cells.length > 0) {
                locationName = `"${tableRow.cells[0].textContent}"`;
            }
            AppLogger.info('adminWeeklyView: Arkiver-knapp klikket for ID:', locationId, 'Navn:', locationName);
            if (confirm(`Er du sikker på at du vil arkivere ${locationName}?`)) {
                // const feedbackElem = document.getElementById('add-location-feedback'); // Trenger en måte å gi feedback
                // if (feedbackElem) { showFeedback(...) } // Anta at showFeedback er global eller sendt inn

                const success = await AppServices.locations.archiveLocation(locationId);
                if (success) {
                    AppLogger.info('adminWeeklyView: Sted arkivert, oppdaterer visning.');
                    refreshActiveView(); // Kall refresh for å laste tabellen på nytt
                } else {
                    AppLogger.error('adminWeeklyView: Arkivering feilet for ID:', locationId);
                    // Vis feilmelding
                }
            }
        }
    }

    // NYTT: Funksjon for å sette opp lytteren for arkiver-knappene
    function setupArchiveButtonListener() {
        if (_activeLocationsTableBodyElement) {
            // Fjern gammel lytter for å unngå duplikater hvis denne kalles flere ganger
            _activeLocationsTableBodyElement.removeEventListener('click', handleArchiveButtonClick);
            _activeLocationsTableBodyElement.addEventListener('click', handleArchiveButtonClick);
            AppLogger.info('adminWeeklyView: Lytter for Arkiver-knapper er satt opp på activeLocationsTableBody.');
        }
    }
    
    // NYTT: refreshActiveView-funksjon som kan kalles fra adminPage.js
    function refreshActiveView() {
        if (_weekSelectElement && _weekSelectElement.value) {
            const currentSelectedWeek = parseInt(_weekSelectElement.value);
            const currentYear = CURRENT_YEAR; 
            AppLogger.info(`adminWeeklyView: refreshActiveView kalt. Laster data for uke ${currentSelectedWeek}, år ${currentYear}.`);
            displayActiveLocationsWithWeeklyData(currentSelectedWeek, currentYear);
        } else {
            AppLogger.warn('adminWeeklyView: Kan ikke refreshe, ukevelger ikke funnet eller ingen verdi valgt. Laster for default uke.');
            displayActiveLocationsWithWeeklyData(CURRENT_WEEK, CURRENT_YEAR);
        }
    }


    function init(config) {
        AppLogger.info('adminWeeklyView: Initialiserer med config:', config);
        if (config && config.weekSelectId) { _weekSelectElement = document.getElementById(config.weekSelectId); }
        else { AppLogger.error('adminWeeklyView: weekSelectId mangler i config.'); }

        if (config && config.activeLocationsTableBodyId) { _activeLocationsTableBodyElement = document.getElementById(config.activeLocationsTableBodyId); }
        else { AppLogger.warn('adminWeeklyView: activeLocationsTableBodyId mangler i config.'); }
        
        if (config && config.selectedWeekDisplayId) { _selectedWeekDisplayElement = document.getElementById(config.selectedWeekDisplayId); }
        else { AppLogger.warn('adminWeeklyView: selectedWeekDisplayId mangler i config.'); }

        populateWeekDropdown();
        setupEventListeners(); 
        refreshActiveView(); // NYTT: Kall refreshActiveView for å laste initiell data
    }

    return {
        init: init,
        refreshActiveView: refreshActiveView // NYTT: Eksporter denne for adminPage.js
    };
})();

// Testlogg helt på slutten av filen for å bekrefte at den har kjørt
console.log('DEBUG: adminWeeklyView.js har kjørt ferdig og AppViews.weekly bør være definert nå.');
// console.log('DEBUG: AppViews.weekly er:', AppViews.weekly);