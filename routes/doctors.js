// routes/doctors.js
const express = require('express');
const router = express.Router();
const Doctor = require('../models/Doctor');
const Attendance = require('../models/Attendance');
const { auth } = require('../middleware/auth');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

const multer = require('multer');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const hospitalId = req.body.hospitalId || 'default';
    const dir = path.join(__dirname, '..', 'uploads', 'hospitals', hospitalId, 'doctors');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

module.exports = (io) => {
  // Get single doctor by doctorId
  router.get('/doctor/:doctorId', async (req, res) => {
    try {
      const doctor = await Doctor.findOne({ doctorId: req.params.doctorId }).lean();
      if (!doctor) return res.status(404).json({ message: 'Doctor not found' });
      res.json(doctor);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  router.get('/:hospitalId', async (req, res) => {
    // If a hospital is logged in, enforce scoping
    if (req.user && req.user.role === 'hospital' && req.user.ref !== req.params.hospitalId) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    // Optimized with .lean() for faster performance
    const doctors = await Doctor.find({ hospitalId: req.params.hospitalId }).lean();
    res.json(doctors);
  });

  router.post('/', auth(['hospital']), upload.single('photo'), async (req, res) => {
    try {
      if (req.user.role === 'hospital' && req.user.ref !== req.body.hospitalId) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }

      // Validate required fields
      if (!req.body.doctorId || !req.body.hospitalId) {
        return res.status(400).json({ success: false, message: 'Doctor ID and Hospital ID are required' });
      }

      // Check if doctor already exists
      const existing = await Doctor.findOne({ doctorId: req.body.doctorId });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Doctor ID already exists' });
      }

      const photoUrl = req.file ? `/uploads/hospitals/${req.body.hospitalId}/doctors/${req.file.filename}` : '';

      const doc = new Doctor({
        ...req.body,
        password: 'test@1234',
        forcePasswordChange: true,
        photoUrl
      });
      await doc.save();
      res.json({ success: true, doctor: doc });
    } catch (err) {
      console.error('Doctor creation error:', err);
      res.status(400).json({ success: false, message: err.message || 'Failed to create doctor' });
    }
  });

  // Upload doctor photo
  router.post('/:doctorId/photo', auth(['doctor', 'hospital']), upload.single('photo'), async (req, res) => {
    try {
      const existing = await Doctor.findOne({ doctorId: req.params.doctorId });
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Doctor not found' });
      }

      // Check permissions
      if (req.user.role === 'hospital' && req.user.ref !== existing.hospitalId) {
        return res.status(403).json({ success: false, message: 'Forbidden: Cannot upload photos for doctors from other hospitals' });
      }

      // For doctor role, check if token ref matches doctorId (case-insensitive)
      if (req.user.role === 'doctor') {
        const tokenRef = (req.user.ref || '').toUpperCase();
        const doctorId = (req.params.doctorId || '').toUpperCase();
        if (tokenRef !== doctorId) {
          console.error('Doctor photo auth mismatch:', { tokenRef, doctorId, user: req.user });
          return res.status(403).json({ success: false, message: 'Forbidden: Token does not match doctor ID' });
        }
      }

      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No photo file provided. Please select an image file.' });
      }

      // Validate file size (5MB max)
      if (req.file.size > 5 * 1024 * 1024) {
        return res.status(400).json({ success: false, message: 'File size exceeds 5MB limit' });
      }

      const photoUrl = `/uploads/hospitals/${existing.hospitalId}/doctors/${req.file.filename}`;
      const updated = await Doctor.findOneAndUpdate(
        { doctorId: req.params.doctorId },
        { $set: { photoUrl } },
        { new: true }
      );

      res.json({ success: true, doctor: updated });
    } catch (err) {
      console.error('Doctor photo upload error:', err);
      res.status(500).json({ success: false, message: err.message || 'Failed to upload photo' });
    }
  });

  router.put('/:doctorId', auth(['doctor', 'hospital']), async (req, res) => {
    try {
      const existing = await Doctor.findOne({ doctorId: req.params.doctorId });
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Doctor not found' });
      }

      // Check permissions
      if (req.user.role === 'hospital' && req.user.ref !== existing.hospitalId) {
        return res.status(403).json({ success: false, message: 'Forbidden: Cannot update doctors from other hospitals' });
      }

      // For doctor role, check if token ref matches doctorId (case-insensitive)
      if (req.user.role === 'doctor') {
        const tokenRef = (req.user.ref || '').toUpperCase();
        const doctorId = (req.params.doctorId || '').toUpperCase();
        if (tokenRef !== doctorId) {
          console.error('Doctor auth mismatch:', { tokenRef, doctorId, user: req.user });
          return res.status(403).json({ success: false, message: 'Forbidden: Token does not match doctor ID' });
        }
      }

      const updated = await Doctor.findOneAndUpdate(
        { doctorId: req.params.doctorId },
        { $set: req.body },
        { new: true }
      );

      res.json({ success: true, doctor: updated });
    } catch (err) {
      console.error('Doctor update error:', err);
      res.status(500).json({ success: false, message: err.message || 'Failed to update doctor profile' });
    }
  });

  router.delete('/:doctorId', auth(['hospital']), async (req, res) => {
    await Doctor.findOneAndDelete({ doctorId: req.params.doctorId });
    res.json({ success: true });
  });

  router.post('/attendance', auth(['doctor', 'hospital']), async (req, res) => {
    try {
      const { doctorId, date, availability, shift, method } = req.body;

      // Validate required fields
      if (!doctorId || !date || !availability) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: doctorId, date, and availability are required'
        });
      }

      // For doctor role, verify they can only mark their own attendance
      if (req.user.role === 'doctor') {
        const tokenRef = (req.user.ref || '').toUpperCase();
        const requestDoctorId = (doctorId || '').toUpperCase();
        if (tokenRef !== requestDoctorId) {
          return res.status(403).json({
            success: false,
            message: 'Forbidden: You can only mark your own attendance'
          });
        }
      }

      // For hospital role, verify doctor belongs to their hospital
      if (req.user.role === 'hospital') {
        const doctor = await Doctor.findOne({ doctorId });
        if (!doctor) {
          return res.status(404).json({ success: false, message: 'Doctor not found' });
        }
        if (doctor.hospitalId !== req.user.ref) {
          return res.status(403).json({
            success: false,
            message: 'Forbidden: Cannot mark attendance for doctors from other hospitals'
          });
        }
      }

      const markedBy = req.user.role === 'doctor' ? 'Doctor' : 'Reception';
      const day = new Date(date);
      day.setHours(0, 0, 0, 0);

      const att = await Attendance.findOneAndUpdate(
        { doctorId, date: day },
        { $set: { availability, shift: shift || 'Morning', markedBy, method: method || 'Manual' } },
        { upsert: true, new: true }
      );

      // Sync with Doctor model
      const docStatus = availability === 'Present' ? 'Available' : 'Not Available';
      await Doctor.findOneAndUpdate(
        { doctorId },
        { $set: { availability: docStatus } }
      );

      // Emit real-time update
      const doctor = await Doctor.findOne({ doctorId });
      if (doctor) {
        io.to(`hospital_${doctor.hospitalId}`).emit('doctor:attendance', {
          doctorId,
          hospitalId: doctor.hospitalId,
          availability: docStatus,
          shift: shift || 'Morning'
        });
        io.emit('doctor:update', { doctorId, availability: docStatus });
      }

      return res.json({ success: true, attendance: att });
    } catch (err) {
      console.error('Attendance update error:', err);
      return res.status(500).json({ success: false, message: err.message || 'Failed to update attendance' });
    }
  });

  // Manual attendance update route for reception staff
  router.put('/attendance/manual-update', auth(['hospital']), async (req, res) => {
    try {
      const { doctorId, date, availability, shift } = req.body;

      // Validation
      if (!doctorId || !date || !availability) {
        return res.status(400).json({
          success: false,
          message: 'DoctorId, date, and availability (Present/Absent/Leave) are required'
        });
      }

      // Check if doctor exists and belongs to the requesting hospital
      const doctor = await Doctor.findOne({ doctorId });
      if (!doctor) {
        return res.status(404).json({ success: false, message: 'Doctor not found' });
      }

      if (req.user.ref !== doctor.hospitalId) {
        return res.status(403).json({ success: false, message: 'Cannot edit attendance for doctors from other hospitals' });
      }

      // Normalize date (remove time component)
      const day = new Date(date);
      day.setHours(0, 0, 0, 0);

      // Update or create attendance record
      const att = await Attendance.findOneAndUpdate(
        { doctorId, date: day },
        {
          $set: {
            availability,
            shift: shift || 'Morning',
            markedBy: 'Reception',
            method: 'Manual Edit',
            updatedAt: new Date()
          }
        },
        { upsert: true, new: true }
      );

      // Sync with Doctor model
      const docStatus = availability === 'Present' ? 'Available' : 'Not Available';
      await Doctor.findOneAndUpdate(
        { doctorId },
        { $set: { availability: docStatus } }
      );

      // Emit socket update
      io.emit('doctor:update', { doctorId, availability: docStatus });
      io.to(`hospital_${doctor.hospitalId}`).emit('attendance:updated', { doctorId, attendance: att });

      return res.json({ success: true, attendance: att, message: 'Attendance updated successfully' });
    } catch (err) {
      console.error('Manual attendance update error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  router.get('/attendance/:doctorId', async (req, res) => {
    const list = await Attendance.find({ doctorId: req.params.doctorId }).sort({ date: -1 });
    res.json(list);
  });

  // Generate QR for Present/Absent for a doctor
  router.get('/:doctorId/attendance/qrs', auth(['hospital', 'doctor']), async (req, res) => {
    try {
      const dir = path.join(__dirname, '..', 'uploads', 'qrs');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const base = process.env.BASE_URL || 'http://localhost:5000';
      const presentUrl = `${base}/api/doctors/attendance/scan/${encodeURIComponent(req.params.doctorId)}?set=Present`;
      const absentUrl = `${base}/api/doctors/attendance/scan/${encodeURIComponent(req.params.doctorId)}?set=Absent`;
      const pPath = path.join(dir, `${req.params.doctorId}-present.png`);
      const aPath = path.join(dir, `${req.params.doctorId}-absent.png`);
      await QRCode.toFile(pPath, presentUrl);
      await QRCode.toFile(aPath, absentUrl);
      res.json({ present: `/uploads/qrs/${req.params.doctorId}-present.png`, absent: `/uploads/qrs/${req.params.doctorId}-absent.png` });
    } catch (err) { res.status(500).json({ message: err.message }); }
  });

  // Scan endpoint to mark attendance via QR
  router.get('/attendance/scan/:doctorId', async (req, res) => {
    try {
      const set = req.query.set;
      const shift = req.query.shift || 'Morning';

      if (!['Present', 'Absent'].includes(set)) {
        return res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Invalid QR Scan</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: Arial, sans-serif; max-width: 400px; margin: 50px auto; padding: 20px; text-align: center; }
              .error { color: #dc3545; background: #f8d7da; padding: 20px; border-radius: 8px; }
            </style>
          </head>
          <body>
            <div class="error">
              <h2>❌ Invalid QR Code</h2>
              <p>This QR code is not valid for attendance marking.</p>
            </div>
          </body>
          </html>
        `);
      }

      // Check if doctor exists
      const doctor = await Doctor.findOne({ doctorId: req.params.doctorId });
      if (!doctor) {
        return res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Doctor Not Found</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: Arial, sans-serif; max-width: 400px; margin: 50px auto; padding: 20px; text-align: center; }
              .error { color: #dc3545; background: #f8d7da; padding: 20px; border-radius: 8px; }
            </style>
          </head>
          <body>
            <div class="error">
              <h2>❌ Doctor Not Found</h2>
              <p>Doctor ID "${req.params.doctorId}" not found in system.</p>
            </div>
          </body>
          </html>
        `);
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const att = await Attendance.findOneAndUpdate(
        { doctorId: req.params.doctorId, date: today },
        {
          $set: {
            availability: set,
            shift: shift,
            markedBy: 'Doctor',
            markedAt: new Date()
          }
        },
        { upsert: true, new: true }
      );

      // Return success page
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Attendance Marked</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Arial, sans-serif; max-width: 400px; margin: 50px auto; padding: 20px; text-align: center; }
            .success { color: #155724; background: #d4edda; padding: 20px; border-radius: 8px; }
            .info { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 15px; }
          </style>
        </head>
        <body>
          <div class="success">
            <h2>✅ Attendance Marked Successfully!</h2>
            <p><strong>Doctor:</strong> ${doctor.name || req.params.doctorId}</p>
            <p><strong>Status:</strong> ${set}</p>
            <p><strong>Shift:</strong> ${shift}</p>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
            <p><strong>Time:</strong> ${new Date().toLocaleTimeString()}</p>
          </div>
          <div class="info">
            <p>Your attendance has been recorded in the system.</p>
          </div>
        </body>
        </html>
      `);

    } catch (err) {
      console.error('Attendance scan error:', err);
      res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Arial, sans-serif; max-width: 400px; margin: 50px auto; padding: 20px; text-align: center; }
            .error { color: #dc3545; background: #f8d7da; padding: 20px; border-radius: 8px; }
          </style>
        </head>
        <body>
          <div class="error">
            <h2>❌ System Error</h2>
            <p>Unable to mark attendance. Please try again or contact IT support.</p>
          </div>
        </body>
        </html>
      `);
    }
  });

  // Geofence Distance Helper (km)
  function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Geofence Check-in Route
  router.post('/geofence-checkin', auth(['doctor']), async (req, res) => {
    try {
      const { doctorId, lat, lng } = req.body;
      if (!lat || !lng) return res.status(400).json({ success: false, message: 'Coordinates required' });

      const doctor = await Doctor.findOne({ doctorId });
      if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });

      const Hospital = require('../models/Hospital');
      const hospital = await Hospital.findOne({ hospitalId: doctor.hospitalId });
      if (!hospital || !hospital.location || !hospital.location.lat) {
        return res.status(400).json({ success: false, message: 'Hospital location not configured' });
      }

      const dist = getDistance(lat, lng, hospital.location.lat, hospital.location.lng);
      const radius = 0.1; // 100 meters (strictly as per requirements)

      if (dist > radius) {
        return res.status(400).json({
          success: false,
          message: `Outside geofence radius. You are ${(dist * 1000).toFixed(0)}m away. Max allowed: ${radius * 1000}m.`
        });
      }

      // Mark Attendance (Check-In)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const att = await Attendance.findOneAndUpdate(
        { doctorId, date: today },
        {
          $set: {
            availability: 'Present',
            markedBy: 'Doctor',
            method: 'Geofence',
            checkIn: new Date()
          }
        },
        { upsert: true, new: true }
      );

      // Update Doctor status and last location
      await Doctor.findOneAndUpdate(
        { doctorId },
        {
          $set: {
            availability: 'Available',
            proximityStatus: 'Within 100m',
            lastKnownLocation: { lat, lng, updatedAt: new Date() }
          }
        }
      );

      // Emit events
      io.to(`hospital_${doctor.hospitalId}`).emit('doctor:attendance', {
        doctorId,
        hospitalId: doctor.hospitalId,
        availability: 'Available',
        proximityStatus: 'Within 100m',
        method: 'Geofence',
        checkIn: att.checkIn
      });

      res.json({ success: true, distance: dist, attendance: att });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Geofence Check-out Route
  router.post('/geofence-checkout', auth(['doctor']), async (req, res) => {
    try {
      const { doctorId, lat, lng } = req.body;
      if (!lat || !lng) return res.status(400).json({ success: false, message: 'Coordinates required' });

      const doctor = await Doctor.findOne({ doctorId });
      if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });

      const Hospital = require('../models/Hospital');
      const hospital = await Hospital.findOne({ hospitalId: doctor.hospitalId });
      if (!hospital || !hospital.location || !hospital.location.lat) {
        return res.status(400).json({ success: false, message: 'Hospital location not configured' });
      }

      const dist = getDistance(lat, lng, hospital.location.lat, hospital.location.lng);
      const radius = 0.1; // 100 meters

      if (dist > radius) {
        return res.status(400).json({
          success: false,
          message: `Outside geofence radius. You are ${(dist * 1000).toFixed(0)}m away. Max allowed: ${radius * 1000}m.`
        });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const att = await Attendance.findOne({ doctorId, date: today });
      if (!att || !att.checkIn) {
        return res.status(400).json({ success: false, message: 'No active check-in found for today' });
      }

      const checkOut = new Date();
      const diffMs = checkOut - att.checkIn;
      const hours = (diffMs / (1000 * 60 * 60)).toFixed(2);

      const updatedAtt = await Attendance.findOneAndUpdate(
        { doctorId, date: today },
        {
          $set: {
            checkOut: checkOut,
            totalHours: hours
          }
        },
        { new: true }
      );

      // Update Doctor status to Not Available on checkout
      await Doctor.findOneAndUpdate(
        { doctorId },
        {
          $set: {
            availability: 'Not Available',
            proximityStatus: 'Out of Range',
            todayHours: hours
          }
        }
      );

      io.to(`hospital_${doctor.hospitalId}`).emit('doctor:attendance', {
        doctorId,
        hospitalId: doctor.hospitalId,
        availability: 'Not Available',
        proximityStatus: 'Out of Range',
        method: 'Geofence',
        checkOut: checkOut,
        totalHours: hours
      });

      res.json({ success: true, distance: dist, attendance: updatedAtt });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  return router;
};

