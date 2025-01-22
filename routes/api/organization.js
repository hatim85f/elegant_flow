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
        $addFields: {
          branches: {
            $cond: {
              if: { $gt: [{ $size: "$branchDetails" }, 0] }, // Check if branchDetails has at least one branch
              then: "$branchDetails", // Use branchDetails
              else: [], // Otherwise, set branches to an empty array
            },
          },
        },
      },
      {
        $unwind: {
          path: "$branches",
          preserveNullAndEmptyArrays: true, // Preserve empty branches array
        },
      },
      {
        $lookup: {
          from: "users", // Name of the users collection
          localField: "branches.branchManager", // Field in the branches collection referencing a user
          foreignField: "_id", // Field in the users collection
          as: "branchManagerDetails", // Alias for the joined data
        },
      },
      {
        $addFields: {
          "branches.branchManager": {
            $cond: {
              if: { $gt: [{ $size: "$branchManagerDetails" }, 0] }, // Check if branchManagerDetails exists
              then: {
                $concat: [
                  { $arrayElemAt: ["$branchManagerDetails.firstName", 0] },
                  " ",
                  { $arrayElemAt: ["$branchManagerDetails.lastName", 0] },
                ],
              },
              else: null, // Otherwise, set branchManager to null
            },
          },
        },
      },
      {
        $group: {
          _id: "$_id", // Group back to the original organization structure
          name: { $first: "$name" },
          logo: { $first: "$logo" },
          industry: { $first: "$industry" },
          website: { $first: "$website" },
          branches: { $push: "$branches" }, // Regroup branches into an array
          address: { $first: "$address" },
        },
      },
      {
        $project: {
          name: 1,
          logo: 1,
          industry: 1,
          website: 1,
          branches: 1, // Include the enriched branch details
          address: 1,
        },
      },
    ]);

    return res.status(200).json({ organization: organization[0] });
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
    let branchUpdates = [];

    // Fetch current branches for the organization
    const currentBranches = await Branch.find({
      branchForOrganization: organizationId,
    });

    const existingBranchesMap = new Map(
      currentBranches.map((branch) => [branch.branchName.toLowerCase(), branch])
    );

    if (branches.length > 0) {
      for (let branch of branches) {
        const branchNameLower = branch.branchName.toLowerCase();
        if (existingBranchesMap.has(branchNameLower)) {
          // Update existing branch
          const existingBranch = existingBranchesMap.get(branchNameLower);
          branchUpdates.push(
            Branch.updateOne(
              { _id: existingBranch._id },
              {
                $set: {
                  branchLocation:
                    branch.branchLocation || existingBranch.branchLocation,
                  branchContact:
                    branch.branchContact || existingBranch.branchContact,
                  branchEmail: branch.branchEmail || existingBranch.branchEmail,
                  branchManager:
                    branch.branchManager || existingBranch.branchManager,
                },
              }
            )
          );
        } else {
          // Add new branch
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

    // Execute branch updates
    if (branchUpdates.length > 0) {
      await Promise.all(branchUpdates);
    }

    // Insert new branches
    if (organizationBranches.length > 0) {
      const insertedBranches = await Branch.insertMany(organizationBranches);
      organizationBranches = insertedBranches.map((branch) => branch._id); // Collect the IDs of new branches
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
            $each: organizationBranches, // Add new branches
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
      message: "Server Error for updating Organization: " + error.message,
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
