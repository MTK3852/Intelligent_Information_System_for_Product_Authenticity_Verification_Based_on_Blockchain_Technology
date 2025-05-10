const path = require('path'); // Ensure path is required

// Load environment variables from .env file located one level up
require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); 

const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const nano = require('nano');
const multer = require('multer');
const xlsx = require('xlsx');
const xml2js = require('xml2js');
const axios = require('axios'); // *** ADDED for Ollama ***

const app = express();
// app.use(bodyParser.json());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const cors = require('cors');

// --- CORS Configuration ---
// More explicit configuration to handle preflight requests
const corsOptions = {
    origin: '*', // Allow all origins (adjust in production if needed)
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204, // Standard success for preflight
    allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Email'] // Explicitly allow necessary headers
};

app.use(cors(corsOptions));
// Handle preflight requests explicitly (sometimes needed in addition to cors middleware)
// app.options('*', cors(corsOptions)); // You can uncomment this if the above doesn't suffice
// ------------------------

// Setting for Hyperledger Fabric
const user_identity = process.argv[2]
if (!user_identity) {
    console.error("Error: User identity must be provided as a command line argument.");
    console.error("Usage: node app_server.js <user_identity>");
    process.exit(1);
}
console.log(`Using identity: ${user_identity}`);

const { Wallets, Gateway } = require('fabric-network');
const fs = require('fs');
const ccpPath = path.resolve(__dirname, '.',  'connection_conf.json');

// Function to connect to the gateway and get contract
// Simplifies connection logic in each endpoint
async function getContract() {
        let ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

    // Check if the identity exists
        const identity = await wallet.get(user_identity);
        if (!identity) {
        console.log(`An identity for the user "${user_identity}" does not exist in the wallet`);
        // Enroll the admin user first if needed, or handle user registration
        throw new Error(`Identity ${user_identity} not found in wallet. Run registration scripts first.`);
    }

        const gateway = new Gateway();
    console.log('Connecting to gateway...');
        await gateway.connect(ccp, { wallet, identity: user_identity, discovery: { enabled: true, asLocalhost: false } });
    console.log('Connected to gateway.');

        const network = await gateway.getNetwork("product-authenticity-channel");
        const contract = network.getContract('product-authenticity-chaincode');

    return { gateway, contract };
}

// --- Helper Function: Log search details to Ollama --- 
async function logToOllama(logDetails) {
    const ollamaUrl = 'http://host.docker.internal:11434/api/generate';
    const modelName = 'llama3.2:1b';
    console.log(`[Ollama Log] Sending log data to ${ollamaUrl} for model ${modelName}...`);
    
    try {
        // Construct a simple prompt from the details
        let prompt = `Log entry:\nSerial: ${logDetails.serialNumber}\nStatus: ${logDetails.status}\n`;
        if(logDetails.error) {
            prompt += `Error: ${logDetails.error}\n`;
        }
        if(logDetails.companyOrg) {
            prompt += `Company: ${logDetails.companyOrg}\n`;
        }
        prompt += `Timestamp: ${new Date().toISOString()}`;

        const payload = {
            model: modelName,
            prompt: prompt,
            stream: false // We want the full response, not a stream
        };

        const response = await axios.post(ollamaUrl, payload, {
             timeout: 15000 // Set a timeout (e.g., 15 seconds)
        });
        
        // Log the response from Ollama
        console.log('[Ollama Log] Received response:', JSON.stringify(response.data, null, 2));
        // You might want to log only specific parts like response.data.response
        // console.log('[Ollama Log] Model response text:', response.data.response);

    } catch (error) {
        console.error(`[Ollama Log] Failed to send log to Ollama:`, error.message);
        // Log more details if available (e.g., response error)
        if (error.response) {
            console.error('[Ollama Log] Ollama Error Response Data:', error.response.data);
            console.error('[Ollama Log] Ollama Error Response Status:', error.response.status);
        } else if (error.request) {
            console.error('[Ollama Log] Ollama No Response Received:', error.request);
        } else {
            console.error('[Ollama Log] Ollama Request Setup Error:', error.message);
        }
    }
    // This function runs asynchronously and doesn't return anything to the main flow
}

// --- Helper Function: Update Statistics Count in CouchDB ---
// Add companyName as the third argument
async function updateStatsCount(companyOrg, countType, companyName) {
    if (!statsCouch) {
        console.warn(`[Stats Update] Cannot update stats, statsCouch client is not initialized.`);
        return;
    }
    // Validate companyOrg (ID)
    if (!companyOrg || typeof companyOrg !== 'string') {
        console.warn(`[Stats Update] Invalid companyOrg (ID: '${companyOrg}') provided. Cannot update stats.`);
        return;
    }
    // Validate companyName
    if (!companyName || typeof companyName !== 'string') {
        console.warn(`[Stats Update] Invalid companyName ('${companyName}') provided for ID ${companyOrg}. Cannot update stats.`);
        return;
    }
    if (countType !== 'success' && countType !== 'fail') {
         console.warn(`[Stats Update] Invalid countType ('${countType}') provided. Use 'success' or 'fail'.`);
        return;
    }

    // ** Generate DB name using stats_{id}_{name} format **
    // Sanitize companyOrg (ID)
    const sanitizedCompanyId = companyOrg.toLowerCase().replace(/[^a-z0-9_$()+-/]/g, '_');
    // Sanitize companyName 
    const sanitizedCompanyName = companyName.toLowerCase().replace(/[^a-z0-9_$()+-/]/g, '_');
    // Combine with prefix
    const dbName = `stats_${sanitizedCompanyId}_${sanitizedCompanyName}`;
    const docId = 'counts';
    let db;

    console.log(`[Stats Update] Attempting to update '${countType}' count for company '${companyName}' (ID: ${companyOrg}) in DB '${dbName}'`);

    try {
        // 1. Ensure Database Exists
        try {
            await statsCouch.db.create(dbName);
            console.log(`[Stats Update] Created statistics database: ${dbName}`);
        } catch (err) {
            if (err.statusCode === 412) {
                // Database already exists, which is fine
                console.log(`[Stats Update] Statistics database '${dbName}' already exists.`);
            } else {
                // Other error creating/accessing DB
                throw new Error(`Failed to create/access stats DB '${dbName}': ${err.message || err.statusCode}`);
            }
        }
        
        // Use the database
        db = statsCouch.db.use(dbName);

        // 2. Get or Create the Counts Document (with retries for conflicts)
        let currentDoc = null;
        let updated = false;
        for (let i = 0; i < 3; i++) { // Retry up to 3 times on conflict
            try {
                currentDoc = await db.get(docId);
                console.log(`[Stats Update] Found existing counts doc for DB ${dbName}:`, currentDoc);
            } catch (err) {
                if (err.statusCode === 404) {
                    console.log(`[Stats Update] No counts doc found for DB ${dbName}. Creating new one.`);
                    currentDoc = { _id: docId, success: 0, fail: 0 }; // Create base doc
                } else {
                    throw new Error(`Failed to get counts doc '${docId}' from '${dbName}': ${err.message || err.statusCode}`);
                }
            }

            // 3. Increment the specific counter
            currentDoc[countType] = (currentDoc[countType] || 0) + 1;

            // 4. Insert/Update the document
            try {
                const insertResponse = await db.insert(currentDoc);
                if (insertResponse.ok) {
                    console.log(`[Stats Update] Successfully updated ${countType} count for DB ${dbName} to ${currentDoc[countType]}. Rev: ${insertResponse.rev}`);
                    updated = true;
                    break; // Success, exit retry loop
                } else {
                     throw new Error('CouchDB insert reported not ok.');
                }
            } catch (insertErr) {
                if (insertErr.statusCode === 409 && i < 2) {
                    console.warn(`[Stats Update] Conflict (409) updating counts for DB ${dbName}. Retrying (${i + 1})...`);
                    await new Promise(resolve => setTimeout(resolve, 50)); // Small delay before retry
                } else {
                    throw new Error(`Failed to insert/update counts doc for DB ${dbName} after ${i+1} attempts: ${insertErr.message || insertErr.statusCode}`);
                }
            }
        } // End retry loop

        if (!updated) {
             console.error(`[Stats Update] Failed to update count for DB ${dbName} after multiple retries.`);
        }

    } catch (error) {
        console.error(`[Stats Update] Error updating statistics for company '${companyName}' (ID: ${companyOrg}) in DB '${dbName}':`, error);
    }
}

// --- Separate CouchDB Configuration for Users --- 
// ***** IMPORTANT: Replace placeholders with your actual CouchDB connection details *****
// ***** Consider using environment variables for security                      *****
const couchDbUrl = process.env.USERS_COUCHDB_URL || 'http://admin:password@localhost:5984'; // Example: Include user/pass if needed
const usersDbName = process.env.USERS_COUCHDB_NAME || 'users'; 
let usersDb;

