// js/services/locationService.js
var AppServices = AppServices || {};

AppServices.locations = (function() {
    // Sikrer at nødvendige Firebase-objekter og logger er tilgjengelige
    if (typeof AppLogger === 'undefined') { console.error("AppLogger mangler i locationService.js!"); }
    if (typeof firestoreDB === 'undefined') { console.error("firestoreDB mangler i locationService.js!"); }
    // Sjekk for firebase.firestore.FieldValue for serverTimestamp
    if (typeof firebase === 'undefined' || typeof firebase.firestore === 'undefined' || typeof firebase.firestore.FieldValue === 'undefined') {
        console.error("Firebase FieldValue (for serverTimestamp) mangler! Sørg for at Firebase SDK er fullstendig lastet.");
    }

    const locationsCollection = firestoreDB.collection('locations');
    async function addLocation(locationData) {
        if (!locationData || !locationData.name || locationData.name.trim() === '') {
            AppLogger.error('locationService: Stedsnavn kan ikke være tomt for addLocation.');
            return null;
        }

        // Validering av nye felter
        if (!locationData.address || locationData.address.trim() === '') {
            AppLogger.error('locationService: Adresse kan ikke være tom for addLocation.');
            return null;
        }

        if (!locationData.estimatedTime || isNaN(locationData.estimatedTime) || locationData.estimatedTime <= 0) {
            AppLogger.error('locationService: Estimert tid må være et gyldig tall større enn 0 for addLocation.');
            return null;
        }

        AppLogger.info('locationService: Forsøker å legge til nytt sted:', locationData.name);
        try {
            const payload = {
                name: locationData.name.trim(),
                address: locationData.address.trim(),
                estimatedTime: parseFloat(locationData.estimatedTime),
                isArchived: false, 
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            const docRef = await locationsCollection.add(payload);
            AppLogger.info('locationService: Sted lagt til med ID:', docRef.id, payload);
            return docRef;
        } catch (error) {
            AppLogger.error('locationService: Feil ved tillegging av sted i Firestore:', error);
            return null;
        }
    }

    /**
     * Henter alle aktive steder (de som ikke er arkivert), sortert etter opprettelsesdato (nyeste først).
     * @returns {Promise<Array<object>>} Et promise som resolver med en array av stedsdokumenter.
     */
    async function getActiveLocations() {
        AppLogger.info('locationService: Henter aktive steder...');
        try {
            const snapshot = await locationsCollection
                                    .where("isArchived", "==", false)
                                    .orderBy("createdAt", "desc")
                                    .get();
            const activeLocations = [];
            snapshot.forEach(doc => {
                activeLocations.push({ id: doc.id, ...doc.data() });
            });
            AppLogger.info('locationService: Antall aktive steder funnet:', activeLocations.length);
            AppLogger.debug('locationService: Aktive steder data:', activeLocations);
            return activeLocations; // KORRIGERT HER
        } catch (error) {
            AppLogger.error('locationService: Feil ved henting av aktive steder:', error);
            return []; 
        }
    }
// Inne i AppServices.locations = (function() { ... })();

async function getArchivedLocations() {
    AppLogger.info('locationService: Henter arkiverte steder...');
    try {
        const snapshot = await locationsCollection
                                .where("isArchived", "==", true)
                                .orderBy("archivedAt", "desc") // Sorter på når de ble arkivert
                                .get();
        const archivedLocations = [];
        snapshot.forEach(doc => {
            archivedLocations.push({ id: doc.id, ...doc.data() });
        });
        AppLogger.info('locationService: Antall arkiverte steder funnet:', archivedLocations.length);
        return archivedLocations;
    } catch (error) {
        AppLogger.error('locationService: Feil ved henting av arkiverte steder:', error);
        return [];
    }
}

async function getTimeEntriesForLocation(locationId) {
    AppLogger.info('locationService: Henter alle timeoppføringer for sted ID:', locationId);
    if (!locationId) return [];
    try {
        // Anta at du har en 'timeEntries' collection
        const timeEntriesRef = firestoreDB.collection('timeEntries');
        const snapshot = await timeEntriesRef.where("locationId", "==", locationId).get();
        const entries = [];
        snapshot.forEach(doc => {
            entries.push({ id: doc.id, ...doc.data() });
        });
        AppLogger.info('locationService: Antall timeoppføringer funnet for sted', locationId, ':', entries.length);
        return entries;
    } catch (error) {
        AppLogger.error('locationService: Feil ved henting av timeoppføringer for sted:', locationId, error);
        return [];
    }
}
    // NYTT: Funksjon for å arkivere et sted
    /**
     * Arkiverer et sted ved å sette isArchived til true.
     * @param {string} locationId - ID-en til stedet som skal arkiveres.
     * @returns {Promise<boolean>} True ved suksess, false ved feil.
     */
    async function archiveLocation(locationId) {
        AppLogger.info('locationService: Arkiverer sted med ID:', locationId);
        if (!locationId) {
            AppLogger.error('locationService: Ingen locationId oppgitt for arkivering.');
            return false;
        }
        try {
            const locationRef = locationsCollection.doc(locationId);
            await locationRef.update({
                isArchived: true,
                // NYTT: Legger til et tidsstempel for når stedet ble arkivert (valgfritt, men nyttig)
                archivedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            AppLogger.info('locationService: Sted arkivert:', locationId);
            return true;
        } catch (error) {
            AppLogger.error('locationService: Feil ved arkivering av sted:', locationId, error);
            return false;
        }
    }

   // NYTT: Funksjon for å hente arkiverte steder
    /**
     * Henter alle arkiverte steder, sortert etter når de ble arkivert (nyeste først).
     * @returns {Promise<Array<object>>} Et promise som resolver med en array av arkiverte stedsdokumenter.
     */
    async function getArchivedLocations() {
        AppLogger.info('locationService: Henter arkiverte steder...');
        try {
            const snapshot = await locationsCollection
                                    .where("isArchived", "==", true)
                                    .orderBy("archivedAt", "desc") // Sorter på arkiveringsdato
                                    .get();
            const archivedLocations = [];
            snapshot.forEach(doc => {
                archivedLocations.push({ id: doc.id, ...doc.data() });
            });
            AppLogger.info('locationService: Antall arkiverte steder funnet:', archivedLocations.length);
            return archivedLocations;
        } catch (error) {
            AppLogger.error('locationService: Feil ved henting av arkiverte steder:', error);
            return [];
        }
    }

    // NYTT: Funksjon for å hente alle timeregistreringer for et gitt sted
    /**
     * Henter alle timeregistreringer for en spesifikk locationId.
     * @param {string} locationId - ID-en til stedet.
     * @returns {Promise<Array<object>>} Et promise som resolver med en array av timeregistreringer.
     */
    async function getTimeEntriesForLocation(locationId) {
        AppLogger.info('locationService: Henter alle timeregistreringer for sted ID:', locationId);
        if (!locationId) {
            AppLogger.warn('locationService: Ingen locationId oppgitt til getTimeEntriesForLocation.');
            return [];
        }
        try {
            // Anta at du har (eller vil ha) en 'timeEntries' collection
            const timeEntriesCollectionRef = firestoreDB.collection('timeEntries');
            const snapshot = await timeEntriesCollectionRef.where("locationId", "==", locationId).get();
            const entries = [];
            snapshot.forEach(doc => {
                entries.push({ id: doc.id, ...doc.data() });
            });
            AppLogger.info('locationService: Antall timeoppføringer funnet for sted', locationId, ':', entries.length);
            return entries;
        } catch (error) {
            AppLogger.error('locationService: Feil ved henting av timeregistreringer for sted:', locationId, error);
            return [];
        }
    }

    // NYTT: Funksjon for å gjenopprette et arkivert sted
    /**
     * Gjenoppretter et arkivert sted ved å sette isArchived til false.
     * Fjerner også archivedAt-feltet.
     * @param {string} locationId - ID-en til stedet som skal gjenopprettes.
     * @returns {Promise<boolean>} True ved suksess, false ved feil.
     */
    async function restoreLocation(locationId) {
        AppLogger.info('locationService: Gjenoppretter sted med ID:', locationId);
        if (!locationId) {
            AppLogger.error('locationService: Ingen locationId oppgitt for gjenoppretting.');
            return false;
        }
        try {
            const locationRef = locationsCollection.doc(locationId);
            await locationRef.update({
                isArchived: false,
                archivedAt: firebase.firestore.FieldValue.delete(), // NYTT: Fjerner arkiveringsdatoen
                restoredAt: firebase.firestore.FieldValue.serverTimestamp() // NYTT: Valgfritt: logg når det ble gjenopprettet
            });
            AppLogger.info('locationService: Sted gjenopprettet:', locationId);
            return true;
        } catch (error) {
            AppLogger.error('locationService: Feil ved gjenoppretting av sted:', locationId, error);
            return false;
        }
    }

    
   // NYTT: Funksjon for å hente timeregistreringer for et gitt sted, uke og år
    /**
     * Henter timeregistreringer for en spesifikk locationId, weekNumber og year.
     * @param {string} locationId - ID-en til stedet.
     * @param {number} weekNumber - Ukenummeret.
     * @param {number} year - Årstallet.
     * @returns {Promise<Array<object>>} Et promise som resolver med en array av timeregistreringer.
     */
    async function getTimeEntriesForLocationByWeekYear(locationId, weekNumber, year) {
        // NYTT: Konverter weekNumber og year til tall, for sikkerhets skyld.
        const numWeekNumber = parseInt(weekNumber);
        const numYear = parseInt(year);

        AppLogger.info(`locationService: Henter timeoppføringer for sted ID: ${locationId}, Uke: ${numWeekNumber}, År: ${numYear}`);
        
        if (!locationId || isNaN(numWeekNumber) || isNaN(numYear)) {
            AppLogger.warn('locationService: Utilstrekkelig eller ugyldig data for getTimeEntriesForLocationByWeekYear.', 
                         { locationId, weekNumberInput: weekNumber, yearInput: year });
            return []; // Returner tom array hvis input er ugyldig
        }

        try {
            const timeEntriesCollectionRef = firestoreDB.collection('timeEntries');
            // VIKTIG: Denne spørringen krever en sammensatt indeks i Firestore.
            // Firestore vil gi en feilmelding i nettleserkonsollen med en lenke
            // for å opprette indeksen første gang du kjører dette (hvis den ikke finnes).
            const snapshot = await timeEntriesCollectionRef
                                    .where("locationId", "==", locationId)
                                    .where("weekNumber", "==", numWeekNumber)
                                    .where("year", "==", numYear)
                                    .orderBy("dateOfWork", "asc") // Sorterer etter dato, eldste først i uken
                                    .get();
            
            const entries = [];
            snapshot.forEach(doc => {
                entries.push({ id: doc.id, ...doc.data() });
            });
            AppLogger.info(`locationService: Antall timeoppføringer funnet for sted ${locationId}, uke ${numWeekNumber}/${numYear}: ${entries.length}`);
            AppLogger.debug('locationService: Data for timeoppføringer:', entries);
            return entries;
        } catch (error) {
            AppLogger.error(`locationService: Feil ved henting av timeoppføringer for sted ${locationId}, uke ${numWeekNumber}/${numYear}:`, error);
            if (error.code === 'failed-precondition') {
                AppLogger.error("Firestore indekseringsfeil: En sammensatt indeks mangler sannsynligvis for 'timeEntries'-collection. " +
                                "Sjekk nettleserkonsollen for en feilmelding fra Firestore med en lenke for å opprette indeksen. " +
                                "Indeksen bør være for feltene: locationId (asc), weekNumber (asc), year (asc), dateOfWork (asc).");
                // Du kan eventuelt kaste feilen videre eller informere brukeren på en annen måte.
            }
            return []; // Returner tom array ved feil
        }
    }
    // NYTT SLUTT

    // NYTT: Funksjon for å slette et sted permanent
    /**
     * Sletter et sted permanent fra databasen, inkludert alle timeregistreringer.
     * @param {string} locationId - ID-en til stedet som skal slettes.
     * @returns {Promise<boolean>} True ved suksess, false ved feil.
     */
    async function deleteLocation(locationId) {
        AppLogger.info('locationService: Sletter sted med ID:', locationId);
        if (!locationId) {
            AppLogger.error('locationService: Ingen locationId oppgitt for sletting.');
            return false;
        }
        try {
            // Slett alle timeEntries for dette stedet
            const timeEntriesRef = firestoreDB.collection('timeEntries');
            const snapshot = await timeEntriesRef.where('locationId', '==', locationId).get();
            const batch = firestoreDB.batch();
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            // Slett selve stedet
            await locationsCollection.doc(locationId).delete();
            AppLogger.info('locationService: Sted og tilhørende timeEntries slettet:', locationId);
            return true;
        } catch (error) {
            AppLogger.error('locationService: Feil ved sletting av sted:', locationId, error);
            return false;
        }
    }

    // NYTT: Funksjon for å oppdatere et eksisterende sted med nye felter
    /**
     * Oppdaterer et eksisterende sted med nye felter.
     * @param {string} locationId - ID-en til stedet som skal oppdateres.
     * @param {object} updateData - Objekt med felter som skal oppdateres (f.eks. name, address, estimatedTime).
     * @returns {Promise<boolean>} True ved suksess, false ved feil.
     */
    async function updateLocation(locationId, updateData) {
        AppLogger.info('locationService: Oppdaterer sted med ID:', locationId, updateData);
        if (!locationId || !updateData || typeof updateData !== 'object') {
            AppLogger.error('locationService: Mangler locationId eller updateData for updateLocation.');
            return false;
        }
        try {
            // Fjern eventuelle ugyldige felter
            const allowedFields = ['name', 'address', 'estimatedTime'];
            const updatePayload = {};
            allowedFields.forEach(field => {
                if (field in updateData) {
                    updatePayload[field] = updateData[field];
                }
            });
            if (Object.keys(updatePayload).length === 0) {
                AppLogger.warn('locationService: Ingen gyldige felter å oppdatere for updateLocation.');
                return false;
            }
            await locationsCollection.doc(locationId).update(updatePayload);
            AppLogger.info('locationService: Sted oppdatert:', locationId);
            return true;
        } catch (error) {
            AppLogger.error('locationService: Feil ved oppdatering av sted:', locationId, error);
            return false;
        }
    }

    // Offentlig API for locationService

    return {
        addLocation: addLocation,
        getActiveLocations: getActiveLocations,
        archiveLocation: archiveLocation,
        getArchivedLocations: getArchivedLocations,
        getTimeEntriesForLocation: getTimeEntriesForLocation, // Beholder denne hvis den trengs for totalberegninger
        restoreLocation: restoreLocation,
        getTimeEntriesForLocationByWeekYear: getTimeEntriesForLocationByWeekYear, // NYTT
        deleteLocation: deleteLocation,
        updateLocation: updateLocation // NYTT
    };
})();