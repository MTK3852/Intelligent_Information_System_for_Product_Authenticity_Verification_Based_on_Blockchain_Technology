console.log('[responses.js] Script loaded and parsing started.');

// Base URL for the API - Adjust if your API server runs elsewhere
const API_BASE_URL = 'http://192.168.56.4:9090/api'; // Assuming API server is accessible here from the frontend

// Store logged-in user info (simple in-memory storage)
let loggedInUser = null;

// NEW: State for statistics month navigation
let currentStatsYear = new Date().getFullYear();
let currentStatsMonth = new Date().getMonth(); // 0-indexed (0 = January, 11 = December)

// Global variable to track if we are modifying an item
let modifyingItemId = null;

// DOM Elements
let loginForm, registerForm, logoutButton, loginNavButton, registerNavButton;
let loginScreen, registerScreen, logoutSection, topNav;
let mainSearchContent; // The main div holding search H1, form etc.
let loggedInWelcomeScreen, welcomeUserNameSpan; // Added elements for welcome screen
let statusMessage, loggedInUserSpan;
// Add refs for new status divs
let loginStatusMessage, registerStatusMessage; 
let searchTextInput, searchResultContainer, searchButton;
let topLeftNav, backButton; // Changed backButtons to single backButton in topLeftNav
let loggedInView; // Added for admin panel
let adminCompanyListView; // Added for admin company list view

// DOM Elements for Admin Panel
let addItemButton, modifyItemButton, deleteItemButton;
let addItemFormContainer, addItemForm, cancelAddItemButton;
let companyItemTableBody; // Reference to the table body

// DOM Elements for Admin Company Panel
let activateSelectedCompaniesButton, deactivateSelectedCompaniesButton, deleteSelectedCompaniesButton;
let selectAllCompaniesCheckbox;

// NEW Button for Company View
let statsButton; // Renamed for clarity
let homeButton; // Added for Home button

// NEW Statistics View Elements
let statisticsView;
let backToAdminButton;
let statsNav; // Added reference for the nav div
let statsTitle; // NEW: Title element for stats page

// Define default HTML for the search result area
const DEFAULT_SEARCH_RESULT_HTML = '<h4> <em class="result-text">Item Is Real/Fake</em> </h4>';

// --- Helper Function for Serial Number Input Formatting ---
function formatSerialNumberInput(event) {
    const input = event.target;
    let value = input.value.replace(/\D/g, ''); // Remove non-digits
    let formattedValue = '';

    for (let i = 0; i < value.length; i++) {
        if (i > 0 && i % 4 === 0) {
            formattedValue += '-'; // Add hyphen every 4 digits
        }
        formattedValue += value[i];
    }

    // Limit length to XX-XX-XX-XX format (19 chars)
    if (formattedValue.length > 19) {
        formattedValue = formattedValue.substring(0, 19);
    }

    // Update the input field value directly
    input.value = formattedValue;
}

// --- UI Control Functions ---

function showScreen(screenName) {
    console.log(`[showScreen] Called with screenName: ${screenName}`);
    clearStatus();
    // Hide all primary content sections first
    console.log('[showScreen] Hiding all screens...');
    if(mainSearchContent) mainSearchContent.style.display = 'none'; else console.warn('[showScreen] mainSearchContent is null');
    if(loginScreen) loginScreen.style.display = 'none'; else console.warn('[showScreen] loginScreen is null');
    if(registerScreen) registerScreen.style.display = 'none'; else console.warn('[showScreen] registerScreen is null');
    if(loggedInView) loggedInView.style.display = 'none'; else console.warn('[showScreen] loggedInView is null');
    if(adminCompanyListView) adminCompanyListView.style.display = 'none'; else console.warn('[showScreen] adminCompanyListView is null'); // Hide new view
    if(statisticsView) statisticsView.style.display = 'none'; // Hide stats view
    if(statsNav) statsNav.style.display = 'none'; // Hide stats nav button container

    // Hide/Show main top-left nav depending on screen
    if (screenName === 'statistics') {
        if(topLeftNav) topLeftNav.style.display = 'none'; // Hide main nav when showing stats
    } else if (loggedInUser || screenName === 'login' || screenName === 'register') {
        if(topLeftNav) topLeftNav.style.display = 'block'; // Show main nav otherwise when logged in or on auth screens
    } else {
        if(topLeftNav) topLeftNav.style.display = 'none'; // Hide otherwise (e.g., main search logged out)
    }

    // Show the requested screen (main content area)
    console.log(`[showScreen] Attempting to show main content: ${screenName}`);
    // Log intended state BEFORE showing target
    const mainSearchStyleBeforeShow = mainSearchContent ? mainSearchContent.style.display : 'not found';
    console.log(`[showScreen] #main-search-content display BEFORE showing ${screenName}: ${mainSearchStyleBeforeShow}`);

    if (screenName === 'login') {
        if(loginScreen) loginScreen.style.display = 'block';
        if(topLeftNav) topLeftNav.style.display = 'block'; // ** Restore: Show back button for Login **
        console.log('[showScreen] Display set for loginScreen');
    } else if (screenName === 'register') {
        if(registerScreen) registerScreen.style.display = 'block';
        if(topLeftNav) topLeftNav.style.display = 'block'; // ** Restore: Show back button for Register **
        console.log('[showScreen] Display set for registerScreen');
    } else if (screenName === 'admin') {
        if(loggedInView) {
            loggedInView.style.display = 'block';
            console.log('[showScreen] Display set for loggedInView (admin panel)');
        } else {
            console.error('[showScreen] Cannot show admin panel - loggedInView element not found!');
        }
        if(mainSearchContent) mainSearchContent.style.display = 'none'; 
    } else if (screenName === 'admin-company-list') {
        if(adminCompanyListView) {
            adminCompanyListView.style.display = 'block';
            console.log('[showScreen] Display set for adminCompanyListView');
        } else {
            console.error('[showScreen] Cannot show admin company list view - adminCompanyListView element not found!');
        }
        if(mainSearchContent) mainSearchContent.style.display = 'none'; 
    } else if (screenName === 'statistics') {
        if(statisticsView) statisticsView.style.display = 'block';
        if(statsNav) statsNav.style.display = 'block'; // Show stats nav button container
        console.log('[showScreen] Display set for statisticsView');
        // TODO: Potentially trigger fetch/display of stats data here
        // displayCompanyStatisticsData(); // Example call
    } else { // Default to 'main'
        if(mainSearchContent) mainSearchContent.style.display = 'block';
        console.log('[showScreen] Display set for mainSearchContent');
    }
}

// Function to update UI based on login state (mainly top nav)
function updateUI() {
    clearStatus(); 

    // Hide company action buttons by default
    if(statsButton) statsButton.style.display = 'none'; // Hide stats button
    if(homeButton) homeButton.style.display = 'none'; // Hide home button

    if (loggedInUser) {
        // --- Logged In State ---
        if(topNav) topNav.style.display = 'none'; else console.warn('[updateUI] topNav (Login/Register) is null');
        if(logoutSection) logoutSection.style.display = 'flex'; else console.warn('[updateUI] logoutSection is null');
        // ** SHOW topLeftNav (Back button) when logged in **
        if(topLeftNav) topLeftNav.style.display = 'block'; else console.warn('[updateUI] topLeftNav (Back Button) is null'); 
        // ** Set initial button text **
        if(backButton) backButton.textContent = 'Go to Search'; else console.warn('[updateUI] backButton is null');
        // ** Explicitly HIDE main search content **
        if(mainSearchContent) mainSearchContent.style.display = 'none'; else console.warn('[updateUI] mainSearchContent is null');

        // Get company name and display name (email)
        const companyName = loggedInUser.companyName || 'User'; // Fallback if no company name
        const displayName = loggedInUser.email; // Assuming email is the desired username display

        // Update logout section 
        if (logoutSection) {
            logoutSection.innerHTML = `
                Welcome, ${companyName}! 
                <span id="logged-in-user" style="font-size: 0.8em; opacity: 0.8; margin-left: 5px; margin-right: 15px;">(${displayName})</span> 
                <button id="logout-button" type="button" class="search-button">Logout</button>
            `;
            // Re-attach the event listener to the NEW logout button
            const newLogoutButton = document.getElementById('logout-button');
            if (newLogoutButton) {
                newLogoutButton.addEventListener('click', handleLogout);
            } else {
                console.error('[updateUI] Could not find new logout button to attach listener.');
            }
        } else {
            console.warn('[updateUI] logoutSection element not found, cannot update innerHTML or attach listener.');
        }
        
        // ** Show appropriate view based on user role **
        if (loggedInUser.email === 'admin@gmail.com') {
            console.log('[updateUI] Admin user detected, showing company list view.');
            showScreen('admin-company-list'); // Use a new screen name
            fetchAndDisplayAllCompanies(); // Fetch and display all companies for admin
        } else {
            console.log('[updateUI] Regular user detected, showing item admin panel.');
            // --- Revert: Show admin panel directly, don't redirect --- 
            showScreen('admin'); // Existing screen name for regular admin panel
            fetchAndDisplayCompanyItems(); // Fetch items when showing panel
            // window.location.href = 'home.html'; 
            // --- End Revert --- 

            // Visibility for buttons on index.html (will apply if user navigates back)
            if(statsButton) statsButton.style.display = 'inline-block'; 
            if(homeButton) homeButton.style.display = 'inline-block'; 
        }

    } else {
        // --- Logged Out State ---
        if(topNav) topNav.style.display = 'flex'; else console.warn('[updateUI] topNav (Login/Register) is null');
        if(logoutSection) logoutSection.style.display = 'none'; else console.warn('[updateUI] logoutSection is null');
        if(topLeftNav) topLeftNav.style.display = 'none'; else console.warn('[updateUI] topLeftNav (Back Button) is null'); // Hide Back button when logged out
        // ** Explicitly show main search content when logged out **
        if(mainSearchContent) mainSearchContent.style.display = 'block'; else console.warn('[updateUI] mainSearchContent is null');
        showScreen('main'); // ShowScreen will hide other panels
    }
}

// Function to display status messages - MODIFIED for Auto-Clear & Timeout Management
function showStatus(message, isError = true, targetId = 'status-message') {
    let targetElement = document.getElementById(targetId);
    if (targetElement) {
        // Clear any existing timeout for this specific element
        if (targetElement.dataset.statusTimeoutId) {
            clearTimeout(parseInt(targetElement.dataset.statusTimeoutId));
            delete targetElement.dataset.statusTimeoutId; // Remove the stored ID
        }

        targetElement.textContent = message;
        targetElement.style.color = isError ? 'red' : 'lightblue'; 
        targetElement.style.textAlign = 'center'; 

        // Set a new timeout to clear this message
        const timeoutId = setTimeout(() => {
            // Check if the element still exists and the message is still the one we set
            if (targetElement && targetElement.textContent === message) {
                 targetElement.textContent = '';
            }
            // Clear the stored timeout ID once executed or if element/message changed
            if (targetElement && targetElement.dataset.statusTimeoutId === String(timeoutId)) {
                 delete targetElement.dataset.statusTimeoutId;
            }
        }, 5000); // 5000 milliseconds = 5 seconds
        
        // Store the new timeout ID on the element
        targetElement.dataset.statusTimeoutId = String(timeoutId);

    } else {
        console.warn(`Status message element with ID "${targetId}" not found.`);
    }
}

// Function to clear status messages - Keep clearing all for navigation/reset
function clearStatus() {
    if (statusMessage) statusMessage.textContent = '';
    if (loginStatusMessage) loginStatusMessage.textContent = '';
    if (registerStatusMessage) registerStatusMessage.textContent = '';
}

// Function to reset main page search elements
function resetMainPage() {
    if (searchTextInput) searchTextInput.value = ''; // Clear input
    // ** Modify reset to use container and default HTML **
    if (searchResultContainer) {
        searchResultContainer.innerHTML = DEFAULT_SEARCH_RESULT_HTML;
    }
    clearStatus(); // Also clear any general status messages
}

// --- Event Handlers ---

// Handle User Registration
async function handleRegister(event) {
    console.log('[handleRegister] Function called'); // Add log
    event.preventDefault(); 
    showStatus('Registering...', false, 'register-screen'); 

    // ** Get elements via event.target **
    const form = event.target;
    const nameElement = form.elements['register-name'];
    const emailElement = form.elements['register-email'];
    const passwordElement = form.elements['register-password'];
    const companyIdElement = form.elements['register-company-id']; // Get the new Company ID element
    console.log('[handleRegister] form:', form);
    console.log('[handleRegister] nameElement (from form.elements):', nameElement);
    console.log('[handleRegister] emailElement (from form.elements):', emailElement);
    console.log('[handleRegister] passwordElement (from form.elements):', passwordElement);
    console.log('[handleRegister] companyIdElement (from form.elements):', companyIdElement); // Log the new element

    // Check if elements exist before accessing value
    // Add companyIdElement to the check
    if (!nameElement || !emailElement || !passwordElement || !companyIdElement) {
        console.error('[handleRegister] Register form elements not found via form.elements!');
        showStatus('Registration form error. Please refresh.', true, 'register-screen');
        return; 
    }

    const companyName = nameElement.value;
    const email = emailElement.value;
    const password = passwordElement.value;
    const companyId = companyIdElement.value; // Get the Company ID value

    // ** Add input validation for companyId **
    if (!/^\d{4}$/.test(companyId)) {
        showStatus('Company ID must be exactly 4 digits.', true, 'register-screen');
        return; // Stop submission if format is incorrect
    }

    try {
        const response = await fetch(`${API_BASE_URL}/registerCompany`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            // Include companyId in the JSON payload
            body: JSON.stringify({ companyName, email, password, companyId }), 
        });

        const responseText = await response.text(); 

        if (response.status === 201) {
            registerForm.reset();
            // ** Change: Use custom modal instead of alert **
            const modal = document.getElementById('registration-success-modal');
            const modalOkButton = document.getElementById('modal-ok-button');

            if (modal && modalOkButton) {
                // Update modal text
                const modalMessageElement = modal.querySelector('p');
                if (modalMessageElement) {
                    modalMessageElement.textContent = "Registration submitted successfully! An administrator will review your request and contact you by email upon approval. You will be able to log in after your account is activated.";
                } else {
                    console.warn("Could not find message element within registration success modal.");
                }

                modal.style.display = 'flex'; // Show the modal (using flex for centering)

                // Add listener to OK button
                modalOkButton.onclick = function() { // Use onclick for simplicity here
                    modal.style.display = 'none'; // Hide modal
                    window.location.href = 'index.html'; // Redirect to main page after closing modal
                };
            } else {
                console.error('Registration success modal elements not found!');
                // Fallback alert if modal fails
                alert('Registration successful! Please log in.');
                window.location.href = 'index.html'; 
            }

            // alert('Registration successful! Please log in.');
            // window.location.href = 'index.html'; // Redirect to main page
        } else {
            let errorMessage = responseText;
            try {
                const errorJson = JSON.parse(responseText);
                errorMessage = errorJson.error || responseText;
            } catch (e) { /* Ignore parsing error, use text */ }
            // Show failure message in the register screen's status area
            showStatus(`Registration failed: ${errorMessage} (Status: ${response.status})`, true, 'register-screen'); 
            registerForm.reset(); 
        }
    } catch (error) {
        console.error('Registration error:', error);
        // Show failure message in the register screen's status area
        showStatus(`Registration failed: ${error.message}`, true, 'register-screen'); 
        registerForm.reset(); 
    }
}

