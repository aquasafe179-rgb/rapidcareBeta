// routes/emergency.js
const express = require('express');
const router = express.Router();
const Emergency = require('../models/EmergencyRequest');
const Ambulance = require('../models/Ambulance');
const Hospital = require('../models/Hospital');
const Bed = require('../models/Bed');
const { auth } = require('../middleware/auth');



module.exports = (socketIo) => {
  const io = socketIo;

  // Update Prep Info (Ambulance side)
  router.put('/:id/prep-info', auth(['ambulance']), async (req, res) => {
    try {
      const { vitals, patientCondition, eta, remarks } = req.body;
      const em = await Emergency.findByIdAndUpdate(
        req.params.id,
        {
          $set: {
            prepInfo: { vitals, patientCondition, eta, remarks }
          }
        },
        { new: true }
      );
      if (!em) return res.status(404).json({ success: false, message: 'Emergency not found' });

      // Notify Hospital
      if (em.hospitalId) {
        io.to(`hospital_${em.hospitalId}`).emit('emergency:update', {
          emergencyId: em._id,
          hospitalId: em.hospitalId,
          status: em.status,
          prepInfo: em.prepInfo
        });
      }

      res.json({ success: true, emergency: em });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  // Set Ready to Serve (Hospital side)
  router.put('/:id/ready-to-serve', auth(['hospital']), async (req, res) => {
    try {
      const em = await Emergency.findByIdAndUpdate(
        req.params.id,
        { $set: { isReadyToServe: true } },
        { new: true }
      );
      if (!em) return res.status(404).json({ success: false, message: 'Emergency not found' });

      // Notify Ambulance
      if (em.ambulanceId) {
        io.to(`ambulance_${em.ambulanceId}`).emit('emergency:update', {
          emergencyId: em._id,
          status: em.status,
          isReadyToServe: true
        });
      }

      res.json({ success: true, emergency: em });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  // Get emergency by ID (for authenticated portals)
  router.get('/id/:id', async (req, res) => {
    try {
      // Optimized with .lean()
      const em = await Emergency.findById(req.params.id).lean();
      if (!em) return res.status(404).json({ message: 'Not found' });
      return res.json(em);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  });

  // Public emergency submission (no auth required)
  router.post('/public', async (req, res) => {
    try {
      const payload = req.body;
      payload.submittedBy = 'public';
      // Assign to selected hospital if provided; otherwise reject for clarity
      if (!payload.hospitalId || typeof payload.hospitalId !== 'string' || payload.hospitalId.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'A target hospitalId is required to submit an emergency request'
        });
      }
      payload.hospitalId = payload.hospitalId.trim();
      payload.status = 'Pending';

      // Validate required fields
      if (!payload.patient || !payload.patient.name || !payload.patient.contactMobile) {
        return res.status(400).json({
          success: false,
          message: 'Patient name and contact mobile are required'
        });
      }

      const em = new Emergency(payload);
      await em.save();
      // Notify only the selected hospital reception room
      io.to(`hospital_${em.hospitalId}`).emit('emergency:new:public', em);
      res.json({ success: true, message: 'Emergency request submitted. Hospital will contact you shortly.', emergency: em });
    } catch (err) {
      console.error('Public emergency submission error:', err);
      res.status(400).json({ success: false, message: err.message });
    }
  });

  // Ambulance emergency submission (requires auth)
  router.post('/', auth(['ambulance', 'hospital']), async (req, res) => {
    try {
      const payload = req.body;
      payload.submittedBy = 'ambulance';
      payload.status = 'Pending';

      // Validate required fields
      if (!payload.hospitalId || typeof payload.hospitalId !== 'string' || payload.hospitalId.trim() === '') {
        return res.status(400).json({ success: false, message: 'Hospital ID is required' });
      }

      // Validate patient information
      if (!payload.patient || !payload.patient.name || !payload.patient.contactMobile) {
        return res.status(400).json({ success: false, message: 'Patient name and contact mobile are required' });
      }

      // Auto-attach EMT and Pilot info if provided
      if (payload.emtRef && payload.pilotRef) {
        payload.emtName = payload.emtRef.name;
        payload.emtId = payload.emtRef.emtId;
        payload.emtMobile = payload.emtRef.mobile;
        payload.pilotName = payload.pilotRef.name;
        payload.pilotId = payload.pilotRef.pilotId;
        payload.pilotMobile = payload.pilotRef.mobile;
      }

      // For ambulance role, allow sending to ANY hospital (no restriction)
      // For hospital role, they can only submit for their own hospital
      if (req.user.role === 'hospital' && req.user.ref !== payload.hospitalId) {
        return res.status(403).json({ success: false, message: 'Forbidden: Cannot submit emergency requests for other hospitals' });
      }

      const em = new Emergency(payload);
      await em.save();

      // Emit to hospital room if hospitalId is provided
      if (em.hospitalId) {
        io.to(`hospital_${em.hospitalId}`).emit('emergency:new:ambulance', em);
      }

      res.json({ success: true, emergency: em });
    } catch (err) {
      console.error('Emergency submission error:', err);
      res.status(500).json({ success: false, message: err.message || 'Failed to submit emergency request' });
    }
  });

  // Get all emergencies for a hospital (both public and ambulance)
  router.get('/:hospitalId', async (req, res) => {
    if (req.user && req.user.role === 'hospital' && req.user.ref !== req.params.hospitalId) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    // Optimized with .lean()
    const list = await Emergency.find({ hospitalId: req.params.hospitalId })
      .sort({ createdAt: -1 })
      .lean();
    res.json(list);
  });

  // Get public emergencies (unassigned or for specific hospital)
  router.get('/public/all', auth(['hospital']), async (req, res) => {
    const list = await Emergency.find({ submittedBy: 'public' }).sort({ createdAt: -1 });
    res.json(list);
  });

  // Get public emergencies for a specific hospital
  router.get('/public/:hospitalId', async (req, res) => {
    try {
      // Optimized with .lean()
      const list = await Emergency.find({
        hospitalId: req.params.hospitalId,
        submittedBy: 'public'
      }).sort({ createdAt: -1 }).lean();
      res.json(list);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get ambulance emergencies for a specific hospital
  router.get('/ambulance/:hospitalId', async (req, res) => {
    try {
      // Optimized with .lean()
      const list = await Emergency.find({
        hospitalId: req.params.hospitalId,
        submittedBy: 'ambulance'
      }).sort({ createdAt: -1 }).lean();
      res.json(list);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // Reply to emergency request
  router.put('/:id/reply', auth(['hospital']), async (req, res) => {
    try {
      const { status, message, reason, repliedBy, repliedAt } = req.body;

      if (!status || !message) {
        return res.status(400).json({
          success: false,
          message: 'Status and message are required'
        });
      }

      const emergency = await Emergency.findById(req.params.id);
      if (!emergency) {
        return res.status(404).json({
          success: false,
          message: 'Emergency not found'
        });
      }

      // Update emergency with reply
      const updated = await Emergency.findByIdAndUpdate(
        req.params.id,
        {
          $set: {
            status: status,
            replyMessage: message,
            replyReason: reason,
            repliedBy: repliedBy,
            repliedAt: repliedAt || new Date(),
            updatedAt: new Date()
          }
        },
        { new: true }
      );

      // Notify the submitter (public or ambulance) about the reply
      if (emergency.submittedBy === 'public') {
        // For public users, we could emit to a general room or store for polling
        io.emit('emergency:reply:public', {
          emergencyId: emergency._id,
          status: status,
          message: message,
          reason: reason
        });
      } else if (emergency.submittedBy === 'ambulance') {
        // Notify the specific ambulance
        io.to(`ambulance_${emergency.ambulanceId}`).emit('emergency:reply:ambulance', {
          emergencyId: emergency._id,
          status: status,
          message: message,
          reason: reason
        });
      }

      res.json({ success: true, emergency: updated });
    } catch (err) {
      console.error('Emergency reply error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Get public emergencies for a specific hospital (duplicate removed)

  // Public: Get emergency detail by ID (no auth; shows limited fields)
  router.get('/detail/:id', async (req, res) => {
    try {
      const em = await Emergency.findById(req.params.id).lean();
      if (!em) return res.status(404).json({ success: false, message: 'Not found' });
      // Return safe subset for public
      const safe = {
        _id: em._id,
        createdAt: em.createdAt,
        updatedAt: em.updatedAt,
        status: em.status,
        hospitalId: em.hospitalId,
        rejectionReason: em.rejectionReason || em.reason || '',
        alternateHospitals: em.alternateHospitals || [],
        selectedHospital: em.selectedHospital || '',
      };
      return res.json({ success: true, emergency: safe });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  });

  // Get ambulance emergencies for a hospital (duplicate removed - using the one above)

  // Accept emergency
  router.put('/:id/accept', auth(['hospital']), async (req, res) => {
    try {
      const { remarks, assisted, assistedComment } = req.body;
      const em = await Emergency.findByIdAndUpdate(
        req.params.id,
        {
          $set: {
            status: 'Accepted',
            remarks,
            assisted,
            assistedComment,
            handledBy: req.user.ref,
            hospitalId: req.user.ref,
            responseTime: new Date()
          }
        },
        { new: true }
      );
      if (!em) return res.status(404).json({ success: false, message: 'Not found' });

      // Emit to both hospital and ambulance
      io.to(`hospital_${em.hospitalId}`).emit('emergency:update', em);
      if (em.ambulanceId) {
        io.to(`ambulance_${em.ambulanceId}`).emit('emergency:response', {
          requestId: em._id,
          status: 'Accepted',
          hospital: req.user.ref,
          message: 'Your emergency request has been accepted by the hospital.',
          remarks: remarks
        });
      }

      res.json({ success: true, emergency: em });
    } catch (err) {
      console.error('Accept emergency error:', err);
      res.status(400).json({ success: false, message: err.message });
    }
  });

  // Reject emergency (standardize to 'Rejected' in status)
  router.put('/:id/reject', auth(['hospital']), async (req, res) => {
    try {
      const { rejectionReason, alternateHospitals } = req.body;

      // Validate required fields
      if (!rejectionReason || rejectionReason.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Rejection reason is required when denying an emergency request'
        });
      }

      const em = await Emergency.findByIdAndUpdate(
        req.params.id,
        {
          $set: {
            status: 'Rejected',
            rejectionReason: rejectionReason.trim(),
            alternateHospitals: alternateHospitals || [],
            handledBy: req.user.ref,
            responseTime: new Date()
          }
        },
        { new: true }
      );

      if (!em) return res.status(404).json({ success: false, message: 'Emergency request not found' });

      // Emit to both hospital and ambulance
      io.to(`hospital_${em.hospitalId}`).emit('emergency:update', em);
      if (em.ambulanceId) {
        io.to(`ambulance_${em.ambulanceId}`).emit('emergency:response', {
          requestId: em._id,
          status: 'Rejected',
          hospital: req.user.ref,
          message: 'Your emergency request has been denied by the hospital.',
          reason: rejectionReason,
          alternateHospitals: alternateHospitals || []
        });
      }

      res.json({ success: true, emergency: em });
    } catch (err) {
      console.error('Reject emergency error:', err);
      res.status(400).json({ success: false, message: err.message });
    }
  });

  // Transfer emergency
  router.put('/:id/transfer', auth(['hospital']), async (req, res) => {
    try {
      const { selectedHospital, alternateHospitals, transferReason } = req.body;

      // Validate required fields
      if (!selectedHospital || selectedHospital.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Selected hospital is required when transferring an emergency request'
        });
      }

      const em = await Emergency.findByIdAndUpdate(
        req.params.id,
        {
          $set: {
            status: 'Transferred',
            selectedHospital: selectedHospital.trim(),
            alternateHospitals: alternateHospitals || [selectedHospital.trim()],
            transferReason: transferReason || 'Transferred to more suitable facility',
            handledBy: req.user.ref,
            responseTime: new Date()
          }
        },
        { new: true }
      );

      if (!em) return res.status(404).json({ success: false, message: 'Emergency request not found' });

      // Emit to both hospital and ambulance
      io.to(`hospital_${em.hospitalId}`).emit('emergency:update', em);
      if (em.ambulanceId) {
        io.to(`ambulance_${em.ambulanceId}`).emit('emergency:response', {
          requestId: em._id,
          status: 'Transferred',
          hospital: req.user.ref,
          message: 'Your emergency request has been transferred to another hospital.',
          transferTo: selectedHospital,
          reason: transferReason || 'Transferred to more suitable facility',
          alternateHospitals: alternateHospitals || []
        });
      }

      res.json({ success: true, emergency: em });
    } catch (err) {
      console.error('Transfer emergency error:', err);
      res.status(400).json({ success: false, message: err.message });
    }
  });

  router.put('/:id/status', auth(['hospital']), async (req, res) => {
    try {
      const { status, reason, alternateHospitals, selectedHospital, handledBy, remarks } = req.body;
      const existing = await Emergency.findById(req.params.id);
      if (!existing) return res.status(404).json({ success: false, message: 'Not found' });

      const em = await Emergency.findByIdAndUpdate(
        req.params.id,
        { $set: { status, reason, alternateHospitals, selectedHospital, handledBy, hospitalId: req.user.ref, remarks } },
        { new: true }
      );

      // Notify ambulance if it's an ambulance request
      if (em.submittedBy === 'ambulance' && em.hospitalId) {
        io.to(`hospital_${em.hospitalId}`).emit('emergency:update', em);
      }

      res.json({ success: true, emergency: em });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  router.get('/:hospitalId/recommend', async (req, res) => {
    try {
      const { bedType } = req.query;
      const hospital = await Hospital.findOne({ hospitalId: req.params.hospitalId });
      if (!hospital) return res.status(404).json({ message: 'Hospital not found' });

      const candidates = await Hospital.find({ 'address.state': hospital.address.state, hospitalId: { $ne: hospital.hospitalId } });

      const result = [];
      for (const h of candidates) {
        const vacantCount = await Bed.countDocuments({ hospitalId: h.hospitalId, bedType: bedType || 'General', status: 'Vacant' });
        if (vacantCount > 0) result.push({ hospitalId: h.hospitalId, name: h.name, vacant: vacantCount });
      }

      res.json({ candidates: result });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // Mark emergency as handled by ambulance
  router.put('/:id/handled', auth(['ambulance']), async (req, res) => {
    try {
      const { handledComment } = req.body;

      const em = await Emergency.findById(req.params.id);
      if (!em) {
        return res.status(404).json({ success: false, message: 'Emergency request not found' });
      }

      // Verify that this ambulance owns this emergency
      if (em.ambulanceId !== req.user.ref) {
        return res.status(403).json({
          success: false,
          message: 'You can only mark your own emergency requests as handled'
        });
      }

      // Update emergency as handled
      em.handled = true;
      em.handledAt = new Date();
      em.handledBy = req.user.ref;
      em.handledComment = handledComment || 'Case completed by ambulance team';
      await em.save();

      // Emit updates
      io.to(`hospital_${em.hospitalId}`).emit('emergency:handled', {
        requestId: em._id,
        ambulanceId: em.ambulanceId,
        handledAt: em.handledAt,
        comment: em.handledComment
      });

      res.json({ success: true, emergency: em });
    } catch (err) {
      console.error('Handle emergency error:', err);
      res.status(400).json({ success: false, message: err.message });
    }
  });

  // Get ambulance's own emergency requests
  router.get('/my-requests/:ambulanceId', auth(['ambulance']), async (req, res) => {
    try {
      // Verify ambulance can only see their own requests
      if (req.user.ref !== req.params.ambulanceId) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      const requests = await Emergency.find({ ambulanceId: req.params.ambulanceId })
        .sort({ createdAt: -1 })
        .limit(50); // Limit to recent 50 requests

      res.json({ success: true, requests });
    } catch (err) {
      console.error('Get ambulance requests error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Admit patient to a bed
  router.post('/:id/admit', auth(['hospital']), async (req, res) => {
    try {
      const { bedId } = req.body;
      if (!bedId) return res.status(400).json({ success: false, message: 'Bed ID is required' });

      const em = await Emergency.findById(req.params.id);
      if (!em) return res.status(404).json({ success: false, message: 'Emergency request not found' });

      if (req.user.ref !== em.hospitalId) return res.status(403).json({ success: false, message: 'Forbidden' });

      // Update Emergency
      em.status = 'Admitted';
      em.bedId = bedId;
      await em.save();

      // Update Bed
      const bed = await Bed.findOneAndUpdate(
        { bedId, hospitalId: em.hospitalId },
        { $set: { status: 'Occupied', lastUpdated: new Date() } },
        { new: true }
      );

      if (!bed) return res.status(404).json({ success: false, message: 'Bed not found' });

      io.to(`hospital_${em.hospitalId}`).emit('emergency:update', em);
      io.to(`hospital_${em.hospitalId}`).emit('bed:update', bed);

      res.json({ success: true, emergency: em, bed });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Discharge patient
  router.post('/:id/discharge', auth(['hospital']), async (req, res) => {
    try {
      const em = await Emergency.findById(req.params.id);
      if (!em) return res.status(404).json({ success: false, message: 'Emergency request not found' });

      if (req.user.ref !== em.hospitalId) return res.status(403).json({ success: false, message: 'Forbidden' });

      const bedId = em.bedId;

      // Update Emergency
      em.status = 'Discharged';
      em.bedId = null; // Optional: keep history or clear
      await em.save();

      // Update Bed if linked
      let bed = null;
      if (bedId) {
        bed = await Bed.findOneAndUpdate(
          { bedId, hospitalId: em.hospitalId },
          { $set: { status: 'Vacant', lastUpdated: new Date() } },
          { new: true }
        );
        if (bed) io.to(`hospital_${em.hospitalId}`).emit('bed:update', bed);
      }

      io.to(`hospital_${em.hospitalId}`).emit('emergency:update', em);

      res.json({ success: true, emergency: em, bed });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  return router;
};


