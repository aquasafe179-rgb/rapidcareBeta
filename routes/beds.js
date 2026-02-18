// routes/beds.js
const express = require('express');
const router = express.Router();
const Bed = require('../models/Bed');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const { auth } = require('../middleware/auth');

module.exports = (io) => {
  router.get('/:hospitalId', async (req, res) => {
    try {
      // If a hospital is logged in, enforce scoping to its own hospitalId
      if (req.user && req.user.role === 'hospital' && req.user.ref !== req.params.hospitalId) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      // Optimized with .lean() for faster performance (returns plain JS objects)
      const beds = await Bed.find({ hospitalId: req.params.hospitalId })
        .sort({ wardNumber: 1, bedNumber: 1 })
        .lean();
      res.json(beds);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  router.post('/', auth(['hospital']), async (req, res) => {
    try {
      console.log('Bed creation request:', req.body);
      const { hospitalId, wardNumber, bedType, start, end } = req.body;

      if (!hospitalId || !wardNumber || !bedType) {
        return res.status(400).json({ success: false, message: 'Missing required fields: hospitalId, wardNumber, bedType' });
      }

      if (req.user.role === 'hospital' && req.user.ref !== hospitalId) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }

      const created = [];
      const s = parseInt(start);
      const e = parseInt(end);

      console.log(`Creating beds from ${s} to ${e} for hospital ${hospitalId}, ward ${wardNumber}, type ${bedType}`);

      // Ensure QR directory exists
      const qrDir = path.join(__dirname, '..', 'uploads', 'qrs');
      if (!fs.existsSync(qrDir)) {
        console.log('Creating QR directory:', qrDir);
        fs.mkdirSync(qrDir, { recursive: true });
      }
      const base = process.env.BASE_URL || 'http://localhost:5000';

      for (let n = s; n <= e; n++) {
        const bedNumber = String(n).padStart(2, '0');
        const bedId = `${hospitalId}-W${wardNumber}-B${bedNumber}`;
        const exists = await Bed.findOne({ bedId });
        if (exists) continue;

        const bed = new Bed({ hospitalId, bedId, bedNumber, wardNumber, bedType, status: 'Vacant' });
        await bed.save();

        try {
          console.log(`Generating QR codes for bed ${bedId}`);

          // Generate QR codes with timeout
          const infoUrl = `${base}/api/beds/scan/${encodeURIComponent(bedId)}`;
          const filePath = path.join(qrDir, `${bedId}.png`);

          console.log(`Generating info QR: ${infoUrl} -> ${filePath}`);
          await Promise.race([
            QRCode.toFile(filePath, infoUrl),
            new Promise((_, reject) => setTimeout(() => reject(new Error('QR generation timeout')), 10000))
          ]);
          bed.qrCodeUrl = `/uploads/qrs/${bedId}.png`;

          // dual QR for status set
          const vacUrl = `${base}/api/beds/scan/${encodeURIComponent(bedId)}?set=Vacant`;
          const occUrl = `${base}/api/beds/scan/${encodeURIComponent(bedId)}?set=Occupied`;
          const vPath = path.join(qrDir, `${bedId}-vacant.png`);
          const oPath = path.join(qrDir, `${bedId}-occupied.png`);

          console.log(`Generating status QRs: ${vacUrl} -> ${vPath}, ${occUrl} -> ${oPath}`);

          await Promise.all([
            Promise.race([
              QRCode.toFile(vPath, vacUrl),
              new Promise((_, reject) => setTimeout(() => reject(new Error('QR generation timeout')), 10000))
            ]),
            Promise.race([
              QRCode.toFile(oPath, occUrl),
              new Promise((_, reject) => setTimeout(() => reject(new Error('QR generation timeout')), 10000))
            ])
          ]);

          bed.qrVacantUrl = `/uploads/qrs/${bedId}-vacant.png`;
          bed.qrOccupiedUrl = `/uploads/qrs/${bedId}-occupied.png`;
          await bed.save();

          console.log(`QR codes generated successfully for bed ${bedId}`);
        } catch (qrError) {
          console.error(`QR generation failed for bed ${bedId}:`, qrError.message);
          // Continue without QR codes
        }

        created.push(bed);
      }
      res.json({ success: true, created });
    } catch (err) {
      console.error('Bed creation error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Generate QR code for a specific bed
  router.get('/:bedId/qr', auth(['hospital']), async (req, res) => {
    try {
      const bed = await Bed.findOne({ bedId: req.params.bedId });
      if (!bed) {
        return res.status(404).json({ success: false, message: 'Bed not found' });
      }

      const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
      const qrUrl = `${baseUrl}/api/beds/scan/${req.params.bedId}`;

      // Generate QR code
      const qrPath = path.join(__dirname, '..', 'uploads', 'qrs', `bed-${req.params.bedId}.png`);
      const qrDir = path.dirname(qrPath);

      if (!fs.existsSync(qrDir)) {
        fs.mkdirSync(qrDir, { recursive: true });
      }

      await QRCode.toFile(qrPath, qrUrl);

      res.json({
        success: true,
        bedId: req.params.bedId,
        qrUrl: qrUrl,
        qrImage: `/uploads/qrs/bed-${req.params.bedId}.png`
      });

    } catch (err) {
      console.error('Bed QR generation error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  router.get('/scan/:bedId', async (req, res) => {
    try {
      const bed = await Bed.findOne({ bedId: req.params.bedId });
      if (!bed) {
        return res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Bed Not Found</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: Arial, sans-serif; max-width: 400px; margin: 50px auto; padding: 20px; text-align: center; }
              .error { color: #dc3545; background: #f8d7da; padding: 20px; border-radius: 8px; }
            </style>
          </head>
          <body>
            <div class="error">
              <h2>❌ Bed Not Found</h2>
              <p>Bed ID "${req.params.bedId}" not found in system.</p>
            </div>
          </body>
          </html>
        `);
      }

      const toSet = req.query.set;

      if (toSet && ['Vacant', 'Occupied', 'Reserved', 'Cleaning'].includes(toSet)) {
        const oldStatus = bed.status;
        bed.status = toSet;
        bed.lastUpdated = new Date();
        await bed.save();

        // Emit real-time update
        io.to(`hospital_${bed.hospitalId}`).emit('bed:update', bed);

        // Return success page
        return res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Bed Status Updated</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: Arial, sans-serif; max-width: 400px; margin: 50px auto; padding: 20px; text-align: center; }
              .success { color: #155724; background: #d4edda; padding: 20px; border-radius: 8px; }
              .info { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 15px; }
              .status-badge { padding: 4px 12px; border-radius: 12px; font-weight: bold; }
              .vacant { background: #28a745; color: white; }
              .occupied { background: #dc3545; color: white; }
              .reserved { background: #ffc107; color: black; }
              .cleaning { background: #6c757d; color: white; }
            </style>
          </head>
          <body>
            <div class="success">
              <h2>✅ Bed Status Updated!</h2>
              <p><strong>Bed:</strong> ${bed.bedNumber} (${bed.bedType})</p>
              <p><strong>Ward:</strong> ${bed.wardNumber}</p>
              <p><strong>Previous Status:</strong> <span class="status-badge ${oldStatus.toLowerCase()}">${oldStatus}</span></p>
              <p><strong>New Status:</strong> <span class="status-badge ${toSet.toLowerCase()}">${toSet}</span></p>
              <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            </div>
            <div class="info">
              <p>Bed status has been updated in the hospital system.</p>
              <p><strong>Hospital:</strong> ${bed.hospitalId}</p>
            </div>
          </body>
          </html>
        `);
      }

      // If no status change, show bed info
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Bed Information</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Arial, sans-serif; max-width: 400px; margin: 50px auto; padding: 20px; text-align: center; }
            .info { background: #e7f3ff; border: 1px solid #b3d7ff; padding: 20px; border-radius: 8px; }
            .status-badge { padding: 4px 12px; border-radius: 12px; font-weight: bold; }
            .vacant { background: #28a745; color: white; }
            .occupied { background: #dc3545; color: white; }
            .reserved { background: #ffc107; color: black; }
            .cleaning { background: #6c757d; color: white; }
            .btn { padding: 10px 20px; margin: 5px; border: none; border-radius: 4px; color: white; cursor: pointer; text-decoration: none; display: inline-block; }
          </style>
        </head>
        <body>
          <div class="info">
            <h2>🛏️ Bed Information</h2>
            <p><strong>Bed:</strong> ${bed.bedNumber} (${bed.bedType})</p>
            <p><strong>Ward:</strong> ${bed.wardNumber}</p>
            <p><strong>Current Status:</strong> <span class="status-badge ${bed.status.toLowerCase()}">${bed.status}</span></p>
            <p><strong>Hospital:</strong> ${bed.hospitalId}</p>
          </div>
          <div style="margin-top: 20px;">
            <h3>Update Status:</h3>
            <a href="?set=Vacant" class="btn" style="background: #28a745;">Mark Vacant</a>
            <a href="?set=Occupied" class="btn" style="background: #dc3545;">Mark Occupied</a>
            <a href="?set=Reserved" class="btn" style="background: #ffc107; color: black;">Mark Reserved</a>
            <a href="?set=Cleaning" class="btn" style="background: #6c757d;">Mark Cleaning</a>
          </div>
        </body>
        </html>
      `);

    } catch (err) {
      console.error('Bed scan error:', err);
      res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>System Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Arial, sans-serif; max-width: 400px; margin: 50px auto; padding: 20px; text-align: center; }
            .error { color: #dc3545; background: #f8d7da; padding: 20px; border-radius: 8px; }
          </style>
        </head>
        <body>
          <div class="error">
            <h2>❌ System Error</h2>
            <p>Unable to process bed scan. Please try again or contact IT support.</p>
          </div>
        </body>
        </html>
      `);
    }
  });

  // Mass QR PDF generation for bed ranges
  router.get('/pdf/mass/:hospitalId', async (req, res) => {
    try {
      console.log(`PDF generation request for hospital ${req.params.hospitalId}`);
      const { wardNumber, bedType } = req.query;
      let query = { hospitalId: req.params.hospitalId };
      if (wardNumber) query.wardNumber = wardNumber;
      if (bedType) query.bedType = bedType;

      console.log('PDF query:', query);
      const beds = await Bed.find(query).sort({ wardNumber: 1, bedNumber: 1 });
      console.log(`Found ${beds.length} beds for PDF generation`);

      if (beds.length === 0) return res.status(404).send('No beds found');

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="beds_qr_${req.params.hospitalId}.pdf"`);
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      doc.pipe(res);

      doc.fontSize(24).text(`Bed QR Codes - ${req.params.hospitalId}`, { align: 'center' });
      if (wardNumber) doc.fontSize(16).text(`Ward: ${wardNumber}`, { align: 'center' });
      if (bedType) doc.fontSize(16).text(`Type: ${bedType}`, { align: 'center' });
      doc.moveDown(2);

      const root = path.join(__dirname, '..');
      const qrSize = 120;
      const margin = 20;
      const cols = 2;
      const rows = 3;
      let currentPage = 0;
      let currentRow = 0;
      let currentCol = 0;

      for (let i = 0; i < beds.length; i++) {
        const bed = beds[i];

        if (i > 0 && i % (cols * rows) === 0) {
          doc.addPage();
          currentPage++;
          currentRow = 0;
          currentCol = 0;
        }

        const x = margin + (currentCol * (qrSize * 2 + margin * 2));
        const y = 100 + (currentRow * (qrSize + margin * 3));

        // Bed info
        doc.fontSize(12).text(`Bed ${bed.bedNumber} - ${bed.bedType}`, x, y - 20);

        // Generate QR codes if they don't exist
        if (!bed.qrVacantUrl || !bed.qrOccupiedUrl) {
          const qrDir = path.join(__dirname, '..', 'uploads', 'qrs');
          if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir, { recursive: true });

          const base = process.env.BASE_URL || 'http://localhost:5000';
          const vacUrl = `${base}/api/beds/scan/${encodeURIComponent(bed.bedId)}?set=Vacant`;
          const occUrl = `${base}/api/beds/scan/${encodeURIComponent(bed.bedId)}?set=Occupied`;
          const vPath = path.join(qrDir, `${bed.bedId}-vacant.png`);
          const oPath = path.join(qrDir, `${bed.bedId}-occupied.png`);

          await QRCode.toFile(vPath, vacUrl);
          await QRCode.toFile(oPath, occUrl);

          bed.qrVacantUrl = `/uploads/qrs/${bed.bedId}-vacant.png`;
          bed.qrOccupiedUrl = `/uploads/qrs/${bed.bedId}-occupied.png`;
          await bed.save();
        }

        // Vacant QR
        const vacPath = path.join(root, bed.qrVacantUrl.replace('/uploads', 'uploads'));
        if (fs.existsSync(vacPath)) {
          try {
            doc.image(vacPath, x, y, { width: qrSize });
            doc.fontSize(10).text('Vacant', x, y + qrSize + 5, { width: qrSize, align: 'center' });
          } catch (e) {
            doc.fontSize(10).text('Error loading QR', x, y, { width: qrSize, align: 'center' });
          }
        } else {
          doc.fontSize(10).text('QR Not Found', x, y, { width: qrSize, align: 'center' });
        }

        // Occupied QR
        const occPath = path.join(root, bed.qrOccupiedUrl.replace('/uploads', 'uploads'));
        if (fs.existsSync(occPath)) {
          try {
            doc.image(occPath, x + qrSize + margin, y, { width: qrSize });
            doc.fontSize(10).text('Occupied', x + qrSize + margin, y + qrSize + 5, { width: qrSize, align: 'center' });
          } catch (e) {
            doc.fontSize(10).text('Error loading QR', x + qrSize + margin, y, { width: qrSize, align: 'center' });
          }
        } else {
          doc.fontSize(10).text('QR Not Found', x + qrSize + margin, y, { width: qrSize, align: 'center' });
        }

        currentCol++;
        if (currentCol >= cols) {
          currentCol = 0;
          currentRow++;
        }
      }

      doc.end();
    } catch (err) {
      console.error('PDF generation error:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // Individual bed QR PDF (kept for backward compatibility)
  router.get('/pdf/:bedId', async (req, res) => {
    try {
      const bed = await Bed.findOne({ bedId: req.params.bedId });
      if (!bed) return res.status(404).send('Not found');
      res.setHeader('Content-Type', 'application/pdf');
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      doc.pipe(res);
      doc.fontSize(20).text(`Bed ${bed.bedNumber} - ${bed.bedType}`, { align: 'center' });
      doc.moveDown();
      const root = path.join(__dirname, '..');
      const vacAbs = path.join(root, bed.qrVacantUrl.replace('/uploads', 'uploads'));
      const occAbs = path.join(root, bed.qrOccupiedUrl.replace('/uploads', 'uploads'));
      const w = 220; const x1 = 60, x2 = 320, y = 140;
      if (fs.existsSync(vacAbs)) { try { doc.image(vacAbs, x1, y, { width: w }); } catch (e) { } }
      if (fs.existsSync(occAbs)) { try { doc.image(occAbs, x2, y, { width: w }); } catch (e) { } }
      doc.fontSize(14).text('Scan to set Vacant', x1, y + w + 10, { width: w, align: 'center' });
      doc.fontSize(14).text('Scan to set Occupied', x2, y + w + 10, { width: w, align: 'center' });
      doc.end();
    } catch (err) { res.status(500).json({ message: err.message }); }
  });

  router.put('/:bedId', auth(['hospital']), async (req, res) => {
    try {
      const updates = req.body;
      const existing = await Bed.findOne({ bedId: req.params.bedId });
      if (!existing) return res.status(404).json({ success: false, message: 'Not found' });
      if (req.user.role === 'hospital' && req.user.ref !== existing.hospitalId) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
      const updated = await Bed.findOneAndUpdate({ bedId: req.params.bedId }, { $set: updates }, { new: true });
      io.to(`hospital_${updated.hospitalId}`).emit('bed:update', updated);
      res.json({ success: true, bed: updated });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  router.delete('/:bedId', auth(['hospital']), async (req, res) => {
    try {
      const existing = await Bed.findOne({ bedId: req.params.bedId });
      if (!existing) return res.status(404).json({ success: false, message: 'Not found' });
      if (req.user.role === 'hospital' && req.user.ref !== existing.hospitalId) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
      const removed = await Bed.findOneAndDelete({ bedId: req.params.bedId });
      res.json({ success: true, removed });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // HTML Mass Print Sheet
  router.get('/print-sheet/:hospitalId', async (req, res) => {
    try {
      const { wardNumber, bedType } = req.query;
      let query = { hospitalId: req.params.hospitalId };
      if (wardNumber) query.wardNumber = wardNumber;
      if (bedType) query.bedType = bedType;

      const beds = await Bed.find(query).sort({ wardNumber: 1, bedNumber: 1 }).lean();
      if (beds.length === 0) return res.status(404).send('No beds found');

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Mass QR Print - ${req.params.hospitalId}</title>
          <style>
            @media print {
              .no-print { display: none; }
              body { margin: 0; padding: 0; }
            }
            body { font-family: 'Inter', sans-serif; background: #f0f2f5; margin: 2rem; }
            .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
            .qr-card { 
              background: white; border: 2px solid #333; padding: 15px; border-radius: 8px; 
              text-align: center; page-break-inside: avoid; display: flex; flex-direction: column; align-items: center;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .hospital-name { font-size: 1.2rem; font-weight: bold; color: #d32f2f; margin-bottom: 5px; }
            .bed-info { font-size: 1.1rem; font-weight: bold; margin-bottom: 10px; }
            .qr-images { display: flex; gap: 15px; justify-content: center; }
            .qr-box { display: flex; flex-direction: column; align-items: center; }
            .qr-box img { width: 140px; height: 140px; border: 1px solid #eee; }
            .qr-label { font-size: 0.8rem; font-weight: bold; margin-top: 5px; text-transform: uppercase; }
            .footer-info { margin-top: 10px; font-size: 0.7rem; color: #666; border-top: 1px dashed #ccc; padding-top: 5px; width: 100%; }
            .btn-print { 
              background: #d32f2f; color: white; padding: 10px 20px; border: none; border-radius: 4px; 
              cursor: pointer; font-size: 1rem; margin-bottom: 2rem; 
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="text-align: center;">
            <button onclick="window.print()" class="btn-print">🖨️ Print QR Sheet</button>
            <p>Use "Save as PDF" or print directly. Designed for A4 paper.</p>
          </div>
          <div class="grid">
            ${beds.map(b => `
              <div class="qr-card">
                <div class="hospital-name">${b.hospitalId}</div>
                <div class="bed-info">Ward ${b.wardNumber} | Bed ${b.bedNumber}</div>
                <div class="qr-images">
                  <div class="qr-box">
                    <img src="${b.qrVacantUrl}" />
                    <div class="qr-label">Scan to Vacant</div>
                  </div>
                  <div class="qr-box">
                    <img src="${b.qrOccupiedUrl}" />
                    <div class="qr-label">Scan to Occupied</div>
                  </div>
                </div>
                <div class="footer-info">
                  ${b.bedType} Bed | ID: ${b.bedId}
                </div>
              </div>
            `).join('')}
          </div>
        </body>
        </html>
      `;
      res.send(html);
    } catch (err) {
      res.status(500).send(err.message);
    }
  });

  return router;
};


