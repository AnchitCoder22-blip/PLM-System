const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * protect — JWT verification middleware.
 * Expects: Authorization: Bearer <token>
 * On success: attaches req.user with { id, username, role }.
 * On failure: returns 401 Unauthorized.
 */
async function protect(req, res, next) {
    let token;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ error: 'Not authorized — no token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Attach lean user data (without password) to the request
        const user = await User.findById(decoded.id).select('-password');
        if (!user) {
            return res.status(401).json({ error: 'Not authorized — user no longer exists.' });
        }

        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Not authorized — invalid or expired token.' });
    }
}

/**
 * adminOnly — Role-gate middleware (use after `protect`).
 */
function adminOnly(req, res, next) {
    if (req.user && req.user.role === 'admin') {
        return next();
    }
    return res.status(403).json({ error: 'Access denied — admin privileges required.' });
}

module.exports = { protect, adminOnly };
