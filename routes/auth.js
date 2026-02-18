// routes/auth.js
const express = require('express');
const jwt = require('jsonwebtoken');
const Hospital = require('../models/Hospital');
const Doctor = require('../models/Doctor');
const Ambulance = require('../models/Ambulance');
const Nurse = require('../models/Nurse');

const router = express.Router();

const signToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET || 'devsecret', { expiresIn: '24h' });
}

router.post('/login', async (req, res) => {
  try {
    let { role, username, password } = req.body;
    role = (role || '').trim().toLowerCase();
    username = (username || '').trim();
    password = password || '';

    let user = null;
    let userType = '';

    if (role === 'hospital') {
      user = await Hospital.findOne({ hospitalId: { $regex: `^${username}$`, $options: 'i' } });
      userType = 'Hospital';
    } else if (role === 'doctor') {
      user = await Doctor.findOne({ doctorId: { $regex: `^${username}$`, $options: 'i' } });
      userType = 'Doctor';
    } else if (role === 'ambulance') {
      const rx = { $regex: `^${username}$`, $options: 'i' };
      user = await Ambulance.findOne({ $or: [{ 'emt.emtId': rx }, { 'pilot.pilotId': rx }, { ambulanceId: rx }] });
      userType = 'Ambulance';
    } else if (role === 'nurse') {
      user = await Nurse.findOne({ nurseId: { $regex: `^${username}$`, $options: 'i' } });
      userType = 'Nurse';
    } else if (role === 'superadmin') {
      const SuperAdmin = require('../models/SuperAdmin');
      user = await SuperAdmin.findOne({ username: { $regex: `^${username}$`, $options: 'i' } });
      userType = 'SuperAdmin';
    } else {
      return res.status(400).json({ message: 'Invalid role' });
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const ok = (role === 'superadmin')
      ? await require('bcrypt').compare(password, user.password)
      : await user.comparePassword(password);

    if (!ok) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    // Update last login for ambulance
    if (role === 'ambulance') {
      user.lastLogin = new Date();
      user.status = 'On Duty'; // Set to active on login
      await user.save();
    }

    // Build token payload with hospitalId for doctor
    const tokenPayload = { role, id: user._id, ref: username };
    if ((role === 'doctor' || role === 'nurse') && user.hospitalId) {
      tokenPayload.hospitalId = user.hospitalId;
    }

    const token = signToken(tokenPayload);

    // Return user data for login
    if (role === 'ambulance') {
      res.json({ token, forcePasswordChange: !!user.forcePasswordChange, ambulance: user });
    } else if (role === 'doctor') {
      res.json({ token, forcePasswordChange: !!user.forcePasswordChange, doctor: user, hospitalId: user.hospitalId });
    } else if (role === 'nurse') {
      res.json({ token, nurse: user });
    } else if (role === 'superadmin') {
      res.json({ token, admin: { username: user.username } });
    } else {
      res.json({ token, forcePasswordChange: !!user.forcePasswordChange });
    }
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: err.message });
  }
});

router.post('/change-password', async (req, res) => {
  try {
    const { role, username, newPassword } = req.body;
    let Model = null, filter = {};
    if (role === 'hospital') { Model = Hospital; filter = { hospitalId: username }; }
    if (role === 'doctor') { Model = Doctor; filter = { doctorId: username }; }
    if (role === 'ambulance') { Model = Ambulance; filter = { $or: [{ 'emt.emtId': username }, { 'pilot.pilotId': username }, { ambulanceId: username }] }; }

    if (!Model) return res.status(400).json({ message: 'Invalid role' });
    const doc = await Model.findOne(filter);
    if (!doc) return res.status(404).json({ message: 'User not found' });

    doc.password = newPassword;
    doc.forcePasswordChange = false;
    await doc.save(); // triggers pre-save hook for hashing

    res.json({ success: true });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = (io) => router;





