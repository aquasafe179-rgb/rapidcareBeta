// utils/validators.js - Input validation utilities

const { AppError } = require('./errorHandler');

// Validate required fields
const validateRequired = (fields, body) => {
  const missing = [];
  fields.forEach(field => {
    if (!body[field] || (typeof body[field] === 'string' && body[field].trim() === '')) {
      missing.push(field);
    }
  });
  
  if (missing.length > 0) {
    throw new AppError(`Missing required fields: ${missing.join(', ')}`, 400);
  }
};

// Validate email format
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new AppError('Invalid email format', 400);
  }
};

// Validate phone number (Indian format)
const validatePhone = (phone) => {
  const phoneRegex = /^[6-9]\d{9}$/;
  if (!phoneRegex.test(phone)) {
    throw new AppError('Invalid phone number. Must be 10 digits starting with 6-9', 400);
  }
};

// Validate password strength
const validatePassword = (password) => {
  if (password.length < 6) {
    throw new AppError('Password must be at least 6 characters long', 400);
  }
};

// Sanitize string input (remove HTML tags, trim)
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return str.replace(/<[^>]*>/g, '').trim();
};

// Sanitize object (recursively sanitize all string fields)
const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sanitized = {};
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      sanitized[key] = sanitizeString(obj[key]);
    } else if (typeof obj[key] === 'object') {
      sanitized[key] = sanitizeObject(obj[key]);
    } else {
      sanitized[key] = obj[key];
    }
  }
  return sanitized;
};

// Validate MongoDB ObjectId
const validateObjectId = (id) => {
  const objectIdRegex = /^[0-9a-fA-F]{24}$/;
  if (!objectIdRegex.test(id)) {
    throw new AppError('Invalid ID format', 400);
  }
};

// Validate age
const validateAge = (age) => {
  const ageNum = parseInt(age);
  if (isNaN(ageNum) || ageNum < 0 || ageNum > 150) {
    throw new AppError('Invalid age. Must be between 0 and 150', 400);
  }
};

// Validate date
const validateDate = (date) => {
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) {
    throw new AppError('Invalid date format', 400);
  }
};

module.exports = {
  validateRequired,
  validateEmail,
  validatePhone,
  validatePassword,
  sanitizeString,
  sanitizeObject,
  validateObjectId,
  validateAge,
  validateDate
};
