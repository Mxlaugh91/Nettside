1. adminPage.js
Purpose: Main controller for the admin dashboard.
Key Functions:
Checks for required services (AppLogger, AppServices.auth, AppServices.users, AppServices.locations) and views (AppViews.weekly).
Handles navigation between dashboard sections (overview, locations, manage locations).
Loads and displays archived locations.
Calls loadAdministrerLokasjoner() to initialize/manage locations via the AdministrerLokasjoner class.
Relies on AppServices.users.addEmployee for employee management.
Interconnections: Uses AppServices for backend logic, AppViews.weekly for weekly admin view, and AdministrerLokasjoner for location management.
2. adminWeeklyView.js
Purpose: Implements the weekly admin view (AppViews.weekly).
Key Functions:
init(config): Initializes the weekly view with DOM element IDs.
populateWeekDropdown(), updateSelectedWeekDisplay(): Manage week selection UI.
setupEventListeners(), handleWeekSelectionChange(): Handle user interaction.
updateCompletionStatus(): Updates UI to reflect completion status of locations.
refreshActiveView(): Refreshes data display.
Interconnections: Registered as AppViews.weekly, called by adminPage.js for weekly data display and updates.
3. administrerLokasjoner.js
Purpose: UI logic for managing (CRUD) locations in the admin dashboard.
Main Class: AdministrerLokasjoner
Constructor: Initializes state (locations, isLoading).
loadAllLocations(): Loads locations from Firestore via AppServices.locations.
renderLocations(), createLocationCardHTML(): Renders location cards in the UI.
editLocation(), archiveLocation(), deleteLocation(): Edit, archive, or delete locations (calls AppServices.locations methods).
updateLocationCount(), getLocationInfo(), getLocationIcon(): UI helpers.
showLoading(), showError(): UI feedback.
refresh(): Reloads locations.
Global Instance: administrerLokasjoner, with ensureAdministrerLokasjoner() for safe access.
Interconnections: Uses AppServices.locations for backend, called by adminPage.js.
4. userService.js
Purpose: User management service (AppServices.users).
Key Functions:
getUserData(userId), ensureUserData(userId, email, displayName): Fetch/ensure user data in Firestore.
addEmployee(): Adds a new employee (used by admin).
Interconnections: Uses firestoreDB and firebaseAuth (from Firebase), called by admin dashboard for employee management.
5. authService.js
Purpose: Authentication service (AppServices.auth).
Key Functions:
signIn(email, password): Authenticates user.
signOutUser(): Signs out user.
onAuthStateChanged(callback): Listens for auth state changes.
Interconnections: Uses firebaseAuth (from Firebase), called by login and dashboard pages for authentication flow.
6. main.js
Purpose: Global initialization.
Key Functions:
On DOMContentLoaded, sets the current year in the footer.
Logs initialization via AppLogger.
Interconnections: Utility, no direct business logic.
7. logger.js
Purpose: Logging utility (AppLogger).
Main Functions:
debug(), info(), warn(), error(): Structured logging with timestamps and log levels.
Interconnections: Used throughout all modules for consistent logging and debugging.
8. firebase-init.js
Purpose: Initializes Firebase app, authentication, and Firestore.
Key Logic:
Sets up firebaseApp, firebaseAuth, and firestoreDB as global variables.
Interconnections: All services (userService, authService, locationService, timeEntryService) depend on these globals for backend operations.
Interconnections & Flow
AppServices: Central registry for all backend services (users, auth, locations, timeEntry, etc.), making them accessible across views.
AppViews: Registry for view modules (e.g., AppViews.weekly for admin weekly view).
Admin Dashboard: adminPage.js orchestrates navigation, uses adminWeeklyView.js for weekly data, and administrerLokasjoner.js for location management.
Employee Dashboard: (from EmployeePage.js, not in your list but referenced) uses AppServices.timeEntry and AppServices.locations for time entry and location overview.
Firebase: Used for authentication and Firestore data storage, initialized globally.
Logging: AppLogger is used throughout for error/info/debug logging.
Summary:
The application is modular, with clear separation between views (UI logic), services (backend/data logic), and core utilities (logging, Firebase). Admin and employee dashboards are event-driven, rely on central service registries, and use Firebase for authentication and data. Location management is encapsulated in a dedicated class and view, while logging and error handling are consistent across the codebase.