const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");

const Clients = require("../../models/Clients");
const Organization = require("../../models/Organization");
const User = require("../../models/User");
const { default: mongoose } = require("mongoose");

// @route   GET api/clients
// @desc    Get all clients under the same organization as the user
// @access  Private
router.get("/all/:userId", auth, async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findOne({ _id: userId });
    const userRole = user.role;

    let matchCriteria = {};

    // Define match criteria based on the user's role
    if (userRole === "owner") {
      matchCriteria.clientForOrganization = user.organization;
    } else if (userRole === "manager") {
      const userTeamIds = await User.find({ parentId: userId }).select("_id");
      const teamMemberIds = userTeamIds.map((memberIds) => memberIds._id);
      matchCriteria.assignedTo = { $in: teamMemberIds };
    } else {
      matchCriteria.assignedTo = new mongoose.Types.ObjectId(userId);
    }

    // Aggregate clients based on the match criteria
    const clients = await Clients.aggregate([
      {
        $match: matchCriteria,
      },
      {
        $lookup: {
          from: "users", // The collection name where users are stored
          localField: "assignedTo",
          foreignField: "_id",
          as: "assignedToUser",
        },
      },
      {
        $unwind: {
          path: "$assignedToUser",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "clientCreatedBy",
          foreignField: "_id",
          as: "clientCreatedByUser",
        },
      },
      {
        $unwind: {
          path: "$clientCreatedByUser",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          handledBy: {
            $concat: [
              "$assignedToUser.firstName",
              " ",
              "$assignedToUser.lastName",
            ],
          },
          handledByAvatar: "$assignedToUser.profile.avatar",
        },
      },
      {
        $facet: {
          activeClients: [
            { $match: { clientStatus: "active" } },
            {
              $project: {
                clientName: 1,
                clientEmail: 1,
                clientPhone: 1,
                clientStatus: 1,
                assignedTo: 1,
                clientForOrganization: 1,
                clientCreatedBy: {
                  $concat: [
                    "$clientCreatedByUser.firstName",
                    " ",
                    "$clientCreatedByUser.lastName",
                  ],
                },
                clientUpdatedBy: 1,
                clientCreatedAt: 1,
                clientUpdatedAt: 1,
                handledBy: 1,
                handledByAvatar: 1,
              },
            },
          ],
          inactiveClients: [
            { $match: { clientStatus: "inactive" } },
            {
              $project: {
                clientName: 1,
                clientEmail: 1,
                clientPhone: 1,
                clientStatus: 1,
                assignedTo: 1, // Add assignedTo (ID)
                clientForOrganization: 1,
                clientCreatedBy: {
                  $concat: [
                    "$clientCreatedByUser.firstName",
                    " ",
                    "$clientCreatedByUser.lastName",
                  ],
                },
                clientUpdatedBy: 1,
                clientCreatedAt: 1,
                clientUpdatedAt: 1,
                handledBy: 1,
                handledByAvatar: 1,
              },
            },
          ],
        },
      },
    ]);

    return res.status(200).json({
      activeClients: clients[0]?.activeClients || [],
      inactiveClients: clients[0]?.inactiveClients || [],
    });
  } catch (error) {
    return res.status(500).send({
      error: "ERROR!",
      message: "Server Error, Please try again" + error.message,
    });
  }
});

// @route   POST api/clients
// @desc    Create a client with the owner for fast distribution
// @access  Private
router.post("/add_short_client/:userId", auth, async (req, res) => {
  const { clientName, clientEmail, clientPhone } = req.body;
  const { userId } = req.params;

  try {
    const organization = await Organization.findOne({
      created_by: userId,
    });

    const userData = await User.findOne({ _id: userId });

    const organizationUsers = await User.find({
      organization: userData.organization,
      role: "employee",
    });

    const isClient = await Clients.findOne({
      clientEmail: clientEmail,
      clientForOrganization: organization._id,
      clientName: clientName,
      clientPhone: clientPhone,
    });

    if (isClient) {
      return res.status(400).json({
        message: "Client already exists",
      });
    }

    let newClient;

    if (organizationUsers.length > 0) {
      // Find the employee with the least number of clients
      const userClientCounts = await Promise.all(
        organizationUsers.map(async (user) => {
          const clientCount = await Clients.countDocuments({
            assignedTo: user._id,
          });
          return { userId: user._id, clientCount };
        })
      );

      // Find the user with the least number of clients
      const leastAssignedUser = userClientCounts.reduce((prev, current) =>
        prev.clientCount < current.clientCount ? prev : current
      );

      const assignedTo = leastAssignedUser.userId;

      newClient = new Clients({
        clientName: clientName,
        clientEmail: clientEmail,
        clientPhone: clientPhone,
        assignedTo: assignedTo,
        clientForOrganization: organization._id,
        clientCreatedBy: userId,
        clientUpdatedBy: userId,
      });
    } else {
      newClient = new Clients({
        clientName: clientName,
        clientEmail: clientEmail,
        clientPhone: clientPhone,
        clientForOrganization: organization._id,
        clientCreatedBy: userId,
        clientUpdatedBy: userId,
      });
    }

    await Clients.insertMany([newClient]);

    res.json({
      message: "Client created successfully",
      client: newClient,
    });
  } catch (err) {
    res.status(500).send({
      error: "ERROR!",
      message: err.message,
    });
  }
});

router.delete("/edit", async (req, res) => {
  try {
    const clients = await Clients.deleteMany({}, { clientStatus: "inactive" });

    return res.status(200).send({
      clients,
      message: "All clients are inactive now",
    });
  } catch (error) {
    return res.status(500).send({
      error: "ERROR!",
      message: error.message,
    });
  }
});

module.exports = router;
