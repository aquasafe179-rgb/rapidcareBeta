# 🔑 RapidCare Test Credentials

## Updated Credentials (After Database Reset)

All passwords are **bcrypt-hashed** and set to: `test@1234`

---

## 🏥 Hospital Login (Reception Portal)

### AIIMS-RPR
- **ID**: `AIIMS-RPR`
- **Password**: `test@1234`
- **Name**: AIIMS Raipur
- **Location**: Tatibandh, GE Road, Raipur
- **Doctors**: 2 (DOC-AIIMS-01, DOC-AIIMS-02)
- **Ambulances**: 1 (AMB-AIIMS-01)
- **Beds**: 20 (5 ICU, 15 General)

### MEKAHARA-RPR
- **ID**: `MEKAHARA-RPR`
- **Password**: `test@1234`
- **Name**: Dr. B.R.A.M. Hospital (Mekahara)
- **Location**: Civil Lines, Raipur
- **Doctors**: 1 (DOC-MEK-01)
- **Ambulances**: 0
- **Beds**: 20 (5 ICU, 15 General)

### NH-NARAYANA
- **ID**: `NH-NARAYANA`
- **Password**: `test@1234`
- **Name**: NH Narayana Superspeciality Hospital
- **Location**: Sector 32, Naya Raipur
- **Doctors**: 1 (DOC-NH-01)
- **Ambulances**: 1 (AMB-NH-01)
- **Beds**: 20 (5 ICU, 15 General)

---

## 👨‍⚕️ Doctor Login (Doctor Portal)

### DOC-AIIMS-01 (AIIMS-RPR)
- **ID**: `DOC-AIIMS-01`
- **Password**: `test@1234`
- **Name**: Dr. Rajesh Gupta
- **Speciality**: Cardiology
- **Qualification**: MD, DM
- **Experience**: 15 years

### DOC-AIIMS-02 (AIIMS-RPR)
- **ID**: `DOC-AIIMS-02`
- **Password**: `test@1234`
- **Name**: Dr. Priya Singh
- **Speciality**: Neurology
- **Qualification**: MD, DNB
- **Experience**: 10 years

### DOC-MEK-01 (MEKAHARA-RPR)
- **ID**: `DOC-MEK-01`
- **Password**: `test@1234`
- **Name**: Dr. S.K. Verma
- **Speciality**: Surgery
- **Qualification**: MS
- **Experience**: 20 years

### DOC-NH-01 (NH-NARAYANA)
- **ID**: `DOC-NH-01`
- **Password**: `test@1234`
- **Name**: Dr. Amit Patel
- **Speciality**: Oncology
- **Qualification**: MD, MCh
- **Experience**: 12 years

---

## 🚑 Ambulance Login (Ambulance Portal)

### AMB-AIIMS-01 (AIIMS-RPR)
- **ID**: `AMB-AIIMS-01`
- **Password**: `test@1234`
- **Vehicle Number**: CG04-AMB-01
- **EMT**: Sanjay Sahu (EMT-01)
- **Status**: On Duty

### AMB-NH-01 (NH-NARAYANA)
- **ID**: `AMB-NH-01`
- **Password**: `test@1234`
- **Vehicle Number**: CG04-AMB-02
- **EMT**: Rahul Gond (EMT-02)
- **Status**: On Duty

---

## 🛠️ Admin & Development

### ⚡ Database Reset
To reset the database and regenerate all credentials:
- **Command**: `npm run seed` (Terminal)
- **API**: `POST /api/reset-db` (Browser/Postman)

### 👤 Super Admin (Management)
To create the first Super Admin (only possible if none exists):
- **Endpoint**: `POST /api/admin/create-initial`
- **Body**: `{ "username": "admin", "password": "yourpassword" }`

---

## 📁 QR Codes Generated
QR codes are stored in `uploads/qr/` (Attendance) and `uploads/qrs/-` (Beds).
Format: `[HospitalID]-[Ward]-[BedID]-[Status].png`

---

## 🧪 Testing Portals
- **Reception**: [http://localhost:5000/reception.html](http://localhost:5000/reception.html)
- **Doctor**: [http://localhost:5000/doctor.html](http://localhost:5000/doctor.html)
- **Ambulance**: [http://localhost:5000/ambulance.html](http://localhost:5000/ambulance.html)
- **Public**: [http://localhost:5000/public.html](http://localhost:5000/public.html)

---

## 📝 Changelog
- **v1.2**: Standardized IDs (e.g., `AIIMS-RPR` instead of `HOSP001`).
- **v1.1**: Added Super Admin registration details.
- **v1.0**: Initial credential set.

**Last Updated**: 2026-02-18
