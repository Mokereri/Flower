import express from "express";
import mysql from "mysql2";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Handle __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// MySQL connection
const db = mysql.createConnection({
  host: "localhost",
  user: "Mokereri",        // change if you use another username
  password: "Kay@2030",       // replace with your MySQL password
  database: "molvin_db"           // must match your DB
});

db.connect((err) => {
  if (err) {
    console.error("Database connection failed:", err);
    return;
  }
  console.log("✅ Connected to MySQL");
});

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
      console.error(err);
      return res.status(500).json({ message: "Database error" });
    }
    res.json({ message: "Thanks for subscribing!" });
  });
});

// Get all subscribers
app.get("/subscribers", (req, res) => {
  const query = "SELECT id, email, created_at FROM subscribers ORDER BY created_at DESC";
  db.query(query, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Database error" });
    }
    res.json(results);
  });
});

// ✅ Serve static files (like admin.html) from /public
app.use(express.static(path.join(__dirname, "public")));

// Default route (optional: redirect to admin page)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// Start server
app.listen(3000, () => {
  console.log("🚀 Server running at http://localhost:3000");
});