// Handle User Login
async function handleLogin(event) {
    console.log('[handleLogin] Function called'); 
    event.preventDefault(); 

    // ** Find elements within the login screen div **
    const loginScreenDiv = document.getElementById('login-screen');
    console.log('[handleLogin] loginScreenDiv:', loginScreenDiv);
    if (!loginScreenDiv) {
        console.error('[handleLogin] Could not find login screen container!');
        // Show error - target main screen as login screen might be messed up
        showStatus('Login container error. Please refresh.', true, 'main-search-content');
        return;
    }
    
    // Use querySelector relative to the container
    const emailElement = loginScreenDiv.querySelector('#login-email'); 
    const passwordElement = loginScreenDiv.querySelector('#login-password');
    console.log('[handleLogin] emailElement (from querySelector):', emailElement);
    console.log('[handleLogin] passwordElement (from querySelector):', passwordElement);

    // Check if elements exist before accessing value
    if (!emailElement || !passwordElement) {
        console.error('[handleLogin] Login email or password element not found via querySelector!');
        showStatus('Login form error. Please refresh.', true, 'login-screen'); // Target login screen for this error
        return; 
    }
    
    // Show status *after* confirming elements exist
    showStatus('Logging in...', false, 'login-screen'); 

    const email = emailElement.value;
    const password = passwordElement.value;

    try {
        console.log('[handleLogin] Entered try block'); 
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });
        console.log(`[handleLogin] Fetch response status: ${response.status}`); 

        if (response.ok) { 
            console.log('[handleLogin] Response is OK');
            const data = await response.json();
            console.log('[handleLogin] Parsed data:', data);
            loggedInUser = data.company; 
            console.log('[handleLogin] loggedInUser variable set:', loggedInUser);
            
            // ** Simple localStorage Save **
            try {
                localStorage.setItem('loggedInUser', JSON.stringify(loggedInUser));
                console.log('[handleLogin] localStorage check immediately after set:', localStorage.getItem('loggedInUser'));
            } catch (e) {
                console.error("[Login Error] Error saving user to localStorage:", e);
                showStatus("Could not save session state.", true, 'login-screen'); 
                // Do not proceed if saving fails
                return; 
            }
            // ** End Simple Save **
            
            loginForm.reset();

            // --- Redirect or Update UI based on role --- 
            if (loggedInUser && loggedInUser.email !== 'admin@gmail.com') {
                // Non-admin user: Redirect immediately to home page
                console.log('[handleLogin] Non-admin user logged in, redirecting to home.html');
                window.location.href = 'home.html';
            } else {
                // Admin user: Update UI directly (will show admin panel)
                console.log('[handleLogin] Admin user logged in, calling updateUI()');
                updateUI(); 
            }
            // --- End Redirect Logic --- 

        } else {
            console.log(`[handleLogin] Response not OK (status ${response.status})`); 
            const errorText = await response.text();
            console.log(`[handleLogin] Error response text: ${errorText}`); 
            showStatus(`Login failed: ${errorText} (Status: ${response.status})`, true, 'login-screen'); 
            loggedInUser = null;
            loginForm.reset(); 
        }
    } catch (error) {
        console.error('[handleLogin] CATCH block error:', error); 
        showStatus(`Login failed: ${error.message}`, true, 'login-screen'); 
        loggedInUser = null;
        loginForm.reset(); 
    }
}

// Handle User Logout
function handleLogout() {
    console.log('[Auth] handleLogout called');

    // 1. Clear user state immediately
    localStorage.removeItem('loggedInUser');
    loggedInUser = null;
    console.log('[Auth] User state cleared');

    // 2. Hide potentially visible admin panels 
    if(loggedInView) loggedInView.style.display = 'none';
    if(adminCompanyListView) adminCompanyListView.style.display = 'none';

    // 3. Update UI to reflect logged-out state (shows main nav/search)
    updateUI(); 

    // 4. Ensure main screen is active and reset its content
    // showScreen('main'); // updateUI already calls this indirectly
    resetMainPage();

    // 5. Clear the hash in the URL
    window.location.hash = '';

    console.log('[Auth] Logout complete, UI updated directly.');
    // window.location.reload(); // <-- Remove the reload
}

// Original function to query item - Modified for Fetch & Clarity
function askblockchain() {
    clearStatus(); // Clear general status message area
    const search_text = searchTextInput.value.trim();
    if (!search_text) {
        searchResultContainer.innerHTML = `<span style="color: red;">Error:</span> Please enter a serial number to search.`;
            return;
        }

    const userEmail = loggedInUser ? loggedInUser.email : 'Anonymous';
    const companyOrg = search_text.substring(0, 4);
    console.log(`ask_blockchain pressed by: ${userEmail}`);
    console.log("Searching for item:", search_text, "company derived:", companyOrg);
    
    // Update result area to show searching status in green
    searchResultContainer.innerHTML = "Searching..."; 
    searchResultContainer.style.color = 'lightgreen'; // Set color to green

    // ** Prepare fetch options, including headers if logged in **
    const fetchOptions = {
        method: 'GET', // Method is GET for this endpoint
        headers: { 
            // Add standard headers if needed, e.g., Content-Type (though less common for GET)
        }
    };

    // ** Add X-User-Email header ONLY if user is logged in **
    if (loggedInUser && loggedInUser.email) {
        fetchOptions.headers['X-User-Email'] = loggedInUser.email;
        console.log('[askblockchain] Adding X-User-Email header for logged-in user.');
                } else {
        console.log('[askblockchain] Not adding X-User-Email header (user not logged in).');
    }

    // Construct the URL
    const url = `${API_BASE_URL}/queryStoreItem?item_serial_number=${encodeURIComponent(search_text)}&company_org=${encodeURIComponent(companyOrg)}`;

    // Make the fetch request with options
    fetch(url, fetchOptions) // Pass the options object here
        .then(response => {
            searchResultContainer.style.color = ''; // Reset color before showing final result or error
            if (!response.ok) {
                 // Attempt to read error text/json for better message
                return response.text().then(text => { 
                    let detail = text;
                    try {
                        const errJson = JSON.parse(text);
                        if (errJson && errJson.Error) { detail = errJson.Error; }
                        else if (errJson && errJson.error) { detail = errJson.error; }
                    } catch(e) { /* Ignore */ }
                    throw new Error(detail || `HTTP error! Status: ${response.status}`); 
                });
            }
            return response.json(); // Expecting { response: "{\"key\":\"value\"}" }
        })
        .then(data => {
            searchResultContainer.style.color = ''; // Reset color
            console.log("Raw response data:", data);
            if (typeof data.response !== 'string') {
                throw new Error("Invalid response format from server.");
            }
            const itemData = JSON.parse(data.response); 
            console.log("Parsed item data:", itemData);

            const company_org = itemData.company_org || 'N/A';
            const item_type = itemData.item_type || 'N/A';
            const item_name = itemData.item_name || 'N/A';
            
            // ** Change Start: Build Table HTML **
            const tableHTML = `
                <style>
                    .result-table {
                        width: 80%; /* Adjust width as needed */
                        margin: 1em auto; /* Center table */
                        border-collapse: collapse;
                        text-align: left;
                    }
                    .result-table th, .result-table td {
                        border: 1px solid #ddd; /* Light border */
                        padding: 8px;
                    }
                    .result-table th {
                        background-color: #4f6b85; /* Darker blue header */
                        color: white;
                    }
                    .result-table tr:nth-child(even) { background-color: #3c4f65; } /* Slightly lighter rows */
                    .result-table tr:hover { background-color: #55708a; } /* Hover effect */
                    .result-table td:first-child { font-weight: bold; } /* Bold labels */
                </style>
                <p style="color: lightgreen; text-align: center; margin-bottom: 0.5em;">Item is original. Congratulations!</p>
                <table class="result-table">
                    <tr><th>Attribute</th><th>Value</th></tr>
                    <tr><td>Company</td><td>${company_org}</td></tr>
                    <tr><td>Item Name</td><td>${item_name}</td></tr>
                    <tr><td>Type</td><td>${item_type}</td></tr>
                    <tr><td>Serial</td><td>${search_text}</td></tr>
                </table>
            `;
            searchResultContainer.innerHTML = tableHTML;
            // ** Change End **

        })
        .catch(error => {
            searchResultContainer.style.color = ''; // Ensure color is reset to default CSS
            console.error('Search failed:', error);
            let detail = error.message;
            if (detail.includes("item not exist") || detail.includes("Item not exist")) {
                detail = "Item not found or is fake.";
            } else if (detail.includes("Failed to get state")) {
                 detail = "Error retrieving item data.";
            }
            // Display error in result area (innerHTML will override inline style)
            // Make the "Search Failed:" part red
            searchResultContainer.innerHTML = `<p style="color: red; text-align: center;"><span style="font-weight:bold;">Search Failed:</span> ${detail}</p>`; 
            // Removed showStatus call
        });
}

// --- Helper Function for Error Messages ---
function extractUserFriendlyError(errorMessage) {
    if (!errorMessage) return "An unknown error occurred.";

    // Prioritize specific known errors
    if (errorMessage.includes("already exists:")) {
        // Return the fixed string, ignoring the specific serial number
        return "Item with this serial number already exists."; 
    }
    if (errorMessage.includes("not found:")) {
        // Keep the specific serial for 'not found' as it might be useful
        const parts = errorMessage.split("not found:");
        return parts.length > 1 ? `Item not found: ${parts[1].trim()}` : "Item not found.";
    }
    if (errorMessage.includes("Unauthorized")) {
        return "Unauthorized operation.";
    }
    if (errorMessage.includes("Failed to verify new serial number")) {
        // Extract the core reason if possible
         const parts = errorMessage.split("already exists:");
         if (parts.length > 1) return `Cannot change serial: New serial number '${parts[1].trim()}' already exists.`;
        return "Cannot change serial: Failed to verify new serial number."
    }

    // Remove common prefixes
    const prefixesToRemove = [
        "Change failed: Deleted old item, but failed to create new item",
        "Change failed: Could not delete original item",
        "Change failed:",
        "Update failed:",
        "Add failed:",
        "Cannot change serial: Error checking new serial number",
        "Cannot change serial:"
    ];
    for (const prefix of prefixesToRemove) {
        if (errorMessage.startsWith(prefix)) {
            errorMessage = errorMessage.substring(prefix.length).trim().replace(/^\(|^:/, '').replace(/\)$/, '').trim();
            break; // Remove only the first matching prefix
        }
    }

    // If it still contains peer details, try to extract the last message
    if (errorMessage.includes("No valid responses from any peers")) {
        const msgIndex = errorMessage.lastIndexOf("message=");
        if (msgIndex !== -1) {
            let coreMsg = errorMessage.substring(msgIndex + "message=".length).trim();
            const newlineIndex = coreMsg.indexOf('\n'); // Find potential line breaks
            if (newlineIndex !== -1) {
                 coreMsg = coreMsg.substring(0, newlineIndex).trim();
            }
             // Simple known error check again on extracted core message
            if (coreMsg.includes("already exists:")) {
                // Return the fixed string here too
                return "Item with this serial number already exists."; 
            }
            if (coreMsg.includes("not found:")) return `Item not found: ${coreMsg.split("not found:")[1].trim()}`;
            return `Operation failed: ${coreMsg}`; // Return extracted message
        }
        return "Operation failed due to a network or peer error."; // Fallback
    }

    // Return the processed or original message
    return errorMessage || "An error occurred during the operation.";
}

// --- Helper Function to Make Table Cell Content Copyable ---
function makeCellCopyable(cellElement, statusElementId) {
    if (!cellElement) return;

    cellElement.classList.add('copyable-cell'); // Add class for cursor styling
    cellElement.title = 'Click to copy'; // Add tooltip

    cellElement.addEventListener('click', async (event) => {
        const textToCopy = event.target.textContent;
        if (!textToCopy) return; // Nothing to copy

        if (navigator.clipboard && navigator.clipboard.writeText) {
            // --- Use Modern Clipboard API (Secure Contexts) ---
            try {
                await navigator.clipboard.writeText(textToCopy);
                showStatus(`Copied: "${textToCopy}"`, false, statusElementId);
            } catch (err) {
                console.error('Failed to copy using navigator.clipboard: ', err);
                showStatus('Failed to copy text to clipboard.', true, statusElementId);
            }
        } else if (document.queryCommandSupported && document.queryCommandSupported('copy')) {
            // --- Use Fallback (Deprecated) --- 
            const textarea = document.createElement('textarea');
            textarea.value = textToCopy;
            textarea.style.position = 'fixed'; // Prevent scrolling to bottom
            textarea.style.opacity = '0'; // Hide the element
            document.body.appendChild(textarea);
            textarea.select();
            try {
                const successful = document.execCommand('copy');
                if (successful) {
                    showStatus(`Copied: "${textToCopy}"`, false, statusElementId);
        } else {
                    throw new Error('execCommand returned false.');
                }
            } catch (err) {
                console.error('Fallback copy failed: ', err);
                showStatus('Failed to copy text using fallback method.', true, statusElementId);
            }
            document.body.removeChild(textarea);
        } else {
            // --- No Copy Method Available ---
            console.warn('Clipboard API and execCommand("copy") are not supported in this context.');
            showStatus('Cannot copy text in this browser/context.', true, statusElementId);
        }
    });
}

// --- Admin Panel Functions ---

// Fetch and display items for the logged-in company
// --- REVERTED TO ORIGINAL --- 
async function fetchAndDisplayCompanyItems() {
    const neededColspan = 7; // Ensure this matches displayItems

    // ** Use companyName for the request **
    if (!loggedInUser || !loggedInUser.companyName) { // Check for companyName again
        console.error("[Admin] Cannot fetch items: User not logged in or companyName missing.");
        if (companyItemTableBody) {
            companyItemTableBody.innerHTML = `<tr><td colspan="${neededColspan}" style="color: red;">Could not load items. User information missing.</td></tr>`;
        } else {
             console.error("[Admin] companyItemTableBody not found when trying to show missing user error.");
        }
        return;
    }

    const ownerName = loggedInUser.companyName; // Get the company Name
    console.log(`[Admin] Fetching items for owner: ${ownerName}`); // Log using name
    if (companyItemTableBody) {
        companyItemTableBody.innerHTML = `<tr><td colspan="${neededColspan}">Loading items...</td></tr>`; // Show loading state & Update colspan
    } else {
        console.error("[Admin] companyItemTableBody not found when trying to show loading state.");
        showStatus("Error: Could not find item table.", true, "admin-status-message");
        return; // Cannot proceed without the table body
    }

    try {
        // ** Change URL back to use ownerName **
        const response = await fetch(`${API_BASE_URL}/items/owner/${ownerName}`);
        
        // ++ Add logging before the check ++
        // ** Update log message **
        console.log(`[Admin] Fetch response status for owner ${ownerName}: ${response.status}, ok: ${response.ok}`);

        if (!response.ok) {
            // ++ Add logging inside the !ok block ++
            console.log(`[Admin] Response not OK. Checking if status is 404...`);
            if (response.status === 404) {
                // ++ Add logging inside the 404 block ++
                 // ** Update log message **
                console.log(`[Admin] Status IS 404. Handling as 'No Items Found' for owner ${ownerName}.`);
                // ++ Add user-visible status message ** Update message **
                showStatus(`No items found for your company (${ownerName}). Add items using the 'Add New Item' button.`, false, "admin-status-message"); 
                displayItems([]); // Display empty list message
                return; 
            }
            // ++ Add logging if it's NOT 404 ++
            console.error(`[Admin] Response not OK and status is NOT 404 (${response.status}). Throwing error.`);
            const errorText = await response.text();
            throw new Error(`Failed to fetch items: ${errorText} (Status: ${response.status})`);
        }

        // ++ Add logging if response IS ok ++
        console.log(`[Admin] Response OK. Parsing JSON...`);
        const items = await response.json();
        console.log("[Admin] Received items:", items);
        displayItems(items);

    } catch (error) {
        console.error("[Admin] Error fetching items:", error);
        if (companyItemTableBody) {
            companyItemTableBody.innerHTML = `<tr><td colspan="${neededColspan}" style="color: red;">Error loading items: ${error.message}</td></tr>`;
        }
        showStatus(`Error loading items: ${error.message}`, true, "admin-status-message"); 
    }
}

