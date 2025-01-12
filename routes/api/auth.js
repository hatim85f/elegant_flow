const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("config");
const auth = require("../../middleware/auth");
const isCompanyAdmin = require("../../middleware/isCompanyAdmin");
const { check, validationResult } = require("express-validator");
const User = require("../../models/User");
const Organization = require("../../models/Organization");

const sgMail = require("@sendgrid/mail");

const secretToken =
  process.env.NODE_ENV === "production"
    ? process.env.JWT_SECRET
    : config.get("jwtSecret");

const mailAPIKey = process.env.mail_API;

// @router GET api/auth
// get user data
router.get("/", auth, async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.userId }).select("-password");
    res.json(user);
  } catch (error) {
    console.log(error.message);
    return res.status(500).send({
      error: "Server Error",
      message: error.message,
    });
  }
});

// @router GET api/auth
// get user data
router.get("/all", auth, isCompanyAdmin, async (req, res) => {
  try {
    const user = await User.find({
      organization: req.body.organization,
    }).select("-password");
    res.json(user);
  } catch (error) {
    console.log(error.message);
    return res.status(500).send({
      error: "Server Error",
      message: error.message,
    });
  }
});

// @router POST api/auth
// logging user in and getting token
router.post(
  "/login",
  [
    check("userName", "Username must be a valid email").isEmail(),
    check("password", "Password is required").exists(),
  ],
  async (req, res) => {
    const { userName, password } = req.body;

    try {
      let user = await User.findOne({ userName });

      if (!user) {
        return res.status(400).json({
          error: "Error",
          message: "Invalid Credentials",
        });
      }

      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        return res.status(400).json({
          error: "Error",
          message: "Invalid Username or Password",
        });
      }

      const payload = {
        user: {
          id: user.id,
        },
      };

      jwt.sign(payload, secretToken, (error, token) => {
        if (error) throw error;
        res.json({
          token,
          user: user,
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

// @router POST api/auth
// create new user
router.post(
  "/register",
  [
    check("firstName", "First name is required").not().isEmpty(),
    check("lastName", "Last name is required").not().isEmpty(),
    check("userName", "Username must be a valid email").isEmail(),
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
      let organizationNew = false;

      if (!organization) {
        const newOrganization = await new Organization({
          name: organizationName,
          createdAt: Date.now(),
        });

        await newOrganization.save();

        organizationId = newOrganization._id;

        organizationName = true;
      } else {
        organizationId = organization._id;
      }

      const newUser = new User({
        firstName,
        lastName,
        userName,
        email: userName,
        role: "owner",
        createdAt: Date.now(),
        organization: organizationId,
        branch: null,
      });

      const payload = {
        user: {
          id: newUser.id,
        },
      };

      const salt = await bcrypt.genSalt(10);

      newUser.password = await bcrypt.hash(password, salt);

      await newUser.save();

      if (organizationNew) {
        await Organization.updateOne(
          { name: organizationName },
          {
            $set: {
              created_by: newUser._id,
            },
          }
        );
      }

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
        message: "Server Error, please try again" + error.message,
      });
    }
  }
);

// @router POST api/auth
// create new user
router.post("/invite", auth, isCompanyAdmin, async (req, res) => {
  const { firstName, lastName, email, role, userId, parentId, branchId } =
    req.body;

  try {
    const user = await User.findOne({ _id: userId });

    const isPreviousUser = await User.findOne({
      email: email,
      organization: user.organization,
    });

    if (isPreviousUser) {
      return res.status(400).send({
        error: "ERROR!",
        message: "User already exists",
      });
    }

    const newUser = new User({
      firstName: firstName,
      lastName: lastName,
      userName: email,
      email: email,
      role: role,
      createdAt: Date.now(),
      organization: user.organization,
      parentId: parentId ? parentId : userId,
      branch: branchId ? branchId : null,
    });

    const salt = await bcrypt.genSalt(10);

    newUser.password = await bcrypt.hash(`${firstName}${lastName}`, salt);

    await newUser.save();

    sgMail.setApiKey(mailAPIKey);

    const msg = {
      to: email,
      from: "info@codexpandit.com",
      templateId: "d-8fe4f1a2c4c34dc7907d04659e164e2d",
      dynamic_template_data: {
        subject: "Invitation to join the team",
        firstName: firstName,
        lastName: lastName,
        manager_name: `${user.firstName} ${user.lastName}`,
        username: email,
        password: `${firstName}${lastName}`,
      },
    };

    sgMail.send(msg);

    return res.status(200).send({
      message: `User ${firstName} ${lastName} has been invited to join the team`,
    });
  } catch (error) {
    return res.status(500).send({
      error: "ERROR!",
      message: "Server Error, Please try again later",
    });
  }
});

// @router PUT api/auth
// edit current user
// user changing his details
router.put("/:userId", auth, async (req, res) => {
  const { userId } = req.params;
  const {
    avatar,
    firstName,
    lastName,
    email,
    phoneNumber,
    department,
    officeLocation,
    facebook,
    x,
    linkedin,
    instagram,
  } = req.body;

  try {
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          firstName,
          lastName,
          userName: email,
          email,
          department,
          officeLocation,
          profile: {
            firstName,
            lastName,
            phone: phoneNumber,
            avatar,
          },
          social: {
            facebook,
            x,
            linkedin,
            instagram,
          },
        },
      }
    );

    const user = await User.findOne({ _id: userId });

    return res.status(200).send({
      message: "Your Profile updated Successfully",
      user: user,
    });
  } catch (error) {
    return res.status(500).send({
      error: "ERROR!",
      message: "Server Error, Please try again later",
    });
  }
});

// change user password by checking the old one
router.put("/change-password/:userId", auth, async (req, res) => {
  const { userId } = req.params;
  const { oldPassword, newPassword } = req.body;

  try {
    const isUser = await User.findOne({ _id: userId });

    if (!isUser) {
      return res.status(400).send({
        error: "ERROR!",
        message: "User Not Found",
      });
    }

    // Check if old and new passwords are the same

    if (oldPassword === newPassword)
      return res.status(400).send({
        error: "Same password",
        message: `New password can't be the same as old password`,
      });

    // Check if password is correct
    const isMatch =
      isUser.password === oldPassword ||
      (await bcrypt.compare(oldPassword, isUser.password));

    if (!isMatch) {
      return res.status(500).send({
        error: "Incorrect password",
        message: `Old password is incorrect`,
      });
    }

    // Change password
    const salt = await bcrypt.genSalt(10);
    hashedPassword = await bcrypt.hash(newPassword, salt);
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          password: hashedPassword,
        },
      }
    );

    return res.status(200).send({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    return res.status(500).send({
      error: "ERROR!",
      message: "Server Error, please try again",
    });
  }
});

// router @PUT
// updating user push token
router.put("/push-token/:userId", auth, async (req, res) => {
  const { userId } = req.params;
  const { pushToken } = req.body;

  try {
    await User.updateOne(
      { _id: userId },
      {
        $addToSet: {
          pushTokens: pushToken,
        },
      }
    );

    return res.status(200).send({
      message: "Push Token updated successfully",
    });
  } catch (error) {
    return res.status(500).send({
      error: "ERROR!",
      message: "Server Error, please try again",
    });
  }
});

module.exports = router;
