// js/services/timeEntryService.js
class TimeEntryService {
    constructor() {
        this.db = null;
        this.collection = 'timeEntries';
    }

    async init() {
        try {
            if (!firebase || !firebase.firestore) {
                throw new Error('Firebase Firestore is not available');
            }
            this.db = firebase.firestore();
            AppLogger.info('TimeEntryService: Firebase Firestore initialisert');
            return { success: true };
        } catch (error) {
            AppLogger.error('TimeEntryService init feil:', error);
            return { success: false, error: error.message };
        }
    }    /**
     * Create a new time entry for an employee
     * @param {Object} timeEntryData - The time entry data
     * @param {string} timeEntryData.employeeId - Firebase UID of the employee
     * @param {string} timeEntryData.locationId - ID of the location
     * @param {string} timeEntryData.workDate - Date in YYYY-MM-DD format
     * @param {number} timeEntryData.hoursWorked - Number of hours worked
     * @param {boolean} timeEntryData.taskCompleted - Whether the task is completed
     * @param {string} timeEntryData.notes - Optional notes
     * @returns {Promise<Object>} Result object with success status
     */    async createTimeEntry(timeEntryData) {
        try {
            console.log('=== TIME ENTRY SERVICE DEBUG ===');
            console.log('Received timeEntryData:', timeEntryData);
            
            if (!this.db) {
                console.log('Database not initialized, initializing...');
                const initResult = await this.init();
                if (!initResult.success) {
                    throw new Error('Failed to initialize database');
                }
                console.log('Database initialized successfully');
            }

            // Validate required fields
            const requiredFields = ['employeeId', 'locationId', 'workDate', 'hoursWorked'];
            for (const field of requiredFields) {
                if (!timeEntryData[field]) {
                    throw new Error(`Missing required field: ${field}`);
                }
            }
            console.log('All required fields present');

            // Create the time entry document
            const timeEntry = {
                employeeId: timeEntryData.employeeId,
                locationId: timeEntryData.locationId,
                workDate: timeEntryData.workDate,
                hoursWorked: parseFloat(timeEntryData.hoursWorked),
                taskCompleted: Boolean(timeEntryData.taskCompleted),
                notes: timeEntryData.notes || '',
                edgingDone: Boolean(timeEntryData.edgingDone),
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                weekNumber: this.getWeekNumber(new Date(timeEntryData.workDate)),
                year: new Date(timeEntryData.workDate).getFullYear(),
                status: 'submitted' // For admin review
            };
            
            console.log('Created timeEntry document:', timeEntry);
            console.log('taskCompleted field specifically:', {
                original: timeEntryData.taskCompleted,
                processed: timeEntry.taskCompleted,
                type: typeof timeEntry.taskCompleted
            });            // Check for duplicate entries (same employee, location, and date)
            console.log('Checking for existing entries...');
            const existingEntry = await this.getTimeEntryByDate(
                timeEntryData.employeeId, 
                timeEntryData.locationId, 
                timeEntryData.workDate
            );
            console.log('Existing entry check result:', existingEntry);

            if (existingEntry.success && existingEntry.data) {
                console.log('Found existing entry, updating instead of creating new');
                // Update existing entry instead of creating duplicate
                const updateResult = await this.updateTimeEntry(existingEntry.data.id, {
                    hoursWorked: timeEntry.hoursWorked,
                    taskCompleted: timeEntry.taskCompleted,
                    edgingDone: timeEntry.edgingDone,
                    notes: timeEntry.notes,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                console.log('Update result:', updateResult);
                
                if (updateResult.success) {
                    AppLogger.info('TimeEntryService: Existing time entry updated for', timeEntryData.workDate);
                    return { success: true, updated: true, id: existingEntry.data.id };
                } else {
                    throw new Error('Failed to update existing time entry');
                }
            }

            // Create new time entry
            console.log('Creating new time entry in database...');
            console.log('About to write to collection:', this.collection);
            console.log('Document to write:', timeEntry);
            
            const docRef = await this.db.collection(this.collection).add(timeEntry);
            
            console.log('Database write successful! Document ID:', docRef.id);
            AppLogger.info('TimeEntryService: New time entry created with ID:', docRef.id);
            return { success: true, id: docRef.id };        } catch (error) {
            console.log('=== TIME ENTRY SERVICE ERROR ===');
            console.log('Error details:', error);
            console.log('Error message:', error.message);
            console.log('Error code:', error.code);
            console.log('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
            
            AppLogger.error('TimeEntryService createTimeEntry feil:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get time entry for specific date
     * @param {string} employeeId - Employee Firebase UID
     * @param {string} locationId - Location ID
     * @param {string} workDate - Date in YYYY-MM-DD format
     * @returns {Promise<Object>} Result with time entry data
     */
    async getTimeEntryByDate(employeeId, locationId, workDate) {
        try {
            if (!this.db) {
                const initResult = await this.init();
                if (!initResult.success) {
                    throw new Error('Failed to initialize database');
                }
            }

            const snapshot = await this.db.collection(this.collection)
                .where('employeeId', '==', employeeId)
                .where('locationId', '==', locationId)
                .where('workDate', '==', workDate)
                .limit(1)
                .get();

            if (snapshot.empty) {
                return { success: true, data: null };
            }

            const doc = snapshot.docs[0];
            return { 
                success: true, 
                data: { id: doc.id, ...doc.data() }
            };

        } catch (error) {
            AppLogger.error('TimeEntryService getTimeEntryByDate feil:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get time entries for an employee
     * @param {string} employeeId - Employee Firebase UID
     * @param {Object} filters - Optional filters
     * @returns {Promise<Object>} Result with time entries array
     */
    async getEmployeeTimeEntries(employeeId, filters = {}) {
        try {
            if (!this.db) {
                const initResult = await this.init();
                if (!initResult.success) {
                    throw new Error('Failed to initialize database');
                }
            }

            let query = this.db.collection(this.collection)
                .where('employeeId', '==', employeeId);

            // Apply filters
            if (filters.locationId) {
                query = query.where('locationId', '==', filters.locationId);
            }
            if (filters.month && filters.year) {
                const startDate = `${filters.year}-${filters.month.toString().padStart(2, '0')}-01`;
                const endDate = `${filters.year}-${filters.month.toString().padStart(2, '0')}-31`;
                query = query.where('workDate', '>=', startDate)
                            .where('workDate', '<=', endDate);
            }

            // Order by date descending
            query = query.orderBy('workDate', 'desc');

            const snapshot = await query.get();
            const timeEntries = [];

            snapshot.forEach(doc => {
                timeEntries.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            AppLogger.info(`TimeEntryService: Retrieved ${timeEntries.length} time entries for employee ${employeeId}`);
            return { success: true, data: timeEntries };

        } catch (error) {
            AppLogger.error('TimeEntryService getEmployeeTimeEntries feil:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Update an existing time entry
     * @param {string} timeEntryId - Time entry document ID
     * @param {Object} updateData - Data to update
     * @returns {Promise<Object>} Result object
     */
    async updateTimeEntry(timeEntryId, updateData) {
        try {
            if (!this.db) {
                const initResult = await this.init();
                if (!initResult.success) {
                    throw new Error('Failed to initialize database');
                }
            }

            await this.db.collection(this.collection).doc(timeEntryId).update({
                ...updateData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            AppLogger.info('TimeEntryService: Time entry updated:', timeEntryId);
            return { success: true };

        } catch (error) {
            AppLogger.error('TimeEntryService updateTimeEntry feil:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get weekly summary for employee
     * @param {string} employeeId - Employee Firebase UID
     * @param {number} weekNumber - Week number
     * @param {number} year - Year
     * @returns {Promise<Object>} Weekly summary data
     */
    async getWeeklySummary(employeeId, weekNumber, year) {
        try {
            if (!this.db) {
                const initResult = await this.init();
                if (!initResult.success) {
                    throw new Error('Failed to initialize database');
                }
            }

            const snapshot = await this.db.collection(this.collection)
                .where('employeeId', '==', employeeId)
                .where('weekNumber', '==', weekNumber)
                .where('year', '==', year)
                .get();

            let totalHours = 0;
            let completedLocations = 0;
            let pendingLocations = 0;
            const locationData = new Map();

            snapshot.forEach(doc => {
                const data = doc.data();
                totalHours += data.hoursWorked;
                
                const locationId = data.locationId;
                if (!locationData.has(locationId)) {
                    locationData.set(locationId, {
                        totalHours: 0,
                        completed: false,
                        entries: []
                    });
                }
                
                const location = locationData.get(locationId);
                location.totalHours += data.hoursWorked;
                location.entries.push(data);
                
                if (data.taskCompleted) {
                    location.completed = true;
                }
            });

            // Count completed vs pending locations
            locationData.forEach(location => {
                if (location.completed) {
                    completedLocations++;
                } else {
                    pendingLocations++;
                }
            });

            return {
                success: true,
                data: {
                    totalHours,
                    completedLocations,
                    pendingLocations,
                    totalLocations: completedLocations + pendingLocations,
                    locationData: Object.fromEntries(locationData)
                }
            };

        } catch (error) {
            AppLogger.error('TimeEntryService getWeeklySummary feil:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get current week number
     * @param {Date} date - Date object
     * @returns {number} Week number
     */
    getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }

    /**
     * Format date for display
     * @param {string} dateString - Date in YYYY-MM-DD format
     * @returns {string} Formatted date
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('nb-NO', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    /**
     * Get time entries for admin review
     * @param {Object} filters - Optional filters
     * @returns {Promise<Object>} Result with time entries for admin
     */
    async getTimeEntriesForAdmin(filters = {}) {
        try {
            if (!this.db) {
                const initResult = await this.init();
                if (!initResult.success) {
                    throw new Error('Failed to initialize database');
                }
            }

            let query = this.db.collection(this.collection);

            // Apply filters
            if (filters.employeeId) {
                query = query.where('employeeId', '==', filters.employeeId);
            }
            if (filters.locationId) {
                query = query.where('locationId', '==', filters.locationId);
            }
            if (filters.status) {
                query = query.where('status', '==', filters.status);
            }
            if (filters.weekNumber && filters.year) {
                query = query.where('weekNumber', '==', filters.weekNumber)
                            .where('year', '==', filters.year);
            }

            // Order by creation date descending
            query = query.orderBy('createdAt', 'desc');

            const snapshot = await query.get();
            const timeEntries = [];

            snapshot.forEach(doc => {
                timeEntries.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            AppLogger.info(`TimeEntryService: Retrieved ${timeEntries.length} time entries for admin`);
            return { success: true, data: timeEntries };

        } catch (error) {
            AppLogger.error('TimeEntryService getTimeEntriesForAdmin feil:', error);
            return { success: false, error: error.message };
        }
    }
}

// Initialize and export the service
const timeEntryService = new TimeEntryService();

// Auto-initialize if AppServices exists
if (typeof AppServices !== 'undefined') {
    AppServices.timeEntry = timeEntryService;
    AppLogger.info('TimeEntryService: Service registered in AppServices');
} else {
    AppLogger.warn('TimeEntryService: AppServices not available, service not registered');
}