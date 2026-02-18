const mongoose = require('mongoose');

const CallLogSchema = new mongoose.Schema(
    {
        hospitalId: { type: String, required: true },
        callerName: String,
        callerMobile: String,
        reason: String,
        status: { type: String, enum: ['Pending', 'Accepted', 'Rejected'], default: 'Pending' },
        remarks: String,
        calledAt: { type: Date, default: Date.now }
    },
    { timestamps: true }
);

module.exports = mongoose.model('CallLog', CallLogSchema);
