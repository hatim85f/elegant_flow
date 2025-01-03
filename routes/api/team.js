const express = require("express");
const router = express.Router();

const User = require("../../models/User");
const auth = require("../../middleware/auth");
const Clients = require("../../models/Clients");

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
    const user = await User.findOne({ _id: userId });

    if (!user) {
      return res.status(404).json({
        error: "User not found",
        message: "The specified user does not exist.",
      });
    }

    const isOwner = user.role === "owner";

    const teamPipeline = [
      {
        $match: isOwner
          ? { role: "manager", organization: user.organization }
          : { parentId: user._id },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "parentId",
          as: "subTeam",
        },
      },
      {
        $lookup: {
          from: "clients",
          localField: "_id",
          foreignField: "assignedTo",
          as: "customers",
        },
      },
      {
        $addFields: {
          teamMembers: { $size: "$subTeam" },
          customersNumber: { $size: "$customers" },
          subTeam: {
            $map: {
              input: "$subTeam",
              as: "subMember",
              in: {
                _id: "$$subMember._id",
                avatar: "$$subMember.avatar",
                firstName: "$$subMember.firstName",
                lastName: "$$subMember.lastName",
                role: {
                  $cond: {
                    if: { $eq: ["$$subMember.role", "manager"] },
                    then: "Manager",
                    else: "Employee",
                  },
                },
                officeLocation: "$$subMember.officeLocation",
                teamMembers: {
                  $size: {
                    $filter: {
                      input: "$subTeam",
                      as: "nestedSubMember",
                      cond: {
                        $eq: ["$$nestedSubMember.parentId", "$$subMember._id"],
                      },
                    },
                  },
                },
                customersNumber: {
                  $size: {
                    $filter: {
                      input: "$customers",
                      as: "customer",
                      cond: {
                        $eq: ["$$customer.assignedTo", "$$subMember._id"],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          avatar: 1,
          firstName: 1,
          lastName: 1,
          role: {
            $cond: {
              if: { $eq: ["$role", "manager"] },
              then: "Manager",
              else: "Employee",
            },
          },
          officeLocation: 1,
          teamMembers: 1,
          customersNumber: 1,
          subTeam: 1,
        },
      },
    ];

    const teamMembers = await User.aggregate(teamPipeline);

    return res.status(200).json({ teamMembers });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "ERROR!",
      message: "An error occurred while fetching team members.",
    });
  }
});

module.exports = router;
