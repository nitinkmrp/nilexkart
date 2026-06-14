import jwt from 'jsonwebtoken';

/**
 * roleGuard.js
 * Middleware that checks for a valid JWT and verifies the user's role.
 * 
 * @param {string[]} allowedRoles - Array of roles allowed to access the route
 */
const roleGuard = (allowedRoles = []) => {
  return (req, res, next) => {
    try {
      // Get the token from the Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: Missing or invalid token format. Use Bearer <token>',
        });
      }

      const token = authHeader.split(' ')[1];
      const secret = process.env.JWT_SECRET || process.env.ADMIN_SECRET_KEY || 'default_fallback_secret';

      // Verify token
      const decoded = jwt.verify(token, secret);
      
      // Attach decoded user info to the request object
      req.user = decoded;

      // Check if user has required role
      if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: `Forbidden: Requires one of the following roles: ${allowedRoles.join(', ')}`,
        });
      }

      next();
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Invalid or expired token',
        error: err.message
      });
    }
  };
};

export default roleGuard;
