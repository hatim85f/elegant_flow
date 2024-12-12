const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("config");
const auth = require("../../middleware/auth");
const { check, validationResult } = require("express-validator");
const User = require("../../models/User");

// @router POST api/auth
// create new user
router.post("/register", async (req, res) => {
  const { userName, email, password } = req.body;

  try {
    const isUser = await User.findOne({ email });

    if (isUser) {
      return res.status(500).send({
        error: "Error",
        message: "User Email Already Exists",
      });
    }

    const newUser = new User({
      userName,
      email,
      role: "owner",
    });

    const payload = {
      user: {
        id: newUser.id,
      },
    };

    const salt = await bcrypt.genSalt(10);

    newUser.password = await bcrypt.hash(password, salt);

    await newUser.save();

    jwt.sign(payload, setcretToken, (error, token) => {
      if (error) throw error;
      res.json({
        token,
        user: newUser,
        message: "User created and waiting for admins approval",
      });
    });
  } catch (error) {
    return res.status(500).send({
      error: "Server Error",
      message: "Server Error, please try again later",
    });
  }
});

module.exports = router;
