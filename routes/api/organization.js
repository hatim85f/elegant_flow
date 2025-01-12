const express = require("express");
const router = express.Router();

const Organization = require("../../models/Organization");
const auth = require("../../middleware/auth");
const Branch = require("../../models/Branch");

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

router.get("/:userId", auth, async (req, res) => {
  const { userId } = req.params;

  try {
    const organization = await Organization.findOne({ created_by: userId });

    return res.status(200).json({ organization });
  } catch (error) {
    return res.status(500).send({
      error: "Error!",
      message: "Server Error for getting Organization Names",
    });
  }
});

router.put("/:userId/:organizationId", auth, async (req, res) => {
  const { userId, organizationId } = req.params;
  const { orgnaizationName, industry, website, logo, branches } = req.body;

  try {
    let organizationBranches = [];
    if (branches.length > 0) {
      for (let branch of branches) {
        const newBranch = new Branch({
          branchName: branch.branchName,
          branchLocation: branch.branchLocation,
          branchContact: branch.branchContact,
          branchEmail: branch.branchEmail,
          branchManager: branch.branchManager,
        });

        organizationBranches.push(newBranch);
      }
    }

    await Organization.updateOne(
      {
        _id: organizationId,
        created_by: userId,
      },
      {
        name: orgnaizationName,
        logo,
        industry,
        website,
        branches: {
          $addToSet: {
            branches: organizationBranches,
          },
        },
        updated_at: Date.now(),
      }
    );

    return res
      .status(200)
      .json({ message: "Organization updated successfully" });
  } catch (error) {
    return res.status(500).send({
      error: "Error!",
      message: "Server Error for updating Organization",
    });
  }
});

// delete one single branch from an organization
router.delete("/:organizationId/:branchId", auth, async (req, res) => {
  const { organizationId, branchId } = req.params;

  try {
    await Organization.updateOne(
      {
        _id: organizationId,
      },
      {
        $pull: {
          branches: {
            _id: branchId,
          },
        },
      }
    );

    return res.status(200).json({ message: "Branch deleted successfully" });
  } catch (error) {
    return res.status(500).send({
      error: "Error!",
      message: "Server Error for deleting Branch",
    });
  }
});

module.exports = router;
