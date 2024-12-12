const roleMiddleware = (allowedRoles) => {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Access denied" });
    }
    next();
  };
};

// Example Usage:
app.post(
  "/create-employee",
  roleMiddleware(["owner", "manager"]),
  createEmployee
);