try {
    console.log(`Attempting to connect Nano to CouchDB URL: ${couchDbUrl.replace(/^(http:\/\/)([^:]+):([^@]+)@/, '$1$2:****@')} `); // Obfuscate pw
    const couch = nano(couchDbUrl);
    console.log(`Attempting to use CouchDB database: "${usersDbName}"`);
    usersDb = couch.db.use(usersDbName); // Use the specified database
    // Check if DB exists, optional: create if not
    couch.db.get(usersDbName, (err) => {
        if (err && err.statusCode === 404) {
            console.warn(`CouchDB database "${usersDbName}" does not exist. Creating...`);
            couch.db.create(usersDbName, (createErr) => {
                if (createErr && createErr.statusCode !== 412) { // 412 = already exists (race condition)
                    console.error(`FATAL: Could not create users CouchDB database "${usersDbName}":`, createErr);
        process.exit(1);
                } else {
                    console.log(`Users CouchDB database "${usersDbName}" created or already exists.`);
                }
            });
        } else if (err) {
            console.error(`FATAL: Error connecting to users CouchDB database "${usersDbName}":`, err);
            process.exit(1); 
        } else {
             console.log(`Successfully connected to users CouchDB database: "${usersDbName}"`);
        }
        // --- Ensure Default Admin User Exists ---
        const adminEmail = 'admin@gmail.com';
        const adminPassword = 'works1234'; // Store securely, e.g., env var
        const saltRounds = 10;

        usersDb.get(adminEmail, async (err, body) => {
            if (err && err.statusCode === 404) {
                console.log(`Admin user '${adminEmail}' not found. Creating...`);
                try {
                    const hashedPassword = await bcrypt.hash(adminPassword, saltRounds);
                    const adminDoc = {
                        _id: adminEmail,
                        type: 'user',
                        role: 'admin', // Add role field
                        email: adminEmail,
                        companyName: 'Administrator', // Default name for admin
                        hashedPassword: hashedPassword,
                        registeredAt: new Date().toISOString(),
                        isActive: true // ** Set default admin to active on creation **
                    };
                    await usersDb.insert(adminDoc);
                    console.log(`Admin user '${adminEmail}' created successfully.`);
                } catch (hashOrInsertError) {
                    console.error(`FATAL: Failed to create admin user '${adminEmail}':`, hashOrInsertError);
                    // Decide if server should exit or just log error
                    // process.exit(1); 
                }
            } else if (err) {
                console.error(`Error checking for admin user '${adminEmail}':`, err);
                // Decide if server should exit or just log error
            } else {
                console.log(`Admin user '${adminEmail}' already exists.`);
                // ** Add check: If admin exists but is not active, activate it **
                if (body.isActive !== true) {
                    console.warn(`Admin user '${adminEmail}' exists but is not active. Activating...`);
                    try {
                        body.isActive = true; // Set isActive to true on the fetched document
                        // We need the _rev from the body to update
                        await usersDb.insert(body);
                        console.log(`Admin user '${adminEmail}' activated successfully.`);
                    } catch (updateError) {
                        console.error(`FATAL: Failed to activate existing admin user '${adminEmail}':`, updateError);
                        // Decide if server should exit or just log error
                        // process.exit(1);
                    }
                } else {
                     console.log(`Admin user '${adminEmail}' is already active.`);
                }
            }
        });
        // --- End Admin User Check ---
    });
} catch (error) {
    console.error("FATAL: Failed to initialize CouchDB connection for users:", error);
    process.exit(1);
}

// --- NEW: Separate CouchDB Configuration for Statistics (General Instance) ---
// Uses a general URL, similar to the users DB configuration.
// Define this in your .env file or environment variables.
const statsDbUrl = process.env.STATS_COUCHDB_URL || process.env.USERS_COUCHDB_URL || 'http://admin:password@localhost:5984'; // Fallback to user DB URL if stats not set
console.log(`[Stats DB] Using statistics CouchDB URL: ${statsDbUrl}`);
let statsCouch; // Nano instance for statistics

try {
    console.log(`Attempting to connect Nano to Statistics CouchDB URL: ${statsDbUrl.replace(/^(http:\/\/)([^:]+):([^@]+)@/, '$1$2:****@')} `); 
    statsCouch = nano(statsDbUrl);
    // Optional: Verify connection by pinging or getting DB list.
    // Example: await statsCouch.db.list(); 
    console.log("Successfully initialized Nano client for General Statistics CouchDB.");
} catch (error) {
    console.error("FATAL: Failed to initialize Nano client for General Statistics CouchDB:", error);
    statsCouch = null; // Ensure it's null on failure
    console.error("Statistics functionality will be unavailable. Check STATS_COUCHDB_URL.");
    // Decide if you want to exit or continue without stats functionality
    // process.exit(1); 
}
// --- End NEW Statistics CouchDB Configuration ---

// --- Email Sending Helper Function ---
async function sendEmail(to, subject, textBody) {
    const mailOptions = {
        from: '"Authenticity Search" <YOUR_EMAIL_ADDRESS>', // Sender address - ** REPLACE YOUR_EMAIL_ADDRESS **
        to: to, // List of receivers
        subject: subject, // Subject line
        text: textBody, // Plain text body
        // html: "<b>Hello world?</b>", // You can add HTML body as well
    };

    try {
        let info = await transporter.sendMail(mailOptions);
        console.log(`Email sent successfully to ${to}: ${info.messageId}`);
        return info; // Return info object on success
    } catch (error) {
        console.error(`Error sending email to ${to}:`, error);
        // Don't throw error here, just log it, so API call doesn't fail if email fails
        // throw error; // Re-throw if you want the API call to fail on email error
    }
}

// --- Authentication Middleware ---
// Assumes the frontend sends the user's email in the 'X-User-Email' header
async function authenticateUser(req, res, next) {
    const userEmail = req.headers['x-user-email']; // Case-insensitive headers
    console.log(`[Auth Middleware] Checking header X-User-Email: ${userEmail}`);

    if (!userEmail) {
        console.log('[Auth Middleware] Failed: Missing X-User-Email header.');
        return res.status(401).json({ error: 'Authentication required: Missing user identifier header.' });
    }

    try {
        // Fetch user document from CouchDB using callback style + promise
        const userDoc = await new Promise((resolve, reject) => {
            console.log(`[Auth Middleware CB] Attempting usersDb.get('${userEmail}') with callback...`);
            usersDb.get(userEmail, (err, body) => {
                if (err) {
                    console.log(`[Auth Middleware CB] usersDb.get FAILED. Status: ${err.statusCode}, Msg: ${err.message}`);
                    if (err.statusCode === 404) {
                        resolve(null); // User not found
                    } else {
                        reject(new Error('Database error during authentication.'));
                    }
                } else {
                    console.log(`[Auth Middleware CB] usersDb.get SUCCEEDED.`);
                    resolve(body); // User found
                }
            });
        });

        if (!userDoc) {
            console.log(`[Auth Middleware] Failed: User '${userEmail}' not found.`);
            return res.status(401).json({ error: 'Authentication failed: User not found.' });
        }

        if (userDoc.isActive !== true) {
            console.log(`[Auth Middleware] Failed: User '${userEmail}' is inactive.`);
            return res.status(403).json({ error: 'Forbidden: Account is inactive.' });
        }
        
        // Attach user info to the request object for later use
        req.user = {
            email: userDoc.email,
            companyName: userDoc.companyName, // Crucial for associating items
            role: userDoc.role 
        };
        console.log(`[Auth Middleware] Success: User '${userEmail}' authenticated. Role: ${req.user.role}`);
        next(); // Proceed to the next middleware or route handler

    } catch (error) {
        console.error(`[Auth Middleware] Error during authentication for ${userEmail}:`, error);
        return res.status(500).json({ error: 'Internal server error during authentication.' });
    }
}
// --- End Authentication Middleware ---

// --- Multer Setup (for file uploads) ---
// Store files in memory for processing, adjust if handling very large files
const storage = multer.memoryStorage(); 
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // Example: Limit file size to 10MB
    fileFilter: (req, file, cb) => {
        // Accept only specific file types
        const allowedTypes = ['text/plain', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/xml', 'application/xml'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            console.log(`[Upload Filter] Rejected file type: ${file.mimetype}`);
            cb(new Error(`Invalid file type. Only TXT, XML, XLS, XLSX allowed. Detected: ${file.mimetype}`), false);
        }
    }
});

