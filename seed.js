require('dotenv').config();
const mongoose = require('mongoose');
const Hospital = require('./models/Hospital');
const Doctor = require('./models/Doctor');
const Bed = require('./models/Bed');
const Ambulance = require('./models/Ambulance');
const Attendance = require('./models/Attendance');
const EmergencyRequest = require('./models/EmergencyRequest');
const bcrypt = require('bcrypt');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

async function fullSeed() {
    try {
        const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/rapidcare';
        console.log('🔄 Connecting to MongoDB:', uri.split('@').pop());
        await mongoose.connect(uri, { family: 4 });
        console.log('✅ Connected to MongoDB');

        console.log('🔄 Dropping database...');
        try {
            await mongoose.connection.db.dropDatabase();
            console.log('🗑️  Database dropped');
        } catch (e) {
            console.log('⚠️  Could not drop database (maybe empty):', e.message);
        }

        const hospitals = [
            {
                hospitalId: 'AIIMS-RPR',
                name: 'AIIMS Raipur',
                contact: '0771-2572999',
                email: 'info@aiimsraipur.edu.in',
                address: { state: 'Chhattisgarh', district: 'Raipur', city: 'Raipur', street: 'Tatibandh, GE Road' },
                location: { lat: 21.2568, lng: 81.5791 },
                password: 'test@1234',
                services: ['Emergency', 'OPD', 'IPD', 'Trauma'],
                facilities: ['ICU', 'NICU', 'Blood Bank', 'Pharmacy', 'Radiology'],
                insurance: ['Ayushman Bharat', 'CGHS', 'ESI']
            },
            {
                hospitalId: 'MEKAHARA-RPR',
                name: 'Dr. B.R.A.M. Hospital (Mekahara)',
                contact: '0771-2890001',
                email: 'contact@ptjnm.in',
                address: { state: 'Chhattisgarh', district: 'Raipur', city: 'Raipur', street: 'Civil Lines' },
                location: { lat: 21.2514, lng: 81.6371 },
                password: 'test@1234',
                services: ['General Medicine', 'Surgery', 'Pediatrics'],
                facilities: ['ICU', 'General Wards', 'Pharmacy'],
                insurance: ['Ayushman Bharat', 'State Health Scheme']
            },
            {
                hospitalId: 'NH-NARAYANA',
                name: 'NH Narayana Superspeciality Hospital',
                contact: '1800-203-2999',
                email: 'info.rpr@narayanahealth.org',
                address: { state: 'Chhattisgarh', district: 'Raipur', city: 'Naya Raipur', street: 'Sector 32' },
                location: { lat: 21.1611, lng: 81.7825 },
                password: 'test@1234',
                services: ['Cardiology', 'Neurology', 'Oncology', 'Emergency'],
                facilities: ['Advanced ICU', 'NICU', 'Cath Lab', 'MRI'],
                insurance: ['All Major Insurers', 'Ayushman Bharat']
            }
        ];

        // Generate Hospital Attendance QRs
        const qrDir = path.join(__dirname, 'uploads', 'qr');
        if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir, { recursive: true });
        const base = process.env.BASE_URL || 'http://localhost:5000';

        for (const h of hospitals) {
            const presentUrl = `${base}/api/hospital/${h.hospitalId}/attendance-scan?type=Present`;
            const absentUrl = `${base}/api/hospital/${h.hospitalId}/attendance-scan?type=Absent`;
            const pPath = path.join(qrDir, `present_${h.hospitalId}.png`);
            const aPath = path.join(qrDir, `absent_${h.hospitalId}.png`);

            await QRCode.toFile(pPath, presentUrl);
            await QRCode.toFile(aPath, absentUrl);

            h.attendanceQR = {
                presentQR: `/uploads/qr/present_${h.hospitalId}.png`,
                absentQR: `/uploads/qr/absent_${h.hospitalId}.png`,
                generatedAt: new Date()
            };
            await new Hospital(h).save();
        }
        console.log(`✅ Created ${hospitals.length} hospitals with QR codes`);

        const doctors = [
            { hospitalId: 'AIIMS-RPR', doctorId: 'DOC-AIIMS-01', name: 'Dr. Rajesh Gupta', speciality: 'Cardiology', password: 'test@1234', availability: 'Available', qualification: 'MD, DM', experience: '15 Years' },
            { hospitalId: 'AIIMS-RPR', doctorId: 'DOC-AIIMS-02', name: 'Dr. Priya Singh', speciality: 'Neurology', password: 'test@1234', availability: 'Available', qualification: 'MD, DNB', experience: '10 Years' },
            { hospitalId: 'MEKAHARA-RPR', doctorId: 'DOC-MEK-01', name: 'Dr. S.K. Verma', speciality: 'Surgery', password: 'test@1234', availability: 'Available', qualification: 'MS', experience: '20 Years' },
            { hospitalId: 'NH-NARAYANA', doctorId: 'DOC-NH-01', name: 'Dr. Amit Patel', speciality: 'Oncology', password: 'test@1234', availability: 'Available', qualification: 'MD, MCh', experience: '12 Years' }
        ];
        for (const d of doctors) {
            await new Doctor(d).save();
        }
        console.log(`✅ Created ${doctors.length} doctors`);

        const ambulances = [
            { hospitalId: 'AIIMS-RPR', ambulanceId: 'AMB-AIIMS-01', ambulanceNumber: 'CG04-AMB-01', vehicleNumber: 'CG04-AMB-01', password: 'test@1234', status: 'On Duty', emt: { name: 'Sanjay Sahu', mobile: '9876543210', emtId: 'EMT-01' } },
            { hospitalId: 'NH-NARAYANA', ambulanceId: 'AMB-NH-01', ambulanceNumber: 'CG04-AMB-02', vehicleNumber: 'CG04-AMB-02', password: 'test@1234', status: 'On Duty', emt: { name: 'Rahul Gond', mobile: '9876543211', emtId: 'EMT-02' } }
        ];
        for (const a of ambulances) {
            await new Ambulance(a).save();
        }
        console.log(`✅ Created ${ambulances.length} ambulances`);

        const beds = [];
        for (const hospitalId of ['AIIMS-RPR', 'MEKAHARA-RPR', 'NH-NARAYANA']) {
            for (let i = 1; i <= 5; i++) {
                beds.push({ hospitalId, bedId: `${hospitalId}-ICU-B0${i}`, bedNumber: `B0${i}`, wardNumber: 'ICU', bedType: 'ICU', status: 'Vacant' });
            }
            for (let i = 1; i <= 15; i++) {
                beds.push({ hospitalId, bedId: `${hospitalId}-GEN-B${String(i).padStart(2, '0')}`, bedNumber: `B${String(i).padStart(2, '0')}`, wardNumber: '1', bedType: 'General', status: 'Vacant' });
            }
        }
        for (const b of beds) {
            await new Bed(b).save();
        }
        console.log(`✅ Created ${beds.length} beds`);

        await mongoose.connection.close();
        console.log('🚀 SEEDING COMPLETE');
    } catch (err) {
        console.error('❌ Seeding Error:', err);
        process.exit(1);
    }
}

fullSeed();
