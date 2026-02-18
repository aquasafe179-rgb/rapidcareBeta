// models/EmergencyRequest.js
const mongoose = require('mongoose');

const EmergencySchema = new mongoose.Schema(
  {
    patient: {
      name: String,
      age: Number,
      gender: String,
      symptoms: String,
      emergencyType: String,
      contactMobile: String,
      contactAddress: String,
    },
    hospitalId: { type: String, index: true },
    ambulanceId: String,
    readyEquipment: String,
    // Include both 'Denied' and 'Rejected' for backward-compat; UI uses 'Rejected'
    status: { type: String, enum: ['Pending', 'Accepted', 'Denied', 'Rejected', 'Transferred', 'Handled', 'Admitted', 'Discharged'], default: 'Pending' },
    bedId: String,
    reason: String,
    alternateHospitals: [String],
    selectedHospital: String,
    submittedBy: { type: String, enum: ['public', 'ambulance'], required: true },
    handledBy: String,
    // EMT and Pilot information (auto-attached from ambulance login)
    emtName: String,
    emtId: String,
    emtMobile: String,
    pilotName: String,
    pilotId: String,
    pilotMobile: String,
    remarks: String,
    rejectionReason: String,
    assisted: { type: Boolean, default: false },
    assistedComment: String,
    handled: { type: Boolean, default: false },
    handledAt: Date,
    // Reply fields
    replyMessage: String,
    replyReason: String,
    transportMode: String, // Ambulance, Private, etc.
    prepInfo: {
      vitals: String,
      patientCondition: String,
      eta: String,
      remarks: String
    },
    isReadyToServe: { type: Boolean, default: false },
    repliedBy: String,
    repliedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('EmergencyRequest', EmergencySchema);