// <<< NEW: GeoIP Function using ip-api.com >>>
async function getGeoLocation(req) {
    // 1. Attempt to get initial IP from request
    let initialIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress;
    if (initialIp && initialIp.includes(',')) {
        initialIp = initialIp.split(',')[0].trim(); 
    }
    if (initialIp && initialIp.startsWith('::ffff:')) {
        initialIp = initialIp.substring(7);
    }
    console.log(`[GeoIP] Initial IP detected: ${initialIp}`);

    // 2. Define function to check if IP is private
    const isPrivateIP = (ipToCheck) => {
        if (!ipToCheck) return true;
        if (ipToCheck === '127.0.0.1' || ipToCheck === '::1') return true;
        if (/^(?:10|127)\.(?:\d{1,3}\.){2}\d{1,3}$/.test(ipToCheck)) return true;
        if (/^192\.168\.(?:\d{1,3}\.){1}\d{1,3}$/.test(ipToCheck)) return true;
        if (/^172\.(?:1[6-9]|2\d|3[0-1])\.(?:\d{1,3}\.){1}\d{1,3}$/.test(ipToCheck)) return true;
        if (ipToCheck.startsWith('fe80:')) return true; 
        if (ipToCheck.startsWith('fc00:') || ipToCheck.startsWith('fd00:')) return true;
        return false;
    };

    let ipToLookup; // This will hold the public IP we use for the final lookup

    // 3. Determine the IP to use for the location lookup
    if (isPrivateIP(initialIp)) {
        console.log(`[GeoIP] Initial IP (${initialIp}) is local/private. Attempting to fetch public IP from external service...`);
        try {
            const publicIpResponse = await axios.get('https://api.ipify.org?format=json', { timeout: 1500 }); // Short timeout for public IP fetch
            if (publicIpResponse.data && publicIpResponse.data.ip && !isPrivateIP(publicIpResponse.data.ip)) {
                ipToLookup = publicIpResponse.data.ip;
                console.log(`[GeoIP] Fetched public IP successfully: ${ipToLookup}`);
            } else {
                console.warn(`[GeoIP] Failed to fetch a valid public IP from ipify. Response:`, publicIpResponse.data);
                return "Unknown"; // Cannot proceed without a valid public IP
            }
        } catch (publicIpError) {
            console.error('[GeoIP] Error fetching public IP from ipify:', publicIpError.message);
            return "Unknown"; // Cannot proceed if public IP fetch fails
        }
    } else {
        // Initial IP is likely public, use it directly
        ipToLookup = initialIp;
        console.log(`[GeoIP] Initial IP (${initialIp}) appears public. Using it for location lookup.`);
    }

    // 4. Perform location lookup using the determined public IP (ipToLookup)
    // Request country name field
    const apiUrl = `http://ip-api.com/json/${ipToLookup}?fields=status,message,country`; 
    console.log(`[GeoIP] Calling ip-api.com with IP: ${ipToLookup} to get country`);

    try {
        const response = await axios.get(apiUrl, { timeout: 2000 }); // Timeout for geo lookup
        const data = response.data;
        
        // Check for success and the country field
        if (data && data.status === 'success' && data.country) {
            const countryName = data.country; 
            console.log(`[GeoIP] Location lookup successful for ${ipToLookup}. Country: ${countryName}`);
            return countryName; // Return only the country name
        } else {
             // Log failure or missing country field
             console.warn(`[GeoIP] ip-api.com lookup failed or missing country data for ${ipToLookup}. Status: ${data?.status}, Message: ${data?.message}, Data:`, data);
             return "Unknown";
        }
    } catch (error) {
        console.error(`[GeoIP] Error during ip-api.com call for ${ipToLookup}:`, error.message);
        if (error.response) {
             console.error(`[GeoIP] ip-api.com Error Response: ${error.response.status} ${error.response.statusText}`);
        }
        return "Unknown"; // Return Unknown on error
    }
}
// <<< END GeoIP Function >>>

// --- Helper Function: Log Check Event to CouchDB ---
async function logCheckEvent(companyId, companyName, serialNumber, result, location) {
    if (!statsCouch) {
        console.warn(`[Stats Log] Cannot log check event, statsCouch client is not initialized.`);
        return;
    }
    if (!companyId || !companyName || !serialNumber || !result) {
        console.warn(`[Stats Log] Missing required data for logging event:`, { companyId, companyName, serialNumber, result });
            return;
        }

    // Construct DB name using stats_{id}_{name} format
    const sanitizedCompanyId = String(companyId).toLowerCase().replace(/[^a-z0-9_$()+-/]/g, '_');
    const sanitizedCompanyName = String(companyName).toLowerCase().replace(/[^a-z0-9_$()+-/]/g, '_');
    const dbName = `stats_${sanitizedCompanyId}_${sanitizedCompanyName}`;
    let db;

    console.log(`[Stats Log] Attempting to log '${result}' event for company '${companyName}' (ID: ${companyId}) in DB '${dbName}'`);

    try {
        // 1. Ensure Database Exists
        try {
            await statsCouch.db.create(dbName);
            console.log(`[Stats Log] Created statistics database: ${dbName}`);
            // <<< NEW: Define Indexes after creating DB >>>
            try {
                await statsCouch.db.use(dbName).index({
                    index: { fields: ['timestamp'] },
                    name: 'timestamp-idx',
                    type: 'json'
                });
                await statsCouch.db.use(dbName).index({
                    index: { fields: ['location'] },
                    name: 'location-idx',
                    type: 'json'
                });
                 await statsCouch.db.use(dbName).index({
                    index: { fields: ['result'] },
                    name: 'result-idx',
                    type: 'json'
                });
                console.log(`[Stats Log] Created default indexes in ${dbName}`);
            } catch (indexErr) {
                 // Ignore index already exists error (code varies)
                if (indexErr.statusCode !== 409 && !indexErr.message.includes('exists')) {
                    console.error(`[Stats Log] Error creating indexes in ${dbName}:`, indexErr);
                } else {
                    console.log(`[Stats Log] Indexes likely already exist in ${dbName}.`);
                }
            }
            // <<< END Index Definition >>>
        } catch (err) {
            if (err.statusCode === 412) {
                console.log(`[Stats Log] Statistics database '${dbName}' already exists.`);
            } else {
                throw new Error(`Failed to create/access stats DB '${dbName}': ${err.message || err.statusCode}`);
            }
        }
        
        // Use the database
        db = statsCouch.db.use(dbName);

        // 2. Create the log document
        const timestamp = new Date().toISOString();
        const doc = {
            _id: `check_${timestamp}_${Math.random().toString(36).substring(2, 8)}`, // Unique ID
            type: 'check_log',
            timestamp: timestamp,
            companyId: companyId,
            companyName: sanitizedCompanyName, // Store sanitized name
            serialNumber: serialNumber,
            result: result, // 'success' or 'fail'
            location: location || "Unknown" // Use provided location or default
        };

        // 3. Insert the document
        const insertResponse = await db.insert(doc);
        if (insertResponse.ok) {
            console.log(`[Stats Log] Successfully logged event to DB ${dbName}. Doc ID: ${insertResponse.id}`);
        } else {
             throw new Error('CouchDB insert reported not ok.');
        }

    } catch (error) {
        console.error(`[Stats Log] Error logging check event for company '${companyName}' (ID: ${companyId}) in DB '${dbName}':`, error);
    }
}
// --- End Log Check Event ---

app.get('/api/queryStoreItem', async function (req, res) {
    const serialNumber = req.query.item_serial_number;
    const companyOrgForStats = req.query.company_org; // This is the 4-digit ID
    const userEmailHeader = req.headers['x-user-email']; 
    const isLikelyLoggedIn = !!userEmailHeader; 

    console.log(`GET /api/queryStoreItem?item_serial_number=${serialNumber}&company_org=${companyOrgForStats}. LoggedIn: ${isLikelyLoggedIn}`);
    
    // <<< Get Geo Location >>>
    const location = await getGeoLocation(req);
    console.log(`[GeoIP Result] Location determined as: ${location}`);
    // <<< End Geo Location >>>

    let gateway;
    try {
        const { gateway: connectedGateway, contract } = await getContract();
        gateway = connectedGateway; 

        console.log('--> Evaluate Transaction: queryStoreItem', serialNumber);
        const resultBytes = await contract.evaluateTransaction('queryStoreItem', serialNumber);
        const resultString = resultBytes.toString();
        console.log(`*** Result: ${resultString}`);

        // --- Statistics & Logging Logic (Success Path) ---
        if (!isLikelyLoggedIn) {
            if (companyOrgForStats) {
                // <<< Check if company exists AND get name >>>
                try {
                    const findQuery = {
                        selector: { type: 'user', companyId: companyOrgForStats },
                        fields: ['_id', 'companyName'], 
                        limit: 1 
                    };
                    console.log(`[Stats Check] Querying usersDb for companyId: ${companyOrgForStats}`);
                    const findResult = await usersDb.find(findQuery);
                    
                    if (findResult && findResult.docs && findResult.docs.length > 0) {
                        const companyNameForStats = findResult.docs[0].companyName; 
                        console.log(`[Stats Check] Found registered company '${companyNameForStats}' with ID ${companyOrgForStats}. Proceeding with SUCCESS event log.`);
                        // <<< Call NEW log function >>>
                        logCheckEvent(companyOrgForStats, companyNameForStats, serialNumber, 'success', location);
                        // <<< Remove old Ollama log here, combine if needed >>>
                    } else {
                        console.log(`[Stats Check] No registered company found with ID ${companyOrgForStats}. Skipping statistics log.`);
                        // Optionally log this specific outcome differently
                        // logToOllama(...);
                    }
                } catch (dbError) {
                     console.error(`[Stats Check] Error querying usersDb for companyId ${companyOrgForStats}:`, dbError);
                     // Optionally log this specific outcome differently
                     // logToOllama(...);
                }
                // <<< End Check >>>
            } else {
                 console.warn(`[Stats/Log] Missing company_org query parameter for successful anonymous search of ${serialNumber}. Cannot check/log stats.`);
                 // Optionally log this specific outcome differently
                 // logToOllama(...);
            }
        } else {
             console.log('[Stats/Log] Skipping statistics log for logged-in user success.');
             // Optionally log logged-in activity differently
             // logToOllama(...);
        }
        // --- End Statistics & Logging Logic ---

        res.status(200).json({ response: resultString }); 

    } catch (error) { // Catch Chaincode errors
        const errorMessage = error.toString(); 
        console.error(`Failed to evaluate transaction queryStoreItem for ${serialNumber}: ${errorMessage}`);
        
        // --- Statistics & Logging Logic for Failure ---
        if (!isLikelyLoggedIn) { 
            if (companyOrgForStats) {
                 // <<< Check if company exists AND get name for FAIL stats >>>
                 try {
                    const findQuery = {
                        selector: { type: 'user', companyId: companyOrgForStats },
                        fields: ['_id', 'companyName'], 
                        limit: 1 
                    };
                    console.log(`[Stats Check - Fail] Querying usersDb for companyId: ${companyOrgForStats}`);
                    const findResult = await usersDb.find(findQuery);
                    
                    if (findResult && findResult.docs && findResult.docs.length > 0) {
                         const companyNameForStats = findResult.docs[0].companyName;
                        console.log(`[Stats Check - Fail] Found registered company '${companyNameForStats}' with ID ${companyOrgForStats}. Proceeding with FAIL event log.`);
                        // <<< Call NEW log function >>>
                        logCheckEvent(companyOrgForStats, companyNameForStats, serialNumber, 'fail', location);
                        // <<< Remove old Ollama log here, combine if needed >>>
                    } else {
                        console.log(`[Stats Check - Fail] No registered company found with ID ${companyOrgForStats}. Skipping FAIL statistics log.`);
                        // Optionally log this specific outcome differently
                        // logToOllama(...);
                    }
                } catch (dbError) {
                     console.error(`[Stats Check - Fail] Error querying usersDb for companyId ${companyOrgForStats}:`, dbError);
                     // Optionally log this specific outcome differently
                     // logToOllama(...);
                }
                 // <<< End Check >>>
            } else {
                 console.warn(`[Stats/Log] Missing company_org query parameter for failed anonymous search of ${serialNumber}. Cannot check/log stats.`);
                 // Optionally log this specific outcome differently
                 // logToOllama(...);
            }
        } else {
             console.log('[Stats/Log] Skipping statistics log for logged-in user failure.');
             // Optionally log logged-in activity differently
             // logToOllama(...);
        }
        // --- End Statistics & Logging Logic for Failure ---

        let userErrorMessage = errorMessage;
        // ... (rest of error parsing) ...
        res.status(500).json({ error: userErrorMessage });
    } finally {
        if (gateway) {
        await gateway.disconnect();
            console.log('Disconnected from gateway.');
        }
    }
});

