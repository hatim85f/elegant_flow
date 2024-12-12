const jwt = require("jsonwebtoken");
const config = require("config");

module.exports = (req, res, next) => {
  const setcretToken =
    process.env.NODE_ENV === "production"
      ? process.env.jwtSecret
      : config.get("jwtSecret");
  // Get token from header
  const token = req.header("x-auth-token");

  // Check if no Token
  if (!token) {
    return res.status(401).json({
      message:
        "You are not authorized to perform this opertaion, login or contact your provider",
    });
  }

  // Verify token

  try {
    const decoded = jwt.verify(token, setcretToken);

    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ message: "Token is not valid" });
  }
};
