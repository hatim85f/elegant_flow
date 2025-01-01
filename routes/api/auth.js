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
        message: "Server Error, please try again",
      });
    }
  }
);

// @router POST api/auth
// create new user
router.post("/invite", auth, isCompanyAdmin, async (req, res) => {
  const { firstName, lastName, email, role, userId } = req.body;

  try {
    const user = await User.findOne({ _id: userId });

    // const isPreviousUser = await User.findOne({ email: email });

    // if (isPreviousUser) {
    //   return res.status(400).send({
    //     error: "ERROR!",
    //     message: "User already exists",
    //   });
    // }

    // const newUser = new User({
    //   firstName: firstName,
    //   lastName: lastName,
    //   userName: email,
    //   email: email,
    //   role: role,
    //   createdAt: Date.now(),
    //   organization: user.organization,
    //   parentId: userId,
    // });

    // const salt = await bcrypt.genSalt(10);

    // newUser.password = await bcrypt.hash(`${firstName}${lastName}`, salt);

    // await newUser.save();

    sgMail.setApiKey(mailAPIKey);

    const msg = {
      to: email,
      from: user.email,
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

    sgMail
      .send(msg)
      .then((response) => {
        if (response[0]?.statusCode === 202) {
          // SendGrid returns 202 for successful email acceptance
          return res.status(200).send({
            message: `Email Sent Successfully to ${firstName} ${lastName}`,
          });
        } else {
          return res.status(500).send({
            message: "Unexpected status code:" + response[0]?.statusCode,
          });
        }
      })
      .catch((error) => {
        console.error("Error sending email:", error);
        if (error.response) {
          console.error("SendGrid response:", error.response.body); // Log detailed error response
        }
      });

    // return res.status(200).send({
    //   message: `User ${firstName} ${lastName} has been invited to join the team`,
    // });
  } catch (error) {
    return res.status(500).send({
      error: "ERROR!",
      message: "Server Error, please try again",
    });
  }
});

// @router PUT api/auth
// edit current user
router.put("/:userId", auth, async (req, res) => {
  const { userId } = req.params;
  const { userDetails } = req.body;

  try {
    const isUser = await User.findOne({ _id: userId });

    if (!isUser) {
      return res.status(400).send({
        error: "ERROR!",
        message: "User Not Found",
      });
    }

    const updatedFields = {};

    if (userDetails.employmentType)
      updatedFields.employmentType = userDetails.employmentType;
    if (userDetails.officeLocation)
      updatedFields.officeLocation = userDetails.officeLocation;
    if (userDetails.subordinates)
      updatedFields.subordinates = userDetails.subordinates;
    if (userDetails.accessLevel)
      updatedFields.accessLevel = userDetails.accessLevel;

    if (userDetails.profile) {
      if (userDetails.profile.firstName)
        updatedFields["profile.firstName"] = userDetails.profile.firstName;
      if (userDetails.profile.lastName)
        updatedFields["profile.lastName"] = userDetails.profile.lastName;
      if (userDetails.profile.phone)
        updatedFields["profile.phone"] = userDetails.profile.phone;
      if (userDetails.profile.avatar)
        updatedFields["profile.avatar"] = userDetails.profile.avatar;
    }

    if (userDetails.settings) {
      if (userDetails.settings.theme)
        updatedFields["settings.theme"] = userDetails.settings.theme;
      if (userDetails.settings.mode)
        updatedFields["settings.mode"] = userDetails.settings.mode;
      if (userDetails.settings.chatOn !== undefined)
        updatedFields["settings.chatOn"] = userDetails.settings.chatOn;
      if (userDetails.settings.notificationsOn !== undefined)
        updatedFields["settings.notificationsOn"] =
          userDetails.settings.notificationsOn;
      if (userDetails.settings.newsletterOn !== undefined)
        updatedFields["settings.newsletterOn"] =
          userDetails.settings.newsletterOn;
    }

    if (userDetails.social) {
      if (userDetails.social.facebook)
        updatedFields["social.facebook"] = userDetails.social.facebook;
      if (userDetails.social.x)
        updatedFields["social.x"] = userDetails.social.x;
      if (userDetails.social.linkedin)
        updatedFields["social.linkedin"] = userDetails.social.linkedin;
      if (userDetails.social.instagram)
        updatedFields["social.instagram"] = userDetails.social.instagram;
    }

    // Update the user
    const updatedUser = await User.updateOne(
      { _id: userId },
      { $set: updatedFields }
    );

    return res.status(200).send({
      success: true,
      message: "User updated successfully",
      updatedFields,
    });
  } catch (error) {
    return res.status(500).send({
      error: "ERROR!",
      message: "Server Error, please try again",
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

module.exports = router;
