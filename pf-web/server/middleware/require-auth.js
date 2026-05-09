function getSessionUserId(req) {
  const userId = Number(req.session && req.session.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    return null;
  }
  return userId;
}

function requireAuth(req, res, next) {
  const userId = getSessionUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthenticated" });
  }

  req.userId = userId;
  return next();
}

module.exports = {
  requireAuth,
};
