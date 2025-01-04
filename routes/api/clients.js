const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");

const Clients = require("../../models/Clients");
const Organization = require("../../models/Organization");

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
