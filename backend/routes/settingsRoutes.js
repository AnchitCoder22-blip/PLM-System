const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');
const Log = require('../models/Log');

// ─── GET /api/settings ── Fetch current settings ─────────────────────────────
router.get('/', async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = await Settings.create({ visitorRatePerHour: 10 });
        }
        res.json(settings);
    } catch (err) {
        console.error('GET /api/settings error:', err.message);
        res.status(500).json({ error: 'Failed to fetch settings.' });
    }
});

// ─── PUT /api/settings ── Update settings ────────────────────────────────────
router.put('/', async (req, res) => {
    try {
        const { visitorRatePerHour } = req.body;
        if (visitorRatePerHour === undefined || isNaN(visitorRatePerHour)) {
            return res.status(400).json({ error: 'Valid visitorRatePerHour is required.' });
        }

        let settings = await Settings.findOne();
        if (!settings) {
            settings = new Settings();
        }
        
        settings.visitorRatePerHour = Number(visitorRatePerHour);
        await settings.save();
        
        res.json({ message: 'Settings updated successfully.', settings });
    } catch (err) {
        console.error('PUT /api/settings error:', err.message);
        res.status(500).json({ error: 'Failed to update settings.' });
    }
});

// ─── GET /api/settings/revenue-chart ── Aggregates 7-day revenue ─────────────
router.get('/revenue-chart', async (req, res) => {
    try {
        const dateLimit = new Date();
        dateLimit.setDate(dateLimit.getDate() - 6); // Last 7 days including today
        dateLimit.setHours(0, 0, 0, 0);

        const logs = await Log.find({ 
            status: 'Exited', 
            revenue: { $gt: 0 },
            createdAt: { $gte: dateLimit }
        });

        const labels = [];
        const data = [];
        const revenueByDate = {};

        // Initialize last 7 days with 0
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toLocaleDateString();
            revenueByDate[dateStr] = 0;
            
            // Format label for chart (e.g. "Apr 18")
            const formattedLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            labels.push(formattedLabel);
        }

        // We need to map logs.date (which is in local format) to the index, or just keep revenueByDate keyed by localDateString
        // Actually, labels shouldn't be the keys. 
        const dateKeys = Object.keys(revenueByDate);

        logs.forEach(log => {
            if (revenueByDate[log.date] !== undefined) {
                revenueByDate[log.date] += log.revenue;
            }
        });

        dateKeys.forEach(key => {
            data.push(revenueByDate[key]);
        });

        res.json({ labels, data });
    } catch (err) {
        console.error('GET /api/settings/revenue-chart error:', err.message);
        res.status(500).json({ error: 'Failed to fetch revenue data.' });
    }
});

module.exports = router;
