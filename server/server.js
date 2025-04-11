require('dotenv').config(); // Load environment variables from .env file
const path = require('path'); // Import path module

// --- Add check for API Key --- 
console.log('Attempting to load YOUTUBE_API_KEY...');
if (process.env.YOUTUBE_API_KEY) {
    console.log('YOUTUBE_API_KEY loaded successfully.');
} else {
    console.error('>>> YOUTUBE_API_KEY not found in environment variables! Check your .env file. <<<');
}
// --- End check ---

const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const axios = require('axios'); // Import axios

const PORT = process.env.PORT || 5000;

// --- Firebase Admin Initialization (Modified for Glitch .env) ---
let db;
try {
  let serviceAccount;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    console.log('Initializing Firebase Admin using FIREBASE_SERVICE_ACCOUNT_JSON from .env');
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  } else {
    // Fallback to file path for local development
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH || './firebaseServiceAccountKey.json'; 
    console.log('Initializing Firebase Admin using service account file:', serviceAccountPath);
    serviceAccount = require(serviceAccountPath);
  }

  if (!admin.apps.length) {
    initializeApp({
        credential: cert(serviceAccount)
    });
    console.log('Firebase Admin SDK initialized successfully.');
    db = getFirestore();
    console.log('Firestore database instance obtained.');
  } else {
    db = getFirestore(admin.apps[0]);
    console.log('Using existing Firebase Admin SDK instance.');
  }
} catch (error) {
  console.error('Error initializing Firebase Admin SDK or getting Firestore:', error);
  if (error instanceof SyntaxError && process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
       console.error('>>> Check if FIREBASE_SERVICE_ACCOUNT_JSON in .env is valid JSON! <<<');
  }
  process.exit(1); 
}

// --- Express App Setup ---
const app = express();

// Middleware
// Allow requests from your frontend development server and production domain
// Removed temporary debug origin, kept expected ones
const allowedOrigins = ['http://localhost:3000', 'http://localhost:5173']; 
app.use(cors({
  origin: function (origin, callback) {
    console.log("==> CORS Check - Request Origin:", origin);
    // Normalize origin by removing trailing slash if present
    const normalizedOrigin = origin ? origin.replace(/\/$/, '') : origin;
    console.log("==> CORS Check - Normalized Origin:", normalizedOrigin);

    // Allow requests with no origin OR if normalized origin is in the list
    if (!normalizedOrigin || allowedOrigins.indexOf(normalizedOrigin) !== -1) {
        console.log("==> CORS Allowed: Origin is allowed.");
        return callback(null, true);
    }
    
    // Deny otherwise
    const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
    console.error("==> CORS Denied: Origin not in allowed list:", origin); // Log original origin in error
    return callback(new Error(msg), false);
  }
}));
app.use(express.json()); // Middleware to parse JSON bodies

// --- Firestore Helper Functions ---
const getGameRef = (sessionId) => db.collection('gameSessions').doc(sessionId);
const getPlayersRef = (sessionId) => getGameRef(sessionId).collection('players');
const getSongsRef = () => db.collection('songs'); // Reference to the global songs collection

// --- API Routes ---

// GET /api/songs - Fetch all songs
app.get('/api/songs', async (req, res) => {
    try {
        const songsSnapshot = await getSongsRef().get();
        const songsList = songsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(songsList);
    } catch (error) {
        console.error("Error fetching songs:", error);
        res.status(500).send('Error fetching songs');
    }
});

