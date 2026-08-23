const jwt = require('jsonwebtoken');
const userQuery = require('../models/userQuery');

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const [scheme, headerToken] = authHeader.split(' ');

    // Bearer header only. Session JWTs must never travel in URLs (they leak
    // into logs, history, and referrers). Embedded documents use short-lived,
    // single-purpose tickets issued per resource instead — see xrayRoutes.
    const token = scheme === 'Bearer' && headerToken ? headerToken : null;

    if (!token) {
      return res.status(401).json({ error: 'Authentication token is required.' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await userQuery.findById(payload.sub);

    if (!user) {
      return res.status(401).json({ error: 'User account no longer exists.' });
    }

    // The 1-hour temporary-password window is enforced on EVERY request, not
    // only at login: a JWT minted inside the window must not outlive it.
    if (
      user.must_change_password &&
      user.reset_token_expires &&
      new Date(user.reset_token_expires) < new Date()
    ) {
      return res.status(401).json({ error: 'Your temporary credentials have expired. Please request a new password reset.' });
    }

    const allowedPaths = ['/api/auth/update-password', '/api/auth/me'];
    if (user.must_change_password && !allowedPaths.includes(req.baseUrl + req.path)) {
      return res.status(403).json({ error: 'You must change your temporary password to proceed.' });
    }

    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

module.exports = authMiddleware;
