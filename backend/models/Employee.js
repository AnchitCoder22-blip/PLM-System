const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Employee name is required'],
            trim: true,
        },
        employeeId: {
            type: String,
            required: [true, 'Employee ID is required'],
            unique: true,
            trim: true,
        },
        plate: {
            type: String,
            required: [true, 'Vehicle plate number is required'],
            unique: true,
            uppercase: true,
            trim: true,
        },
    },
    {
        timestamps: true,
    }
);

// plate is already indexed via unique:true on the schema field

module.exports = mongoose.model('Employee', employeeSchema);