app.get('/api/queryAllItems', async function (req, res) {
     console.log(`GET /api/queryAllItems`);
    let gateway;
    try {
        const { gateway: connectedGateway, contract } = await getContract();
        gateway = connectedGateway;

        console.log('--> Evaluate Transaction: queryAllItems');
        const result = await contract.evaluateTransaction('queryAllItems');
        console.log(`*** Result: ${result.toString()}`);
        // Assuming queryAllItems returns a JSON array string
        res.status(200).json({ response: result.toString() });

    } catch (error) {
        console.error(`Failed to evaluate transaction queryAllItems: ${error}`);
        res.status(500).json({ error: error.toString() });
    } finally {
        if (gateway) {
            await gateway.disconnect();
            console.log('Disconnected from gateway.');
        }
    }
});

app.post('/api/admin/createStoreItem', async function (req, res) {
    console.log(`POST /api/admin/createStoreItem with query:`, req.query);
    let gateway;
    try {
        const { gateway: connectedGateway, contract } = await getContract();
        gateway = connectedGateway;

        // Data from query parameters (Consider changing to request body for POST)
        const { company_org, item_type, item_name, item_serial_number } = req.query;
        if (!company_org || !item_type || !item_name || !item_serial_number) {
            return res.status(400).json({ error: "Missing required query parameters for creating item." });
        }

        console.log('--> Submit Transaction: createStoreItem');
        await contract.submitTransaction('createStoreItem', company_org, item_type, item_name, item_serial_number);
        console.log('*** Transaction submitted successfully');
        res.status(201).send('Transaction createStoreItem has been submitted');

    } catch (error) {
        console.error(`Failed to submit transaction createStoreItem: ${error}`);
        res.status(500).json({ error: error.toString() });
    } finally {
        if (gateway) {
            await gateway.disconnect();
            console.log('Disconnected from gateway.');
        }
    }
});

app.put('/api/admin/changeItemOwner', async function (req, res) {
    console.log(`PUT /api/admin/changeItemOwner with query:`, req.query);
    let gateway;
    try {
        const { gateway: connectedGateway, contract } = await getContract();
        gateway = connectedGateway;

        // Data from query parameters (Consider changing to request body for PUT)
        const { item_serial_number, item_new_company_org } = req.query;
         if (!item_serial_number || !item_new_company_org) {
            return res.status(400).json({ error: "Missing required query parameters for changing owner." });
        }

        console.log('--> Submit Transaction: changeItemOwner');
        // Assuming args are: serial number, new owner
        await contract.submitTransaction('changeItemOwner', item_serial_number, item_new_company_org);
        console.log('*** Transaction submitted successfully');
        res.send('Transaction changeItemOwner has been submitted');

    } catch (error) {
        console.error(`Failed to submit transaction changeItemOwner: ${error}`);
         res.status(500).json({ error: error.toString() });
    } finally {
        if (gateway) {
        await gateway.disconnect();
            console.log('Disconnected from gateway.');
        }
    }
});

// --- NEW: Admin Endpoint to Get All Companies ---
app.get('/api/admin/companies', authenticateUser, async function (req, res) {
    console.log(`GET /api/admin/companies requested by user: ${req.user?.email}`);

    // 1. Check if user is admin
    if (!req.user || req.user.role !== 'admin') {
        console.warn(`[Get Companies] Unauthorized attempt by non-admin user: ${req.user?.email}`);
        return res.status(403).json({ error: 'Forbidden: Admin privileges required.' });
    }

    // 2. Query CouchDB for all user documents
    try {
        console.log('[Get Companies] Querying usersDb for all documents with type:user');
        const query = {
            selector: { type: 'user' },
            // Specify fields to return - EXCLUDE hashedPassword
            fields: [
                '_id', 
                'email',
                'companyName',
                'companyId',
                'role',
                'registeredAt',
                'isActive'
            ],
            limit: 1000 // Add a reasonable limit
        };
        const result = await usersDb.find(query);

        if (!result || !result.docs) {
             console.error('[Get Companies] Invalid response from usersDb.find');
             throw new Error('Failed to retrieve company list from database.');
        }
        
        const companies = result.docs;
        console.log(`[Get Companies] Found ${companies.length} company/user documents.`);

        // 3. Send the list as JSON
        res.status(200).json(companies);

    } catch (error) {
        console.error('[Get Companies] Error fetching company list:', error);
        res.status(500).json({ error: `Internal server error retrieving company list: ${error.message}` });
    }
});

// --- NEW: Admin Endpoint to Update Company Active Status ---
app.put('/api/admin/companies/:email/status', authenticateUser, async function (req, res) {
    const targetEmail = req.params.email;
    const { isActive } = req.body;

    console.log(`PUT /api/admin/companies/${targetEmail}/status requested by ${req.user?.email}. New status: ${isActive}`);

    // 1. Check if requester is admin
    if (!req.user || req.user.role !== 'admin') {
        console.warn(`[Update Status] Unauthorized attempt by non-admin user: ${req.user?.email}`);
        return res.status(403).json({ error: 'Forbidden: Admin privileges required.' });
    }

    // 2. Validate input
    if (typeof isActive !== 'boolean') {
        console.warn(`[Update Status] Invalid 'isActive' value in request body:`, req.body);
        return res.status(400).json({ error: 'Invalid request body: isActive must be true or false.' });
    }
    if (!targetEmail) {
         return res.status(400).json({ error: 'Missing target email in URL path.' });
    }
    // Prevent admin from deactivating itself (optional but recommended)
    if (targetEmail === 'admin@gmail.com' && isActive === false) {
        console.warn(`[Update Status] Attempt to deactivate admin account denied.`);
        return res.status(403).json({ error: 'Forbidden: Cannot deactivate the primary admin account.' });
    }

    // 3. Fetch the target user document from CouchDB
    try {
        console.log(`[Update Status] Fetching user document for ${targetEmail}...`);
        const userDoc = await usersDb.get(targetEmail);

        // 4. Update the isActive status
        userDoc.isActive = isActive;
        console.log(`[Update Status] Document for ${targetEmail} fetched. Setting isActive to ${isActive}. Current revision: ${userDoc._rev}`);

        // 5. Save the updated document back to CouchDB
        // The userDoc object already contains the necessary _id and _rev
        const updateResponse = await usersDb.insert(userDoc);
        
        if (!updateResponse.ok) {
            // This case might not happen often with nano if insert doesn't throw, but good to check
            console.error(`[Update Status] CouchDB insert reported not ok for ${targetEmail}. Response:`, updateResponse);
            throw new Error('Database update failed.');
        }

        console.log(`[Update Status] Successfully updated status for ${targetEmail}. New revision: ${updateResponse.rev}`);
        
        // 6. Prepare and send back the updated user info (excluding password)
        const updatedCompanyInfo = {
            _id: userDoc._id,
            email: userDoc.email,
            companyName: userDoc.companyName,
            companyId: userDoc.companyId,
            role: userDoc.role,
            registeredAt: userDoc.registeredAt,
            isActive: userDoc.isActive // Reflect the new status
        };
        
        res.status(200).json(updatedCompanyInfo);

    } catch (error) {
        console.error(`[Update Status] Error processing status update for ${targetEmail}:`, error);
        if (error.statusCode === 404) {
            res.status(404).json({ error: `User not found: ${targetEmail}` });
        } else if (error.statusCode === 409) {
            res.status(409).json({ error: 'Conflict updating user status. Please refresh and try again.' });
        } else {
            res.status(500).json({ error: `Internal server error updating user status: ${error.message}` });
        }
    }
});

