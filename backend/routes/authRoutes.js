const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

/** Generate a signed JWT for a user */
function generateToken(user) {
    return jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '8h' }
    );
}

// ─── POST /api/auth/login ── Authenticate user & return JWT ─────────────────
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required.' });
        }

        const user = await User.findOne({ username: username.toLowerCase().trim() });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        const token = generateToken(user);

        res.json({
            message: 'Login successful.',
            token,
            role: user.role,
            username: user.username,
        });
    } catch (err) {
        console.error('POST /api/auth/login error:', err.message);
        res.status(500).json({ error: 'Login failed.' });
    }
});

// ─── POST /api/auth/setup ── Seed initial users (dev only) ──────────────────
router.post('/setup', async (req, res) => {
    try {
        const existingAdmin = await User.findOne({ role: 'admin' });
        if (existingAdmin) {
            return res.status(200).json({
                message: 'Setup already completed. Users exist.',
                admin: existingAdmin.username,
            });
        }

        // Create default admin
        const admin = await User.create({
            username: 'admin',
            password: 'admin123',
            role: 'admin',
        });

        // Create default security user
        const security = await User.create({
            username: 'security',
            password: 'security123',
            role: 'security',
        });

        res.status(201).json({
            message: 'Initial users created successfully.',
            users: [
                { username: admin.username, role: admin.role },
                { username: security.username, role: security.role },
            ],
        });
    } catch (err) {
        console.error('POST /api/auth/setup error:', err.message);
        res.status(500).json({ error: 'Setup failed.' });
    }
});

module.exports = router;
