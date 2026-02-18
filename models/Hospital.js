// models/Hospital.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const addressSchema = new mongoose.Schema(
  {
    state: { type: String, default: '' },
    district: { type: String, default: '' },
    city: { type: String, default: '' },
    street: { type: String, default: '' },
  },
  { _id: false }
);

const HospitalSchema = new mongoose.Schema(
  {
    hospitalId: { type: String, required: true, unique: true, index: true },
    name: { type: String, default: '' },
    address: { type: addressSchema, default: {} },
    contact: { type: String, default: '' },
    googleMapUrl: { type: String, default: '' },
    location: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null }
    },
    gallery: { type: [String], default: [] },
    services: { type: [String], default: [] },
    tests: { type: [String], default: [] },
    insurance: { type: [String], default: [] },
    procedures: { type: [String], default: [] },
    facilities: { type: [String], default: [] },
    management: { type: [String], default: [] },
    highlights: { type: [String], default: [] },
    treatment: { type: [String], default: [] },
    surgery: { type: [String], default: [] },
    therapy: { type: [String], default: [] },
    password: { type: String, default: 'test@1234' },
    forcePasswordChange: { type: Boolean, default: true },
    attendanceQR: {
      presentQR: { type: String, default: '' },
      absentQR: { type: String, default: '' },
      generatedAt: { type: Date }
    }
  },
  { timestamps: true }
);

// Pre-save hook to hash password and extract coordinates
HospitalSchema.pre('save', async function (next) {
  // Hash password
  if (this.isModified('password') && !this.password.startsWith('$2b$')) {
    try {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    } catch (error) {
      return next(error);
    }
  }

  // Extract coordinates from Google Map URL
  if (this.isModified('googleMapUrl') && this.googleMapUrl) {
    const { extractCoordinatesFromUrl } = require('../utils/coordinateExtractor');
    const coords = extractCoordinatesFromUrl(this.googleMapUrl);
    if (coords) {
      this.location = coords;
    }
  }

  next();
});

HospitalSchema.methods.comparePassword = async function (candidate) {
  try {
    // Try bcrypt comparison
    return await bcrypt.compare(candidate, this.password);
  } catch (err) {
    // Fallback: simple string comparison (for legacy/plain text passwords)
    return candidate === this.password;
  }
};

module.exports = mongoose.model('Hospital', HospitalSchema);