// --- NEW: Admin Endpoint to Delete a Company ---
app.delete('/api/admin/companies/:email', authenticateUser, async function (req, res) {
    const targetEmail = req.params.email;
    console.log(`DELETE /api/admin/companies/${targetEmail} requested by ${req.user?.email}`);

    // 1. Check if requester is admin
    if (!req.user || req.user.role !== 'admin') {
        console.warn(`[Delete Company] Unauthorized attempt by non-admin user: ${req.user?.email}`);
        return res.status(403).json({ error: 'Forbidden: Admin privileges required.' });
    }

    // 2. Prevent deleting the primary admin account
    if (targetEmail === 'admin@gmail.com') {
        console.warn(`[Delete Company] Attempt to delete primary admin account denied.`);
        return res.status(403).json({ error: 'Forbidden: Cannot delete the primary admin account.' });
    }

    // 3. Fetch the target user document to get the current revision (_rev)
    try {
        console.log(`[Delete Company] Fetching user document for ${targetEmail} to get revision...`);
        const userDoc = await usersDb.get(targetEmail);
        const docId = userDoc._id; // Should be the same as targetEmail
        const docRev = userDoc._rev;

        console.log(`[Delete Company] Found document for ${targetEmail}. ID: ${docId}, Rev: ${docRev}. Proceeding with deletion...`);

        // 4. Delete the document using ID and revision
        const deleteResponse = await usersDb.destroy(docId, docRev);

        if (!deleteResponse.ok) {
            console.error(`[Delete Company] CouchDB destroy reported not ok for ${targetEmail}. Response:`, deleteResponse);
            throw new Error('Database deletion failed.');
        }

        console.log(`[Delete Company] Successfully deleted company ${targetEmail}.`);
        
        // TODO: Optional - Trigger deletion of associated items/stats if necessary
        // This might involve complex logic depending on how items are linked.
        // For now, we just delete the user record.

        // 5. Send success response (204 No Content is standard for DELETE)
        res.status(204).send(); 

    } catch (error) {
        console.error(`[Delete Company] Error processing deletion for ${targetEmail}:`, error);
        if (error.statusCode === 404) {
            res.status(404).json({ error: `User not found: ${targetEmail}` });
        } else if (error.statusCode === 409) {
            // This might happen if the document was updated between fetch and delete
            res.status(409).json({ error: 'Conflict deleting user. Please refresh and try again.' });
        } else {
            res.status(500).json({ error: `Internal server error deleting user: ${error.message}` });
        }
    }
});
// --- End Admin Delete Company Endpoint ---

// --- NEW: Endpoint to Proxy Gemini AI Analysis for Stats ---
app.post('/api/analyze-stats', authenticateUser, async function (req, res) {
    const statsData = req.body; // { successCount, failCount, locationData: [{country, count}, ...] }
    const requesterEmail = req.user?.email;
    console.log(`POST /api/analyze-stats requested by ${requesterEmail}`);

    // 1. Validate Input Data from Frontend
    if (!statsData || typeof statsData.successCount === 'undefined' || typeof statsData.failCount === 'undefined' || !Array.isArray(statsData.locationData)) {
        console.warn('[AI Analyze] Invalid stats data received from frontend:', statsData);
        return res.status(400).json({ error: 'Invalid or incomplete statistics data provided.' });
    }

    // 2. Get API Key from Environment
    const apiKey = process.env.AI_SECRET_KEY;
    if (!apiKey) {
        console.error('[AI Analyze] AI_SECRET_KEY is not set in the environment variables.');
        return res.status(500).json({ error: 'AI Analysis configuration error on server.' });
    }

    // 3. Construct the Prompt
    let locationText = 'Top 5 Locations:\n';
    if (statsData.locationData.length > 0) {
        const totalLocationChecks = statsData.locationData.reduce((sum, loc) => sum + loc.count, 0);
        statsData.locationData.forEach(loc => {
            const percentage = totalLocationChecks > 0 ? ((loc.count / totalLocationChecks) * 100).toFixed(1) : 0;
            // ** Use template literal or escape newline properly **
            locationText += `- ${loc.country}: ${loc.count} checks (${percentage}%)\n`; 
        });
    } else {
        locationText += '- No location data available.\n';
    }

    // ** Use template literal for the main prompt for easier multi-line handling **
    const prompt = `These are our stats for this month about product authenticity checks:
- Successful checks: ${statsData.successCount}
- Failed checks: ${statsData.failCount}
${locationText}
Analyze this data and provide:
- Key takeaways or patterns
- Actionable suggestions for improvement
- Ideas to encourage more users to check their products with our platform

Be brief and direct. Focus on insights. Format the output clearly, perhaps using bullet points.`; // Ensure backtick closes the template literal

    // ** Simplify logging to avoid potential syntax issues **
    console.log('[AI Analyze] Sending prompt to Gemini...'); 
    // console.log('[AI Analyze] Prompt:\n', prompt); // Optional: Log full prompt if needed for debugging

    // 4. Call Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
    const requestBody = {
        contents: [{
            parts: [{
                text: prompt
            }]
        }]
        // Add generationConfig if needed (e.g., temperature, max output tokens)
        // "generationConfig": {
        //   "temperature": 0.7,
        //   "maxOutputTokens": 500
        // }
    };

    try {
        const geminiResponse = await axios.post(geminiUrl, requestBody, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000 // 30 second timeout for AI generation
        });

        // 5. Extract and Send Response Text
        // The exact path might vary slightly based on Gemini API version, check response structure
        const generatedText = geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!generatedText) {
            console.error('[AI Analyze] Failed to extract generated text from Gemini response:', JSON.stringify(geminiResponse.data, null, 2));
            throw new Error('AI model did not return valid content.');
        }

        console.log('[AI Analyze] Received analysis from Gemini.');
        res.status(200).json({ analysis: generatedText });

    } catch (error) {
        console.error('[AI Analyze] Error calling Gemini API:', error.message);
        let errorStatus = 500;
        let errorMessage = 'Failed to get analysis from AI model.';
        if (error.response) {
            // Error from Gemini API itself
            console.error('[AI Analyze] Gemini API Error Response Data:', JSON.stringify(error.response.data, null, 2));
            console.error('[AI Analyze] Gemini API Error Response Status:', error.response.status);
            errorStatus = error.response.status || 500;
            errorMessage = error.response.data?.error?.message || errorMessage;
        } else if (error.request) {
            // Request made but no response received (e.g., timeout)
             console.error('[AI Analyze] Gemini No Response Received:', error.code);
             errorMessage = 'AI analysis request timed out or failed to connect.';
             errorStatus = 504; // Gateway Timeout
        } else {
            // Setup error
            console.error('[AI Analyze] Gemini Request Setup Error:', error.message);
        }
        res.status(errorStatus).json({ error: errorMessage });
    }
});
// --- End AI Analysis Proxy Endpoint ---

