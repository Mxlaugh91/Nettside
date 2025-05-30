# Firebase Security Rules Fix Guide

## 🔥 CRITICAL FIXES APPLIED

**Fixed Issues:**
1. ✅ **Locations**: Employee permissions were commented out → Now activated
2. ✅ **Time Entries**: Used `resource.data` instead of `request.resource.data` for creation → Now fixed

**Current Status**: Both locations and time entries should now work for employees after applying the corrected rules.

## Current Issue
Your employee dashboard is getting `FirebaseError: Missing or insufficient permissions` when trying to access the `locations` and `timeEntries` collections. This is because the Firebase security rules are currently blocking employee access.

## Step-by-Step Solution

### 1. Open Firebase Console
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **prosjectx**

### 2. Navigate to Firestore Database Rules
1. In the left sidebar, click **"Firestore Database"**
2. Click on the **"Rules"** tab at the top

### 3. Current Rules (Problem)
Your current rules probably look like this (with employee permissions commented out):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null && 
                     get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    match /locations/{locationId} {
      // Only admin access currently allowed
      allow read, write: if request.auth != null &&
                            get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
      
      // EMPLOYEE PERMISSIONS ARE COMMENTED OUT - THIS IS THE PROBLEM!
      // allow read: if request.auth != null &&
      //                (
      //                  (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin') ||
      //                  (
      //                    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'employee' &&
      //                    resource.data.isArchived == false 
      //                  )
      //                );
    }
    
    match /timeEntries/{timeEntryId} {
      // Only admin access currently allowed
      allow read, write: if request.auth != null &&
                            get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
      
      // EMPLOYEE PERMISSIONS ARE COMMENTED OUT - THIS IS THE PROBLEM!
      // allow create: if request.auth != null &&
      //                  get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'employee' &&
      //                  resource.data.employeeId == request.auth.uid;
      // 
      // allow read, update: if request.auth != null &&
      //                        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'employee' &&
      //                        resource.data.employeeId == request.auth.uid;
    }
  }
}
```

### 4. Fixed Rules (Solution)
Replace your current rules with these **FIXED** rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users collection - users can read/write their own data, admins can read all
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null && 
                     get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Locations collection - FIXED: Employee read permissions activated
    match /locations/{locationId} {
      // Admin can read and write all locations
      allow read, write: if request.auth != null &&
                            get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
      
      // EMPLOYEES CAN NOW READ ACTIVE LOCATIONS (uncommented and activated)
      allow read: if request.auth != null &&
                     (
                       (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin') ||
                       (
                         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'employee' &&
                         resource.data.isArchived == false 
                       )
                     );
    }
    
    // Time Entries collection - FIXED: Employee permissions activated
    match /timeEntries/{timeEntryId} {
      // Admin can read and write all time entries
      allow read, write: if request.auth != null &&
                            get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
        // EMPLOYEES CAN NOW CREATE AND MANAGE THEIR OWN TIME ENTRIES (uncommented and activated)
      allow create: if request.auth != null &&
                       get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'employee' &&
                       request.resource.data.employeeId == request.auth.uid;
      
      allow read, update: if request.auth != null &&
                             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'employee' &&
                             resource.data.employeeId == request.auth.uid;
    }
  }
}
```

### 5. Apply the Rules
1. Copy the **Fixed Rules** above
2. Paste them into the Firebase Console Rules editor
3. Click **"Publish"** to activate the new rules

### 6. Test the Fix
After publishing the rules:

1. Refresh your employee dashboard page
2. Login as an employee user
3. Click the **"Test Steder"** button to run diagnostics
4. Check that:
   - Locations load successfully 
   - No permission errors in browser console
   - Time registration works

## What This Fixes

### Before (Problem):
- ❌ Employees couldn't read locations → "Missing or insufficient permissions"
- ❌ Employees couldn't create time entries → "Missing or insufficient permissions"  
- ❌ Employee dashboard showed no locations

### After (Fixed):
- ✅ Employees can read active locations (`isArchived == false`)
- ✅ Employees can create their own time entries
- ✅ Employees can read and update their own time entries only
- ✅ Employee dashboard loads locations and allows time registration

## Security Notes
The fixed rules maintain security by:
- Employees can only see **active** locations (not archived ones)
- Employees can only create time entries for **themselves** (`employeeId == request.auth.uid`)
- Employees can only read/update **their own** time entries
- Admin permissions remain unchanged (full access to everything)

## Troubleshooting
If you still get permission errors after applying the rules:

1. Make sure the user has `role: 'employee'` in their user document
2. Check that locations have `isArchived: false` 
3. Verify the rules were published successfully
4. Clear browser cache and refresh the page
5. Use the enhanced debug button to check user permissions

## Quick Verification Commands
Run these in browser console after login to verify:

```javascript
// Check current user
console.log('User:', firebase.auth().currentUser);

// Test location access
AppServices.locations.getActiveLocations().then(console.log).catch(console.error);

// Test timeEntry permissions
AppServices.timeEntry.debugUserPermissions().then(console.log).catch(console.error);
```
