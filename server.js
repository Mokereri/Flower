import express from 'express';
import { Pool } from 'pg';
import cors from 'cors';
import dotenv from 'dotenv';
// import { sendSubscriptionEmail } from './emailService.js'; // Assuming you have this

dotenv.config();

// Configuration for pg Pool using individual environment variables
const poolConfig = {
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
    // *** CRITICAL RENDER SSL SETTING ***
    ssl: {
        rejectUnauthorized: false
    }
};

// Check if a full DATABASE_URL is available (best practice)
const connectionString = process.env.DATABASE_URL;

const pool = connectionString 
    ? new Pool({ connectionString, ssl: { rejectUnauthorized: false } }) // Use URL if available
    : new Pool(poolConfig); // Otherwise use individual config

// Test Database Connection
pool.query('SELECT 1 + 1 AS result')
    .then(res => {
        console.log(`✅ Database connection successful! Result: ${res.rows[0].result}`);
    })
    .catch(err => {
        console.error('❌ Database connection failed:', err);
        // This is where you see the ECONNREFUSED error
    });

const app = express();
const port = process.env.PORT || 3000;
const allowedOrigin = process.env.CORS_ALLOWED_ORIGIN;

app.use(cors({
    origin: allowedOrigin
}));
app.use(express.json());


// ----------------------------------------------------
// Endpoints
// ----------------------------------------------------

app.post('/subscribe', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    try {
        const result = await pool.query(
            'INSERT INTO subscribers (email) VALUES ($1) ON CONFLICT (email) DO NOTHING RETURNING *',
            [email]
        );

        if (result.rowCount === 0) {
             return res.status(409).json({ success: false, message: 'Email already subscribed.' });
        }
        
        // Assuming email service is set up
        // await sendSubscriptionEmail(email); 

        res.status(200).json({ success: true, message: 'Subscription successful!' });
    } catch (error) {
        console.error('Subscription error:', error); 
        // We will now see a more specific error than just ECONNREFUSED if the connection works.
        res.status(500).json({ success: false, message: 'Error subscribing. Please try again later.' });
    }
});

// Admin Route (Needs 'admin.html' in public folder, or remove)
app.get('/admin', (req, res) => {
    // NOTE: This assumes you fixed the ENOENT error by creating public/admin.html
    // If you don't need this, remove it to prevent the ENOENT error.
    res.sendFile('admin.html', { root: './public' });
});

app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
    console.log(`CORS allowed origin: ${allowedOrigin}`);
});
