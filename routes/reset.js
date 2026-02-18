// Reset database route
const Hospital = require('../models/Hospital');
const Doctor = require('../models/Doctor');
const Bed = require('../models/Bed');
const Ambulance = require('../models/Ambulance');
const Attendance = require('../models/Attendance');
const EmergencyRequest = require('../models/EmergencyRequest');
const bcrypt = require('bcrypt');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

module.exports = (io) => {
  const router = require('express').Router();

  // Reset database endpoint
  router.post('/', async (req, res) => {
    try {
      console.log('🔄 Starting database reset...');
      console.log('🔄 Dropping database...');
      await mongoose.connection.db.dropDatabase();
      console.log('🗑️  Database dropped');

      // Create dummy hospitals
      const hospitals = [
        {
          hospitalId: 'AIIMS-RPR',
          name: 'AIIMS Raipur',
          contact: '0771-2572999',
          email: 'info@aiimsraipur.edu.in',
          address: { state: 'Chhattisgarh', district: 'Raipur', city: 'Raipur', street: 'Tatibandh, GE Road' },
          location: { lat: 21.2568, lng: 81.5791 },
          services: ['Emergency', 'OPD', 'IPD', 'Trauma'],
          facilities: ['ICU', 'NICU', 'Blood Bank', 'Pharmacy', 'Radiology'],
          insurance: ['Ayushman Bharat', 'CGHS', 'ESI'],
          treatment: ['Cardiology', 'Neurology', 'Oncology', 'Pediatrics'],
          surgery: ['Appendectomy', 'Gallbladder', 'Hernia'],
          therapy: ['Physiotherapy', 'Occupational Therapy'],
          password: bcrypt.hashSync('test@1234', 10),
          forcePasswordChange: true
        },
        {
          hospitalId: 'MEKAHARA-RPR',
          name: 'Dr. B.R.A.M. Hospital (Mekahara)',
          contact: '0771-2890001',
          email: 'contact@ptjnm.in',
          address: { state: 'Chhattisgarh', district: 'Raipur', city: 'Raipur', street: 'Civil Lines' },
          location: { lat: 21.2514, lng: 81.6371 },
          services: ['Emergency', 'Diagnostics', 'Surgery'],
          facilities: ['Radiology', 'ICU', 'Laboratory', 'Pharmacy'],
          insurance: ['Ayushman Bharat', 'MediCare'],
          treatment: ['Neurology', 'Cardiology', 'Oncology'],
          surgery: ['Bypass', 'Brain Surgery', 'Cancer Surgery'],
          therapy: ['Occupational', 'Speech Therapy'],
          password: bcrypt.hashSync('test@1234', 10),
          forcePasswordChange: true
        },
        {
          hospitalId: 'NH-NARAYANA',
          name: 'NH Narayana Superspeciality Hospital',
          contact: '1800-203-2999',
          email: 'info.rpr@narayanahealth.org',
          address: { state: 'Chhattisgarh', district: 'Raipur', city: 'Naya Raipur', street: 'Sector 32' },
          location: { lat: 21.1611, lng: 81.7825 },
          services: ['Emergency', 'OPD', 'Maternity'],
          facilities: ['ICU', 'NICU', 'Laboratory', 'Pharmacy'],
          insurance: ['XYZ Insure', 'MediCare', 'Health Plus'],
          treatment: ['Gynecology', 'Pediatrics', 'General Medicine'],
          surgery: ['C-Section', 'Hysterectomy', 'Appendectomy'],
          therapy: ['Physiotherapy', 'Occupational Therapy'],
          password: bcrypt.hashSync('test@1234', 10),
          forcePasswordChange: true
        }
      ];

      // Generate Hospital Attendance QRs
      const hQrDir = path.join(__dirname, '..', 'uploads', 'qr');
      if (!fs.existsSync(hQrDir)) fs.mkdirSync(hQrDir, { recursive: true });
      const base = process.env.BASE_URL || 'http://localhost:5000';

      for (const h of hospitals) {
        const presentUrl = `${base}/api/hospital/${h.hospitalId}/attendance-scan?type=Present`;
        const absentUrl = `${base}/api/hospital/${h.hospitalId}/attendance-scan?type=Absent`;
        const pPath = path.join(hQrDir, `present_${h.hospitalId}.png`);
        const aPath = path.join(hQrDir, `absent_${h.hospitalId}.png`);

        await QRCode.toFile(pPath, presentUrl);
        await QRCode.toFile(aPath, absentUrl);

        h.attendanceQR = {
          presentQR: `/uploads/qr/present_${h.hospitalId}.png`,
          absentQR: `/uploads/qr/absent_${h.hospitalId}.png`,
          generatedAt: new Date()
        };
      }

      await Hospital.collection.insertMany(hospitals, { bypassDocumentValidation: true });
      console.log(`✅ Created ${hospitals.length} hospitals`);

      // Create dummy doctors
      const doctors = [
        {
          hospitalId: 'AIIMS-RPR',
          doctorId: 'DOC-AIIMS-01',
          name: 'Dr. Rajesh Gupta',
          qualification: 'MD, DM',
          speciality: 'Cardiology',
          experience: '15 yrs',
          photoUrl: '',
          password: bcrypt.hashSync('test@1234', 10),
          forcePasswordChange: true,
          availability: 'Available',
          shift: 'Morning'
        },
        {
          hospitalId: 'AIIMS-RPR',
          doctorId: 'DOC-AIIMS-02',
          name: 'Dr. Priya Singh',
          qualification: 'MD, DNB',
          speciality: 'Neurology',
          experience: '10 yrs',
          photoUrl: '',
          password: bcrypt.hashSync('test@1234', 10),
          forcePasswordChange: true,
          availability: 'Available',
          shift: 'Afternoon'
        },
        {
          hospitalId: 'MEKAHARA-RPR',
          doctorId: 'DOC-MEK-01',
          name: 'Dr. S.K. Verma',
          qualification: 'MS',
          speciality: 'Surgery',
          experience: '20 yrs',
          photoUrl: '',
          password: bcrypt.hashSync('test@1234', 10),
          forcePasswordChange: true,
          availability: 'Available',
          shift: 'Morning'
        },
        {
          hospitalId: 'NH-NARAYANA',
          doctorId: 'DOC-NH-01',
          name: 'Dr. Amit Patel',
          qualification: 'MD, MCh',
          speciality: 'Oncology',
          experience: '12 yrs',
          photoUrl: '',
          password: bcrypt.hashSync('test@1234', 10),
          forcePasswordChange: true,
          availability: 'Available',
          shift: 'Morning'
        }
      ];
      await Doctor.collection.insertMany(doctors, { bypassDocumentValidation: true });
      console.log(`✅ Created ${doctors.length} doctors`);

      // Create dummy ambulances
      const ambulances = [
        {
          hospitalId: 'AIIMS-RPR',
          ambulanceId: 'AMB-AIIMS-01',
          ambulanceNumber: 'CG04-AMB-01',
          vehicleNumber: 'CG04-AMB-01',
          emt: { name: 'Sanjay Sahu', mobile: '9876543210', emtId: 'EMT-01' },
          pilot: { name: 'Vikram Singh', mobile: '9876543212', pilotId: 'PIL-01' },
          password: bcrypt.hashSync('test@1234', 10),
          forcePasswordChange: true,
          status: 'On Duty'
        },
        {
          hospitalId: 'NH-NARAYANA',
          ambulanceId: 'AMB-NH-01',
          ambulanceNumber: 'CG04-AMB-02',
          vehicleNumber: 'CG04-AMB-02',
          emt: { name: 'Rahul Gond', mobile: '9876543211', emtId: 'EMT-02' },
          pilot: { name: 'Rajesh Kumar', mobile: '9876543213', pilotId: 'PIL-02' },
          password: bcrypt.hashSync('test@1234', 10),
          forcePasswordChange: true,
          status: 'On Duty'
        }
      ];
      await Ambulance.collection.insertMany(ambulances, { bypassDocumentValidation: true });
      console.log(`✅ Created ${ambulances.length} ambulances`);

      // Create dummy beds for each hospital
      const beds = [];
      const hospitalsForBeds = ['AIIMS-RPR', 'MEKAHARA-RPR', 'NH-NARAYANA'];

      // Ensure QR directory exists for beds
      const qrDir = path.join(__dirname, '..', 'uploads', 'qrs');
      if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir, { recursive: true });

      for (const hospitalId of hospitalsForBeds) {
        // ICU beds (5 per hospital)
        for (let i = 1; i <= 5; i++) {
          const bedNumber = String(i).padStart(2, '0');
          const bedId = `${hospitalId}-ICU-B${bedNumber}`;
          const bed = {
            hospitalId,
            bedId,
            bedNumber,
            wardNumber: 'ICU',
            bedType: 'ICU',
            status: i % 2 === 0 ? 'Occupied' : 'Vacant'
          };

          // Generate Bed QRs
          const vacUrl = `${base}/api/beds/scan/${bedId}?set=Vacant`;
          const occUrl = `${base}/api/beds/scan/${bedId}?set=Occupied`;
          const vPath = path.join(qrDir, `${bedId}-vacant.png`);
          const oPath = path.join(qrDir, `${bedId}-occupied.png`);

          await QRCode.toFile(vPath, vacUrl);
          await QRCode.toFile(oPath, occUrl);

          bed.qrVacantUrl = `/uploads/qrs/${bedId}-vacant.png`;
          bed.qrOccupiedUrl = `/uploads/qrs/${bedId}-occupied.png`;

          beds.push(bed);
        }

        // General beds (15 per hospital)
        for (let i = 1; i <= 15; i++) {
          const bedNumber = String(i).padStart(2, '0');
          const bedId = `${hospitalId}-GEN-B${bedNumber}`;
          const bed = {
            hospitalId,
            bedId,
            bedNumber,
            wardNumber: '1',
            bedType: 'General',
            status: i % 3 === 0 ? 'Occupied' : 'Vacant'
          };

          // Generate Bed QRs
          const vacUrl = `${base}/api/beds/scan/${bedId}?set=Vacant`;
          const occUrl = `${base}/api/beds/scan/${bedId}?set=Occupied`;
          const vPath = path.join(qrDir, `${bedId}-vacant.png`);
          const oPath = path.join(qrDir, `${bedId}-occupied.png`);

          await QRCode.toFile(vPath, vacUrl);
          await QRCode.toFile(oPath, occUrl);

          bed.qrVacantUrl = `/uploads/qrs/${bedId}-vacant.png`;
          bed.qrOccupiedUrl = `/uploads/qrs/${bedId}-occupied.png`;

          beds.push(bed);
        }
      }

      await Bed.collection.insertMany(beds, { bypassDocumentValidation: true });
      console.log(`✅ Created ${beds.length} beds`);

      // Create some sample attendance records
      const attendanceRecords = [
        {
          doctorId: 'DOC100',
          date: new Date(),
          availability: 'Present',
          shift: 'Morning'
        },
        {
          doctorId: 'DOC101',
          date: new Date(),
          availability: 'Present',
          shift: 'Afternoon'
        }
      ];
      await Attendance.collection.insertMany(attendanceRecords, { bypassDocumentValidation: true });
      console.log(`✅ Created ${attendanceRecords.length} attendance records`);

      // Emit reset completion event
      io.emit('database:reset', {
        message: 'Database has been reset with fresh dummy data',
        timestamp: new Date(),
        counts: {
          hospitals: hospitals.length,
          doctors: doctors.length,
          ambulances: ambulances.length,
          beds: beds.length,
          attendance: attendanceRecords.length
        }
      });

      res.json({
        success: true,
        message: 'Database reset successfully',
        counts: {
          hospitals: hospitals.length,
          doctors: doctors.length,
          ambulances: ambulances.length,
          beds: beds.length,
          attendance: attendanceRecords.length
        }
      });

    } catch (error) {
      console.error('❌ Database reset failed:', error);
      res.status(500).json({
        success: false,
        message: 'Database reset failed',
        error: error.message
      });
    }
  });

  return router;
};

