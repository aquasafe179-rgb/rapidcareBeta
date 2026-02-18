// routes/ambulances.js
const express = require('express');
const router = express.Router();
const Ambulance = require('../models/Ambulance');
const { auth } = require('../middleware/auth');

module.exports = (io) => {
  router.get('/:hospitalId', async (req, res) => {
    if (req.user && req.user.role === 'hospital' && req.user.ref !== req.params.hospitalId) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    // Optimized with .lean() for faster performance
    const list = await Ambulance.find({ hospitalId: req.params.hospitalId }).lean();
    res.json(list);
  });

  // get ambulance by id or by emt/pilot id (query username=)
  router.get('/', async (req, res) => {
    const { username } = req.query;
    if (!username) return res.status(400).json({ message: 'username required' });
    // Optimized with .lean()
    const amb = await Ambulance.findOne({
      $or: [
        { ambulanceId: username },
        { 'emt.emtId': username },
        { 'pilot.pilotId': username }
      ]
    }).lean();
    if (!amb) return res.status(404).json({ message: 'not found' });
    res.json(amb);
  });

  router.post('/', auth(['hospital']), async (req, res) => {
    try {
      console.log('Ambulance POST - User:', req.user, 'Body hospitalId:', req.body.hospitalId);
      if (req.user.role === 'hospital' && req.user.ref !== req.body.hospitalId) {
        console.log('Forbidden: user.ref', req.user.ref, '!== body.hospitalId', req.body.hospitalId);
        return res.status(403).json({ success: false, message: `Forbidden: Your hospital ID (${req.user.ref}) does not match the request (${req.body.hospitalId})` });
      }

      // Validate required fields
      if (!req.body.ambulanceId || !req.body.hospitalId || !req.body.ambulanceNumber) {
        return res.status(400).json({ success: false, message: 'Ambulance ID, Hospital ID, and Ambulance Number are required' });
      }

      // Check if ambulance already exists
      const existing = await Ambulance.findOne({ ambulanceId: req.body.ambulanceId });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Ambulance ID already exists' });
      }

      const amb = new Ambulance({ ...req.body, password: 'test@1234', forcePasswordChange: true, status: 'Offline' });
      await amb.save();
      res.json({ success: true, ambulance: amb });
    } catch (err) {
      console.error('Ambulance creation error:', err);
      res.status(400).json({ success: false, message: err.message || 'Failed to create ambulance' });
    }
  });

  router.put('/:ambulanceId', auth(['hospital', 'ambulance']), async (req, res) => {
    const existing = await Ambulance.findOne({ ambulanceId: req.params.ambulanceId });
    if (!existing) return res.status(404).json({ success: false, message: 'Not found' });
    if (req.user.role === 'hospital' && req.user.ref !== existing.hospitalId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    if (req.user.role === 'ambulance' && ![existing.ambulanceId, existing?.emt?.emtId, existing?.pilot?.pilotId].includes(req.user.ref)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const updated = await Ambulance.findOneAndUpdate({ ambulanceId: req.params.ambulanceId }, { $set: req.body }, { new: true });
    res.json({ success: true, ambulance: updated });
  });

  router.patch('/:ambulanceId/location', auth(['ambulance']), async (req, res) => {
    try {
      const { lat, lng } = req.body;
      const amb = await Ambulance.findOneAndUpdate(
        { ambulanceId: req.params.ambulanceId },
        { $set: { 'location.lat': lat, 'location.lng': lng, status: 'In Transit' } },
        { new: true }
      );
      io.to(`hospital_${amb.hospitalId}`).emit('ambulance:location', { ambulanceId: amb.ambulanceId, lat, lng });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  router.delete('/:ambulanceId', auth(['hospital']), async (req, res) => {
    const existing = await Ambulance.findOne({ ambulanceId: req.params.ambulanceId });
    if (!existing) return res.status(404).json({ success: false, message: 'Not found' });
    if (req.user.role === 'hospital' && req.user.ref !== existing.hospitalId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    await Ambulance.findOneAndDelete({ ambulanceId: req.params.ambulanceId });
    res.json({ success: true });
  });

  return router;
};