// Render items in the table
// --- REVERTED TO ORIGINAL --- 
function displayItems(items) {
    const neededColspan = 7; // Checkbox, Serial, Name, Type, Owner, QR, Actions
    const statusElementId = 'admin-status-message'; // Always use admin status for this function

    if (!companyItemTableBody) {
        console.error("[Admin] Cannot display items: Table body element not found.");
        return;
    }

    companyItemTableBody.innerHTML = ''; // Clear previous items/loading message
    
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    if (selectAllCheckbox) {
         selectAllCheckbox.checked = false; // Reset select all checkbox
    } else {
        console.warn("[Admin] Select All Checkbox element not found.")
    }

    if (!items || items.length === 0) {
        companyItemTableBody.innerHTML = `<tr><td colspan="${neededColspan}">No items found for your company.</td></tr>`; // Updated colspan
        if (selectAllCheckbox) selectAllCheckbox.disabled = true; // Disable if no items
        return;
    }

    if (selectAllCheckbox) selectAllCheckbox.disabled = false; // Enable if items exist

    const baseUrl = window.location.origin + window.location.pathname;

    items.forEach(item => {
        const row = companyItemTableBody.insertRow();
        row.classList.add('list-item');
        row.dataset.serial = item.item_serial_number; 

        // Create checkbox cell
        const selectCell = row.insertCell();
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'item-select-checkbox';
        checkbox.value = item.item_serial_number;
        checkbox.addEventListener('change', updateSelectAllCheckboxState); // Add listener
        selectCell.appendChild(checkbox);

        // Create other cells (Serial, Name, Type, Owner)
        let cell = row.insertCell();
        cell.textContent = item.item_serial_number;
        makeCellCopyable(cell, statusElementId); // Serial

        cell = row.insertCell();
        cell.textContent = item.item_name;
        makeCellCopyable(cell, statusElementId); // Name

        cell = row.insertCell();
        cell.textContent = item.item_type;
        makeCellCopyable(cell, statusElementId); // Type

        cell = row.insertCell();
        cell.textContent = item.company_org;
        makeCellCopyable(cell, statusElementId); // Owner

        // --- Create QR Code Cell --- (Keep the improved version)
        const qrCell = row.insertCell();
        qrCell.classList.add('qr-code-cell'); 
        const qrContainer = document.createElement('div');
        qrContainer.classList.add('qr-code-container');
        qrContainer.title = `QR Code for ${item.item_serial_number}`;
        qrCell.appendChild(qrContainer);
        const verificationUrl = `${baseUrl}?verifySerial=${encodeURIComponent(item.item_serial_number)}`;
        try {
            new QRCode(qrContainer, {
                text: verificationUrl,
                width: 64, height: 64,
                colorDark : "#000000", colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.L 
            });
            const urlSpan = document.createElement('span');
            urlSpan.classList.add('qr-code-url');
            urlSpan.textContent = verificationUrl;
            qrContainer.appendChild(urlSpan);
            qrContainer.style.cursor = 'pointer';
            qrContainer.addEventListener('click', () => {
                window.open(verificationUrl, '_blank'); 
            });
        } catch (error) {
            console.error(`Failed to generate QR code for ${item.item_serial_number}:`, error);
            qrContainer.textContent = 'Error'; 
        }
        // --- End QR Code Cell ---

        // --- Create QR Actions Cell (New) --- (Keep the improved version)
        const qrActionsCell = row.insertCell();
        qrActionsCell.classList.add('qr-code-actions');
        qrActionsCell.style.textAlign = 'center'; 
        qrActionsCell.style.verticalAlign = 'middle'; 
        const enlargeButton = document.createElement('button');
        enlargeButton.textContent = 'Enlarge';
        enlargeButton.className = 'search-button'; 
        enlargeButton.style.padding = '3px 8px'; 
        enlargeButton.title = `Enlarge QR code for ${item.item_serial_number}`;
        enlargeButton.addEventListener('click', () => {
            showEnlargedQr(verificationUrl);
        });
        qrActionsCell.appendChild(enlargeButton);
        // --- End QR Actions Cell ---

    });
    console.log(`[Admin] Displayed ${items.length} items.`);
    updateSelectAllCheckboxState(); // Initial check
}

// --- Handler for 'Select All' checkbox --- (Keep original)
function handleSelectAllChange(event) {
    const isChecked = event.target.checked;
    console.log(`[Admin] Select All changed to: ${isChecked}`);
    const itemCheckboxes = companyItemTableBody.querySelectorAll('.item-select-checkbox');
    itemCheckboxes.forEach(checkbox => {
        checkbox.checked = isChecked;
    });
}

// --- Helper to update 'Select All' based on individual checkboxes ---
function updateSelectAllCheckboxState() {
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    if (!selectAllCheckbox) return; // Should not happen if element exists

    const itemCheckboxes = companyItemTableBody.querySelectorAll('.item-select-checkbox');
    const totalItems = itemCheckboxes.length;
    const checkedItems = companyItemTableBody.querySelectorAll('.item-select-checkbox:checked').length;

    if (totalItems === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
        selectAllCheckbox.disabled = true;
    } else {
        selectAllCheckbox.disabled = false;
        if (checkedItems === totalItems) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else if (checkedItems > 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true; // Show partial selection state
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        }
    }
}

// Show the Add New Item form
function showAddItemForm() {
    if (addItemFormContainer && addItemForm) {
        // Don't reset the form here if modifying, 
        // as handleModifyItemClick will pre-fill it.
        // Only reset if modifyingItemId is null.
        if (!modifyingItemId) { 
            addItemForm.reset(); 
            document.getElementById('item-serial-number').disabled = false; // Ensure enabled for add
            document.getElementById('item-form-title').textContent = 'Add New Item';
            document.getElementById('save-item-button').textContent = 'Save Item';
        }
        addItemFormContainer.style.display = 'block';
        console.log("[Admin] Item form shown.");
    } else {
        console.error("[Admin] Cannot show Add Item form: Elements not found.");
    }
}

// Hide the Add New Item form and reset state
function hideAddItemForm() {
    if (addItemFormContainer && addItemForm) {
        addItemForm.reset();
        addItemFormContainer.style.display = 'none';
        // Reset modify state
        modifyingItemId = null;
        document.getElementById('item-serial-number').disabled = false; // Re-enable field
        document.getElementById('item-form-title').textContent = 'Add New Item'; // Reset title
        document.getElementById('save-item-button').textContent = 'Save Item'; // Reset button
        console.log("[Admin] Item form hidden and reset.");
    } 
}

// Handle submission of the Add New Item form (handles both Add and Modify)
async function handleAddItemSubmit(event) {
    event.preventDefault();
    console.log("[Admin] Add/Modify Item form submitted");

    const companyOrg = loggedInUser?.companyName; 
    const itemType = document.getElementById('item-type').value.trim();
    const itemName = document.getElementById('item-name').value.trim();
    const newSerial = document.getElementById('item-serial-number').value.trim(); // Potentially new serial

    if (!companyOrg) {
        showStatus("Error: Cannot determine company. Please log in again.", true, "admin-status-message");
        return;
    }

    if (!itemType || !itemName || !newSerial) {
        showStatus("Please fill in all item fields.", true, "admin-status-message");
        return;
    }

    // --- Add Serial Number Format Validation ---
    const serialRegex = /^\d{4}-\d{4}-\d{4}-\d{4}$/;
    if (!serialRegex.test(newSerial)) {
        showStatus("Invalid serial number format. Use XXXX-XXXX-XXXX-XXXX (digits only).", true, "admin-status-message");
        return;
    }
    // --- End Validation ---

    const isModifying = !!modifyingItemId; // Check if we are modifying
    const originalSerial = modifyingItemId; // Store the original serial if modifying

    // --- Determine Action based on modification and serial change ---
    let actionType = isModifying ? (newSerial !== originalSerial ? 'changeSerial' : 'updateDetails') : 'add';
    let statusElement = document.getElementById("admin-status-message");

    // Clear previous timeouts and set initial status manually (no timeout)
    if (statusElement) {
        if (statusElement.dataset.statusTimeoutId) {
            clearTimeout(parseInt(statusElement.dataset.statusTimeoutId));
            delete statusElement.dataset.statusTimeoutId;
        }
        let initialMessage = 'Adding item...';
        if (actionType === 'updateDetails') initialMessage = 'Updating item details...';
        if (actionType === 'changeSerial') initialMessage = 'Changing serial number...';
        statusElement.textContent = initialMessage;
        statusElement.style.color = 'lightblue';
        statusElement.style.textAlign = 'center';
    }
    
    try {
        let responseData = null;

        if (actionType === 'add') {
            // --- ADD NEW ITEM --- 
            console.log("[Admin] Action: Add New Item");
            
            // ** Construct headers with authentication **
            const headers = {
                'Content-Type': 'application/json'
            };
            if (loggedInUser && loggedInUser.email) {
                headers['X-User-Email'] = loggedInUser.email;
                console.log(`[handleAddItemSubmit] Adding X-User-Email header: ${loggedInUser.email}`);
            } else {
                console.error('[handleAddItemSubmit] Cannot add auth header: loggedInUser or email is missing.');
                showStatus('Authentication error: User details missing. Cannot add item.', true, "admin-status-message");
                return; // Stop execution
            }

            const response = await fetch(`${API_BASE_URL}/items`, {
                method: 'POST',
                headers: headers, // Use constructed headers
                body: JSON.stringify({ companyOrg, itemType, itemName, itemSerialNumber: newSerial })
            });
            
            // Try to parse response even if not ok, for potential error messages
            let responseData = {};
            try {
                responseData = await response.json(); 
            } catch (e) {
                 console.warn('[handleAddItemSubmit] Failed to parse response as JSON, trying text...');
                 try { responseData.error = await response.text(); } catch (textErr) { responseData.error = 'Failed to read response'; }
            }

            if (!response.ok) {
                // Use parsed error message if available, otherwise use statusText
                throw new Error(`Add failed: ${responseData.error || response.statusText}`);
            }
            showStatus("Item added successfully!", false, "admin-status-message");

        } else if (actionType === 'updateDetails') {
            // --- UPDATE EXISTING ITEM DETAILS (Serial Unchanged) ---
            console.log("[Admin] Action: Update Item Details");

            // ** Construct headers with authentication **
            const headers = {
                'Content-Type': 'application/json'
            };
            if (loggedInUser && loggedInUser.email) {
                headers['X-User-Email'] = loggedInUser.email;
                console.log(`[handleAddItemSubmit - Update] Adding X-User-Email header: ${loggedInUser.email}`);
            } else {
                console.error('[handleAddItemSubmit - Update] Cannot add auth header: loggedInUser or email is missing.');
                showStatus('Authentication error: User details missing. Cannot update item.', true, "admin-status-message");
                return; // Stop execution
            }

            const response = await fetch(`${API_BASE_URL}/items/${originalSerial}`, {
                method: 'PUT',
                headers: headers, // Use constructed headers
                body: JSON.stringify({ itemName, itemType }) // Only send name and type
            });

            // Try to parse response even if not ok
            let responseData = {};
            try { responseData = await response.json(); } catch (e) {
                 try { responseData.error = await response.text(); } catch (textErr) { responseData.error = 'Failed to read response'; }
            }

            if (!response.ok) {
                throw new Error(`Update failed: ${responseData.error || response.statusText}`);
            }
            showStatus("Item details updated successfully!", false, "admin-status-message");

        } else { // actionType === 'changeSerial'
            // --- CHANGE SERIAL NUMBER (DELETE OLD, ADD NEW) ---
            console.log(`[Admin] Action: Change Serial Number from ${originalSerial} to ${newSerial}`);
            
            // ** Construct headers with authentication (needed for both DELETE and POST) **
            const authHeaders = {}; // Use a different name to avoid scope issues if needed
            if (loggedInUser && loggedInUser.email) {
                authHeaders['X-User-Email'] = loggedInUser.email;
                console.log(`[handleAddItemSubmit - Change] Adding X-User-Email header: ${loggedInUser.email}`);
            } else {
                console.error('[handleAddItemSubmit - Change] Cannot add auth header: loggedInUser or email is missing.');
                showStatus('Authentication error: User details missing. Cannot change item serial.', true, "admin-status-message");
                return; // Stop execution
            }

            // *** Pre-check: Ensure new serial doesn't already exist (No auth needed usually for GET) ***
            console.log(`[Admin] Checking availability of new serial: ${newSerial}`);
            try {
                const checkResponse = await fetch(`${API_BASE_URL}/items/${newSerial}`);
                if (checkResponse.ok) { // Status 200-299
                    // If OK, it means the item EXISTS, which is an error for us here
                    const existingItem = await checkResponse.json(); 
                    console.error(`[Admin] New serial number ${newSerial} already exists:`, existingItem);
                    throw new Error(`Cannot change serial: New serial number '${newSerial}' already exists.`);
                } else if (checkResponse.status !== 404) {
                    // Any other error besides 404 is problematic
                    const errorText = await checkResponse.text();
                    throw new Error(`Cannot change serial: Error checking new serial number (${checkResponse.status}): ${errorText}`);
                }
                // If status is 404, the serial is available - proceed! 
                console.log(`[Admin] New serial ${newSerial} is available.`);
            } catch (checkError) {
                // Catch errors from the fetch itself or the throws above
                 throw new Error(`Cannot change serial: Failed to verify new serial number. ${checkError.message}`);
            }
            // *** End Pre-check ***

            // 1. Delete the old item (Use authHeaders)
            console.log(`[Admin] Deleting old item: ${originalSerial}`);
            const deleteResponse = await fetch(`${API_BASE_URL}/items/${originalSerial}`, { 
                method: 'DELETE',
                headers: authHeaders 
            });
            if (!deleteResponse.ok) {
                 // Try parsing error
                 let errorDetail = `(Status: ${deleteResponse.status})`;
                 try { errorDetail = (await deleteResponse.json()).error || errorDetail; } catch(e){ 
                     try { errorDetail = await deleteResponse.text(); } catch(tErr) {} 
                 } 
                throw new Error(`Change failed: Could not delete original item (${originalSerial}): ${errorDetail}`);
            }
            console.log(`[Admin] Old item ${originalSerial} deleted.`);
            
            // 2. Create the new item with the new serial (Use authHeaders + Content-Type)
             console.log(`[Admin] Creating new item: ${newSerial}`);
             const createHeaders = { 
                 ...authHeaders, // Include auth header
                 'Content-Type': 'application/json' // Add Content-Type for POST
             };
             const createResponse = await fetch(`${API_BASE_URL}/items`, {
                method: 'POST',
                headers: createHeaders,
                body: JSON.stringify({ companyOrg, itemType, itemName, itemSerialNumber: newSerial })
            });

            // Try parsing create response
            let responseData = {};
            try { responseData = await createResponse.json(); } catch (e) {
                 try { responseData.error = await createResponse.text(); } catch (textErr) { responseData.error = 'Failed to read response'; }
            }

            if (!createResponse.ok) {
                 throw new Error(`Change failed: Deleted old item, but failed to create new item (${newSerial}): ${responseData.error || createResponse.statusText}`);
            }
            console.log(`[Admin] New item ${newSerial} created.`);
            showStatus("Item serial number changed successfully!", false, "admin-status-message");
        }
        
        // Common success path
        console.log(`[Admin] Operation successful. Final item state:`, responseData);
        hideAddItemForm(); 
        fetchAndDisplayCompanyItems(); 

    } catch (error) {
        console.error(`[Admin] Error during ${actionType} operation:`, error);
        const userFriendlyMessage = extractUserFriendlyError(error.message);
        showStatus(userFriendlyMessage, true, "admin-status-message");
        // Don't hide form on error, let user correct it.
    } finally {
        // Reset modify state *only if* we were modifying 
        // (handleAddItemSubmit can be called for adding too)
        if (isModifying) {
            modifyingItemId = null; 
            // Reset form appearance (title, button) happens in hideAddItemForm
             // Ensure serial field is enabled AFTER operation completes or fails
            document.getElementById('item-serial-number').disabled = false; 
        }
    }
}

