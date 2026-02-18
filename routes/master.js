// routes/master.js
const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');

// Models
const Hospital = require('../models/Hospital');
const Doctor = require('../models/Doctor');
const Ambulance = require('../models/Ambulance');
const Bed = require('../models/Bed');
const EmergencyRequest = require('../models/EmergencyRequest');
const Nurse = require('../models/Nurse');
const Announcement = require('../models/Announcement');
const BloodBank = require('../models/BloodBank');
const CallLog = require('../models/CallLog');

const models = {
    hospitals: Hospital,
    doctors: Doctor,
    ambulances: Ambulance,
    beds: Bed,
    emergencies: EmergencyRequest,
    nurses: Nurse,
    announcements: Announcement,
    bloodbank: BloodBank,
    calllogs: CallLog
};

// Middleware to check if collection is valid
const validateCollection = (req, res, next) => {
    const { collection } = req.params;
    if (!models[collection]) {
        return res.status(404).json({ success: false, message: `Collection ${collection} not found` });
    }
    next();
};

// Generic list route
router.get('/:collection', auth(['superadmin']), validateCollection, async (req, res) => {
    try {
        const data = await models[req.params.collection].find().sort({ createdAt: -1 }).limit(100);
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Generic delete route
router.delete('/:collection/:id', auth(['superadmin']), validateCollection, async (req, res) => {
    try {
        const { collection, id } = req.params;
        const model = models[collection];

        const removed = await model.findByIdAndDelete(id);
        if (!removed) {
            // Try by custom ID fields
            const idFields = ['hospitalId', 'doctorId', 'ambulanceId', 'bedId', 'nurseId'];
            for (const field of idFields) {
                const deleted = await model.findOneAndDelete({ [field]: id });
                if (deleted) return res.json({ success: true, message: 'Deleted by custom ID' });
            }
            return res.status(404).json({ success: false, message: 'Record not found' });
        }

        res.json({ success: true, message: 'Record deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Generic update route
router.put('/:collection/:id', auth(['superadmin']), validateCollection, async (req, res) => {
    try {
        const { collection, id } = req.params;
        const model = models[collection];
        const updateData = req.body;

        // Prevent updating IDs
        delete updateData._id;
        delete updateData.hospitalId;
        delete updateData.doctorId;
        delete updateData.ambulanceId;

        const updated = await model.findByIdAndUpdate(id, { $set: updateData }, { new: true });

        if (!updated) {
            // Try by custom ID fields
            const idFields = ['hospitalId', 'doctorId', 'ambulanceId', 'bedId', 'nurseId'];
            for (const field of idFields) {
                const doc = await model.findOneAndUpdate({ [field]: id }, { $set: updateData }, { new: true });
                if (doc) return res.json({ success: true, message: 'Updated by custom ID', data: doc });
            }
            return res.status(404).json({ success: false, message: 'Record not found' });
        }

        res.json({ success: true, message: 'Record updated', data: updated });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
