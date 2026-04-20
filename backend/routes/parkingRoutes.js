const express = require('express');
const router = express.Router();
const Log = require('../models/Log');
const Employee = require('../models/Employee');
const Settings = require('../models/Settings');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// ─── Zone Configuration (mirrors frontend ZONE_CONFIG) ───────────────────────
const ZONE_CONFIG = {
    employee: { blocks: ['A', 'B'], label: 'Employee Zone', slotsPerBlock: 20 },
    visitor:  { blocks: ['C', 'D'], label: 'Visitor Zone',  slotsPerBlock: 20 },
};
const SLOTS_PER_BLOCK = 20;
const TOTAL_EMP_SLOTS = ZONE_CONFIG.employee.blocks.length * SLOTS_PER_BLOCK; // 40
const TOTAL_VIS_SLOTS = ZONE_CONFIG.visitor.blocks.length * SLOTS_PER_BLOCK;  // 40


// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Sanitize a number plate to uppercase alphanumeric */
function cleanPlate(plate) {
    return plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

/** Parse raw slot input to canonical "A-01" format */
function parseSlotInput(rawSlot) {
    if (!rawSlot) return { slot: '', block: '' };
    const s = rawSlot.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (!s) return { slot: '', block: '' };
    const block = s.charAt(0);
    let num = s.substring(1);
    if (!isNaN(num) && num.length > 0) {
        num = parseInt(num, 10).toString().padStart(2, '0');
    }
    return { slot: `${block}-${num}`, block };
}

/** Determine zone from block letter */
function getZoneForBlock(block) {
    if (ZONE_CONFIG.employee.blocks.includes(block)) return 'employee';
    if (ZONE_CONFIG.visitor.blocks.includes(block))  return 'visitor';
    return null;
}

/** Generate a unique daily token  — EMP-20260416-001 / VIS-20260416-001 */
async function generateToken(isEmployee) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;
    const prefix = isEmployee ? 'EMP' : 'VIS';

    // Count how many tokens of this prefix already exist today
    const todayDate = now.toLocaleDateString();
    const count = await Log.countDocuments({
        date: todayDate,
        token: { $regex: `^${prefix}-` },
    });

    const sequence = String(count + 1).padStart(3, '0');
    return `${prefix}-${dateStr}-${sequence}`;
}

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═════════════════════════════════════════════════════════════════════════════

// ─── GET /api/parking/logs ── Fetch all parking logs ─────────────────────────
router.get('/logs', async (_req, res) => {
    try {
        const logs = await Log.find().sort({ createdAt: -1 });
        res.json(logs);
    } catch (err) {
        console.error('GET /api/parking/logs error:', err.message);
        res.status(500).json({ error: 'Failed to fetch parking logs.' });
    }
});

