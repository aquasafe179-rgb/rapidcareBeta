// models/Attendance.js
const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema(
  {
    doctorId: { type: String, required: true, index: true },
    date: { type: Date, required: true },
    availability: { type: String, enum: ['Present', 'Absent'], required: true },
    shift: { type: String, enum: ['Morning', 'Afternoon', 'Evening', 'Night'], default: 'Morning' },
    checkIn: { type: Date },
    checkOut: { type: Date },
    totalHours: { type: Number, default: 0 },
    markedBy: { type: String, enum: ['Doctor', 'Reception'], required: true },
    method: { type: String, enum: ['Manual', 'QR', 'Geofence', 'Manual Edit'], required: false },
  },
  { timestamps: true }
);

AttendanceSchema.index({ doctorId: 1, date: 1 }, { unique: true });
module.exports = mongoose.model('Attendance', AttendanceSchema);


