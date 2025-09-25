// Profile Edit Test Script
// Paste this into the browser console on /profile.html to test profile editing

console.log('🧪 PROFILE EDIT TEST SCRIPT LOADED');
console.log('📝 Instructions: This script will test the profile editing functionality');

// Override console to capture all logs
const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn
};

const testLogs = [];

function captureLog(level, ...args) {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
    ).join(' ');
    testLogs.push(`[${timestamp}] ${level.toUpperCase()}: ${message}`);
    return `[${level}] ${message}`;
}

console.log = (...args) => {
    originalConsole.log(...args);
    captureLog('log', ...args);
};

console.error = (...args) => {
    originalConsole.error(...args); 
    captureLog('error', ...args);
};

console.warn = (...args) => {
    originalConsole.warn(...args);
    captureLog('warn', ...args);
};

// Function to automatically test profile editing
async function testProfileEditing() {
    console.log('🚀 Starting automatic profile editing test...');
    
    try {
        // Step 1: Check if user is logged in
        if (!me) {
            console.error('❌ No user logged in (me is null)');
            return {
                success: false,
                error: 'No authenticated user',
                logs: testLogs.slice()
            };
        }
        
        console.log('✅ User authenticated:', me.uid);
        
        // Step 2: Open edit modal
        const editBtn = document.getElementById('editBtn');
        const editModal = document.getElementById('editModal');
        
        if (!editBtn) {
            console.error('❌ Edit Profile button not found');
            return {
                success: false, 
                error: 'Edit button not found',
                logs: testLogs.slice()
            };
        }
        
        console.log('✅ Edit button found, opening modal...');
        editBtn.click();
        
        // Wait for modal to open
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Step 3: Fill form fields with test data
        const fields = {
            displayNameInput: 'Test User Profile',
            ageInput: '25',
            locationInput: 'Test City',
            bioInput: 'Testing profile editing functionality',
            interestsInput: 'Testing, Programming'
        };
        
        console.log('📝 Filling form fields with test data...');
        
        for (const [fieldName, value] of Object.entries(fields)) {
            const field = window[fieldName];
            if (field) {
                field.value = value;
                console.log(`✅ Set ${fieldName}: ${value}`);
            } else {
                console.warn(`⚠️ Field ${fieldName} not found`);
            }
        }
        
        // Step 4: Trigger save
        const saveEdit = document.getElementById('saveEdit');
        if (!saveEdit) {
            console.error('❌ Save button not found');
            return {
                success: false,
                error: 'Save button not found', 
                logs: testLogs.slice()
            };
        }
        
        console.log('💾 Clicking save button to trigger profile save...');
        console.log('🔍 WATCH FOR FIREBASE ERRORS BELOW:');
        
        // Click save and wait for result
        saveEdit.click();
        
        // Wait for save operation to complete
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log('✅ Test completed. Check logs above for any Firebase errors.');
        
        return {
            success: true,
            logs: testLogs.slice()
        };
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        return {
            success: false,
            error: error.message,
            logs: testLogs.slice()
        };
    }
}

// Function to display test results
function displayTestResults(results) {
    console.log('\n🔍 === TEST RESULTS ===');
    console.log('Success:', results.success);
    if (results.error) {
        console.log('Error:', results.error);
    }
    
    console.log('\n📊 === CAPTURED LOGS ===');
    results.logs.forEach(log => console.log(log));
    
    console.log('\n🔍 === FIREBASE ERROR ANALYSIS ===');
    const firebaseErrors = results.logs.filter(log => 
        log.includes('FIREBASE ERROR') || 
        log.includes('permission-denied') ||
        log.includes('PERMISSION DENIED')
    );
    
    if (firebaseErrors.length > 0) {
        console.log('❌ Found Firebase errors:');
        firebaseErrors.forEach(error => console.error(error));
    } else {
        console.log('✅ No Firebase errors detected in logs');
    }
}

// Auto-run the test
console.log('🎯 Auto-running profile edit test in 2 seconds...');
setTimeout(async () => {
    const results = await testProfileEditing();
    displayTestResults(results);
}, 2000);

// Manual trigger function
window.runProfileTest = async () => {
    console.clear();
    console.log('🧪 MANUALLY TRIGGERED PROFILE EDIT TEST');
    const results = await testProfileEditing();
    displayTestResults(results);
    return results;
};

console.log('✅ Test script ready! Will auto-run in 2 seconds...');
console.log('💡 Or manually trigger with: runProfileTest()');