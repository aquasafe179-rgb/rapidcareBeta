// models/Doctor.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const DoctorSchema = new mongoose.Schema(
  {
    hospitalId: { type: String, index: true },
    doctorId: { type: String, required: true, unique: true },
    name: String,
    qualification: String,
    speciality: String,
    experience: String,
    photoUrl: String,
    lastKnownLocation: {
      lat: Number,
      lng: Number,
      updatedAt: Date
    },
    password: { type: String, default: 'test@1234' },
    forcePasswordChange: { type: Boolean, default: true },
    availability: { type: String, enum: ['Available', 'Not Available'], default: 'Not Available' },
    shift: { type: String, enum: ['Morning', 'Afternoon', 'Evening', 'Night'], default: 'Morning' },
    todayHours: { type: Number, default: 0 },
    proximityStatus: { type: String, default: 'Out of Range' },
    attendance: [
      {
        date: { type: Date },
        status: { type: String, enum: ['Present', 'Absent'] },
        shift: { type: String, enum: ['Morning', 'Afternoon', 'Evening', 'Night'] },
        markedBy: { type: String, enum: ['Reception', 'Doctor'] }
      }
    ],
  },
  { timestamps: true }
);

DoctorSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    if (this.password.startsWith('$2b$')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

DoctorSchema.methods.comparePassword = async function (candidate) {
  // Try bcrypt first (for hashed passwords), fallback to plain text comparison
  try {
    return await bcrypt.compare(candidate, this.password);
  } catch (err) {
    // If bcrypt fails, it might be a plain text password
    return candidate === this.password;
  }
};

module.exports = mongoose.model('Doctor', DoctorSchema);