// NEW: POST /api/add-song - Add a new song from YouTube search
app.post('/api/add-song', async (req, res) => {
    const { title, url } = req.body;

    if (!title || !url) {
        return res.status(400).send('Missing title or url in request body');
    }

    // Basic URL validation (improve as needed)
    if (!url.startsWith('https://www.youtube.com/watch?v=')) {
        return res.status(400).send('Invalid YouTube URL format');
    }

    try {
        // Optional: Check if song with this URL already exists to avoid duplicates
        const existingSongQuery = await getSongsRef().where('url', '==', url).limit(1).get();
        if (!existingSongQuery.empty) {
            console.log(`Song with URL ${url} already exists.`);
            // You might want to return the existing song ID or a specific message
            return res.status(409).send('Song with this URL already exists');
        }

        const newSongRef = await getSongsRef().add({
            title: title,
            url: url,
            // Add timestamp or other relevant metadata if desired
            addedAt: FieldValue.serverTimestamp()
        });
        console.log(`Added new song: ${title} (${url}) with ID: ${newSongRef.id}`);
        res.status(201).json({ id: newSongRef.id, title, url });
    } catch (error) {
        console.error("Error adding song:", error);
        res.status(500).send('Error adding song to database');
    }
});

// NEW: GET /api/youtube-search - Search YouTube for videos
app.get('/api/youtube-search', async (req, res) => {
    const query = req.query.q;
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!query) {
        return res.status(400).send('Missing search query parameter "q"');
    }
    if (!apiKey) {
        console.error("YOUTUBE_API_KEY is not set in environment variables.");
        return res.status(500).send('Server configuration error: YouTube API key missing');
    }

    const youtubeApiUrl = `https://www.googleapis.com/youtube/v3/search`;

    try {
        const response = await axios.get(youtubeApiUrl, {
            params: {
                part: 'snippet', // We need basic info like title
                q: query,        // The search query from the client
                key: apiKey,     // Your API key
                type: 'video',   // Search only for videos
                maxResults: 10,  // Limit the number of results
                videoCategoryId: '10' // Category ID for Music (optional, but helps focus results)
            }
        });

        // Format the results for the frontend
        const searchResults = response.data.items.map(item => ({
            videoId: item.id.videoId,
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails.default.url, // Get default thumbnail
            url: `https://www.youtube.com/watch?v=${item.id.videoId}`
        }));

        res.status(200).json(searchResults);

    } catch (error) {
        console.error("Error searching YouTube:", error.response ? error.response.data : error.message);
        // Provide more specific error messages if possible
        if (error.response && error.response.data && error.response.data.error) {
            const ytError = error.response.data.error;
            // Check for quota exceeded error
            if (ytError.errors && ytError.errors.some(e => e.reason === 'quotaExceeded')) {
                return res.status(429).send('YouTube API quota exceeded. Please try again later.');
            }
             return res.status(500).send(`YouTube API error: ${ytError.message || 'Unknown error'}`);
        }
        res.status(500).send('Error searching YouTube');
    }
});

// GET /api/game/:sessionId - Get current game state
app.get('/api/game/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    if (!sessionId) {
        return res.status(400).send('Session ID is required');
    }
    try {
        const gameDocRef = getGameRef(sessionId);
        const gameDoc = await gameDocRef.get();

        if (!gameDoc.exists) {
            return res.status(404).send('Game session not found');
        }

        const gameState = gameDoc.data();

        // Fetch players separately if needed, or assume they are part of gameState if embedded
        const playersSnapshot = await getPlayersRef(sessionId).get();
        const players = playersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Combine game state and players
        res.status(200).json({ ...gameState, players });

    } catch (error) {
        console.error(`Error fetching game state for session ${sessionId}:`, error);
        res.status(500).send('Error fetching game state');
    }
});

// You might have other routes like POST /api/game to create a session
// or POST /api/game/:sessionId/update for state updates from clients
// Ensure those are also present if they exist.

// --- Serve Static Frontend Files (for Glitch deployment) ---
// Define the path to the build directory of the React app
const frontendBuildPath = path.resolve(__dirname, '..', 'music-guess-app', 'build');

// Serve static files from the React app build directory
app.use(express.static(frontendBuildPath));

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  // Ensure API calls don't fall through to this
  if (!req.path.startsWith('/api/')) {
       res.sendFile(path.resolve(frontendBuildPath, 'index.html'));
  } else {
       // If it starts with /api/ but wasn't caught by API routes, return 404
       res.status(404).send('API route not found');
  }
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// Example usage (Keep or remove as needed)
// initializeDatabase().then(...).catch(...); 