const express = require("express");
const router = express.Router();

const Organization = require("../../models/Organization");
const auth = require("../../middleware/auth");
const Branch = require("../../models/Branch");
const { default: mongoose } = require("mongoose");

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
    const organization = await Organization.aggregate([
      {
        $match: {
          created_by: new mongoose.Types.ObjectId(userId), // Match organizations created by the specific user
        },
      },
      {
        $lookup: {
          from: "branches", // Name of the branches collection
          localField: "branches", // Field in the Organization collection
          foreignField: "_id", // Field in the Branches collection
          as: "branchDetails", // Alias for the joined data
        },
      },
      {
        $project: {
          name: 1,
          logo: 1,
          industry: 1,
          website: 1,
          branches: "$branchDetails", // Include the populated branch details
          address: 1,
        },
      },
    ]);

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
  const { orgnaizationName, industry, website, logo, branches, address } =
    req.body;

  try {
    let organizationBranches = [];

    // Fetch current branches for the organization
    const currentBranches = await Branch.find({
      branchForOrganization: organizationId,
    });
    const existingBranchNames = new Set(
      currentBranches.map((branch) => branch.branchName.toLowerCase()) // Case-insensitive comparison
    );

    if (branches.length > 0) {
      for (let branch of branches) {
        // Check if the branch already exists
        if (!existingBranchNames.has(branch.branchName.toLowerCase())) {
          const newBranch = new Branch({
            branchName: branch.branchName,
            branchLocation: branch.branchLocation,
            branchContact: branch.branchContact,
            branchEmail: branch.branchEmail,
            branchManager: branch.branchManager,
            branchForOrganization: organizationId,
          });

          organizationBranches.push(newBranch);
        }
      }
    }

    // Insert only unique branches
    if (organizationBranches.length > 0) {
      await Branch.insertMany(organizationBranches);
    }

    await Organization.updateOne(
      {
        _id: organizationId,
        created_by: userId,
      },
      {
        $set: {
          name: orgnaizationName,
          logo,
          industry,
          website,
          updated_at: Date.now(),
          address,
        },
        $addToSet: {
          branches: {
            $each: organizationBranches, // Use $each to add multiple branches
          },
        },
      }
    );

    return res
      .status(200)
      .json({ message: "Organization updated successfully" });
  } catch (error) {
    return res.status(500).send({
      error: "Error!",
      message: "Server Error for updating Organization" + error.message,
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
