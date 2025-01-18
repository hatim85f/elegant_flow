const express = require("express");
const router = express.Router();

const Clients = require("../../models/Clients");
const auth = require("../../middleware/auth");
const User = require("../../models/User");

const moment = require("moment");

// get the total number of clients as per the organization id

const getAllClients = async (req, res, userId) => {
  const user = await User.findOne({ _id: userId });
  const role = user.role;

  let findQuery = {};

  if (role === "admin" || role === "owner") {
    findQuery = {
      clientForOrganization: user.organization,
    };
  } else if (role === "manager") {
    const team = await User.find({ parentId: userId });
    const teamIds = team.map((t) => t._id);
    findQuery = {
      clientForOrganization: user.organization,
      assignedTo: { $in: teamIds },
    };
  } else {
    findQuery = {
      clientForOrganization: user.organization,
      assignedTo: userId,
    };
  }

  const clients = await Clients.aggregate([
    {
      $match: findQuery,
    },
    {
      $lookup: {
        from: "users",
        localField: "assignedTo",
        foreignField: "_id",
        as: "assignedTo",
      },
    },
    {
      $unwind: {
        path: "$assignedTo",
        preserveNullAndEmptyArrays: true, // Keep documents even if assignedTo is null or empty
      },
    },
    {
      $project: {
        clientCreatedAt: 1,
        clientName: 1,
        assignedTo: {
          $ifNull: [
            { $concat: ["$assignedTo.firstName", " ", "$assignedTo.lastName"] }, // If assignedTo exists
            `${user.firstName} ${user.lastName}`, // Fallback to the user
          ],
        },
        clientStatus: 1,
      },
    },
  ]);

  return clients.sort((a, b) => a.clientCreatedAt - b.clientCreatedAt);
};

const getClientsNumber = async (req, res, userId) => {
  const user = await User.findOne({ _id: userId });
  const role = user.role;

  let findQuery = {};

  if (role === "admin" || role === "owner") {
    findQuery = {
      clientForOrganization: user.organization,
    };
  } else if (role === "manager") {
    const team = await User.find({ parentId: userId });
    const teamIds = team.map((t) => t._id);
    findQuery = {
      clientForOrganization: user.organization,
      assignedTo: { $in: teamIds },
    };
  } else {
    findQuery = {
      clientForOrganization: user.organization,
      assignedTo: userId,
    };
  }

  const cleints = await Clients.find(findQuery);

  const totalClients = cleints.length;
  const activeClients = cleints.filter(
    (c) => c.clientStatus === "active"
  ).length;

  return {
    totalClients,
    activeClients,
  };
};

router.get("/:userId", auth, async (req, res) => {
  const { userId } = req.params;

  try {
    const clients = await getAllClients(req, res, userId);

    const latestClient = clients[clients.length - 1];
    const numberOfClients = await getClientsNumber(req, res, userId);
    const activeClientsNumber = numberOfClients.activeClients;
    const totalClientsNumber = numberOfClients.totalClients;

    return res.status(200).send({
      latestClient,
      activeClientsNumber,
      totalClientsNumber,
    });
  } catch (error) {
    return res.status(500).send({
      error: "ERROR!",
      message: "Internal Server Error, please try again later",
    });
  }
});

module.exports = router;
