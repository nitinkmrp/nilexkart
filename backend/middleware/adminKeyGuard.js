/**
 * adminKeyGuard.js
 * Middleware that checks for the secret admin key header on write routes.
 * Attach to any route that should be admin-only.
 */
const adminKeyGuard = (req, res, next) => {
  const key = req.headers['x-admin-key'];
  if (!key || key !== process.env.ADMIN_SECRET_KEY) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Admin access required.',
    });
  }
  next();
};

export default adminKeyGuard;
