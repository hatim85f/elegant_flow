const express = require("express");
const router = express.Router();

const User = require("../../models/User");
const auth = require("../../middleware/auth");

// get managers details for the onwer to submit employees
router.get("/managers/:organization", auth, async (req, res) => {
  const { organization } = req.params;

  try {
    const managers = await User.find({
      organization,
      role: "manager",
    });

    const filteredManagers = managers.map((manager) => {
      return {
        label: `${manager.firstName} ${manager.lastName}`,
        value: manager._id,
      };
    });

    return res.status(200).json({ managers: filteredManagers });
  } catch (error) {
    return res.status(500).send({
      error: "ERROR!",
      message: "Server Error, Please try again later",
    });
  }
});

// @router GET api/teams/:userId
// get user's team

router.get("/:userId", auth, async (req, res) => {
  const { userId } = req.params;

  try {
  } catch (error) {
    const user = await User.findOne({ _id: userId });

    let team = [];

    if (user.role === "owner") {
      team = await User.find({ organization: user.organization });
    } else if (user.role === "manager") {
      team = await User.find({ parentId: user._id });
    }
    return res.status(500).send({
      error: "ERROR!",
      message:
        "An error occurred while trying to get the user's teams, please try again later",
    });
  }
});

module.exports = router;