// POST /api/registerCompany (Writes to separate CouchDB)
app.post('/api/registerCompany', async function (req, res) {
    console.log('POST /api/registerCompany -> Separate CouchDB', req.body);
    try {
        // Extract companyId from the request body
        const { email, password, companyName, companyId } = req.body; 

        // Add companyId to the validation check
        if (!email || !password || !companyName || !companyId) {
            return res.status(400).send('Missing required fields: email, password, companyName, companyId');
        }

        // ** Add backend validation for companyId format **
        // if (!/^\\d{4}$/.test(companyId)) {
        //     return res.status(400).send('Invalid Company ID format. Must be exactly 4 digits.');
        // }

        // Check if user already exists using callback style
        await new Promise((resolve, reject) => {
            console.log(`[Register Check CB] Attempting usersDb.get('${email}') with callback...`);
            usersDb.get(email, (err, body) => {
                if (err) {
                    console.log(`[Register Check CB] usersDb.get FAILED. Error Status: ${err.statusCode}, Message: ${err.message}`);
                    if (err.statusCode === 404) {
                        // User does not exist, proceed with registration
                        console.log(`[Register Check CB] Received 404, proceeding with registration for ${email}.`);
                        resolve(); // Resolve the promise to continue registration
                    } else {
                        // Other database error
                        console.error(`[Register Check CB] Non-404 Error checking user existence:`, err);
                        reject(new Error('Database error during registration check.')); // Reject the promise
                    }
                } else {
                    // Document exists! 
                    console.log(`[Register Check CB] usersDb.get SUCCEEDED. Found body:`, JSON.stringify(body, null, 2));
                    console.log(`Registration attempt failed: Email ${email} already exists in CouchDB.`);
                    // ** Cleanup Start **
                    // Send response directly HERE
                    res.status(409).json({ error: `This email is already registered: ${email}` });
                    // Reject the promise with a special error type to signal response was sent
                    reject(new Error('USER_EXISTS_RESPONSE_SENT')); 
                    // ** Cleanup End **
                }
            });
        }).catch(err => {
             // ** Cleanup Start **
             // Handle promise rejection ONLY IF response wasn't already sent
             if (err.message !== 'USER_EXISTS_RESPONSE_SENT') {
                 console.error("[Register Check CB] Promise rejected:", err);
                 // Re-throw to be caught by the main endpoint handler
                 throw err; 
             }
             // If USER_EXISTS_RESPONSE_SENT, do nothing here, response already sent.
             // To stop further execution in the main try block, we still need to throw
             // or structure the code differently (e.g., using return after the promise).
             // Throwing is simpler for now.
             throw err;
             // ** Cleanup End **
        });

        // If the promise resolved (meaning user was not found / 404 error)
        console.log(`[Register Check CB] Promise resolved, continuing registration logic for ${email}...`);

        // Hash the password using bcrypt
        const saltRounds = 10; // Recommended salt rounds
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Create user document for CouchDB
        const userDoc = {
            _id: email, // Use email as the document ID
            type: 'user', // Document type identifier
            email: email,
            companyName: companyName,
            hashedPassword: hashedPassword,
            registeredAt: new Date().toISOString(),
            isActive: false, // Add isActive field, default to false
            companyId: companyId // Add the companyId field
        };

        // Insert the new user document into CouchDB using callback style
        await new Promise((resolve, reject) => {
            console.log(`[Register Insert CB] Attempting usersDb.insert for ${email}...`);
            console.log(`[Register Insert CB] Document: ${JSON.stringify(userDoc)}`); // Log doc being inserted
            usersDb.insert(userDoc, (err, body) => {
                if (err) {
                    console.error(`[Register Insert CB] usersDb.insert FAILED for ${email}:`, err);
                    reject(new Error('Failed to save user data.')); // Reject the promise
                } else {
                    // Insert succeeded
                    console.log(`[Register Insert CB] usersDb.insert SUCCEEDED for ${email}. Body:`, JSON.stringify(body, null, 2));
                    if (!body || !body.ok) { // Add extra check on response body
                         console.error(`[Register Insert CB] usersDb.insert reported success, but body is invalid:`, body);
                         reject(new Error('Failed to save user data, invalid response.'));
                    } else {
                        resolve(body); // Resolve the promise with the success body
                    }
                }
            });
        });

        // If the insert promise resolved successfully:
        console.log(`User ${email} registered successfully in CouchDB.`);
        res.status(201).send(`Company ${companyName} registered successfully for email ${email}`);

    } catch (error) {
        console.error(`Failed during registerCompany process: ${error}`);
        res.status(500).json({ error: error.message || "Failed to register user due to an internal error." });
    }
    // Note: No Fabric gateway connection needed for this endpoint anymore
});

// POST /api/login (Reads from separate CouchDB)
app.post('/api/login', async function (req, res) {
    console.log('POST /api/login -> Separate CouchDB', req.body);
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).send('Missing required fields: email, password');
        }

        // Fetch user document from CouchDB using callback style
        const userDoc = await new Promise((resolve, reject) => {
            console.log(`[Login Check CB] Attempting usersDb.get('${email}') with callback...`);
            usersDb.get(email, (err, body) => {
                if (err) {
                    console.log(`[Login Check CB] usersDb.get FAILED. Error Status: ${err.statusCode}, Message: ${err.message}`);
                    if (err.statusCode === 404) {
                        // User not found - Resolve with null to indicate not found
                        console.log(`[Login Check CB] Received 404, user not found.`);
                        resolve(null);
                    } else {
                        // Other database error
                        console.error(`[Login Check CB] Non-404 Error fetching user:`, err);
                        reject(new Error('Database error during login.')); // Reject the promise
                    }
                } else {
                    // Document found!
                    console.log(`[Login Check CB] usersDb.get SUCCEEDED. Found body:`, JSON.stringify(body, null, 2));
                    resolve(body); // Resolve the promise with the document body
                }
            });
        });

        // Check if the user document was found (promise resolved with null if not found)
        if (!userDoc) {
            console.log(`Login failed: Email ${email} not found in CouchDB.`);
            return res.status(401).send('Authentication failed: Incorrect email or password.');
        }

        // ** Check if user account is active **
        if (userDoc.isActive !== true) {
            console.log(`Login failed: Account for ${email} is not active.`);
            return res.status(403).send('Account not active. Please contact administrator.'); // 403 Forbidden
        }

        // Compare the provided password with the stored hash using bcrypt
        if (!userDoc.hashedPassword) { 
             console.error(`Login failed: User doc for ${email} is missing hashedPassword field.`);
             // Log the invalid structure again just in case
             console.log('Invalid User Document Structure:', JSON.stringify(userDoc, null, 2));
             // Throwing an error here might be better than sending 500 directly
             // to be caught by the main catch block
             return res.status(500).json({ error: 'User data integrity issue.'}); // Keep it simple for now
        }
        
        console.log(`Comparing provided password with stored hash for ${email}`);
        // Assuming bcrypt.compare still works reliably with async/await
        const isPasswordCorrect = await bcrypt.compare(password, userDoc.hashedPassword);

        if (isPasswordCorrect) {
            console.log(`Login successful for email: ${email}`);
            
            // --- Prepare response object --- 
            const companyResponseObject = { 
                email: userDoc.email,
                companyName: userDoc.companyName,
                companyId: userDoc.companyId,
                role: userDoc.role,
                registeredAt: userDoc.registeredAt 
                // DO NOT send hashedPassword
            }; 
            
            // --- Log before sending --- 
            console.log('[Login Response] Raw userDoc from DB:', JSON.stringify(userDoc, null, 2)); // Log the raw DB doc
            console.log('[Login Response] Sending company object:', JSON.stringify(companyResponseObject, null, 2)); // Log the object being sent

            // Send the response
            res.status(200).json({ 
                message: 'Login successful', 
                company: companyResponseObject 
            });
            // ** End Fix ** // (Comment moved)
        } else {
            console.log(`Login failed for email: ${email} - Incorrect password`);
            // ** Throw a standard authentication error instead of file processing error **
            throw new Error('Authentication failed: Incorrect email or password.'); 
        }

    } catch (error) {
        // ** Simplify catch block for login errors **
        console.error(`Error during login for ${email}:`, error);
        // Send specific status codes based on the error message if needed,
        // otherwise send a generic 500 or a more specific auth failure.
        if (error.message.includes('Authentication failed') || error.message.includes('Account not active')) {
             res.status(401).send(error.message); // Use 401 for auth failures
        } else if (error.message.includes('Database error')) {
             res.status(503).send('Service unavailable: Could not verify credentials.'); // 503 for DB issues
        } else {
             res.status(500).send('Internal server error during login.'); // Generic 500
        }
    }
});

// --- NEW Endpoint: Get Public Statistics Counts ---
app.get('/api/public-statistics/:companyName', async function (req, res) {
    const companyName = req.params.companyName;
    // We also need the company ID to construct the correct DB name
    // Let's assume the frontend now sends companyId as a query parameter
    const companyId = req.query.companyId; 
    console.log(`GET /api/public-statistics/${companyName}?companyId=${companyId}`);

    if (!statsCouch) {
        console.error(`[Public Stats] Cannot fetch stats, statsCouch client is not initialized.`);
        return res.status(503).json({ error: 'Statistics service unavailable.' });
    }
    if (!companyName) {
         return res.status(400).json({ error: 'Missing companyName path parameter.' });
    }
    // Add validation for companyId query parameter
    if (!companyId || typeof companyId !== 'string') {
         console.warn(`[Public Stats] Missing or invalid companyId query parameter for company ${companyName}.`);
         return res.status(400).json({ error: 'Missing or invalid companyId query parameter.' });
    }

    // Construct DB name using the required format stats_{id}_{name}
    const sanitizedCompanyId = companyId.toLowerCase().replace(/[^a-z0-9_$()+-/]/g, '_');
    const sanitizedCompanyName = companyName.toLowerCase().replace(/[^a-z0-9_$()+-/]/g, '_');
    const dbName = `stats_${sanitizedCompanyId}_${sanitizedCompanyName}`;
    const docId = 'counts';
    let db;

    try {
        // <<< Start: Ensure DB Exists >>>
        try {
            await statsCouch.db.create(dbName);
            console.log(`[Public Stats] Created statistics database: ${dbName}`);
        } catch (err) {
            if (err.statusCode === 412) {
                console.log(`[Public Stats] Statistics database '${dbName}' already exists.`);
            } else {
                throw new Error(`Failed to create/access stats DB '${dbName}': ${err.message || err.statusCode}`);
            }
        }
        // <<< End: Ensure DB Exists >>>

        db = statsCouch.db.use(dbName);
        const countsDoc = await db.get(docId);
        console.log(`[Public Stats] Found counts for ${companyName} (ID: ${companyId}) in DB ${dbName}:`, countsDoc);
        res.status(200).json({
            success: countsDoc.success || 0,
            fail: countsDoc.fail || 0 
        });
    } catch (error) {
        if (error.statusCode === 404) {
            // Database exists (checked above), but document not found -> 0 counts
            console.log(`[Public Stats] Counts document not found in DB '${dbName}'. Returning zeroes.`);
            res.status(200).json({ success: 0, fail: 0 }); 
        } else {
            // Other error (e.g., failed DB create/access from the check above)
            console.error(`[Public Stats] Error processing statistics for ${companyName} (ID: ${companyId}) in DB '${dbName}':`, error);
            res.status(500).json({ error: `Internal server error processing statistics: ${error.message}` });
        }
    }
});
// --- End NEW Endpoint ---

