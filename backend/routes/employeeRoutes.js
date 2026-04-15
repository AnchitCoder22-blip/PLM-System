const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');

// ─── GET /api/employees ── Retrieve the full employee directory ──────────────
router.get('/', async (_req, res) => {
    try {
        const employees = await Employee.find().sort({ createdAt: -1 });
        res.json(employees);
    } catch (err) {
        console.error('GET /api/employees error:', err.message);
        res.status(500).json({ error: 'Failed to fetch employee records.' });
    }
});

// ─── POST /api/employees ── Register a new employee ─────────────────────────
router.post('/', async (req, res) => {
    try {
        const { name, employeeId, plate } = req.body;

        // ── Validation ───────────────────────────────────────────────────
        if (!name || !employeeId || !plate) {
            return res.status(400).json({ error: 'All fields (name, employeeId, plate) are required.' });
        }

        const cleanPlate = plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

        // ── Duplicate checks ─────────────────────────────────────────────
        const duplicatePlate = await Employee.findOne({ plate: cleanPlate });
        if (duplicatePlate) {
            return res.status(409).json({ error: 'An employee with this Number Plate is already registered.' });
        }

        const duplicateId = await Employee.findOne({ employeeId: employeeId.trim() });
        if (duplicateId) {
            return res.status(409).json({ error: 'An employee with this Employee ID is already registered.' });
        }

        // ── Save ─────────────────────────────────────────────────────────
        const employee = await Employee.create({
            name: name.trim(),
            employeeId: employeeId.trim(),
            plate: cleanPlate,
        });

        res.status(201).json(employee);
    } catch (err) {
        console.error('POST /api/employees error:', err.message);
        res.status(500).json({ error: 'Failed to register employee.' });
    }
});

// ─── DELETE /api/employees/:id ── Remove an employee record ─────────────────
router.delete('/:id', async (req, res) => {
    try {
        const deleted = await Employee.findByIdAndDelete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ error: 'Employee not found.' });
        }
        res.json({ message: 'Employee deleted successfully.', employee: deleted });
    } catch (err) {
        console.error('DELETE /api/employees error:', err.message);
        res.status(500).json({ error: 'Failed to delete employee.' });
    }
});

module.exports = router;
