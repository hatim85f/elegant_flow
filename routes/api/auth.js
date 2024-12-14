const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("config");
const auth = require("../../middleware/auth");
const { check, validationResult } = require("express-validator");
const User = require("../../models/User");
const Organization = require("../../models/Organization");

const secretToken =
  process.env.NODE_ENV === "production"
    ? process.env.JWT_SECRET
    : config.get("jwtSecret");

// @router POST api/auth
// create new user
router.post(
  "/register",
  [
    check("firstName", "First name is required").not().isEmpty(),
    check("lastName", "Last name is required").not().isEmpty(),
    check("userName", "Username is required").not().isEmail(),
    check("password", "Password must be at least 6 characters long").isLength({
      min: 6,
    }),
    check("organizationName", "Organization name is required").not().isEmpty(),
  ],
  async (req, res) => {
    const { firstName, lastName, userName, password, organizationName } =
      req.body;

    try {
      const isUser = await User.findOne({ userName });

      if (isUser) {
        return res.status(500).send({
          error: "Error",
          message: "User Email Already Exists",
        });
      }

      const organization = await Organization.findOne({
        name: organizationName,
      });

      let organizationId;

      if (!organization) {
        const newOrganization = await new Organization({
          name: organizationName,
          createdAt: Date.now(),
        });

        await newOrganization.save();

        organizationId = newOrganization._id;
      } else {
        organizationId = organization._id;
      }

      const newUser = new User({
        firstName,
        lastName,
        userName,
        role: "owner",
        createdAt: Date.now(),
        organization: organizationId,
      });

      const payload = {
        user: {
          id: newUser.id,
        },
      };

      await Organization.updateOne(
        { name: organizationName },
        {
          $set: {
            created_by: newUser._id,
          },
        }
      );

      const salt = await bcrypt.genSalt(10);

      newUser.password = await bcrypt.hash(password, salt);

      await newUser.save();

      const sanitizedUser = { ...newUser.toObject() };
      delete sanitizedUser.password;

      jwt.sign(payload, secretToken, (error, token) => {
        if (error) throw error;
        res.json({
          token,
          user: sanitizedUser,
          message: "User created and waiting for admins approval",
        });
      });
    } catch (error) {
      console.log(error.message);
      return res.status(500).send({
        error: "Server Error",
        message: error.message,
      });
    }
  }
);

module.exports = router;
