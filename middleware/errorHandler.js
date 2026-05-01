const errorHandler = (err, req, res, next) => {
  console.error('❌ Error:', err.message);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ success: false, message: messages.join(', ') });
  }

  // Mongoose duplicate key (e.g. unique email)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({ success: false, message: `${field} already exists` });
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'Invalid ID format' });
  }

  // CORS blocked
  if (err.message?.startsWith('CORS blocked')) {
    return res.status(403).json({ success: false, message: err.message });
  }

  // Default 500
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
};

export default errorHandler;