// Handle Modify Selected Item button click
function handleModifyItemClick() {
    const selectedCheckboxes = document.querySelectorAll('#company-item-table .item-select-checkbox:checked');
    
    if (selectedCheckboxes.length !== 1) {
        showStatus("Please select exactly one item to modify.", true, "admin-status-message");
        return;
    }

    const checkbox = selectedCheckboxes[0];
    const serialToModify = checkbox.value;
    console.log(`[Admin] Modify requested for item: ${serialToModify}`);

    // Find the table row (TR) containing the checkbox
    const row = checkbox.closest('tr');
    if (!row) {
        console.error('Could not find table row for selected item.');
        showStatus("Error finding item data in table.", true, "admin-status-message");
        return;
    }

    // Extract data from the table cells (td) within the row
    // Assumes order: [checkbox, serial, name, type, owner]
    const cells = row.querySelectorAll('td');
    if (cells.length < 4) { // Need at least serial, name, type
        console.error('Table row does not have enough cells.');
        showStatus("Error reading item data from table.", true, "admin-status-message");
        return;
    }

    const currentName = cells[2].textContent;
    const currentType = cells[3].textContent;

    // Pre-fill the form
    document.getElementById('item-serial-number').value = serialToModify;
    document.getElementById('item-name').value = currentName;
    document.getElementById('item-type').value = currentType;

    // Set modification state
    modifyingItemId = serialToModify;
    document.getElementById('item-form-title').textContent = 'Modify Item Details';
    document.getElementById('save-item-button').textContent = 'Update Item';

    // Show the form
    showAddItemForm(); 
}

// Handle Delete Selected Item button click
async function handleDeleteItemsClick() {
    const selectedCheckboxes = document.querySelectorAll('#company-item-table .item-select-checkbox:checked');
    
    if (selectedCheckboxes.length === 0) {
        showStatus("Please select at least one item to delete.", true, "admin-status-message");
        return;
    }

    const serialsToDelete = Array.from(selectedCheckboxes).map(cb => cb.value);
    console.log(`[Admin] Delete requested for items: ${serialsToDelete.join(', ')}`);

    // --- Custom Confirmation Logic --- 
    const modal = document.getElementById('confirmation-modal');
    const modalMessage = document.getElementById('confirmation-modal-message');
    const yesButton = document.getElementById('confirm-yes-button');
    const noButton = document.getElementById('confirm-no-button');

    if (!modal || !modalMessage || !yesButton || !noButton) {
        console.error('Confirmation modal elements not found! Falling back to window.confirm.');
        // Fallback to original confirm if modal elements aren't found
        if (!window.confirm(`Are you sure you want to delete ${serialsToDelete.length} selected item(s)?`)) {
            return;
        }
        // If fallback confirm is yes, proceed directly
        proceedWithDeletion(serialsToDelete);
        return;
    }

    // Set the message and show the modal
    modalMessage.textContent = `Are you sure you want to delete ${serialsToDelete.length} selected item(s)?`;
    modal.style.display = 'flex'; // Use flex to enable centering styles

    // Define what happens when Yes/No is clicked
    const handleYesClick = () => {
        console.log('[Modal] Yes clicked');
        modal.style.display = 'none'; // Hide modal
        removeModalListeners(); // Clean up listeners
        
        // Manually set status message without timeout
        const statusElement = document.getElementById("admin-status-message");
        if (statusElement) {
            // Clear any pending timeout for this element first
            if (statusElement.dataset.statusTimeoutId) {
                clearTimeout(parseInt(statusElement.dataset.statusTimeoutId));
                delete statusElement.dataset.statusTimeoutId;
            }
            // Now set the persistent message
            statusElement.textContent = `Deleting ${serialsToDelete.length} item(s)...`;
            statusElement.style.color = 'lightblue'; 
            statusElement.style.textAlign = 'center';
        }
        
        proceedWithDeletion(serialsToDelete); // Call the actual deletion logic
    };

    const handleNoClick = () => {
        console.log('[Modal] No clicked');
        modal.style.display = 'none'; // Hide modal
        removeModalListeners(); // Clean up listeners
        
        // Uncheck all selected items
        selectedCheckboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        
        // Updated status message
        showStatus('Deletion cancelled. Selected items unchecked.', false, 'admin-status-message'); 
    };
    
    // Function to remove listeners to prevent memory leaks
    const removeModalListeners = () => {
        yesButton.removeEventListener('click', handleYesClick);
        noButton.removeEventListener('click', handleNoClick);
    };

    // Add listeners (use { once: true } might also work but this is safer)
    yesButton.addEventListener('click', handleYesClick);
    noButton.addEventListener('click', handleNoClick);
    // --- End Custom Confirmation Logic ---
}

// Extracted deletion logic into a separate async function
async function proceedWithDeletion(serialsToDelete) {
     // Use the new admin status area
    showStatus(`Deleting ${serialsToDelete.length} item(s)...`, false, "admin-status-message"); // Color changed earlier
    let successCount = 0;
    let failCount = 0;
    let lastError = null;

    // Delete items one by one for simplicity (can be slow)
    for (const serial of serialsToDelete) {
        try {
            // ** Construct headers with authentication **
            const headers = {}; // No Content-Type needed for DELETE
            if (loggedInUser && loggedInUser.email) {
                headers['X-User-Email'] = loggedInUser.email;
                console.log(`[proceedWithDeletion] Adding X-User-Email header for user: ${loggedInUser.email}`);
            } else {
                console.error('[proceedWithDeletion] Cannot add auth header: loggedInUser or email is missing.');
                // Throw an error specific to this item to be caught below
                throw new Error(`Authentication error for ${serial}: User details missing.`); 
            }

            const response = await fetch(`${API_BASE_URL}/items/${serial}`, {
                method: 'DELETE',
                 headers: headers // Use constructed headers
            });

            if (!response.ok) {
                // Try to get more specific error from backend response
                let errorDetail = `(Status: ${response.status})`;
                try {
                    // Don't assume JSON for errors like 401
                    errorDetail = await response.text(); 
                } catch(e) {
                     // Ignore if reading text fails
                 }
                 throw new Error(`Failed to delete ${serial}: ${errorDetail}`);
            }
            console.log(`[Admin] Successfully deleted item: ${serial}`);
            successCount++;
        } catch (error) {
            console.error("[Admin] Error deleting item:", error);
            failCount++;
            lastError = error.message;
        }
    }

    // Show summary status
    let summaryMessage = '';
    if (successCount > 0) {
        summaryMessage += `Successfully deleted ${successCount} item(s). `;
    }
    if (failCount > 0) {
        summaryMessage += `Failed to delete ${failCount} item(s). Last error: ${lastError}`;
    }
    // Use the new admin status area
    showStatus(summaryMessage, failCount > 0, "admin-status-message"); // Show as error if any failed

    fetchAndDisplayCompanyItems(); // Refresh the list
}

// --- Function to update company active status ---
async function updateCompanyStatus(email, isActive) {
    console.log(`[Admin] Updating status for ${email} to ${isActive}`);
    const statusElementId = 'admin-companies-status-message';
    showStatus('Updating status...', false, statusElementId);

    try {
        // ** Add X-User-Email header if user is logged in **
        const headers = {
            'Content-Type': 'application/json'
        };
        if (loggedInUser && loggedInUser.email) {
            headers['X-User-Email'] = loggedInUser.email;
            console.log(`[updateCompanyStatus] Adding X-User-Email header for user: ${loggedInUser.email}`);
        } else {
            console.error('[updateCompanyStatus] Cannot add auth header: loggedInUser or email is missing.');
            showStatus('Authentication error: User details missing. Cannot update status.', true, statusElementId);
            return false; // Indicate failure if user info is missing
        }

        const response = await fetch(`${API_BASE_URL}/admin/companies/${email}/status`, {
            method: 'PUT',
            headers: headers, // Use the constructed headers object
            body: JSON.stringify({ isActive: isActive })
        });

        if (!response.ok) {
            // Try to parse error JSON, otherwise use text
            let errorDetail = `Failed to update status (Status: ${response.status})`;
            try {
                 const errorData = await response.json();
                 errorDetail = errorData.error || errorDetail;
            } catch (parseError) {
                 // If JSON parsing fails, try to get text
                 try {
                     errorDetail = await response.text(); 
                 } catch(textError){ /* Ignore fallback error */ }
            }
            throw new Error(errorDetail);
        }

        const updatedCompany = await response.json();
        showStatus(`Status updated successfully for ${email}.`, false, statusElementId);
        console.log('[Admin] Status update successful:', updatedCompany);
        // Optionally update the specific row in the table directly instead of full refresh
        // For simplicity, we'll rely on the caller to refresh if needed or handle UI update.
        return true; // Indicate success

    } catch (error) {
        console.error('[Admin] Error updating company status:', error);
        showStatus(`Error updating status: ${error.message}`, true, statusElementId);
        return false; // Indicate failure
    }
}

// --- Function to delete a company ---
async function deleteCompany(email, companyName) {
    console.log(`[Admin] Initiating delete for company: ${email} (${companyName})`);
    const statusElementId = 'admin-companies-status-message';

    // Use the existing confirmation modal logic structure
    const modal = document.getElementById('confirmation-modal');
    const modalMessage = document.getElementById('confirmation-modal-message');
    const yesButton = document.getElementById('confirm-yes-button');
    const noButton = document.getElementById('confirm-no-button');

    if (!modal || !modalMessage || !yesButton || !noButton) {
        console.error('Confirmation modal elements not found! Falling back to window.confirm.');
        if (!window.confirm(`ARE YOU SURE you want to delete company ${companyName} (${email}) and all its items? This cannot be undone.`)) {
            return;
        }
        // If fallback confirm is yes, proceed directly
        await proceedWithCompanyDeletion(email, statusElementId);
        return;
    }

    modalMessage.textContent = `ARE YOU SURE you want to delete company ${companyName} (${email}) and all its associated items? This action cannot be undone.`;
    modal.style.display = 'flex';

    const handleYesClick = async () => {
        modal.style.display = 'none';
        removeModalListeners();
        showStatus(`Deleting company ${companyName}...`, false, statusElementId);
        await proceedWithCompanyDeletion(email, statusElementId);
    };

    const handleNoClick = () => {
        modal.style.display = 'none';
        removeModalListeners();
        showStatus('Company deletion cancelled.', false, statusElementId);
    };

    const removeModalListeners = () => {
        yesButton.removeEventListener('click', handleYesClick);
        noButton.removeEventListener('click', handleNoClick);
    };

    yesButton.addEventListener('click', handleYesClick, { once: true }); // Use once for simplicity
    noButton.addEventListener('click', handleNoClick, { once: true });
}

// Actual deletion execution function
async function proceedWithCompanyDeletion(email, statusElementId) {
    try {
        // ** Add X-User-Email header if user is logged in **
        const headers = {
            // No 'Content-Type' needed for DELETE usually, but doesn't hurt
        };
        if (loggedInUser && loggedInUser.email) {
            headers['X-User-Email'] = loggedInUser.email;
            console.log(`[proceedWithCompanyDeletion] Adding X-User-Email header for user: ${loggedInUser.email}`);
        } else {
            console.error('[proceedWithCompanyDeletion] Cannot add auth header: loggedInUser or email is missing.');
            showStatus('Authentication error: User details missing. Cannot delete company.', true, statusElementId);
            return; // Stop execution if user info is missing
        }

        const response = await fetch(`${API_BASE_URL}/admin/companies/${email}`, {
            method: 'DELETE',
            headers: headers // Use the constructed headers
        });

        // Handle expected 204 No Content for successful DELETE
        if (response.status === 204) {
            showStatus(`Company ${email} deleted successfully.`, false, statusElementId);
            console.log(`[Admin] Company ${email} deleted successfully.`);
        } else if (response.status === 207) {
            const result = await response.json();
            showStatus(`Company ${email} deleted, but errors occurred deleting items: ${result.errors.join('; ')}`, true, statusElementId);
            console.warn(`[Admin] Company ${email} deleted with item errors:`, result.errors);
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || `Failed to delete company (Status: ${response.status})`);
        }

        // Refresh the company list after deletion
        fetchAndDisplayAllCompanies();

    } catch (error) {
        console.error('[Admin] Error deleting company:', error);
        showStatus(`Error deleting company: ${error.message}`, true, statusElementId);
    }
}

