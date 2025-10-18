import express from "express";
import mysql from "mysql2";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

// ✅ Handle __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CORS Configuration ---
// Define the specific origin (your Netlify frontend URL) that is allowed to make requests.
// This is crucial for fixing the "Error subscribing" issue in your deployed application.
const allowedOrigin = "https://edgeflowers.netlify.app"; 

app.use(cors({
    origin: allowedOrigin,
    methods: ["POST", "GET"], // Only allow the methods needed for this application
    credentials: true
}));

app.use(express.json()); // Middleware to parse JSON bodies

// --- MySQL Connection ---
const db = mysql.createConnection({
    // NOTE: For deployment, it's highly recommended to use environment variables 
    // instead of hardcoding sensitive credentials like password and host.
    host: "localhost", // Change this to your deployed MySQL host if not local
    user: "Mokereri",
    password: "Kay@2030",
    database: "molvin_db"
});

db.connect((err) => {
    if (err) {
        console.error("Database connection failed:", err);
        // In a deployed environment, you might want to exit the process here
        return;
    }
    console.log("✅ Connected to MySQL");
});

// --- API Endpoints ---

// Subscribe endpoint
app.post("/subscribe", (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: "Email is required" });
    }

    const query = "INSERT INTO subscribers (email) VALUES (?)";

    db.query(query, [email], (err) => {
        if (err) {
            if (err.code === "ER_DUP_ENTRY") {
                return res.status(409).json({ message: "You’re already subscribed!" });
            }
            console.error("Subscription Error:", err);
            return res.status(500).json({ message: "Database error" });
        }
        res.json({ message: "Thanks for subscribing!" });
    });
});

// Get all subscribers (for admin/internal use)
app.get("/subscribers", (req, res) => {
    const query = "SELECT id, email, created_at FROM subscribers ORDER BY created_at DESC";
    db.query(query, (err, results) => {
        if (err) {
            console.error("Fetch Subscribers Error:", err);
            return res.status(500).json({ message: "Database error" });
        }
        res.json(results);
    });
});

// --- Static File Serving & Server Start ---

// Serve static files (like admin.html) from /public
app.use(express.static(path.join(__dirname, "public")));

// Default route (optional: redirect to admin page)
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// Use the PORT environment variable if available (common for deployment), otherwise use 3000
const PORT = process.env.PORT || 3000;

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`CORS allowed origin: ${allowedOrigin}`);
});