app.get('/api/hello', async function (req, res) {
    res.send(200);
});
console.log("=============================================SERVER_STARTED============================================================")
console.log("==============================================ON_PORT_9090==============================================================")
app.listen(9090);

// --- NEW: Endpoint for Generating Statistics Report ---
app.get('/api/statistics/:companyId/:companyName/report', async (req, res) => {
    const { companyId, companyName } = req.params;
    const { startDate: startDateQuery, endDate: endDateQuery } = req.query;

    console.log(`GET /api/statistics/${companyId}/${companyName}/report`, req.query);

    // 0. Validate Inputs
    if (!companyId || !companyName) {
        return res.status(400).json({ error: 'Missing companyId or companyName in path.' });
    }
    if (!statsCouch) {
        console.error(`[Stats Report] Cannot generate report, statsCouch client is not initialized.`);
        return res.status(503).json({ error: 'Statistics service unavailable.' });
    }

    // 1. Determine Time Range
    let endDate = new Date(); // Default to now
    if (endDateQuery) {
        const parsedEnd = new Date(endDateQuery + 'T23:59:59.999Z'); // Assume end of day UTC
        if (!isNaN(parsedEnd)) {
            endDate = parsedEnd;
        } else {
            return res.status(400).json({ error: 'Invalid endDate format. Use YYYY-MM-DD.' });
        }
    }
    let startDate = new Date(endDate); // Default start based on end date
    startDate.setDate(startDate.getDate() - 30); // Default to 30 days before end date
    if (startDateQuery) {
        const parsedStart = new Date(startDateQuery + 'T00:00:00.000Z'); // Assume start of day UTC
        if (!isNaN(parsedStart)) {
            startDate = parsedStart;
        } else {
            return res.status(400).json({ error: 'Invalid startDate format. Use YYYY-MM-DD.' });
        }
    }

    if (startDate >= endDate) {
        return res.status(400).json({ error: 'startDate must be before endDate.' });
    }

    const startISO = startDate.toISOString();
    const endISO = endDate.toISOString();

    console.log(`[Stats Report] Generating report for ${companyName} (ID: ${companyId}) from ${startISO} to ${endISO}`);

    // 2. Construct DB Name
    const sanitizedCompanyId = String(companyId).toLowerCase().replace(/[^a-z0-9_$()+-/]/g, '_');
    const sanitizedCompanyName = String(companyName).toLowerCase().replace(/[^a-z0-9_$()+-/]/g, '_');
    const dbName = `stats_${sanitizedCompanyId}_${sanitizedCompanyName}`;
    let db;

    try {
        // 3. Access Stats DB (Assume it exists - creation happens in logCheckEvent)
        try {
            db = await statsCouch.db.use(dbName);
            // Verify connection with a simple request like db.info()
            await db.info(); 
            console.log(`[Stats Report] Accessed database: ${dbName}`);
        } catch (dbErr) {
            if (dbErr.statusCode === 404) {
                 console.log(`[Stats Report] Statistics database '${dbName}' not found. Attempting to create it...`);
                 try {
                     // Create the database
                     await statsCouch.db.create(dbName);
                     console.log(`[Stats Report] Created database: ${dbName}`);
                     
                     // Immediately create necessary indexes
                     const newDb = statsCouch.db.use(dbName);
                     await newDb.index({ index: { fields: ['timestamp'] }, name: 'timestamp-idx', type: 'json' });
                     await newDb.index({ index: { fields: ['location'] }, name: 'location-idx', type: 'json' });
                     await newDb.index({ index: { fields: ['result'] }, name: 'result-idx', type: 'json' });
                     console.log(`[Stats Report] Created default indexes in new database ${dbName}.`);

                 } catch (createError) {
                     // Handle potential race condition if another request created it meanwhile
                     if (createError.statusCode !== 412) { 
                         console.error(`[Stats Report] Failed to create database or indexes for '${dbName}':`, createError);
                         // Throw error to prevent proceeding with an unusable DB
                         throw new Error(`Failed to initialize stats DB '${dbName}': ${createError.message || createError.statusCode}`);
                     } else {
                         console.log(`[Stats Report] Database '${dbName}' was likely created by another request. Proceeding.`);
                     }
                 }
                 
                 // Since the DB was just created (or created concurrently), there are no logs yet.
                 // Return the empty report directly.
                 return res.status(200).json({
                    startDate: startISO,
                    endDate: endISO,
                    totalChecks: 0,
                    successCount: 0,
                    failCount: 0,
                    successPercentage: 0,
                    failPercentage: 0,
                    locationCounts: {},
                 });
            } else {
                 // Different error accessing the DB
                 throw new Error(`Failed to access stats DB '${dbName}': ${dbErr.message || dbErr.statusCode}`);
            }
        }
        
        // 4. Query Check Logs within the Time Range
        // Use the timestamp index created earlier
        // Note: Fetching all docs can be inefficient for large ranges/datasets.
        // Consider using Mango aggregation or map/reduce views for production.
        const query = {
            selector: {
                type: 'check_log',
                timestamp: {
                    $gte: startISO,
                    $lte: endISO
                }
            },
            // Specify fields needed for aggregation
            fields: ['_id', 'timestamp', 'result', 'location'],
            limit: 10000 // Add a reasonable limit to prevent memory issues
            // bookmark: ... // Add bookmark for pagination if needed
        };

        console.log(`[Stats Report] Executing query on ${dbName}:`, JSON.stringify(query));
        const queryResult = await db.find(query);

        if (!queryResult || !queryResult.docs) {
            throw new Error('Invalid response from statistics database query.');
        }
        const checkLogs = queryResult.docs;
        console.log(`[Stats Report] Found ${checkLogs.length} check logs in the specified range.`);

        // 5. Aggregate Results
        let totalChecks = checkLogs.length;
        let successCount = 0;
        let failCount = 0;
        let locationCounts = {};
        // Add more aggregators if needed (e.g., daily counts)

        for (const log of checkLogs) {
            if (log.result === 'success') {
                successCount++;
            } else if (log.result === 'fail') {
                failCount++;
            }

            const location = log.location || 'Unknown';
            locationCounts[location] = (locationCounts[location] || 0) + 1;
            
            // Example: Aggregate by date (YYYY-MM-DD)
            // const date = log.timestamp.substring(0, 10);
            // dailyCounts[date] = (dailyCounts[date] || 0) + 1;
        }

        // Calculate percentages
        const successPercentage = totalChecks > 0 ? parseFloat(((successCount / totalChecks) * 100).toFixed(1)) : 0;
        const failPercentage = totalChecks > 0 ? parseFloat(((failCount / totalChecks) * 100).toFixed(1)) : 0;

        // TODO: Implement trend analysis (e.g., compare with previous period)

        // 6. Format and Send Response
        const report = {
            companyId,
            companyName,
            startDate: startISO,
            endDate: endISO,
            totalChecks,
            successCount,
            failCount,
            successPercentage,
            failPercentage,
            locationCounts, // Simple location counts for now
            // trends: { ... } // Placeholder for trend data
        };

        res.status(200).json(report);

    } catch (error) {
        console.error(`[Stats Report] Error generating report for ${companyName} (ID: ${companyId}):`, error);
        res.status(500).json({ error: `Internal server error generating statistics report: ${error.message}` });
    }
});
// --- End Statistics Report Endpoint ---

// --- NEW: Endpoint to Get Items by Owner ---
app.get('/api/items/owner/:ownerName', async function (req, res) {
    const ownerName = req.params.ownerName;
    console.log(`GET /api/items/owner/${ownerName}`);

    if (!ownerName) {
        return res.status(400).json({ error: 'Missing ownerName parameter in URL path.' });
    }

    let gateway;
    try {
        const { gateway: connectedGateway, contract } = await getContract();
        gateway = connectedGateway;

        // IMPORTANT: Verify 'QueryItemsByOwner' is the correct chaincode function name!
        console.log(`--> Evaluate Transaction: queryItemsByOwner for owner: ${ownerName}`);
        const resultBytes = await contract.evaluateTransaction('queryItemsByOwner', ownerName);
        const resultString = resultBytes.toString();
        console.log(`*** queryItemsByOwner Result for ${ownerName}: ${resultString}`);

        // Chaincode might return an empty string or empty array '[]' if no items found
        if (!resultString || resultString === '[]') {
            console.log(`No items found for owner ${ownerName}. Returning empty array.`);
            res.status(200).json([]); // Return 200 OK with empty array
        } else {
            // Attempt to parse the JSON string result
            try {
                const items = JSON.parse(resultString);
                res.status(200).json(items);
            } catch (parseError) {
                console.error(`Failed to parse chaincode result for owner ${ownerName}:`, parseError);
                console.error(`Raw chaincode result string: ${resultString}`);
                res.status(500).json({ error: 'Failed to parse item data from blockchain.' });
            }
        }

    } catch (error) {
        const errorMessage = error.toString();
        console.error(`Failed to evaluate transaction queryItemsByOwner for ${ownerName}: ${errorMessage}`);

        // Check if the error message indicates 'not found' (adjust based on actual chaincode errors)
        if (errorMessage.includes('NotFound') || errorMessage.includes('no items found')) { 
            console.log(`Chaincode indicated no items found for owner ${ownerName}. Returning empty array.`);
            res.status(200).json([]); // Return 200 OK with empty array even on chaincode 'not found' error
        } else {
            // For other chaincode errors, return 500
            res.status(500).json({ error: `Error querying items from blockchain: ${errorMessage}` });
        }
    } finally {
        if (gateway) {
            await gateway.disconnect();
            console.log('Disconnected from gateway.');
        }
    }
});
// --- End Get Items by Owner Endpoint ---

