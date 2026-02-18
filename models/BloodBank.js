const mongoose = require('mongoose');

const bloodBankSchema = new mongoose.Schema({
    hospitalId: {
        type: String,
        required: true,
        ref: 'Hospital'
    },
    bloodGroup: {
        type: String,
        required: true,
        enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
    },
    units: {
        type: Number,
        required: true,
        default: 0
    },
    updatedBy: {
        type: String, // 'nurse' or 'reception'
        default: 'system'
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

// Composite index to ensure one record per blood group per hospital
bloodBankSchema.index({ hospitalId: 1, bloodGroup: 1 }, { unique: true });

module.exports = mongoose.model('BloodBank', bloodBankSchema);
