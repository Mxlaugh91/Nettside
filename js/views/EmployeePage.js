// js/views/employeePage.js
document.addEventListener('DOMContentLoaded', function() {
    // --- Feedback utility (must be defined before use) ---
    function showFeedback(type, message) {
        const feedbackEl = document.getElementById('time-entry-feedback');
        if (!feedbackEl) return;
        feedbackEl.className = `feedback-message ${type}`;
        feedbackEl.textContent = message;
        feedbackEl.style.display = 'block';
        setTimeout(() => { feedbackEl.style.display = 'none'; }, 5000);
    }

    if (typeof AppLogger === 'undefined') { 
        console.error("AppLogger mangler i employeePage.js!"); 
        return; 
    }
    if (typeof AppServices === 'undefined' || 
        typeof AppServices.auth === 'undefined' ||
        typeof AppServices.locations === 'undefined' ||
        typeof AppServices.timeEntry === 'undefined') {
        AppLogger.error("Nødvendige AppServices (auth, locations, timeEntry) mangler i employeePage.js!");
        return;
    }
    AppLogger.info('employeePage.js lastet og initialiserer.');

    // Debug: Log available services
    AppLogger.info('EmployeePage: Available AppServices:', Object.keys(AppServices || {}));
    if (AppServices.locations) {
        AppLogger.info('EmployeePage: locationService methods:', Object.keys(AppServices.locations));
    }    // DOM elements
    const employeeEmailSpan = document.getElementById('employee-email');
    const logoutButton = document.getElementById('employee-logout-button');
    const locationsGrid = document.getElementById('locations-grid');
    const timeEntryForm = document.getElementById('time-entry-form');
    const locationSelect = document.getElementById('location-select');
    const workDateInput = document.getElementById('work-date');
    const pendingLocationsSpan = document.getElementById('pending-locations');
    const completedLocationsSpan = document.getElementById('completed-locations');
    const weekSelect = document.getElementById('employee-week-select');

    // State
    let currentUser = null;
    let locations = [];
    let currentWeekData = null;

    // Initialize current date
    if (workDateInput) {
        const today = new Date();
        workDateInput.value = today.toISOString().split('T')[0];
    }

    // Navigation functionality
    const navItems = document.querySelectorAll('.nav-item a');
    const sections = document.querySelectorAll('main section');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = item.getAttribute('href').substring(1);
            showSection(targetId);
            
            // Update active nav item
            navItems.forEach(nav => nav.parentElement.classList.remove('active'));
            item.parentElement.classList.add('active');
        });
    });

    function showSection(sectionId) {
        sections.forEach(section => {
            section.style.display = 'none';
        });
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.style.display = 'block';
            
            // Load section-specific data
            if (sectionId === 'faste-steder') {
                loadLocationsOverview();
            } else if (sectionId === 'historikk') {
                loadTimeEntryHistory();
            }
        }
    }    // Authentication state handling
    AppServices.auth.onAuthStateChanged(firebaseUser => {
        AppLogger.info('EmployeePage: Authentication state changed');
        if (firebaseUser) {
            AppLogger.info('EmployeePage: Bruker logget inn (UID:', firebaseUser.uid, ')');
            AppLogger.info('EmployeePage: User email:', firebaseUser.email);
            currentUser = firebaseUser;
            
            if (employeeEmailSpan) {
                employeeEmailSpan.textContent = firebaseUser.email || 'Ansatt';
            }
              // Initialize the page
            setTimeout(() => {
                initializePage();
            }, 1000); // Wait 1 second for services to be ready
            
        } else {
            AppLogger.info('EmployeePage: Ingen bruker logget inn. Omdirigerer til login.');
            window.location.href = 'index.html';
        }
    });// Initialize page functionality
    async function initializePage() {
        try {
            // Initialize services
            await AppServices.timeEntry.init();
            // Load initial data
            await loadLocations();
            await loadCurrentWeekSummary();
            // Show first section
            showSection('faste-steder');
            // Ensure week number is displayed
            updateWeekNumberDisplay();
            AppLogger.info('EmployeePage: Page initialized successfully');
        } catch (error) {
            AppLogger.error('EmployeePage: Initialization error:', error);
        }
    }    // Load locations from database
    async function loadLocations() {
        try {
            AppLogger.info('EmployeePage: Starting to load locations...');
            
            // Check if service is available
            if (!AppServices.locations || !AppServices.locations.getActiveLocations) {
                throw new Error('AppServices.locations.getActiveLocations is not available');
            }
            
            const locations_data = await AppServices.locations.getActiveLocations();
            AppLogger.info('EmployeePage: Raw data from getActiveLocations:', locations_data);
            
            // locationService returns raw array, not {success, data} object
            if (Array.isArray(locations_data)) {
                locations = locations_data;
                AppLogger.info(`EmployeePage: Loaded ${locations.length} locations`);
                await populateLocationSelectFiltered(); // Use filtered version
            } else {
                AppLogger.error('EmployeePage: Invalid data format returned from locationService, expected array but got:', typeof locations_data);
                throw new Error('Invalid data format returned from locationService');
            }
        } catch (error) {
            AppLogger.error('EmployeePage: Error loading locations:', error);
            showFeedback('error', 'Kunne ikke laste steder. Prøv å oppdatere siden.');
        }
    }

    // Populate location select dropdown, filtering out completed locations for the selected week
    async function populateLocationSelectFiltered() {
        if (!locationSelect || !locations.length || !currentUser || !weekSelect) return;
        // Save the first option (placeholder)
        const firstOption = locationSelect.firstElementChild;
        locationSelect.innerHTML = '';
        if (firstOption) locationSelect.appendChild(firstOption);

        // Get selected week and year
        const selectedWeek = parseInt(weekSelect.value);
        const now = new Date();
        const year = now.getFullYear();
        // Use cached week summary if available and matches selected week
        let completedLocationIds = new Set();
        let weekSummary = null;
        if (currentWeekData && currentWeekData.weekNumber === selectedWeek && currentWeekData.year === year) {
            weekSummary = { success: true, data: currentWeekData };
        } else {
            try {
                weekSummary = await AppServices.timeEntry.getWeeklySummary(currentUser.uid, selectedWeek, year);
            } catch (e) {
                AppLogger.warn('Kunne ikke hente ukesoppsummering for filtrering av steder:', e);
            }
        }
        if (weekSummary && weekSummary.success && weekSummary.data && weekSummary.data.locationData) {
            Object.entries(weekSummary.data.locationData).forEach(([locId, locData]) => {
                if (locData.completed) completedLocationIds.add(locId);
            });
        }
        // Filter locations
        const availableLocations = locations.filter(loc => !completedLocationIds.has(loc.id));
        // Populate dropdown
        if (availableLocations.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Ingen tilgjengelige steder (alle fullført denne uken)';
            option.disabled = true;
            option.selected = true;
            locationSelect.appendChild(option);
            locationSelect.disabled = true;
        } else {
            availableLocations.forEach(location => {
                const option = document.createElement('option');
                option.value = location.id;
                option.textContent = location.name;
                locationSelect.appendChild(option);
            });
            locationSelect.disabled = false;
        }
    }

    // Week selector dropdown logic for employee dashboard
    function populateEmployeeWeekDropdown() {
        if (!weekSelect) return;
        weekSelect.innerHTML = '';
        const currentYear = new Date().getFullYear();
        // Use same week range as admin (20-45)
        for (let week = 20; week <= 45; week++) {
            const option = document.createElement('option');
            option.value = week;
            option.textContent = `Uke ${week}`;
            weekSelect.appendChild(option);
        }
        // Set current week as selected
        const now = new Date();
        const currentWeek = AppServices.timeEntry.getWeekNumber(now);
        weekSelect.value = currentWeek;
        updateWeekNumberDisplay(currentWeek);
    }

    function updateWeekNumberDisplay(weekNumber) {
        const weekNumberSpan = document.getElementById('current-week-number');
        if (weekNumberSpan) {
            weekNumberSpan.textContent = weekNumber || '--';
        }
    }

    // Handle week selection change
    function handleEmployeeWeekChange() {
        const selectedWeek = parseInt(weekSelect.value);
        updateWeekNumberDisplay(selectedWeek);
        loadCurrentWeekSummary(selectedWeek);
        loadLocationsOverview(selectedWeek);
        populateLocationSelectFiltered(); // Update dropdown
    }

    // Load current week summary
    async function loadCurrentWeekSummary(weekOverride) {
        if (!currentUser) return;
        
        try {
            const now = new Date();
            const weekNumber = weekOverride || AppServices.timeEntry.getWeekNumber(now);
            const year = now.getFullYear();
            
            const result = await AppServices.timeEntry.getWeeklySummary(currentUser.uid, weekNumber, year);
            if (result.success) {
                currentWeekData = result.data;
                updateWeeklyStats();
            }
            // Always update week number display after summary
            updateWeekNumberDisplay(weekNumber);
        } catch (error) {
            AppLogger.error('EmployeePage: Error loading weekly summary:', error);
        }
    }

    // Update weekly statistics display
    function updateWeeklyStats() {
        if (!currentWeekData) return;
        
        if (pendingLocationsSpan) {
            pendingLocationsSpan.textContent = currentWeekData.pendingLocations || 0;
        }
        if (completedLocationsSpan) {
            completedLocationsSpan.textContent = currentWeekData.completedLocations || 0;
        }
    }

    // Load locations overview
    async function loadLocationsOverview(weekOverride) {
        if (!locationsGrid || !currentUser) return;
        
        try {
            // Show loading
            locationsGrid.innerHTML = `
                <div class="loading-message">
                    <div class="loading-spinner"></div>
                    <p>Laster faste steder...</p>
                </div>
            `;
              if (!locations.length) {
                AppLogger.info('EmployeePage: No locations in cache, loading from database...');
                await loadLocations();
            }
            
            AppLogger.info(`EmployeePage: Checking locations array: length=${locations.length}`);
            if (!locations.length) {
                AppLogger.warn('EmployeePage: No locations found after loading from database');
                locationsGrid.innerHTML = `
                    <div class="loading-message">
                        <p>Ingen aktive steder funnet. Kontakt administrator for å legge til steder.</p>
                    </div>
                `;
                return;
            }
            
            // Get current week data for each location
            const now = new Date();
            const weekNumber = weekOverride || AppServices.timeEntry.getWeekNumber(now);
            const year = now.getFullYear();
            
            const weekData = await AppServices.timeEntry.getWeeklySummary(currentUser.uid, weekNumber, year);
            const locationData = weekData.success ? weekData.data.locationData : {};
            
            // Create location cards
            locationsGrid.innerHTML = '';
            locations.forEach(location => {
                const locationInfo = locationData[location.id] || { totalHours: 0, completed: false };
                const card = createLocationCard(location, locationInfo);
                locationsGrid.appendChild(card);
            });
            
        } catch (error) {
            AppLogger.error('EmployeePage: Error loading locations overview:', error);
            locationsGrid.innerHTML = `
                <div class="loading-message">
                    <p>Feil ved lasting av steder. Prøv å oppdatere siden.</p>
                </div>
            `;
        }
    }

    // Create location card element
    function createLocationCard(location, locationInfo) {
        const card = document.createElement('div');
        card.className = 'location-card';
        card.dataset.locationId = location.id;
        
        const status = locationInfo.completed ? 'completed' : 'pending';
        const statusText = locationInfo.completed ? 'Fullført' : 'Pågående';
        
        card.innerHTML = `
            <div class="location-card-header">
                <h3 class="location-name">${location.name}</h3>
                <span class="location-status ${status}">${statusText}</span>
            </div>
            <div class="location-card-content">
                <p><strong>📍 Sted:</strong> ${location.name}</p>
                <p><strong>⏰ Timer denne uken:</strong> ${locationInfo.totalHours || 0}</p>
                <p><strong>📝 Beskrivelse:</strong> ${location.description || 'Ingen beskrivelse'}</p>
                ${locationInfo.completed ? '<div class="location-locked">Jobben er fullført for denne uken</div>' : ''}
            </div>
        `;
        
        // Disable kortet hvis fullført
        if (locationInfo.completed) {
            card.classList.add('disabled');
            card.style.pointerEvents = 'none';
            card.style.opacity = '0.6';
        } else {
            card.addEventListener('click', () => {
                selectLocationForTimeEntry(location.id);
            });
        }
        
        return card;
    }

    // Select location for time entry
    function selectLocationForTimeEntry(locationId) {
        if (locationSelect) {
            locationSelect.value = locationId;
        }
        showSection('registrer-timer');
        
        // Update nav
        navItems.forEach(nav => nav.parentElement.classList.remove('active'));
        const timeEntryNav = document.querySelector('a[href="#registrer-timer"]');
        if (timeEntryNav) {
            timeEntryNav.parentElement.classList.add('active');
        }
    }

    // Time entry form submission
    if (timeEntryForm) {
        timeEntryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser) {
                showFeedback('error', 'Bruker ikke logget inn');
                return;
            }
            // --- NYTT: Sjekk om valgt sted er fullført for valgt uke ---
            const selectedLocationId = locationSelect.value;
            const selectedWeek = parseInt(weekSelect.value);
            const now = new Date();
            const year = now.getFullYear();
            // Hent ukedata for valgt sted og uke
            const weekSummary = await AppServices.timeEntry.getWeeklySummary(currentUser.uid, selectedWeek, year);
            if (weekSummary.success && weekSummary.data && weekSummary.data.locationData && weekSummary.data.locationData[selectedLocationId]?.completed) {
                showFeedback('error', 'Jobben for dette stedet er allerede markert som fullført denne uken. Du kan ikke registrere flere timer.');
                return;
            }
            
            const formData = new FormData(timeEntryForm);
            const timeEntryData = {
                employeeId: currentUser.uid,
                locationId: formData.get('locationId'),
                workDate: formData.get('workDate'),
                hoursWorked: parseFloat(formData.get('hoursWorked')),
                taskCompleted: formData.get('taskCompleted') === 'true',
                edgingDone: formData.get('edgingDone') === 'true',
                notes: formData.get('notes') || ''
            };
            
            // Validate data
            if (!timeEntryData.locationId || !timeEntryData.workDate || !timeEntryData.hoursWorked) {
                showFeedback('error', 'Vennligst fyll ut alle påkrevde felt');
                return;
            }
            
            if (timeEntryData.hoursWorked <= 0 || timeEntryData.hoursWorked > 24) {
                showFeedback('error', 'Timer må være mellom 0.1 og 24');
                return;
            }
              try {
                // Disable submit button
                const submitBtn = timeEntryForm.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<span class="button-icon">⏳</span> Lagrer...';
                }
                
                const result = await AppServices.timeEntry.createTimeEntry(timeEntryData);
                
                if (result.success) {
                    const message = result.updated ? 
                        'Timeregistrering oppdatert!' : 
                        'Timeregistrering lagret!';
                    
                    showFeedback('success', message);
                    timeEntryForm.reset();
                    
                    // Set today's date again
                    if (workDateInput) {
                        const today = new Date();
                        workDateInput.value = today.toISOString().split('T')[0];
                    }
                    
                    // Refresh data
                    await loadCurrentWeekSummary();
                    if (document.getElementById('faste-steder').style.display !== 'none') {
                        await loadLocationsOverview();
                    }
                    updateWeekNumberDisplay();
                    await populateLocationSelectFiltered(); // Update dropdown after submit
                    
                } else {
                    throw new Error(result.error);
                }
                
            } catch (error) {
                AppLogger.error('EmployeePage: Time entry submission error:', error);
                showFeedback('error', `Feil ved lagring: ${error.message}`);
            } finally {
                // Re-enable submit button
                const submitBtn = timeEntryForm.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<span class="button-icon">💾</span> Registrer Timer';
                }
            }
        });
    }

    // Load time entry history
    async function loadTimeEntryHistory() {
        if (!currentUser) return;
        
        try {
            const historyTable = document.querySelector('.employee-history-table tbody');
            if (!historyTable) return;
            
            // Get filters
            const monthFilter = document.getElementById('history-month')?.value;
            const locationFilter = document.getElementById('history-location')?.value;
            
            const filters = {};
            if (monthFilter) {
                const [year, month] = monthFilter.split('-');
                filters.year = parseInt(year);
                filters.month = parseInt(month);
            }
            if (locationFilter) {
                filters.locationId = locationFilter;
            }
            
            const result = await AppServices.timeEntry.getEmployeeTimeEntries(currentUser.uid, filters);
            
            if (result.success) {
                populateHistoryTable(result.data);
                updateHistoryStats(result.data);
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            AppLogger.error('EmployeePage: Error loading history:', error);
        }
    }

    // Populate history table
    function populateHistoryTable(timeEntries) {
        const tbody = document.querySelector('.employee-history-table tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        if (!timeEntries.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 2rem;">
                        Ingen timeregistreringer funnet
                    </td>
                </tr>
            `;
            return;
        }
        
        timeEntries.forEach(entry => {
            const location = locations.find(l => l.id === entry.locationId);
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${AppServices.timeEntry.formatDate(entry.workDate)}</td>
                <td>${location ? location.name : 'Ukjent sted'}</td>
                <td>${entry.hoursWorked}</td>
                <td class="${entry.taskCompleted ? 'status-completed' : 'status-pending'}">
                    ${entry.taskCompleted ? 'Fullført' : 'Pågående'}
                </td>
                <td>${entry.notes || '-'}</td>
            `;
            
            tbody.appendChild(row);
        });
    }

    // Update history statistics
    function updateHistoryStats(timeEntries) {
        const totalHours = timeEntries.reduce((sum, entry) => sum + entry.hoursWorked, 0);
        const completedCount = timeEntries.filter(entry => entry.taskCompleted).length;
        
        // Update stat cards if they exist
        const totalHoursStat = document.querySelector('.stat-card .stat-number');
        const completedStat = document.querySelectorAll('.stat-card .stat-number')[1];
        
        if (totalHoursStat) totalHoursStat.textContent = totalHours.toFixed(1);
        if (completedStat) completedStat.textContent = completedCount;
    }

    // Logout functionality
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            AppLogger.info('EmployeePage: Utloggingsknapp klikket.');
            const result = await AppServices.auth.signOutUser();
            if (result.success) {
                AppLogger.info('EmployeePage: Utlogging vellykket, onAuthStateChanged håndterer omdirigering.');
            } else {
                AppLogger.error('EmployeePage: Utlogging feilet', result.error);
                alert('Utlogging feilet. Prøv igjen.');
            }
        });
    } else {
        AppLogger.warn('EmployeePage: Utloggingsknapp (#employee-logout-button) ikke funnet.');
    }    // Debug functionality
    AppLogger.info('EmployeePage: Initialisering fullført.');
    populateEmployeeWeekDropdown();
    if (weekSelect) {
        weekSelect.addEventListener('change', handleEmployeeWeekChange);
    }
});