// --- NEW: Endpoint to Create a New Item ---
app.post('/api/items', authenticateUser, async function (req, res) {
    // Item details are expected in the request body
    const { companyOrg, itemType, itemName, itemSerialNumber } = req.body;
    const requesterEmail = req.user?.email; // Get authenticated user's email

    console.log(`POST /api/items requested by ${requesterEmail}. Item:`, req.body);

    // 1. Validate Input
    if (!companyOrg || !itemType || !itemName || !itemSerialNumber) {
        return res.status(400).json({ error: "Missing required fields: companyOrg, itemType, itemName, itemSerialNumber" });
    }
    // ** Security Check: Ensure the companyOrg matches the authenticated user **
    // This prevents a logged-in user from creating items for another company
    if (req.user?.companyName !== companyOrg) {
        console.warn(`[Create Item] Forbidden: User ${requesterEmail} (${req.user?.companyName}) attempted to create item for ${companyOrg}.`);
        return res.status(403).json({ error: `Forbidden: You can only create items for your own company (${req.user?.companyName}).` });
    }

    let gateway;
    try {
        const { gateway: connectedGateway, contract } = await getContract();
        gateway = connectedGateway;

        console.log('--> Submit Transaction: createStoreItem');
        // Call chaincode function with arguments from the request body
        await contract.submitTransaction('createStoreItem', companyOrg, itemType, itemName, itemSerialNumber);
        console.log('*** Transaction createStoreItem submitted successfully');
        
        // Respond with success and the created item data (optional, but good practice)
        res.status(201).json({ 
            message: 'Item created successfully', 
            item: { companyOrg, itemType, itemName, itemSerialNumber } 
        });

    } catch (error) {
        const errorMessage = error.toString();
        console.error(`Failed to submit transaction createStoreItem: ${errorMessage}`);
        // Check for specific chaincode errors (e.g., item already exists)
        if (errorMessage.includes('already exists')) {
             res.status(409).json({ error: `Conflict: Item with serial number ${itemSerialNumber} already exists.` });
        } else {
            res.status(500).json({ error: `Failed to create item: ${errorMessage}` });
        }
    } finally {
        if (gateway) {
            await gateway.disconnect();
            console.log('Disconnected from gateway.');
        }
    }
});
// --- End Create Item Endpoint ---

// --- NEW: Endpoint to Update Item Details (Name/Type) ---
app.put('/api/items/:serial', authenticateUser, async function (req, res) {
    const itemSerialNumber = req.params.serial;
    const { itemName, itemType } = req.body; // Only expect name and type
    const requesterEmail = req.user?.email;
    const requesterCompany = req.user?.companyName;

    console.log(`PUT /api/items/${itemSerialNumber} requested by ${requesterEmail}. New details:`, req.body);

    // 1. Validate Input
    if (!itemSerialNumber) {
        return res.status(400).json({ error: 'Missing item serial number in URL path.' });
    }
    if (!itemName || !itemType) {
        return res.status(400).json({ error: 'Missing required fields in body: itemName, itemType' });
    }
    if (!requesterCompany) {
         return res.status(401).json({ error: 'Authentication error: User company not found.' });
    }

    let gateway;
    try {
        const { gateway: connectedGateway, contract } = await getContract();
        gateway = connectedGateway;

        // 2. ** Security Check: Verify item exists and user owns it **
        console.log(`[Update Item] Checking ownership for item ${itemSerialNumber} by user ${requesterEmail} (${requesterCompany})`);
        let existingItemData;
        try {
            const resultBytes = await contract.evaluateTransaction('queryStoreItem', itemSerialNumber);
            const resultString = resultBytes.toString();
            if (!resultString) {
                 throw new Error('Item not found'); // Throw if evaluate returns empty
            }
            existingItemData = JSON.parse(resultString);
        } catch (queryError) {
            // Handle errors from queryStoreItem (could be not found or other ledger errors)
            console.error(`[Update Item] Error querying item ${itemSerialNumber} before update: ${queryError}`);
             if (queryError.toString().includes('NotFound') || queryError.message.includes('not found')) {
                return res.status(404).json({ error: `Item not found: ${itemSerialNumber}` });
             } else {
                 return res.status(500).json({ error: `Failed to verify item ownership: ${queryError.toString()}` });
             }
        }

        // Check ownership
        if (existingItemData.company_org !== requesterCompany) {
            console.warn(`[Update Item] Forbidden: User ${requesterEmail} (${requesterCompany}) attempted to update item ${itemSerialNumber} owned by ${existingItemData.company_org}.`);
            return res.status(403).json({ error: 'Forbidden: You can only update items owned by your company.' });
        }
        console.log(`[Update Item] Ownership verified for ${itemSerialNumber}. Proceeding with update.`);

        // 3. Submit the Update Transaction
        // ** Use correct chaincode function name found in Go file **
        console.log('--> Submit Transaction: updateItemDetails');
        await contract.submitTransaction('updateItemDetails', itemSerialNumber, itemName, itemType);
        console.log('*** Transaction updateItemDetails submitted successfully');

        // 4. Respond with success
        // Optionally re-query the item to return the absolute latest state
        res.status(200).json({ 
            message: 'Item details updated successfully', 
            item: { ...existingItemData, item_name: itemName, item_type: itemType } // Return optimistic update
        });

    } catch (error) {
        const errorMessage = error.toString();
        console.error(`Failed to submit transaction updateItemDetails for ${itemSerialNumber}: ${errorMessage}`);
        // Handle potential chaincode errors during update (e.g., concurrent modification)
        res.status(500).json({ error: `Failed to update item details: ${errorMessage}` });
    } finally {
        if (gateway) {
            await gateway.disconnect();
            console.log('Disconnected from gateway.');
        }
    }
});
// --- End Update Item Details Endpoint ---

// --- NEW: Endpoint to Delete an Item ---
app.delete('/api/items/:serial', authenticateUser, async function (req, res) {
    const itemSerialNumber = req.params.serial;
    const requesterEmail = req.user?.email;
    const requesterCompany = req.user?.companyName;

    console.log(`DELETE /api/items/${itemSerialNumber} requested by ${requesterEmail}`);

    // 1. Validate Input
    if (!itemSerialNumber) {
        return res.status(400).json({ error: 'Missing item serial number in URL path.' });
    }
    if (!requesterCompany) {
         return res.status(401).json({ error: 'Authentication error: User company not found.' });
    }

    let gateway;
    try {
        const { gateway: connectedGateway, contract } = await getContract();
        gateway = connectedGateway;

        // 2. ** Security Check: Verify item exists and user owns it before deleting **
        console.log(`[Delete Item] Checking ownership for item ${itemSerialNumber} by user ${requesterEmail} (${requesterCompany})`);
        let existingItemData;
        try {
            const resultBytes = await contract.evaluateTransaction('queryStoreItem', itemSerialNumber);
            const resultString = resultBytes.toString();
            if (!resultString) {
                 throw new Error('Item not found');
            }
            existingItemData = JSON.parse(resultString);
        } catch (queryError) {
             console.error(`[Delete Item] Error querying item ${itemSerialNumber} before delete: ${queryError}`);
             if (queryError.toString().includes('NotFound') || queryError.message.includes('not found') || queryError.message.includes('does not exist')) {
                // If item doesn't exist, arguably the DELETE is successful (idempotent)
                // Or return 404 if strict checking is preferred.
                // Let's return 204 assuming idempotentcy is desired.
                console.log(`[Delete Item] Item ${itemSerialNumber} not found, considering deletion successful.`);
                return res.status(204).send(); 
             } else {
                 return res.status(500).json({ error: `Failed to verify item ownership before delete: ${queryError.toString()}` });
             }
        }

        // Check ownership
        if (existingItemData.company_org !== requesterCompany) {
            console.warn(`[Delete Item] Forbidden: User ${requesterEmail} (${requesterCompany}) attempted to delete item ${itemSerialNumber} owned by ${existingItemData.company_org}.`);
            return res.status(403).json({ error: 'Forbidden: You can only delete items owned by your company.' });
        }
        console.log(`[Delete Item] Ownership verified for ${itemSerialNumber}. Proceeding with delete transaction.`);

        // 3. Submit the Delete Transaction
        // ** Use correct chaincode function name found in Go file **
        console.log('--> Submit Transaction: deleteItem');
        await contract.submitTransaction('deleteItem', itemSerialNumber);
        console.log('*** Transaction deleteItem submitted successfully');

        // 4. Respond with success (204 No Content is standard for DELETE)
        res.status(204).send(); 

    } catch (error) {
        const errorMessage = error.toString();
        console.error(`Failed to submit transaction deleteItem for ${itemSerialNumber}: ${errorMessage}`);
        // Handle potential chaincode errors during delete (e.g., ledger errors)
        res.status(500).json({ error: `Failed to delete item: ${errorMessage}` });
    } finally {
        if (gateway) {
            await gateway.disconnect();
            console.log('Disconnected from gateway.');
        }
    }
});
// --- End Delete Item Endpoint ---
