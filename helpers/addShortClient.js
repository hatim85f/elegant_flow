const Organization = require("../models/Organization");
const User = require("../models/User");
const Clients = require("../models/Clients");
const Notifications = require("../models/Notifications");

const sendNotification = require("./sendNotifications");

const addShortClient = async ({
  clientName,
  clientEmail,
  clientPhone,
  branch,
  userId,
}) => {
  try {
    const organization = await Organization.findOne({
      created_by: userId,
    });

    if (!organization) {
      throw new Error("Organization not found");
    }

    const userData = await User.findOne({ _id: userId });

    const organizationUsers = await User.find({
      organization: userData.organization,
      role: "employee",
      branch: branch,
    });

    const isClient = await Clients.findOne({
      clientEmail: clientEmail,
      clientForOrganization: organization._id,
      clientName: clientName,
      clientPhone: clientPhone,
    });

    if (isClient) {
      throw new Error("Client already exists");
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
        clientForBranch: branch,
      });
    } else {
      newClient = new Clients({
        clientName: clientName,
        clientEmail: clientEmail,
        clientPhone: clientPhone,
        clientForOrganization: organization._id,
        clientCreatedBy: userId,
        clientUpdatedBy: userId,
        clientForBranch: branch,
      });
    }

    const assigningUser = await User.findOne({ _id: userId });
    const assignedName = assigningUser.firstName + " " + assigningUser.lastName;

    const assignedUser = await User.findOne({ _id: newClient.assignedTo });

    const assignedTokens = assignedUser ? assignedUser.pushTokens : [];

    if (assignedTokens.length > 0) {
      const title = `New Client Assigned by ${assignedName}`;
      const body = `You have been assigned a new client: ${clientName}`;
      const data = { route: "clients", id: newClient._id };
      const sound = "custom-sound.wav";
      const subject = "New Client Assigned";
      const screen = "clients";

      for (const token of assignedTokens) {
        await sendNotification(
          token,
          title,
          body,
          data,
          "clients",
          screen,
          sound
        );
      }

      const newNotification = new Notifications({
        title,
        subject,
        body: body,
        type: "client",
        from: userId,
        to: newClient.assignedTo,
        route: "clients",
        screen: screen,
      });

      await Notifications.insertMany(newNotification);
    }

    await newClient.save();

    return newClient;
  } catch (err) {
    throw new Error(err.message);
  }
};

module.exports = { addShortClient };
