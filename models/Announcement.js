const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
    hospitalId: {
        type: String,
        required: true,
        ref: 'Hospital'
    },
    message: {
        type: String,
        required: true
    },
    severity: {
        type: String,
        enum: ['Info', 'Warning', 'Critical'],
        default: 'Info'
    },
    expiresAt: {
        type: Date,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Announcement', announcementSchema);
