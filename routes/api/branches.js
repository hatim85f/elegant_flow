const express = require("express");
const router = express.Router();

const Branch = require("../../models/Branch");
const User = require("../../models/User");
const auth = require("../../middleware/auth");

// get all branches related to userId
router.get("/:userId", auth, async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findOne({ _id: userId });

    const branches = await Branch.find({
      branchForOrganization: user.organization,
    });

    return res.status(200).send({ branches });
  } catch (error) {
    return res.status(500).send({
      error: "ERROR !",
      message: "Internal Server Error, please try again later",
    });
  }
});

module.exports = router;