// --- Function to Fetch and Display All Companies (for Admin User) ---
async function fetchAndDisplayAllCompanies() {
    console.log(`[fetchAndDisplayAllCompanies] Fetching company list for admin...`);
    const statusElementId = 'admin-companies-status-message'; // ID for status in the new admin view
    const tableBody = document.getElementById('all-companies-table-body');
    if (!tableBody) {
        console.error('[fetchAndDisplayAllCompanies] Cannot find table body #all-companies-table-body');
        showStatus('Error displaying company list table.', true, statusElementId);
        return;
    }

    showStatus('Loading company list...', false, statusElementId);
    tableBody.innerHTML = ''; // Clear existing rows

    // ** Reset and manage select-all checkbox **
    if (selectAllCompaniesCheckbox) {
        selectAllCompaniesCheckbox.checked = false;
        selectAllCompaniesCheckbox.disabled = true; // Disable until items load
    }

    try {
        // ** Add X-User-Email header if user is logged in **
        const headers = {
            'Content-Type': 'application/json'
        };
        if (loggedInUser && loggedInUser.email) {
            headers['X-User-Email'] = loggedInUser.email;
            console.log('[fetchAndDisplayAllCompanies] Adding X-User-Email header:', loggedInUser.email);
        } else {
            console.warn('[fetchAndDisplayAllCompanies] Cannot add auth header: loggedInUser or email is missing.');
            // Handle error appropriately - perhaps redirect to login or show error
            showStatus('Authentication error: User details missing.', true, statusElementId);
            return; // Stop execution if user email is missing
        }

        const response = await fetch(`${API_BASE_URL}/admin/companies`, {
            method: 'GET',
            headers: headers // Use the headers object defined above
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch companies: ${errorText} (Status: ${response.status})`);
        }

        const companies = await response.json();

        if (companies && companies.length > 0) {
            if (selectAllCompaniesCheckbox) selectAllCompaniesCheckbox.disabled = false; // Enable if companies exist

            companies.forEach(company => {
                const row = tableBody.insertRow();
 
                // Create checkbox cell
                const selectCell = row.insertCell();
                selectCell.style.textAlign = 'center';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'company-select-checkbox'; // Class for bulk actions
                checkbox.value = company.email;
                checkbox.title = `Select company ${company.companyName}`;

                // Disable checkbox for the admin itself
                if (company.email === 'admin@gmail.com') {
                    checkbox.disabled = true;
                    checkbox.title = 'Admin account cannot be selected for bulk actions';
                }

                // Add listener to update the 'Select All' checkbox state
                checkbox.addEventListener('change', updateCompanySelectAllCheckboxState);
                selectCell.appendChild(checkbox);

                let cell = row.insertCell();
                cell.textContent = company.email || 'N/A';
                makeCellCopyable(cell, 'admin-companies-status-message'); // Email

                cell = row.insertCell();
                cell.textContent = company.companyName || 'N/A';
                makeCellCopyable(cell, 'admin-companies-status-message'); // Company Name

                cell = row.insertCell();
                cell.textContent = company.role || 'user';
                makeCellCopyable(cell, 'admin-companies-status-message'); // Role

                // Format date nicely if possible
                let formattedDate = 'N/A';
                if (company.registeredAt) {
                    try {
                        formattedDate = new Date(company.registeredAt).toLocaleString();
                    } catch (e) { /* ignore date parsing error */ }
                }
                cell = row.insertCell();
                cell.textContent = formattedDate;
                makeCellCopyable(cell, 'admin-companies-status-message'); // Registered At

                // Add "Active" checkbox cell
                const activeCell = row.insertCell();
                activeCell.style.textAlign = 'center'; // Keep checkbox centered

                const activeCheckbox = document.createElement('input');
                activeCheckbox.type = 'checkbox';
                activeCheckbox.checked = company.isActive;
                activeCheckbox.title = company.isActive ? 'Click to deactivate' : 'Click to activate';
                activeCheckbox.style.verticalAlign = 'middle'; // Align checkbox with text

                const statusSpan = document.createElement('span');
                statusSpan.textContent = company.isActive ? ' Active' : ' Inactive';
                statusSpan.style.marginLeft = '5px'; // Space between checkbox and text
                statusSpan.style.verticalAlign = 'middle'; // Align text with checkbox

                // Make the status text itself copyable
                makeCellCopyable(statusSpan, 'admin-companies-status-message');

                // Disable checkbox for the admin itself
                if (company.email === 'admin@gmail.com') {
                    activeCheckbox.disabled = true;
                    activeCheckbox.title = 'Admin status cannot be changed here';
                    statusSpan.style.opacity = '0.6'; // Dim the text too
                }

                activeCheckbox.addEventListener('change', async (event) => {
                    const newState = event.target.checked;
                    const originalState = !newState;
                    event.target.disabled = true; // Disable during update
                    statusSpan.textContent = ' Updating...'; // Provide feedback

                    const success = await updateCompanyStatus(company.email, newState);

                    if (success) {
                        // Update text on success
                        statusSpan.textContent = newState ? ' Active' : ' Inactive';
                    } else {
                        event.target.checked = !newState; // Revert checkbox on failure
                        // Revert text on failure
                        statusSpan.textContent = originalState ? ' Active' : ' Inactive';
                    }
                    event.target.disabled = (company.email === 'admin@gmail.com'); // Re-enable unless it's the admin
                });

                activeCell.appendChild(activeCheckbox);
                activeCell.appendChild(statusSpan); // Add the text span

                // Add "Actions" cell with Delete button
                const actionsCell = row.insertCell();
                actionsCell.style.textAlign = 'center';
                const deleteButton = document.createElement('button');
                deleteButton.textContent = 'Delete';
                deleteButton.className = 'search-button cancel-button'; // Use existing styles
                deleteButton.style.padding = '3px 8px'; // Make button smaller
                deleteButton.title = `Delete company ${company.companyName}`;
                // Disable delete for the admin itself
                if (company.email === 'admin@gmail.com') {
                    deleteButton.disabled = true;
                    deleteButton.title = 'Cannot delete admin account';
                }
                deleteButton.addEventListener('click', () => {
                    deleteCompany(company.email, company.companyName);
                });
                actionsCell.appendChild(deleteButton);

            });
            showStatus('Company list loaded.', false, statusElementId);
        } else {
            showStatus('No companies found.', false, statusElementId);
            const row = tableBody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 8; // ** ADJUST COLSPAN (added select checkbox + Actions columns) **
            cell.textContent = 'No registered companies found.';
            cell.style.textAlign = 'center';
        }

    } catch (error) {
        console.error('[fetchAndDisplayAllCompanies] Error:', error);
        showStatus(`Error loading companies: ${error.message}`, true, statusElementId);
        // Optionally add an error row to the table
        tableBody.innerHTML = ''; // Clear potentially partial data
        const row = tableBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 8;
        cell.textContent = 'Failed to load company list.';
        cell.style.textAlign = 'center';
        cell.style.color = 'red';
    }
}

// --- NEW: Handler for Company 'Select All' checkbox ---
function handleCompanySelectAllChange(event) {
    const isChecked = event.target.checked;
    console.log(`[Admin Companies] Select All changed to: ${isChecked}`);
    const companyCheckboxes = document.querySelectorAll('#all-companies-table-body .company-select-checkbox:not(:disabled)'); // Exclude disabled admin checkbox
    companyCheckboxes.forEach(checkbox => {
        checkbox.checked = isChecked;
    });
}

// --- NEW: Helper to update Company 'Select All' based on individual checkboxes ---
function updateCompanySelectAllCheckboxState() {
    if (!selectAllCompaniesCheckbox) return;

    const companyCheckboxes = document.querySelectorAll('#all-companies-table-body .company-select-checkbox:not(:disabled)');
    const totalSelectableItems = companyCheckboxes.length;
    const checkedItems = document.querySelectorAll('#all-companies-table-body .company-select-checkbox:checked:not(:disabled)').length;

    if (totalSelectableItems === 0) {
        selectAllCompaniesCheckbox.checked = false;
        selectAllCompaniesCheckbox.indeterminate = false;
        selectAllCompaniesCheckbox.disabled = true;
    } else {
        selectAllCompaniesCheckbox.disabled = false;
        if (checkedItems === totalSelectableItems) {
            selectAllCompaniesCheckbox.checked = true;
            selectAllCompaniesCheckbox.indeterminate = false;
        } else if (checkedItems > 0) {
            selectAllCompaniesCheckbox.checked = false;
            selectAllCompaniesCheckbox.indeterminate = true;
        } else {
            selectAllCompaniesCheckbox.checked = false;
            selectAllCompaniesCheckbox.indeterminate = false;
        }
    }
}

// --- NEW: Function to handle bulk status update for companies ---
async function handleBulkCompanyStatusUpdate(isActive) {
    const selectedCheckboxes = document.querySelectorAll('#all-companies-table-body .company-select-checkbox:checked');
    const statusElementId = 'admin-companies-status-message';
    const actionText = isActive ? 'Activating' : 'Deactivating';

    if (selectedCheckboxes.length === 0) {
        showStatus(`Please select at least one company to ${actionText.toLowerCase()}.`, true, statusElementId);
        return;
    }

    const emailsToUpdate = Array.from(selectedCheckboxes).map(cb => cb.value);
    // Filter out the admin user itself - should not be deactivated/reactivated via bulk
    const filteredEmails = emailsToUpdate.filter(email => email !== 'admin@gmail.com');
    const adminSkipped = emailsToUpdate.length !== filteredEmails.length;

    if (filteredEmails.length === 0) {
        showStatus("No companies selected for update (admin account cannot be changed here).", false, statusElementId);
        return;
    }

    console.log(`[Admin] ${actionText} ${filteredEmails.length} companies: ${filteredEmails.join(', ')}`);
    showStatus(`${actionText} ${filteredEmails.length} selected companies...`, false, statusElementId);

    let successCount = 0;
    let failCount = 0;
    let lastError = null;

    // Disable buttons/checkboxes during operation (optional but good UX)
    // ... (add logic to disable controls if desired)

    for (const email of filteredEmails) {
        try {
            const success = await updateCompanyStatus(email, isActive);
            if (success) {
                successCount++;
            } else {
                // updateCompanyStatus already shows an error, just count it
                failCount++;
                lastError = `Failed on ${email}`; // Keep track of the last failure
            }
        } catch (error) {
            // Catch any unexpected errors from the async call itself
            console.error(`[Admin] Unexpected error during bulk ${actionText.toLowerCase()} for ${email}:`, error);
            failCount++;
            lastError = `Unexpected error on ${email}: ${error.message}`;
        }
    }

    // Re-enable controls
    // ... (add logic here)

    // Show summary status
    let summaryMessage = '';
    if (successCount > 0) {
        summaryMessage += `Successfully ${actionText.toLowerCase()}d ${successCount} company(s). `;
    }
    if (failCount > 0) {
        summaryMessage += `Failed to ${actionText.toLowerCase()} ${failCount} company(s). ${lastError ? 'Last error: ' + lastError : ''}`;
    }
    if (adminSkipped) {
         summaryMessage += " (Admin account status unchanged)."
    }
    showStatus(summaryMessage, failCount > 0, statusElementId);

    fetchAndDisplayAllCompanies(); // Refresh the list
}

// --- NEW: Function to handle bulk deletion of companies ---
async function handleDeleteSelectedCompanies() {
    const selectedCheckboxes = document.querySelectorAll('#all-companies-table-body .company-select-checkbox:checked');
    const statusElementId = 'admin-companies-status-message';

    if (selectedCheckboxes.length === 0) {
        showStatus("Please select at least one company to delete.", true, statusElementId);
        return;
    }

    const companiesToDelete = Array.from(selectedCheckboxes).map(cb => ({
        email: cb.value,
        // Find the company name from the table row for a better confirmation message
        companyName: cb.closest('tr')?.querySelector('td:nth-child(3)')?.textContent || cb.value
    }));

    // Filter out the admin user itself
    const filteredCompanies = companiesToDelete.filter(c => c.email !== 'admin@gmail.com');
    const adminSkipped = companiesToDelete.length !== filteredCompanies.length;

    if (filteredCompanies.length === 0) {
        showStatus("No companies selected for deletion (admin account cannot be deleted).", false, statusElementId);
        return;
    }

    const companyNames = filteredCompanies.map(c => c.companyName).join(', ');
    console.log(`[Admin] Delete requested for ${filteredCompanies.length} companies: ${companyNames}`);

    // --- Confirmation Modal --- 
    const modal = document.getElementById('confirmation-modal');
    const modalMessage = document.getElementById('confirmation-modal-message');
    const yesButton = document.getElementById('confirm-yes-button');
    const noButton = document.getElementById('confirm-no-button');

    if (!modal || !modalMessage || !yesButton || !noButton) {
        console.error('Confirmation modal elements not found! Falling back to window.confirm.');
        if (!window.confirm(`ARE YOU SURE you want to delete ${filteredCompanies.length} selected companies and all their items? This cannot be undone.`)) {
            return;
        }
        await proceedWithBulkCompanyDeletion(filteredCompanies, statusElementId);
        return;
    }

    modalMessage.textContent = `ARE YOU SURE you want to delete ${filteredCompanies.length} selected companies (${companyNames}) and all their associated items? This action cannot be undone.`;
    modal.style.display = 'flex';

    const handleYesClick = async () => {
        modal.style.display = 'none';
        removeModalListeners();
        showStatus(`Deleting ${filteredCompanies.length} companies...`, false, statusElementId);
        await proceedWithBulkCompanyDeletion(filteredCompanies, statusElementId);
    };

    const handleNoClick = () => {
        modal.style.display = 'none';
        removeModalListeners();
        showStatus('Bulk company deletion cancelled.', false, statusElementId);
    };

    const removeModalListeners = () => {
        yesButton.removeEventListener('click', handleYesClick);
        noButton.removeEventListener('click', handleNoClick);
    };

    yesButton.addEventListener('click', handleYesClick, { once: true });
    noButton.addEventListener('click', handleNoClick, { once: true });
}

// Actual bulk deletion execution
async function proceedWithBulkCompanyDeletion(companies, statusElementId) {
    let successCount = 0;
    let failCount = 0;
    let lastError = null;
    let itemErrorsOccurred = false;

    // Disable controls
    // ...

    for (const company of companies) {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/companies/${company.email}`, {
                method: 'DELETE'
            });

            if (response.status === 204) {
                successCount++;
            } else if (response.status === 207) {
                // User deleted, but item deletion failed
                successCount++; // Count as success for user deletion
                itemErrorsOccurred = true;
                const result = await response.json();
                lastError = `Item deletion errors for ${company.email}: ${result.errors.join('; ')}`;
                console.warn(`[Admin] Company ${company.email} deleted with item errors:`, result.errors);
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to delete company ${company.email} (Status: ${response.status})`);
            }
        } catch (error) {
            console.error(`[Admin] Error during bulk delete for ${company.email}:`, error);
            failCount++;
            lastError = `Failed on ${company.email}: ${error.message}`;
        }
    }

    // Re-enable controls
    // ...

    // Show summary status
    let summaryMessage = '';
    if (successCount > 0) {
        summaryMessage += `Successfully deleted ${successCount} company record(s). `;
    }
    if (failCount > 0) {
        summaryMessage += `Failed to delete ${failCount} company record(s). ${lastError ? 'Last error: ' + lastError : ''}`;
    }
    if (itemErrorsOccurred) {
        summaryMessage += ' (Note: Errors occurred deleting associated items for some companies).';
    }
    const adminSkipped = document.querySelector('#all-companies-table-body .company-select-checkbox[value="admin@gmail.com"]:checked');
    if (adminSkipped) {
         summaryMessage += " (Admin account was selected but not deleted)."
    }
    showStatus(summaryMessage, failCount > 0 || itemErrorsOccurred, statusElementId);

    fetchAndDisplayAllCompanies(); // Refresh the list
}

// --- NEW: Function to handle printing selected items --- 
function handlePrintSelectedItems() {
    const selectedCheckboxes = document.querySelectorAll('#company-item-table .item-select-checkbox:checked');
    const statusElementId = 'admin-status-message'; // Status area in the item admin view

    if (selectedCheckboxes.length === 0) {
        showStatus("Please select at least one item to print.", true, statusElementId);
        return;
    }

    console.log(`[Print] Preparing to print ${selectedCheckboxes.length} selected items.`);
    showStatus(`Generating QR codes for printing ${selectedCheckboxes.length} item(s)...`, false, statusElementId);

    const printContainer = document.getElementById('print-container');
    if (!printContainer) {
        console.error('[Print] Print container #print-container not found!');
        showStatus('Error: Print container element missing from page.', true, statusElementId);
        return;
    }

    printContainer.innerHTML = ''; // Clear previous print content
    const baseUrl = window.location.origin + window.location.pathname;

    // Get data for selected items
    const itemsToPrint = [];
    selectedCheckboxes.forEach(checkbox => {
        const serial = checkbox.value;
        const row = checkbox.closest('tr');
        if (row) {
            const name = row.cells[2]?.textContent || 'No Name'; // Assuming name is in 3rd cell (index 2)
            itemsToPrint.push({ serial, name });
        } else {
            console.warn(`[Print] Could not find table row for selected serial: ${serial}`);
        }
    });

    if (itemsToPrint.length === 0) {
        showStatus('Error retrieving item data for printing.', true, statusElementId);
        return;
    }

    // Generate QR codes and labels
    itemsToPrint.forEach(item => {
        const verificationUrl = `${baseUrl}?verifySerial=${encodeURIComponent(item.serial)}`;

        const itemDiv = document.createElement('div');
        itemDiv.classList.add('print-qr-item');

        const labelDiv = document.createElement('div');
        labelDiv.classList.add('print-qr-label');
        labelDiv.textContent = `${item.serial} - ${item.name}`; // Label format
        itemDiv.appendChild(labelDiv);

        const qrDiv = document.createElement('div');
        qrDiv.classList.add('print-qr-code');
        itemDiv.appendChild(qrDiv);

        // Generate QR code
        try {
            new QRCode(qrDiv, {
                text: verificationUrl,
                width: 150, // Match CSS size
                height: 150,
                colorDark : "#000000",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.M // Medium correction level is good for stickers
            });
        } catch (error) {
            console.error(`[Print] Failed to generate QR code for ${item.serial}:`, error);
            qrDiv.textContent = 'Error'; 
            qrDiv.style.color = 'red';
        }

        printContainer.appendChild(itemDiv);
    });

    console.log('[Print] Content generated, triggering print dialog...');
    showStatus('QR codes generated. Opening print dialog...', false, statusElementId);
    
    // Use a short timeout to allow the DOM to update before printing
    setTimeout(() => {
        window.print();
        showStatus('Print dialog opened. Remember to choose appropriate paper size/layout.', false, statusElementId);
    }, 500); // 500ms delay 
}

// --- NEW: Function to handle routing based on hash --- 
function handleHashChange() {
    const hash = window.location.hash.substring(1);
    console.log(`[Router] Hash changed to: ${hash}`);
    // ** Move urlParams definition up **
    const urlParams = new URLSearchParams(window.location.search);
    const serialToVerify = urlParams.get('verifySerial');

    // If logged in, the main UI is controlled by updateUI, but hash can toggle search/stats views
    if (loggedInUser) {
        const isAdmin = loggedInUser.email === 'admin@gmail.com';
        const adminScreen = isAdmin ? 'admin-company-list' : 'admin';

        // ** Check for verifySerial FIRST when logged in **
        if (serialToVerify) {
            console.log(`[Router] Logged in, but verifySerial detected: ${serialToVerify}`);
            showScreen('main'); // Ensure main search area is visible
            if (searchTextInput) {
                searchTextInput.value = serialToVerify;
                console.log(`[Router] Pre-filled search input with ${serialToVerify}`);
                askblockchain(); // Trigger the search
            } else {
                console.error('[Router] Search text input not found, cannot pre-fill.');
            }
            // Remove the query param from URL without reloading (optional)
            // window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
            return; // Stop further processing for this hash change
        }

        // Original hash checking logic for logged-in users
        if (hash === 'search') {
             console.log('[Router] Logged in, showing search view');
            showScreen('main'); // Use showScreen to hide others
             if(backButton) backButton.textContent = 'Back to Panel';
            resetMainPage();
        } else if (hash === 'statistics' && !isAdmin) { // Only allow stats for non-admins
            console.log('[Router] Logged in, showing statistics view');
            showScreen('statistics'); 
            handleGoToStats(); // Ensure stats data is loaded/title updated
        } else {
            // Default to admin panel if hash is empty or matches panel
             console.log(`[Router] Logged in, showing ${adminScreen} panel`);
             showScreen(adminScreen); // showScreen hides other panels
             if(backButton) backButton.textContent = 'Go to Search';
        }
        return; // Logged-in logic handled
    }

        // --- Logged Out Logic --- 
         // ** REMOVE Redeclarations - These are now defined at the top of the function **
         // const urlParams = new URLSearchParams(window.location.search);
         // const serialToVerify = urlParams.get('verifySerial');
     
         if (hash === 'login') {
             console.log('[Router] Logged out, showing login screen');
             showScreen('login');
         } else if (hash === 'register') {
             console.log('[Router] Logged out, showing register screen');
             showScreen('register');
         } else if (serialToVerify) {
             // If verifySerial exists AND no specific #login or #register hash
             console.log(`[Router] Logged out, verifying serial: ${serialToVerify}`);
             showScreen('main'); // Ensure main search area is visible
             if (searchTextInput) {
                 searchTextInput.value = serialToVerify;
                 console.log(`[Router] Pre-filled search input with ${serialToVerify}`);
                 askblockchain(); // Trigger the search
             } else {
                 console.error('[Router] Search text input not found, cannot pre-fill.');
             }
         } else {
        // Default to main search screen if no relevant hash or query param
             console.log('[Router] Logged out, showing main search screen');
             showScreen('main');
             resetMainPage();
    }
}

// --- Initialization Function --- 
function initializePage() {
    console.log('[initializePage] Function called - Attempting to initialize...'); // <-- ADD THIS LOG
    // ** Simplified Session Restore Logic **
    try {
        const storedUserString = localStorage.getItem('loggedInUser'); 
        console.log('[initializePage] Retrieved from localStorage:', storedUserString);
        if (storedUserString) {
            loggedInUser = JSON.parse(storedUserString);
            console.log('[initializePage] Restored user:', loggedInUser);
        } else {
             console.log('[initializePage] No user found in localStorage.');
             loggedInUser = null; 
        }
    } catch (e) {
        console.error("[initializePage] Error reading user from localStorage:", e);
        localStorage.removeItem('loggedInUser'); 
        loggedInUser = null;
    }
    // ** End Simplify **

    // Get DOM elements (Common to both pages)
    // ... (keep existing element caching) ...
    loginForm = document.getElementById('login-form');
    registerForm = document.getElementById('register-form');
    loginNavButton = document.getElementById('login-nav-button');
    registerNavButton = document.getElementById('register-nav-button');
    loginScreen = document.getElementById('login-screen');
    registerScreen = document.getElementById('register-screen');
    mainSearchContent = document.getElementById('main-search-content'); 
    loggedInView = document.getElementById('logged-in-view');
    adminCompanyListView = document.getElementById('admin-company-list-view'); // Get new view element
    logoutSection = document.getElementById('logout-section');
    topNav = document.getElementById('top-right-nav'); 
    topLeftNav = document.getElementById('top-left-nav'); 
    searchTextInput = document.getElementById('search-text');
    searchResultContainer = document.querySelector(".search-result");
    searchButton = document.getElementById('search-button'); 
    backButton = document.querySelector("#top-left-nav .back-button"); // Correct selector using class

    // *** Get Admin Panel Elements (index.html specific) ***
    addItemButton = document.getElementById('add-item-button');
    modifyItemButton = document.getElementById('modify-selected-button');
    deleteItemButton = document.getElementById('delete-selected-button');
    addItemFormContainer = document.getElementById('add-item-form-container');
    addItemForm = document.getElementById('add-item-form');
    cancelAddItemButton = document.getElementById('cancel-add-item-button');
    const itemTable = document.getElementById('company-item-table');
    companyItemTableBody = itemTable ? itemTable.querySelector('tbody') : null;
    itemSerialNumberInput = document.getElementById('item-serial-number'); // Get the serial input
    selectAllCheckboxElement = document.getElementById('select-all-checkbox'); // Get select all checkbox
    // Upload/Print buttons
    // uploadItemsButton = document.getElementById('upload-items-button'); 
    itemFileInput = document.getElementById('item-file-input'); 
    printSelectedButton = document.getElementById('print-selected-button');


    // *** Get Admin Company Panel Elements (index.html specific) ***
    activateSelectedCompaniesButton = document.getElementById('activate-selected-companies-button');
    deactivateSelectedCompaniesButton = document.getElementById('deactivate-selected-companies-button');
    deleteSelectedCompaniesButton = document.getElementById('delete-selected-companies-button');
    selectAllCompaniesCheckbox = document.getElementById('select-all-companies-checkbox');

    // *** Cache Statistics Elements (Used by both pages now) ***
    statsButton = document.getElementById('stats-button') || document.getElementById('go-to-stats-button'); // ID differs slightly
    homeButton = document.getElementById('home-button'); // index.html specific?
    statisticsView = document.getElementById('statistics-view');
    backToAdminButton = document.getElementById('back-to-admin-button'); // index.html specific?
    statsNav = document.querySelector('#statistics-view .stats-nav'); // index.html specific?
    statsTitle = document.getElementById('stats-title'); 
    prevMonthBtn = document.getElementById('prev-month-button'); 
    nextMonthBtn = document.getElementById('next-month-button'); 
    currentMonthYearSpan = document.getElementById('current-month-display'); 
    statsTotalChecksCell = document.getElementById('stats-total-checks');
    statsSuccessCountCell = document.getElementById('stats-success-count');
    statsFailCountCell = document.getElementById('stats-fail-count');
    statsSuccessPercentageCell = document.getElementById('stats-success-percentage');
    statsFailPercentageCell = document.getElementById('stats-fail-percentage');
    statsLocationTableBody = document.getElementById('stats-location-body'); 
    statsTrendsTableBody = document.getElementById('stats-trends-body'); 


    // *** Add Event Listeners (Common) ***
    if(loginNavButton) {
        loginNavButton.addEventListener('click', () => {
            resetMainPage(); 
            window.location.hash = 'login'; 
            showScreen('login'); 
        });
    }
    if(registerNavButton) {
        registerNavButton.addEventListener('click', () => {
            resetMainPage(); 
            window.location.hash = 'register'; 
            showScreen('register'); 
        });
    }
    // Note: Logout listener is added dynamically in updateUI or initializeHomePageLogic

    // --- Logic Specific to index.html ---
    if (document.getElementById('login-form')) { // Good indicator for index.html
        console.log('[initializePage] Running index.html specific initialization...');
        
        if(loginForm) loginForm.addEventListener('submit', handleLogin);
        if(registerForm) registerForm.addEventListener('submit', handleRegister);
        if(searchButton) searchButton.addEventListener('click', askblockchain);
        
        // Back button logic for index.html (toggles search/admin)
        if (backButton) {
            backButton.addEventListener('click', () => {
                if (!loggedInUser) { 
                    window.location.hash = ''; 
                    showScreen('main'); 
                    resetMainPage();
                    return;
                }
                const currentHash = window.location.hash.substring(1);
                const isAdminView = currentHash === 'admin' || currentHash === 'admin-company-list';
                const isAdmin = loggedInUser.email === 'admin@gmail.com';
                const targetAdminHash = isAdmin ? 'admin-company-list' : 'admin';

                if (isAdminView) {
                    window.location.hash = 'search'; 
                    if(loggedInView) loggedInView.style.display = 'none';
                    if(adminCompanyListView) adminCompanyListView.style.display = 'none';
                    if(mainSearchContent) mainSearchContent.style.display = 'block';
                    if(backButton) backButton.textContent = 'Back to Panel'; 
                    resetMainPage(); 
                } else {
                    window.location.hash = targetAdminHash;
                    showScreen(targetAdminHash);
                    if(backButton) backButton.textContent = 'Go to Search'; 
                }
            });
        }

        // Admin Panel Listeners (index.html)
        if (addItemButton) addItemButton.addEventListener('click', showAddItemForm);
        if (cancelAddItemButton) cancelAddItemButton.addEventListener('click', hideAddItemForm);
        if (addItemForm) addItemForm.addEventListener('submit', handleAddItemSubmit);
        if (modifyItemButton) modifyItemButton.addEventListener('click', handleModifyItemClick);
        if (deleteItemButton) deleteItemButton.addEventListener('click', handleDeleteItemsClick);
        if (selectAllCheckboxElement) selectAllCheckboxElement.addEventListener('change', handleSelectAllChange);
        if (itemSerialNumberInput) itemSerialNumberInput.addEventListener('input', formatSerialNumberInput);
        if (printSelectedButton) printSelectedButton.addEventListener('click', handlePrintSelectedItems);

        // Admin Company Panel Listeners (index.html)
        if (activateSelectedCompaniesButton) activateSelectedCompaniesButton.addEventListener('click', () => handleBulkCompanyStatusUpdate(true));
        if (deactivateSelectedCompaniesButton) deactivateSelectedCompaniesButton.addEventListener('click', () => handleBulkCompanyStatusUpdate(false));
        if (deleteSelectedCompaniesButton) deleteSelectedCompaniesButton.addEventListener('click', handleDeleteSelectedCompanies);
        if (selectAllCompaniesCheckbox) selectAllCompaniesCheckbox.addEventListener('change', handleCompanySelectAllChange);
        
        // Stats/Home Button Listeners (index.html)
        if (statsButton) { // ID might be 'stats-button' on index.html
            statsButton.addEventListener('click', () => {
                 window.location.hash = 'statistics'; 
            });
        }
        if (backToAdminButton) { // index.html specific
             backToAdminButton.addEventListener('click', () => {
                const isAdmin = loggedInUser && loggedInUser.email === 'admin@gmail.com';
                const targetAdminHash = isAdmin ? 'admin-company-list' : 'admin';
                window.location.hash = targetAdminHash; 
            });
        }
        if (homeButton) { // index.html specific
            homeButton.addEventListener('click', () => {
                window.location.href = 'home.html'; 
            });
        }

        // Initial UI state for index.html
        console.log('[initializePage] Calling initial updateUI() for index.html'); 
        updateUI(); // updateUI handles calling the correct fetch function based on role
        if(searchResultContainer && !loggedInUser) { 
            searchResultContainer.innerHTML = DEFAULT_SEARCH_RESULT_HTML;
        }
        handleHashChange(); // Call hash handler for initial view based on URL
        window.addEventListener('hashchange', handleHashChange); // Add hashchange listener

    } // --- End index.html specific logic ---


    // --- Logic Specific to home.html ---
    if (document.getElementById('home-view-panel')) { // Good indicator for home.html
        console.log('[initializePage] Running home.html specific initialization...');

        if (!loggedInUser) {
            // If not logged in on home page, redirect to the main login page
            console.log('[initializePage - Home] Not logged in, redirecting to login.');
            window.location.href = 'index.html#login'; 
            return; // Stop further execution for home page
        }

        // Populate Welcome Message (Home Page)
        const nameSpan = document.getElementById('logged-in-user-name');
        const emailSpan = document.getElementById('logged-in-user-email');
        const homeLogoutSection = document.getElementById('logout-section'); // Use cached var

        if (nameSpan && emailSpan && homeLogoutSection) {
            nameSpan.textContent = loggedInUser.companyName || 'User';
            emailSpan.textContent = `(${loggedInUser.email || 'No Email'})`;
            homeLogoutSection.style.display = 'flex'; // Show the logout section
            // Attach logout handler for home page
            const homeLogoutButton = homeLogoutSection.querySelector('#logout-button');
            if (homeLogoutButton) {
                homeLogoutButton.addEventListener('click', function handleLogoutHome() {
                     console.log('[Home] Logging out...');
                     localStorage.removeItem('loggedInUser');
                     loggedInUser = null;
                     window.location.href = 'index.html'; // Redirect to main page after logout
                });
            }
        } else {
            console.error('[initializePage - Home] Could not find logout section elements.');
        }

        // Populate User Info Panel (Home Page)
        const infoCompanyName = document.getElementById('user-info-company-name');
        const infoCompanyId = document.getElementById('user-info-company-id');
        const infoEmail = document.getElementById('user-info-email');
        const infoRole = document.getElementById('user-info-role');
        const infoRegisteredAt = document.getElementById('user-info-registered-at');

        if (infoCompanyName && infoCompanyId && infoEmail && infoRole && infoRegisteredAt) {
            infoCompanyName.textContent = loggedInUser.companyName || 'N/A';
            infoCompanyId.textContent = loggedInUser.companyId || 'N/A';
            infoEmail.textContent = loggedInUser.email || 'N/A';
            infoRole.textContent = loggedInUser.role || 'user'; 
            
            let formattedDate = 'N/A';
            if (loggedInUser.registeredAt) {
                try {
                    const dateObj = new Date(loggedInUser.registeredAt);
                    if (dateObj && !isNaN(dateObj.getTime())) { 
                        formattedDate = dateObj.toLocaleString();
                    } else { console.warn('[Home] Date parsing resulted in an invalid date.'); }
                } catch (e) { console.warn('[Home] Error during date formatting:', e); }
            }
            infoRegisteredAt.textContent = formattedDate;
        } else {
            console.error('[initializePage - Home] Could not find all user info panel elements.');
        }

        // Initialize Statistics (Home Page)
        if (statisticsView && loggedInUser.email !== 'admin@gmail.com') {
             console.log('[initializePage - Home] Initializing statistics display...');
             const now = new Date();
             currentStatsYear = now.getFullYear(); 
             currentStatsMonth = now.getMonth(); 
             
             if (statsTitle) { // Use cached variable
                 statsTitle.textContent = `${loggedInUser.companyName} - Statistics`;
             } else { console.warn('[Home] Stats title element (#stats-title) not found/cached.'); }
             
             // Check AGAIN if function exists before calling - belt and suspenders
             if (typeof fetchAndDisplayMonthlyStats === 'function') {
                 fetchAndDisplayMonthlyStats(currentStatsYear, currentStatsMonth); // Initial fetch
             } else {
                 console.error('[initializePage - Home] CRITICAL: fetchAndDisplayMonthlyStats function still not found!');
                 if (statsTitle) statsTitle.textContent += ' - Stats Function Error!';
             }
             
             // NEW: Load persisted AI analysis after stats are initialized
             displayPersistedAiAnalysis(); 
             
        } else if (loggedInUser.email === 'admin@gmail.com') {
             console.log('[initializePage - Home] Admin user, not initializing company stats on home page.');
             if (statsTitle) statsTitle.textContent = 'Statistics (Admin View - N/A)';
        }

        // Home Page Navigation Listeners
        const panelButton = document.getElementById('go-to-panel-button');
        if (panelButton) {
            panelButton.addEventListener('click', () => window.location.href = 'index.html#admin');
        }
        const searchButtonHome = document.getElementById('go-to-search-button');
        if (searchButtonHome) {
            searchButtonHome.addEventListener('click', () => window.location.href = 'index.html#search');
        }
        const statsButtonHome = document.getElementById('go-to-stats-button');
        if (statsButtonHome) { // ID might be 'go-to-stats-button' on home.html
            statsButtonHome.addEventListener('click', () => {
                if (loggedInUser && loggedInUser.email === 'admin@gmail.com') {
                    alert('Statistics are not available for the admin account.');
                } else {
                    window.location.href = 'index.html#statistics'; 
                }
            });
        }

    } // --- End home.html specific logic ---


    // *** Common Listeners (like QR Modal, Month Nav) - Apply if elements exist ***
    const qrModal = document.getElementById('qr-enlarge-modal');
    if (qrModal) {
        qrModal.addEventListener('click', (event) => {
            if (event.target === qrModal) closeQrModal();
        });
        // Add close button listener if it exists
        const closeQrBtn = document.getElementById('modal-close-qr-button'); // Ensure this ID exists
        if(closeQrBtn) closeQrBtn.addEventListener('click', closeQrModal);
    }
    // Month Navigation Button Listeners (Statistics View - could be on index or home)
    if (prevMonthBtn) {
        prevMonthBtn.addEventListener('click', handlePrevMonth);
    }
    if (nextMonthBtn) {
        nextMonthBtn.addEventListener('click', handleNextMonth);
    }

    // *** Add listener for AI Analyze button ***
    const analyzeButton = document.getElementById('analyze-ai-button');
    if (analyzeButton) {
        analyzeButton.addEventListener('click', handleAnalyzeStats);
        console.log('[Initialize] Added listener for AI Analyze button.');
    } else {
        // Log warning if on a page where stats view might exist but button wasn't found
        if(document.getElementById('statistics-view')) {
             console.warn('[Initialize] Analyze AI button (#analyze-ai-button) not found on this page.');
        }
    }
    // *** End AI Analyze listener ***

    console.log('[initializePage] Initialization complete.');
}

// --- NEW: Function to fetch and display company stats --- 
async function fetchAndDisplayCompanyStats() {
    // Check if user is logged in and has necessary info
    if (!loggedInUser || !loggedInUser.companyName || !loggedInUser.companyId) { 
        console.error("[Stats] Cannot fetch stats: User not logged in or missing companyName/companyId.");
        // Clear potentially stale data
        document.getElementById('stats-total-checks').textContent = 'N/A';
        document.getElementById('stats-success-count').textContent = 'N/A';
        document.getElementById('stats-fail-count').textContent = 'N/A';
        document.getElementById('stats-success-percentage').textContent = 'N/A';
        document.getElementById('stats-fail-percentage').textContent = 'N/A';
        document.getElementById('stats-location-body').innerHTML = '<tr><td colspan="2">N/A - User not logged in</td></tr>';
        document.getElementById('stats-date-range').textContent = 'Date Range: N/A';
        return;
    }

    const companyName = loggedInUser.companyName;
    const companyId = loggedInUser.companyId; 
    
    // Get references to output elements
    const totalChecksCell = document.getElementById('stats-total-checks');
    const successCountCell = document.getElementById('stats-success-count');
    const failCountCell = document.getElementById('stats-fail-count'); 
    const successPercCell = document.getElementById('stats-success-percentage');
    const failPercCell = document.getElementById('stats-fail-percentage');
    const locationTableBody = document.getElementById('stats-location-body');
    const dateRangeElement = document.getElementById('stats-date-range');
    const loadingPlaceholder = '...'; 
    
    // Set loading placeholders
    totalChecksCell.textContent = loadingPlaceholder;
    successCountCell.textContent = loadingPlaceholder;
    failCountCell.textContent = loadingPlaceholder; 
    successPercCell.textContent = loadingPlaceholder;
    failPercCell.textContent = loadingPlaceholder;
    locationTableBody.innerHTML = `<tr><td colspan="2">${loadingPlaceholder}</td></tr>`;
    dateRangeElement.textContent = `Date Range: ${loadingPlaceholder}`;

    // Fetch Statistics Report
    try {
        // Construct the URL for the report endpoint
        // We can add startDate/endDate here if needed later
        const url = `${API_BASE_URL}/statistics/${encodeURIComponent(companyId)}/${encodeURIComponent(companyName)}/report`;
        console.log(`[Stats] Fetching stats report from: ${url}`);
        const response = await fetch(url);
        
        if (!response.ok) {
            let errorDetail = response.statusText;
            try {
                const errorJson = await response.json();
                errorDetail = errorJson.error || errorDetail;
            } catch(e){ /* Ignore JSON parsing error */ }
            throw new Error(`Failed to fetch statistics report (${response.status}): ${errorDetail}`);
        }
        
        const report = await response.json(); 
        console.log(`[Stats] Received statistics report for ${companyName} (ID: ${companyId}):`, report);
        
        // Populate the summary table
        totalChecksCell.textContent = report.totalChecks ?? 'Error';
        successCountCell.textContent = report.successCount ?? 'Error';
        failCountCell.textContent = report.failCount ?? 'Error';
        successPercCell.textContent = `${report.successPercentage ?? 'N/A'}%`;
        failPercCell.textContent = `${report.failPercentage ?? 'N/A'}%`;

        // Format and display date range
        try {
            const startDate = new Date(report.startDate).toLocaleDateString();
            const endDate = new Date(report.endDate).toLocaleDateString();
            dateRangeElement.textContent = `Date Range: ${startDate} - ${endDate}`;
        } catch (dateError) {
             console.error("[Stats] Error formatting date range:", dateError);
             dateRangeElement.textContent = `Date Range: Error`;
        }
        
        // Populate the location table (Top 5)
        locationTableBody.innerHTML = ''; // Clear loading row
        if (report.locationCounts && Object.keys(report.locationCounts).length > 0) {
            // Sort locations by count descending and take top 5
            const sortedLocations = Object.entries(report.locationCounts)
                .sort(([,a],[,b]) => b - a) // Sort by count (value)
                .slice(0, 5);

            if (sortedLocations.length > 0) {
                 sortedLocations.forEach(([location, count]) => {
                    const row = locationTableBody.insertRow();
                    row.insertCell().textContent = location;
                    row.insertCell().textContent = count;
                });
            } else {
                 locationTableBody.innerHTML = '<tr><td colspan="2">No location data available</td></tr>';
            }
           
        } else {
            locationTableBody.innerHTML = '<tr><td colspan="2">No location data available</td></tr>';
        }
        
    } catch (error) {
        console.error("[Stats] Error fetching or displaying statistics report:", error);
        // Display error state in UI
        totalChecksCell.textContent = 'Error';
        successCountCell.textContent = 'Error';
        failCountCell.textContent = 'Error';
        successPercCell.textContent = 'Error';
        failPercCell.textContent = 'Error';
        locationTableBody.innerHTML = '<tr><td colspan="2">Error loading data</td></tr>';
         dateRangeElement.textContent = `Date Range: Error`;
    }
}

// --- Placeholder Handler for New Company Button (renamed handleGoToStats) ---
function handleGoToStats() { 
    console.log('[Stats] handleGoToStats called. Navigating/Updating stats view...');
    
    if (!loggedInUser) {
        console.error('[Stats] Cannot display stats: User not logged in.');
        window.location.hash = '#login'; // Redirect if not logged in
        return;
    }

    // Reset to current month/year every time the view is opened
    const now = new Date();
    currentStatsYear = now.getFullYear();
    currentStatsMonth = now.getMonth();
    console.log(`[Stats] Date reset to current: ${currentStatsYear}-${currentStatsMonth + 1}`);

    showScreen('statistics'); // Make the view visible

    // Update the title
    const statsTitleElement = document.getElementById('stats-title');
    if (statsTitleElement) {
        statsTitleElement.textContent = `${loggedInUser.companyName} - Statistics`;
    } else {
        console.warn('[Stats] Stats title element (#stats-title) not found.');
    }
    
    // Fetch and display the stats for the initialized (current) month
    console.log('[Stats] Calling initial fetchAndDisplayMonthlyStats...');
    fetchAndDisplayMonthlyStats(currentStatsYear, currentStatsMonth);
    
    // NEW: Load any persisted AI analysis when showing the stats view
    displayPersistedAiAnalysis(); 
}

// --- Event Listeners --- 
document.addEventListener('DOMContentLoaded', initializePage); // Correctly call initializePage

// ... rest of the event listeners ...

console.log('[responses.js] Script finished parsing.');

// --- Helper Functions ---

// Check login status on page load
function checkLoginStatus() {
    console.log('[checkLoginStatus] Function called.'); // Add log to confirm entry
    try { // <-- ADD TRY
        const storedUserString = localStorage.getItem('loggedInUser');
        console.log('[checkLoginStatus] Retrieved from localStorage:', storedUserString);
        if (storedUserString) {
            loggedInUser = JSON.parse(storedUserString);
            console.log('[checkLoginStatus] Restored user:', loggedInUser);
            // No need to call updateUI here, it will be called by initializePage after this
        } else {
            console.log('[checkLoginStatus] No user found in localStorage.');
            loggedInUser = null;
        }
    // ** NO updateUI() call needed here, let initializePage handle it **
    // updateUI(); // Call updateUI to reflect login state
    } catch (error) { // <-- ADD CATCH
        console.error('!!!!!!!!!!!!!!!!! ERROR INSIDE checkLoginStatus !!!!!!!!!!!!!!!!!!');
        console.error(error);
        // Clear potentially corrupted state and ensure logged out state
        localStorage.removeItem('loggedInUser'); 
        loggedInUser = null;
        // We might still want initializePage to run for basic UI elements
        // updateUI(); // Optionally call updateUI to ensure logged-out view is shown
    }
}

// Function to show the enlarged QR code modal
function showEnlargedQr(url) {
    const modal = document.getElementById('qr-enlarge-modal');
    const qrContainer = document.getElementById('enlarged-qr-code-container');
    const urlElement = document.getElementById('enlarged-qr-url');
    const closeButton = document.getElementById('modal-close-qr-button'); // Make sure this ID exists
    const statusElementId = 'qr-modal-status'; // Use a specific ID if needed, or reuse admin status

    if (!modal || !qrContainer || !urlElement) {
        console.error('Enlarge QR modal elements not found!');
        showStatus('Error displaying enlarged QR code.', true, 'admin-status-message'); // Fallback status
        return;
    }

    console.log('[QR Enlarge] Showing modal for URL:', url);
    qrContainer.innerHTML = ''; // Clear previous QR code
    urlElement.textContent = url; // Display the URL

    // Make the URL text copyable
    urlElement.onclick = async () => { // Simple click-to-copy
        if (navigator.clipboard) {
            try {
                await navigator.clipboard.writeText(url);
                showStatus('URL copied to clipboard!', false, 'admin-status-message'); // Show status briefly
            } catch (err) {
                showStatus('Failed to copy URL.', true, 'admin-status-message');
            }
        }
    };


    try {
        new QRCode(qrContainer, {
            text: url,
            width: 400, // Increased generation size
            height: 400, // Increased generation size
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H // Increased correction level
        });
        modal.style.display = 'flex'; // Show the modal using flex
    } catch (error) {
        console.error('Failed to generate enlarged QR code:', error);
        qrContainer.innerHTML = '<p style="color: red;">Error generating QR code.</p>';
        modal.style.display = 'flex'; // Still show modal with error
    }
}

// Function to close the enlarged QR code modal
function closeQrModal() {
    const modal = document.getElementById('qr-enlarge-modal');
    if (modal) {
        modal.style.display = 'none';
        const qrContainer = document.getElementById('enlarged-qr-code-container');
        if (qrContainer) qrContainer.innerHTML = ''; // Clear the QR code
        const urlElement = document.getElementById('enlarged-qr-url');
        if (urlElement) urlElement.textContent = ''; // Clear the URL
        console.log('[QR Enlarge] Modal closed.');
    }
}

// --- Statistics Section ---

// Helper to format month and year for display
const formatMonthYear = (year, month) => {
    const date = new Date(year, month);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
};

// Function to fetch and display statistics for a specific month and year
async function fetchAndDisplayMonthlyStats(year, month) {
    console.log(`[Stats] Fetching stats report for ${year}-${String(month + 1).padStart(2, '0')}`);
    
    // Use cached variables for DOM elements
    const aiButton = document.getElementById('analyze-ai-button'); // Get AI button ref

    // Basic check if elements exist (using cached variables)
    if (!statsTitle || !currentMonthYearSpan || !statsTotalChecksCell || !statsSuccessCountCell || !statsFailCountCell || !statsSuccessPercentageCell || !statsFailPercentageCell || !statsLocationTableBody || !statsTrendsTableBody || !aiButton) { // Added aiButton check
        console.error("[Stats] Cannot display stats: One or more required statistics DOM elements not found/cached.");
        if(statsTitle) statsTitle.textContent = 'Statistics - UI Error';
        if(currentMonthYearSpan) currentMonthYearSpan.textContent = 'UI Error'; 
        return; 
    }

    // Check for loggedInUser and necessary properties
    if (!loggedInUser || !loggedInUser.companyId || !loggedInUser.companyName) {
        console.error("[Stats] Cannot fetch stats: User not logged in or missing companyId/companyName.");
        statsTitle.textContent = 'Statistics - Error';
        currentMonthYearSpan.textContent = 'Error'; 
        statsTotalChecksCell.textContent = 'N/A';
        statsSuccessCountCell.textContent = 'N/A';
        statsFailCountCell.textContent = 'N/A';
        statsSuccessPercentageCell.textContent = 'N/A';
        statsFailPercentageCell.textContent = 'N/A';
        statsLocationTableBody.innerHTML = '<tr><td colspan="2">N/A</td></tr>';
        // Disable button and show message if user info is missing
        aiButton.disabled = true;
        aiButton.title = 'Cannot load stats (user info missing).';
        localStorage.removeItem('aiAnalysisData'); // Clear potentially stale analysis
        statsTrendsTableBody.innerHTML = '<tr><td colspan="2" style="text-align: center; color: #888;"><i>Statistics unavailable.</i></td></tr>'; 
        return;
    }

    const companyId = loggedInUser.companyId;
    const companyName = loggedInUser.companyName; 

    // Update display elements to show loading state
    statsTitle.textContent = `Statistics for ${companyName}`;
    currentMonthYearSpan.textContent = formatMonthYear(year, month); 
    statsTotalChecksCell.textContent = '...';
    statsSuccessCountCell.textContent = '...';
    statsFailCountCell.textContent = '...';
    statsSuccessPercentageCell.textContent = '...';
    statsFailPercentageCell.textContent = '...';
    statsLocationTableBody.innerHTML = '<tr><td colspan="2">Loading...</td></tr>';
    aiButton.disabled = true; // Disable button while loading
    aiButton.title = 'Loading statistics...';
    statsTrendsTableBody.innerHTML = '<tr><td colspan="2" style="text-align: center;"><i>Loading...</i></td></tr>'; // Indicate loading in AI section too

    // --- Calculate Start and End Dates for the Month --- 
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0); 
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    // --- End Date Calculation ---

    try {
        const apiUrl = `${API_BASE_URL}/statistics/${encodeURIComponent(companyId)}/${encodeURIComponent(companyName)}/report?startDate=${startDateStr}&endDate=${endDateStr}`;
        
        console.log(`[Stats] Calling API: ${apiUrl}`);
        const response = await fetch(apiUrl);
        const report = await response.json(); 

        currentMonthYearSpan.textContent = formatMonthYear(year, month);

        if (response.ok) {
            console.log(`[Stats] Received report for ${year}-${month + 1}:`, report);
            
            // Populate summary table
            const totalChecks = report.totalChecks ?? 0; // Default to 0 if null/undefined
            statsTotalChecksCell.textContent = totalChecks;
            statsSuccessCountCell.textContent = report.successCount ?? 'N/A';
            statsFailCountCell.textContent = report.failCount ?? 'N/A';
            statsSuccessPercentageCell.textContent = report.successPercentage != null ? `${report.successPercentage}%` : 'N/A'; 
            statsFailPercentageCell.textContent = report.failPercentage != null ? `${report.failPercentage}%` : 'N/A';

            // Populate Location Table
            statsLocationTableBody.innerHTML = ''; 
            if (report.locationCounts && Object.keys(report.locationCounts).length > 0) {
                const sortedLocations = Object.entries(report.locationCounts)
                    .sort(([, a], [, b]) => b - a) 
                    .slice(0, 5); 

                if (sortedLocations.length > 0) {
                    sortedLocations.forEach(([location, count]) => {
                        const row = statsLocationTableBody.insertRow();
                        row.insertCell(0).textContent = location || 'Unknown';
                        row.insertCell(1).textContent = count ?? 'N/A';
                    });
                } else {
                    statsLocationTableBody.innerHTML = '<tr><td colspan="2" style="text-align:center;">N/A</td></tr>'; 
                }
            } else {
                statsLocationTableBody.innerHTML = '<tr><td colspan="2" style="text-align:center;">N/A</td></tr>'; 
            }

            // --- Handle AI Button State and Suggestions Area --- 
            if (totalChecks > 0) {
                // Data exists: Enable button, clear title, display persisted/default AI suggestion
                aiButton.disabled = false;
                aiButton.title = 'Analyze this month\'s statistics with AI';
                displayPersistedAiAnalysis(); // Load saved or show default prompt
            } else {
                // No data: Disable button, set title, clear saved analysis, show specific message
                aiButton.disabled = true;
                aiButton.title = 'No data available for this month to analyze.';
                localStorage.removeItem('aiAnalysisData'); // Clear potentially irrelevant saved analysis
                statsTrendsTableBody.innerHTML = '<tr><td colspan="2" style="text-align: center; color: #888; padding-top: 20px; padding-bottom: 20px;"><i>No statistics available for this month.<br>Please select a different month to analyze.</i></td></tr>'; 
            }
            // --- End AI Handling ---

        } else {
            // Handle non-OK responses from the report endpoint
            console.warn(`[Stats] API Error fetching report for ${year}-${month + 1}. Status: ${response.status}, Response:`, report);
            const errorMsg = report.error || `API Error (${response.status})`;
            statsTitle.textContent = `Statistics - API Error`;
            // Display N/A or Error
            statsTotalChecksCell.textContent = 'Error';
            statsSuccessCountCell.textContent = 'N/A';
            statsFailCountCell.textContent = 'N/A';
            statsSuccessPercentageCell.textContent = 'N/A';
            statsFailPercentageCell.textContent = 'N/A';
            statsLocationTableBody.innerHTML = '<tr><td colspan="2" style="text-align:center;">Error</td></tr>';
            // Disable button and show error message
            aiButton.disabled = true;
            aiButton.title = `Error loading statistics: ${errorMsg}`;
            localStorage.removeItem('aiAnalysisData');
            statsTrendsTableBody.innerHTML = `<tr><td colspan="2" style="text-align: center; color: red; padding-top: 20px; padding-bottom: 20px;">Error loading statistics data (${errorMsg}). Cannot analyze.</td></tr>`;
        }
    } catch (error) {
        // Handle network errors or JSON parsing errors
        console.error(`[Stats] Network/Parse Error fetching report for ${year}-${month + 1}:`, error);
        statsTitle.textContent = `Statistics - Network Error`;
        // Display Error
        statsTotalChecksCell.textContent = 'Error';
        statsSuccessCountCell.textContent = 'N/A';
        statsFailCountCell.textContent = 'N/A';
        statsSuccessPercentageCell.textContent = 'N/A';
        statsFailPercentageCell.textContent = 'N/A';
        statsLocationTableBody.innerHTML = '<tr><td colspan="2" style="text-align:center;">Error</td></tr>';
        // Disable button and show error message
        aiButton.disabled = true;
        aiButton.title = 'Network or server error loading statistics.';
        localStorage.removeItem('aiAnalysisData');
        statsTrendsTableBody.innerHTML = '<tr><td colspan="2" style="text-align: center; color: red; padding-top: 20px; padding-bottom: 20px;">Network/Server error loading statistics data. Cannot analyze.</td></tr>';
    }
}

// Handlers for month navigation buttons
function handlePrevMonth() {
    currentStatsMonth--;
    if (currentStatsMonth < 0) {
        currentStatsMonth = 11; // Wrap to December
        currentStatsYear--;     // Decrement year
    }
    console.log(`[Stats] Navigating to Prev Month: ${currentStatsYear}-${currentStatsMonth + 1}`);
    fetchAndDisplayMonthlyStats(currentStatsYear, currentStatsMonth);
}

function handleNextMonth() {
    currentStatsMonth++;
    if (currentStatsMonth > 11) {
        currentStatsMonth = 0; // Wrap to January
        currentStatsYear++;    // Increment year
    }
    console.log(`[Stats] Navigating to Next Month: ${currentStatsYear}-${currentStatsMonth + 1}`);
    fetchAndDisplayMonthlyStats(currentStatsYear, currentStatsMonth);
}

// --- NEW: AI Analysis Handler ---

// Helper function to format AI response text into HTML
function formatAiResponse(rawText) {
    if (!rawText) return '<p>No analysis content received.</p>';

    // Basic Markdown Cleaning (Bold/Italics)
    let cleanedText = rawText
        .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove **bold**
        .replace(/__([^_]+)__/g, '$1')   // Remove __bold__
        .replace(/\*([^*]+)\*/g, '$1')     // Remove *italic*
        .replace(/_([^_]+)_/g, '$1');      // Remove _italic_

    // Normalize line endings and trim whitespace
    const text = cleanedText.replace(/\r\n/g, '\n').trim();

    // Split into logical blocks (paragraphs or list blocks)
    const blocks = text.split(/\n\s*\n/); // Split by one or more empty lines
    let html = '';

    blocks.forEach(block => {
        block = block.trim();
        if (!block) return;

        // Check for potential headings (e.g., starts with ##, ends with :, maybe all caps?)
        let isHeading = false;
        let headingText = block;
        if (block.startsWith('##')) {
            isHeading = true;
            headingText = block.replace(/^##\s*/, '').trim();
        } else if (block.endsWith(':')) {
            // Also consider lines ending with ':' as potential section headers
            // Avoid treating list items ending with ':' as headers
            if (!/^[-*\d.]\s/.test(block)) { 
                isHeading = true;
                headingText = block.slice(0, -1).trim(); // Remove trailing colon
            }
        }

        if (isHeading) {
            html += `<h3>${headingText}</h3>`;
            return; // Processed this block as a heading
        }

        // Check for list types (unordered or ordered)
        const lines = block.split('\n');
        const isUnorderedList = lines.every(line => line.trim().startsWith('*') || line.trim().startsWith('-'));
        const isOrderedList = lines.every(line => /^\d+\.\s/.test(line.trim()));

        if (isUnorderedList) {
            html += '<ul>';
            lines.forEach(line => {
                const itemText = line.trim().replace(/^[-*]\s*/, ''); // Remove bullet and leading space
                if (itemText) { // Avoid adding empty list items
                    html += `<li>${itemText}</li>`;
                }
            });
            html += '</ul>';
        } else if (isOrderedList) {
            html += '<ol>';
            lines.forEach(line => {
                const itemText = line.trim().replace(/^\d+\.\s*/, ''); // Remove number and leading space
                if (itemText) { // Avoid adding empty list items
                   html += `<li>${itemText}</li>`;
                }
            });
            html += '</ol>';
        } else {
            // Treat as a regular paragraph
            // Replace internal single newlines with <br> for multi-line paragraphs
            html += `<p>${block.replace(/\n/g, '<br>')}</p>`;
        }
    });

    return html;
}

// NEW: Helper function to display persisted AI analysis from localStorage
function displayPersistedAiAnalysis() {
    const trendsBody = document.getElementById('stats-trends-body');
    const aiButton = document.getElementById('analyze-ai-button');
    if (!trendsBody) {
        console.warn('[displayPersistedAiAnalysis] Trends table body not found.');
        return;
    }

    try {
        const storedAnalysis = localStorage.getItem('aiAnalysisData');
        if (storedAnalysis) {
            const { html, timestamp } = JSON.parse(storedAnalysis);
            const dateString = new Date(timestamp).toLocaleString();
            trendsBody.innerHTML = `<tr><td>${html}<p style="font-size: 0.8em; color: #666; margin-top: 1em; text-align: right;"><em>Last updated: ${dateString}</em></p></td></tr>`;
            console.log('[displayPersistedAiAnalysis] Displayed persisted AI analysis from', dateString);
            // Ensure button is enabled if analysis is displayed
            if (aiButton) aiButton.disabled = false;
        } else {
            // If no stored data, show default message or keep current content (which might be loading/error)
            // Only reset if it doesn't look like loading/error state
            if (!trendsBody.innerHTML.includes('loader') && !trendsBody.innerHTML.includes('Error') && !trendsBody.innerHTML.includes('N/A')) {
                trendsBody.innerHTML = '<tr><td style="text-align: center;">Click "Analyze by AI" to get insights.</td></tr>';
            }
            console.log('[displayPersistedAiAnalysis] No persisted AI analysis found.');
        }
    } catch (error) {
        console.error('[displayPersistedAiAnalysis] Error loading/parsing persisted AI analysis:', error);
        trendsBody.innerHTML = '<tr><td style="color: red; text-align: center;">Error loading saved AI analysis.</td></tr>';
    }
}

async function handleAnalyzeStats() {
    console.log('[AI Analyze] Button clicked.');
    const aiButton = document.getElementById('analyze-ai-button');
    const trendsBody = document.getElementById('stats-trends-body');
    const statusElementId = 'stats-title'; // Use stats title area for notifications

    if (!trendsBody || !aiButton) {
        console.error('[AI Analyze] Cannot find AI button or trends table body.');
        showStatus('UI Error: Cannot initiate AI analysis.', true, statusElementId);
        return;
    }
    
    // Button should be disabled by fetchAndDisplayMonthlyStats if no data exists,
    // so the explicit check here is removed.
    // if (successCount === 0 && failCount === 0 && locationData.length === 0) {
    //     throw new Error("No statistics data available for analysis in " + monthYearText + ".");
    // }

    // Disable button and show loading state
    aiButton.disabled = true; // Still disable during processing

    try {
        // 1. Gather Data from DOM
        const successCountText = document.getElementById('stats-success-count')?.textContent;
        const failCountText = document.getElementById('stats-fail-count')?.textContent;
        const locationRows = document.querySelectorAll('#stats-location-body tr');

        // Use 0 as default if text content is not a number or is '...'
        const successCount = parseInt(successCountText) || (successCountText === '...' ? 0 : 0); // Default to 0 if parsing fails or loading
        const failCount = parseInt(failCountText) || (failCountText === '...' ? 0 : 0); // Default to 0

        let locationData = [];
        locationRows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length === 2) {
                const country = cells[0].textContent;
                const countText = cells[1].textContent;
                const count = parseInt(countText) || 0;
                // Include only valid entries
                if (country && count > 0 && country !== 'Loading...' && country !== 'N/A' && country !== 'Error loading data') {
                    locationData.push({ country, count });
                }
            }
        });

        // Get month/year for context
        const monthYearText = document.getElementById('current-month-display')?.textContent || 'Current Month';

        console.log('[AI Analyze] Gathered data for', monthYearText, ':', { successCount, failCount, locationData });

        // Add a basic check: if no real data, don't call AI
        if (successCount === 0 && failCount === 0 && locationData.length === 0) {
            throw new Error("No statistics data available for analysis in " + monthYearText + ".");
        }

        // 2. Prepare Headers & Request Body
        const headers = {
            'Content-Type': 'application/json'
        };
        if (loggedInUser && loggedInUser.email) {
            headers['X-User-Email'] = loggedInUser.email;
        } else {
            throw new Error('Authentication error: User details missing.');
        }

        // Include month context in the request
        const body = JSON.stringify({ successCount, failCount, locationData, monthContext: monthYearText });

        // 3. Call Backend Proxy Endpoint
        console.log('[AI Analyze] Calling backend proxy: POST /api/analyze-stats');
        const response = await fetch(`${API_BASE_URL}/analyze-stats`, {
            method: 'POST',
            headers: headers,
            body: body
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || `Analysis failed with status: ${response.status}`);
        }

        // 4. Process and Store Result
        console.log('[AI Analyze] Received analysis:', result.analysis);
        const formattedAnalysis = formatAiResponse(result.analysis);
        const timestamp = Date.now();

        // Store in localStorage
        try {
            localStorage.setItem('aiAnalysisData', JSON.stringify({ html: formattedAnalysis, timestamp }));
            console.log('[AI Analyze] Analysis saved to localStorage.');
        } catch (e) {
            console.error('[AI Analyze] Failed to save analysis to localStorage:', e);
            // Optionally show a non-critical error to the user
            showStatus('Warning: Could not save AI analysis for next session.', true, statusElementId);
        }

        // 5. Display Result using the new function
        displayPersistedAiAnalysis();

        // 6. Show success notification
        showStatus('AI analysis updated successfully!', false, statusElementId);

    } catch (error) {
        console.error('[AI Analyze] Error during analysis:', error);
        trendsBody.innerHTML = `<tr><td colspan="2" style="color: red;">Error getting AI analysis: ${error.message}</td></tr>`; // Use colspan
        // Show error status
        showStatus(`AI Analysis Error: ${error.message}`, true, statusElementId);
    } finally {
        // Re-enable button regardless of success/failure
        aiButton.disabled = false;
    }
}

// --- End Statistics Section ---