// ─── POST /api/parking/scan ── Scan license plate via Python Microservice ────
router.post('/scan', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image provided' });
        }
        
        const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
        const formData = new FormData();
        formData.append('file', blob, 'image.jpg');

        const response = await fetch('http://localhost:8000/scan', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Python API Error: ${response.status} - ${errorData}`);
        }

        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error('POST /api/parking/scan error:', err.message);
        res.status(500).json({ error: 'Failed to scan image.' });
    }
});

// ─── DELETE /api/parking/logs/:id ── Delete a single log ─────────────────────
router.delete('/logs/:id', async (req, res) => {
    try {
        const deleted = await Log.findByIdAndDelete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ error: 'Log entry not found.' });
        }

        // Broadcast real-time update
        const io = req.app.get('io');
        if (io) io.emit('parkingUpdate', { action: 'logDeleted', logId: req.params.id });

        res.json({ message: 'Log deleted successfully.', log: deleted });
    } catch (err) {
        console.error('DELETE /api/parking/logs error:', err.message);
        res.status(500).json({ error: 'Failed to delete log.' });
    }
});

// ─── GET /api/parking/stats ── Dashboard statistics ──────────────────────────
router.get('/stats', async (_req, res) => {
    try {
        const activeParkings = await Log.find({ status: 'Parked' });
        const activeEmp = activeParkings.filter(l => l.type === 'Employee').length;
        const activeVis = activeParkings.filter(l => l.type === 'Visitor').length;

        // Revenue: sum of revenue from visitors exiting today
        const today = new Date().toLocaleDateString();
        const todayExitedVisitors = await Log.find({
            status: 'Exited',
            type: 'Visitor',
            date: today,
        });

        let dailyRevenue = 0;
        todayExitedVisitors.forEach(log => {
            if (log.revenue) {
                dailyRevenue += log.revenue;
            }
        });


        res.json({
            totalSlots:     TOTAL_EMP_SLOTS + TOTAL_VIS_SLOTS,
            empSlotsFree:   TOTAL_EMP_SLOTS - activeEmp,
            visSlotsFree:   TOTAL_VIS_SLOTS - activeVis,
            activeParkings: activeParkings.length,
            dailyRevenue,
        });
    } catch (err) {
        console.error('GET /api/parking/stats error:', err.message);
        res.status(500).json({ error: 'Failed to compute dashboard stats.' });
    }
});

// ─── POST /api/parking/entry ── Register a vehicle entry ─────────────────────
router.post('/entry', async (req, res) => {
    try {
        const { plateNumber, slotInput } = req.body;

        // ── Validate inputs ──────────────────────────────────────────────
        if (!plateNumber || !slotInput) {
            return res.status(400).json({ error: 'Both plateNumber and slotInput are required.' });
        }

        const plate = cleanPlate(plateNumber);
        const { slot, block } = parseSlotInput(slotInput);

        if (!slot || !block) {
            return res.status(400).json({ error: 'Invalid slot format. Use e.g. A-15 or C02.' });
        }

        // ── Determine if employee or visitor ─────────────────────────────
        const employee = await Employee.findOne({ plate });
        const isEmployee = !!employee;
        const parkingType = isEmployee ? 'Employee' : 'Visitor';

        // ── Zone validation ──────────────────────────────────────────────
        const slotZone = getZoneForBlock(block);
        if (!slotZone) {
            return res.status(400).json({
                error: `Invalid block "${block}". Valid blocks: A, B → Employee Zone | C, D → Visitor Zone.`,
            });
        }

        const requiredZone = isEmployee ? 'employee' : 'visitor';
        if (slotZone !== requiredZone) {
            const correct = isEmployee
                ? 'Blocks A or B (Employee Zone)'
                : 'Blocks C or D (Visitor Zone)';
            return res.status(400).json({
                error: `Zone Mismatch! "${plate}" is a ${parkingType}. Please assign a slot in ${correct}.`,
            });
        }

        // ── Occupancy check ──────────────────────────────────────────────
        const occupied = await Log.findOne({ slot, status: 'Parked' });
        if (occupied) {
            return res.status(409).json({
                error: `Slot ${slot} is currently occupied.`,
            });
        }

        // ── Generate token & save ────────────────────────────────────────
        const token = await generateToken(isEmployee);
        const now = new Date();

        const log = await Log.create({
            plate,
            type: parkingType,
            slot,
            token,
            timeIn: now.toLocaleTimeString(),
            date: now.toLocaleDateString(),
            status: 'Parked',
        });

        // Broadcast real-time update
        const io = req.app.get('io');
        if (io) io.emit('parkingUpdate', { action: 'entry', log });

        res.status(201).json({
            message: 'Vehicle entry recorded.',
            log,
        });
    } catch (err) {
        console.error('POST /api/parking/entry error:', err.message);
        res.status(500).json({ error: 'Failed to process vehicle entry.' });
    }
});

// ─── POST /api/parking/exit ── Process a vehicle exit ────────────────────────
router.post('/exit', async (req, res) => {
    try {
        const { input } = req.body;

        if (!input) {
            return res.status(400).json({ error: 'Token or plate number is required.' });
        }

        const cleaned = input.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase();
        const noHyphens = cleaned.replace(/-/g, '');

        // ── Find active record by token OR plate ─────────────────────────
        const record = await Log.findOne({
            status: 'Parked',
            $or: [
                { token: cleaned },
                { plate: cleaned },
                { plate: noHyphens },
            ],
        });

        if (!record) {
            return res.status(404).json({
                error: 'No active parked vehicle found with this Token or Number Plate.',
            });
        }

        // ── Calculate duration ───────────────────────────────────────────
        const exitTime = new Date();
        const exitTimeStr = exitTime.toLocaleTimeString();
        let durationStr = 'Session Ended';
        let revenueCharged = 0;

        try {
            const inDate = new Date(`${record.date} ${record.timeIn}`);
            const diff = Math.max(0, Math.floor((exitTime - inDate) / 1000));
            const hh = Math.floor(diff / 3600);
            const mm = Math.floor((diff % 3600) / 60);
            const ss = diff % 60;
            durationStr = hh > 0 ? `${hh}h ${mm}m` : mm > 0 ? `${mm}m ${ss}s` : `${ss}s`;

            // Revenue for visitors
            if (record.type === 'Visitor') {
                const hours = Math.ceil(diff / 3600);
                
                // Fetch dynamic rate
                let settings = await Settings.findOne();
                let rate = settings ? settings.visitorRatePerHour : 10;
                
                revenueCharged = hours * rate;
            }
        } catch (_) { /* keep default durationStr */ }

        // ── Update the record ────────────────────────────────────────────
        record.status = 'Exited';
        record.timeOut = exitTimeStr;
        record.revenue = revenueCharged;
        await record.save();


        // Broadcast real-time update
        const io = req.app.get('io');
        if (io) io.emit('parkingUpdate', { action: 'exit', log: record });

        res.json({
            message: 'Vehicle exit processed.',
            log: record,
            duration: durationStr,
            revenueCharged,
        });
    } catch (err) {
        console.error('POST /api/parking/exit error:', err.message);
        res.status(500).json({ error: 'Failed to process vehicle exit.' });
    }
});

// ─── POST /api/parking/auto-assign ── Find the next free slot ────────────────
router.post('/auto-assign', async (req, res) => {
    try {
        const { plateNumber } = req.body;

        if (!plateNumber) {
            return res.status(400).json({ error: 'plateNumber is required.' });
        }

        const plate = cleanPlate(plateNumber);
        const employee = await Employee.findOne({ plate });
        const isEmployee = !!employee;
        const zone = isEmployee ? ZONE_CONFIG.employee : ZONE_CONFIG.visitor;

        // Get all currently occupied slots in one query
        const occupiedLogs = await Log.find({ status: 'Parked' }).select('slot');
        const occupiedSlots = new Set(occupiedLogs.map(l => l.slot));

        for (const block of zone.blocks) {
            for (let i = 1; i <= SLOTS_PER_BLOCK; i++) {
                const slotNum = `${block}-${i.toString().padStart(2, '0')}`;
                if (!occupiedSlots.has(slotNum)) {
                    return res.json({
                        slot: slotNum,
                        type: isEmployee ? 'Employee' : 'Visitor',
                    });
                }
            }
        }

        return res.status(404).json({
            error: `No empty slots available in the ${zone.label}.`,
        });
    } catch (err) {
        console.error('POST /api/parking/auto-assign error:', err.message);
        res.status(500).json({ error: 'Failed to auto-assign slot.' });
    }
});

// ─── POST /api/parking/clear-all ── Bulk exit all parked vehicles ────────────
router.post('/clear-all', async (req, res) => {
    try {
        const currentTime = new Date().toLocaleTimeString();
        const result = await Log.updateMany(
            { status: 'Parked' },
            { $set: { status: 'Exited', timeOut: currentTime } }
        );

        // Broadcast real-time update
        const io = req.app.get('io');
        if (io) io.emit('parkingUpdate', { action: 'clearAll', modifiedCount: result.modifiedCount });

        res.json({
            message: `${result.modifiedCount} vehicles have been checked out.`,
            modifiedCount: result.modifiedCount,
        });
    } catch (err) {
        console.error('POST /api/parking/clear-all error:', err.message);
        res.status(500).json({ error: 'Failed to clear all slots.' });
    }
});

module.exports = router;
