// ─── Load environment variables FIRST ─────────────────────────────────────────
require('dotenv').config();

const express  = require('express');
const http     = require('http');
const mongoose = require('mongoose');
const cors     = require('cors');
const { Server } = require('socket.io');

// ─── Express app + HTTP server ───────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const PORT   = process.env.PORT || 5000;

// ─── Socket.io ───────────────────────────────────────────────────────────────
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});

// Make io accessible inside route handlers via req.app.get('io')
app.set('io', io);

io.on('connection', (socket) => {
    console.log(`🔌  Client connected: ${socket.id}`);
    socket.on('disconnect', () => {
        console.log(`🔌  Client disconnected: ${socket.id}`);
    });
});

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Auth Middleware ─────────────────────────────────────────────────────────
const { protect } = require('./middleware/authMiddleware');

// ─── API Routes ──────────────────────────────────────────────────────────────
const authRoutes     = require('./routes/authRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const parkingRoutes  = require('./routes/parkingRoutes');

// Public routes (no JWT required)
app.use('/api/auth', authRoutes);

// Protected routes (JWT required)
app.use('/api/employees', protect, employeeRoutes);
app.use('/api/parking',   protect, parkingRoutes);

// ─── Health-check route (public) ─────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

// ─── MongoDB connection & server start ───────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/parkmanager';

mongoose
    .connect(MONGO_URI)
    .then(() => {
        console.log('✅  MongoDB connected successfully');

        // Use server.listen (not app.listen) so Socket.io shares the same port
        server.listen(PORT, () => {
            console.log(`🚀  Server running on http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('❌  MongoDB connection error:', err.message);
        process.exit(1);
    });
