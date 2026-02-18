// utils/errorHandler.js - Centralized error handling

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Async error wrapper - catches errors in async route handlers
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Validation error handler
const handleValidationError = (err) => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

// MongoDB duplicate key error
const handleDuplicateKeyError = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];
  const message = `${field}: '${value}' already exists. Please use another value.`;
  return new AppError(message, 400);
};

// MongoDB cast error (invalid ID)
const handleCastError = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

// Send error response
const sendErrorResponse = (err, req, res) => {
  // Ensure we don't send response twice
  if (res.headersSent) {
    return;
  }
  
  // Operational errors - send to client
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
  
  // Handle specific MongoDB errors
  if (err.code === 11000) {
    const duplicateError = handleDuplicateKeyError(err);
    return res.status(duplicateError.statusCode).json({
      success: false,
      message: duplicateError.message
    });
  }
  
  if (err.name === 'ValidationError') {
    const validationError = handleValidationError(err);
    return res.status(validationError.statusCode).json({
      success: false,
      message: validationError.message
    });
  }
  
  if (err.name === 'CastError') {
    const castError = handleCastError(err);
    return res.status(castError.statusCode).json({
      success: false,
      message: castError.message
    });
  }
  
  // Programming or unknown errors - don't leak details
  console.error('💥 ERROR:', err);
  return res.status(500).json({
    success: false,
    message: 'Something went wrong. Please try again later.',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};

module.exports = {
  AppError,
  asyncHandler,
  handleValidationError,
  handleDuplicateKeyError,
  handleCastError,
  sendErrorResponse
};
