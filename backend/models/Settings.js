const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    visitorRatePerHour: {
        type: Number,
        required: true,
        default: 10
    }
});

module.exports = mongoose.model('Settings', settingsSchema);
