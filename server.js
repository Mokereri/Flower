import express from "express";
import { Pool } from "pg"; // ⬅️ Using PostgreSQL client
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// --- Configuration (Read from Environment Variables) ---
// Note: The deployment environment (like Render) handles loading these variables.
const allowedOrigin = process.env.CORS_ALLOWED_ORIGIN || "https://edgeflowers.netlify.app";
const PORT = process.env.PORT || 3000;

// PostgreSQL Connection Configuration
const pool = new Pool({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    // Ensure port is parsed as an integer, defaulting to 5432
    port: parseInt(process.env.PG_PORT || '5432', 10),
    // Necessary for secure connection to many cloud database hosts
    ssl: {
        rejectUnauthorized: false 
    }
});

const app = express();

// ✅ Handle __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CORS Configuration ---
app.use(cors({
    origin: allowedOrigin,
    methods: ["POST", "GET"], 
    credentials: true
}));

app.use(express.json()); // Middleware to parse JSON bodies

// --- Database Connection Test ---
pool.connect((err, client, release) => {
    if (err) {
        console.error("❌ Database connection failed:", err.stack);
    } else {
        console.log("✅ Connected to PostgreSQL Database");
        release(); 
    }
});


// --- API Endpoints ---

/**
 * Handles newsletter subscription, inserting the email into the PostgreSQL
 * 'subscribers' table while preventing duplicates.
 */
app.post("/subscribe", async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: "Email is required" });
    }

    // PostgreSQL uses $1 for parameterized queries. 
    // ON CONFLICT (email) DO NOTHING prevents duplicate entries if 'email' has a UNIQUE constraint.
    const query = 'INSERT INTO subscribers (email) VALUES ($1) ON CONFLICT (email) DO NOTHING RETURNING id';

    try {
        const result = await pool.query(query, [email]);

        if (result.rowCount === 0) {
            // No row inserted means the email already exists
            return res.status(409).json({ message: "You’re already subscribed!" });
        }

        res.json({ message: "Thanks for subscribing to Edge Flower Gallery!" });

    } catch (err) {
        console.error("Subscription Error:", err);
        return res.status(500).json({ message: "Database error during subscription." });
    }
});

/**
 * Retrieves all subscribers (Internal/Admin use).
 */
app.get("/subscribers", async (req, res) => {
    const query = "SELECT id, email, created_at FROM subscribers ORDER BY created_at DESC";
    
    try {
        // pool.query returns results in the 'rows' property
        const result = await pool.query(query);
        res.json(result.rows); 

    } catch (err) {
        console.error("Fetch Subscribers Error:", err);
        return res.status(500).json({ message: "Database error" });
    }
});

// --- Static File Serving & Server Start ---

// Serve static files (like admin.html) from /public
app.use(express.static(path.join(__dirname, "public")));

// Default route 
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "admin.html"));
});


// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`CORS allowed origin: ${allowedOrigin}`);
});
