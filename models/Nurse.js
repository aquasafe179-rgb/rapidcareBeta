const mongoose = require('mongoose');

const nurseSchema = new mongoose.Schema({
    nurseId: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    name: {
        type: String,
        required: true
    },
    hospitalId: {
        type: String,
        required: true,
        ref: 'Hospital'
    },
    password: {
        type: String,
        required: true
    },
    mobile: {
        type: String,
        required: true
    },
    photoUrl: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Nurse', nurseSchema);
