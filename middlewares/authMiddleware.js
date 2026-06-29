const jwt = require('jsonwebtoken');
const userQuery = require('../models/userQuery');

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const [scheme, headerToken] = authHeader.split(' ');

    // Prefer the Authorization header. Fall back to a `?token=` query param so
    // authenticated files can be loaded directly in an <iframe>/<embed>, which
    // cannot set request headers (used by the X-Ray PDF preview).
    const token = scheme === 'Bearer' && headerToken ? headerToken : req.query.token;

    if (!token) {
      return res.status(401).json({ error: 'Authentication token is required.' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await userQuery.findById(payload.sub);

    if (!user) {
      return res.status(401).json({ error: 'User account no longer exists.' });
    }

    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

module.exports = authMiddleware;
