// models/Bed.js
const mongoose = require('mongoose');

const BedSchema = new mongoose.Schema(
  {
    hospitalId: { type: String, required: true, index: true },
    bedId: { type: String, required: true, unique: true },
    bedNumber: { type: String, required: true },
    wardNumber: { type: String, default: '' },
    bedType: { type: String, enum: ['ICU', 'General', 'Other'], default: 'General' },
    status: { type: String, enum: ['Vacant', 'Occupied', 'Reserved', 'Cleaning', 'Maintenance'], default: 'Vacant' },
    qrCodeUrl: { type: String, default: '' },
    qrVacantUrl: { type: String, default: '' },
    qrOccupiedUrl: { type: String, default: '' },
    lastUpdated: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Bed', BedSchema);


