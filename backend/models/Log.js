const mongoose = require('mongoose');

const logSchema = new mongoose.Schema(
    {
        plate: {
            type: String,
            required: [true, 'Vehicle plate number is required'],
            uppercase: true,
            trim: true,
        },
        type: {
            type: String,
            required: true,
            enum: ['Employee', 'Visitor'],
        },
        slot: {
            type: String,
            required: [true, 'Parking slot is required'],
            uppercase: true,
            trim: true,
        },
        token: {
            type: String,
            required: true,
            unique: true,
        },
        timeIn: {
            type: String,
            required: true,
        },
        timeOut: {
            type: String,
            default: null,
        },
        date: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            required: true,
            enum: ['Parked', 'Exited'],
            default: 'Parked',
        },
    },
    {
        timestamps: true, // adds createdAt & updatedAt
    }
);

// Indexes for common queries (token already indexed via unique:true)
logSchema.index({ plate: 1 });
logSchema.index({ status: 1 });
logSchema.index({ date: 1, status: 1 });

module.exports = mongoose.model('Log', logSchema);
