const express = require("express");
const router = express.Router();

const Organization = require("../../models/Organization");

// @GET api request
// Public
// Getting all organizations to be used in the registeration form
router.get("/", async (req, res) => {
  try {
    const allOrganizations = await Organization.find({});

    return res.status(200).json({ organizations: allOrganizations });
  } catch (error) {
    return res.status(500).send({
      error: "Error!",
      message: "Server Error for getting Organization Names",
    });
  }
});

module.exports = router;
