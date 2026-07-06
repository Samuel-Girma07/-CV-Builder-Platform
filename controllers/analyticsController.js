const analyticsQuery = require('../models/analyticsQuery');

exports.getFunnel = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { groupBy } = req.query;

    const data = await analyticsQuery.getFunnelData(userId, groupBy);
    res.json(data);
  } catch (error) {
    next(error);
  }
};
