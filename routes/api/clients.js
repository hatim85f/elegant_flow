const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");

const Clients = require("../../models/Clients");
const Organization = require("../../models/Organization");
const User = require("../../models/User");
const { default: mongoose } = require("mongoose");
const Projects = require("../../models/Projects");

const Notifications = require("../../models/Notifications");

const sendNotification = require("../../helpers/sendNotifications");
const isCompanyAdmin = require("../../middleware/isCompanyAdmin");

const route = "menu";

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
                clientFeedback: 1,
                branch: 1,
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
                bracnh: 1,
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

// get full client details
// @ route GET api/clients/:userId/:clientId
// @ desc get full client details
// @ access private
router.get("/:clientId", auth, async (req, res) => {
  const { clientId } = req.params;

  try {
    const client = await Clients.aggregate([
      {
        $match: { _id: new mongoose.Types.ObjectId(clientId) },
      },
      {
        $lookup: {
          from: "projects",
          localField: "clientProjects", // Use the array of project IDs
          foreignField: "_id", // Match with _id in the projects collection
          as: "clientProjectsDetails", // Fetch project details
        },
      },
      {
        $addFields: {
          latestProjectDetails: {
            $arrayElemAt: [
              {
                $map: {
                  input: {
                    $sortArray: {
                      input: "$clientProjectsDetails", // Sort the projects
                      sortBy: { projectCreatedAt: -1 }, // Sort by createdAt descending
                    },
                  },
                  as: "project",
                  in: {
                    projectId: "$$project._id",
                    projectName: "$$project.projectName",
                    projectBudget: "$$project.projectBudget",
                    projectDeadline: "$$project.projectDeadline",
                    projectDescription: "$$project.projectDescription",
                    projectCreatedAt: "$$project.projectCreatedAt",
                  },
                },
              },
              0, // Return the first element (latest project)
            ],
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "assignedTo",
          foreignField: "_id",
          as: "handledByUser",
        },
      },
      {
        $unwind: {
          path: "$handledByUser",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          handledBy: {
            $concat: [
              "$handledByUser.firstName",
              " ",
              "$handledByUser.lastName",
            ],
          },
          handledByAvatar: "$handledByUser.profile.avatar",
        },
      },
      {
        $project: {
          _id: 1,
          clientName: 1,
          clientType: 1,
          clientEmail: 1,
          clientPhone: 1,
          clientAddress: 1,
          clientForOrganization: 1,
          assignedTo: 1,
          clientProjects: 1, // Original project IDs
          latestProjectDetails: 1, // The latest project details
          clientIndustry: 1,
          clientNotes: 1,
          clientFeedback: 1,
          preferredContactMethod: 1,
          clientStatus: 1,
          clientCreatedBy: 1,
          clientCreatedAt: 1,
          clientUpdatedAt: 1,
          handledBy: 1,
          handledByAvatar: 1,
          branch: 1,
        },
      },
    ]);

    return res.status(200).json(client[0]); // Return the single client object
  } catch (error) {
    return res.status(500).send({
      error: "ERROR!",
      message: "Server Error, Please try again. " + error.message,
    });
  }
});

// @route   POST api/clients
// @desc    Create a client with the owner for fast distribution
// @access  Private
router.post(
  "/add_short_client/:userId",
  auth,
  isCompanyAdmin,
  async (req, res) => {
    const { clientName, clientEmail, clientPhone, branch } = req.body;
    const { userId } = req.params;

    try {
      const organization = await Organization.findOne({
        created_by: userId,
      });

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
      const assignedName =
        assigningUser.firstName + " " + assigningUser.lastName;

      const assignedUser = await User.findOne({ _id: newClient.assignedTo });

      const assignedTokens = assignedUser ? assignedUser.pushTokens : [];

      if (assignedTokens.length > 0) {
        const title = `New Client Assigned by ${assignedName}`;
        const body = `You have been assigned a new client: ${clientName}`;
        const data = { route: route, id: newClient._id };
        const sound = "custom-sound.wav";
        const subject = "New Client Assigned";
        const screen = "clients";

        for (const token of assignedTokens) {
          await sendNotification(
            token,
            title,
            body,
            data,
            route,
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
          route: route,
          screen: screen,
        });

        await Notifications.insertMany(newNotification);
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
  }
);

router.post("/full_client/:userId", auth, async (req, res) => {
  const {
    clientName,
    clientType,
    clientEmail,
    clientPhone,
    clientAddress,
    clientIndustry,
    clientNotes,
    assignedTo,
    preferredContactMethod,
    projectName,
    projectDescription,
    projectBudget,
    projectDeadline,
    branch,
  } = req.body;

  const { userId } = req.params;

  try {
    // Fetch user and their organization
    const user = await User.findOne({ _id: userId });

    const organization = user.organization;

    // Fetch organization users based on user's role
    let staff;
    if (user.role === "owner") {
      staff = await User.find({ organization, role: "employee" });
    } else if (user.role === "manager") {
      staff = await User.find({ parentId: userId });
    } else {
      staff = user;
    }

    // Validate `assignedTo` user if provided
    if (assignedTo && !staff.some((s) => s._id.toString() === assignedTo)) {
      return res.status(400).json({
        message: "Projects and Clinets must be assigned to one of sales team",
      });
    }

    // Check for existing client
    const isClient = await Clients.findOne({
      clientEmail,
      clientForOrganization: organization._id,
    });
    if (isClient) {
      return res.status(400).json({ message: "Client already exists" });
    }

    // Determine staff with the least assigned clients if `assignedTo` is not provided
    let clientAssignedTo = assignedTo || null;
    if (!clientAssignedTo && staff.length > 0) {
      const userClientCounts = await Promise.all(
        staff.map(async (user) => {
          const clientCount = await Clients.countDocuments({
            assignedTo: user._id,
          });
          return { userId: user._id, clientCount };
        })
      );

      const leastAssignedUser = userClientCounts.reduce((prev, current) =>
        prev.clientCount < current.clientCount ? prev : current
      );

      clientAssignedTo = leastAssignedUser.userId;
    }

    // Create client
    const newClient = new Clients({
      clientName,
      clientType,
      clientEmail,
      clientPhone,
      clientAddress,
      clientForOrganization: organization._id,
      assignedTo: clientAssignedTo,
      clientIndustry,
      clientNotes,
      preferredContactMethod,
      clientStatus: "active",
      clientCreatedBy: userId,
      clientForBranch: branch,
    });

    await newClient.save();

    // Validate and handle project details
    if (projectName) {
      let parsedDeadline = null;
      if (projectDeadline) {
        parsedDeadline = new Date(projectDeadline);
        if (isNaN(parsedDeadline.getTime())) {
          return res
            .status(400)
            .json({ message: "Invalid project deadline date format" });
        }
      }

      const newProject = new Projects({
        projectName,
        projectDescription,
        projectClient: newClient._id,
        projectForOrganization: organization._id,
        projectDeadline: parsedDeadline,
        projectBudget,
        projectAssignedTo: clientAssignedTo,
        projectCreatedBy: userId,
      });

      await newProject.save();

      await Clients.updateOne(
        { _id: newClient._id },
        { $push: { clientProjects: newProject._id } }
      );
    }

    // Send notification to assigned user if he is not the one creating the client, and if client is updated by the assigned user, and for both if the client is created by client himself
    const assigning = await User.findOne({ _id: userId });
    const assigningTokens = assigning.pushTokens;

    const assigned = await User.findOne({ _id: newClient.assignedTo });
    const assignedTokens = assigned.pushTokens;

    const fullTokens = [...assignedTokens, ...assigningTokens];

    let assinedPerson = await User.findOne({ _id: newClient.assignedTo });
    let manager = await User.findOne({ _id: assinedPerson.parentId });

    if (fullTokens.length > 0) {
      const title = projectName
        ? `Client ${clientName} has been created with a project ${projectName}`
        : `Client ${clientName} has been created`;
      const body = `New client ${clientName} has been created`;
      const data = { route: route, id: newClient._id, screen: "clients" };
      const sound = "custom-sound.wav";
      const subject = "New Client Created";
      const screen = "clients";

      for (const token of fullTokens) {
        await sendNotification(token, title, body, data, route, screen, sound);
      }

      const newNotification = new Notifications({
        title,
        subject,
        body: body,
        type: "client",
        from: userId === newClient.assignedTo ? userId : manager._id,
        to: userId === newClient.assignedTo ? manager._id : userId,
        route: route,
        screen: screen,
      });

      await Notifications.insertMany(newNotification);
    }

    return res.status(200).json({
      message: "Client created successfully",
      client: newClient,
    });
  } catch (error) {
    return res.status(500).send({
      error: "ERROR!",
      message: error.message,
    });
  }
});

router.put("/full_client/:userId/:clientId", auth, async (req, res) => {
  const {
    clientName,
    clientType,
    clientEmail,
    clientPhone,
    clientAddress,
    clientIndustry,
    clientNotes,
    assignedTo,
    preferredContactMethod,
    projectName,
    projectDescription,
    projectBudget,
    projectDeadline,
    branch,
  } = req.body;

  const { userId, clientId } = req.params;

  try {
    // Fetch user and their organization
    const user = await User.findOne({ _id: userId });
    const organization = user.organization;

    // Fetch organization users based on user's role
    let staff;
    if (user.role === "owner") {
      staff = await User.find({ organization, role: "employee" });
    } else if (user.role === "manager") {
      staff = await User.find({ parentId: userId });
    } else {
      staff = user; // Use user directly
    }

    // Validate `assignedTo` user if provided
    if (assignedTo && !staff.some((s) => s._id.toString() === assignedTo)) {
      return res.status(400).json({
        message: "Clients must be assigned to one of the sales team",
      });
    }

    // Fetch the existing client
    const existingClient = await Clients.findOne({
      _id: clientId,
      clientForOrganization: organization._id,
    });

    if (!existingClient) {
      return res.status(404).json({ message: "Client not found" });
    }

    // Update client details
    existingClient.clientName = clientName || existingClient.clientName;
    existingClient.clientType = clientType || existingClient.clientType;
    existingClient.clientEmail = clientEmail || existingClient.clientEmail;
    existingClient.clientPhone = clientPhone || existingClient.clientPhone;
    existingClient.clientAddress =
      clientAddress || existingClient.clientAddress;
    existingClient.clientIndustry =
      clientIndustry || existingClient.clientIndustry;
    existingClient.clientNotes = clientNotes || existingClient.clientNotes;
    existingClient.preferredContactMethod =
      preferredContactMethod || existingClient.preferredContactMethod;
    existingClient.clientStatus = "active";
    existingClient.bracnh = branch;

    // Assign to staff with least clients if no `assignedTo` is provided
    let clientAssignedTo = assignedTo || existingClient.assignedTo;
    if (!assignedTo && staff.length > 0) {
      const userClientCounts = await Promise.all(
        staff.map(async (user) => {
          const clientCount = await Clients.countDocuments({
            assignedTo: user._id,
          });
          return { userId: user._id, clientCount };
        })
      );

      const leastAssignedUser = userClientCounts.reduce((prev, current) =>
        prev.clientCount < current.clientCount ? prev : current
      );

      clientAssignedTo = leastAssignedUser.userId;
    }

    existingClient.assignedTo = clientAssignedTo;

    // Save updated client details
    await existingClient.save();

    // Handle project creation
    if (projectName) {
      let parsedDeadline = null;
      if (projectDeadline) {
        parsedDeadline = new Date(projectDeadline);
        if (isNaN(parsedDeadline.getTime())) {
          return res
            .status(400)
            .json({ message: "Invalid project deadline date format" });
        }
      }

      const newProject = new Projects({
        projectName,
        projectDescription,
        projectClient: clientId,
        projectForOrganization: organization._id,
        projectDeadline: parsedDeadline,
        projectBudget,
        projectAssignedTo: clientAssignedTo,
        projectCreatedBy: userId,
      });

      await newProject.save();

      // Send notification to assigned user if he is not the one creating the client, and if client is updated by the assigned user, and for both if the client is created by client himself
      const assigning = await User.findOne({ _id: userId });
      const assigningTokens = assigning.pushTokens;

      const assigned = await User.findOne({ _id: newClient.assignedTo });
      const assignedTokens = assigned.pushTokens;

      const fullTokens = [...assignedTokens, ...assigningTokens];

      let assinedPerson = await User.findOne({ _id: newClient.assignedTo });
      let manager = await User.findOne({ _id: assinedPerson.parentId });

      if (fullTokens.length > 0) {
        const title = projectName
          ? `Client ${clientName} has been created with a project ${projectName}`
          : `Client ${clientName} has been created`;
        const body = `New client ${clientName} has been created`;
        const data = { route: route, id: newClient._id, screen: "clients" };
        const sound = "custom-sound.wav";
        const subject = "New Client Created";
        const screen = "clients";

        for (const token of fullTokens) {
          await sendNotification(
            token,
            title,
            body,
            data,
            route,
            screen,
            sound
          );
        }

        const newNotification = new Notifications({
          title,
          subject,
          body: body,
          type: "client",
          from: userId === newClient.assignedTo ? userId : manager._id,
          to: userId === newClient.assignedTo ? manager._id : userId,
          route: route,
          screen: screen,
        });

        await Notifications.insertMany(newNotification);
      }
      // Link the project to the client
      await Clients.updateOne(
        { _id: clientId },
        { $push: { clientProjects: newProject._id } }
      );
    }

    return res.status(200).json({
      message: "Client updated successfully",
      client: existingClient,
    });
  } catch (error) {
    return res.status(500).send({
      error: "ERROR!",
      message: error.message,
    });
  }
});

// push feedback to the client details
// @ route PUT api/clients/feedback/:userId/:clientId
router.put("/update_feedback/:userId/:clientId", auth, async (req, res) => {
  const { userId, clientId } = req.params;

  const { feedback } = req.body;

  try {
    const user = await User.findOne({ _id: userId });

    const client = await Clients.findOne({ _id: clientId });

    const newFeedback = {
      feedback,
      feedbackBy: user.firstName + " " + user.lastName,
      feedbackByAvatar: user.profile.avatar,
      feedbackAt: new Date(),
      feedbackSeen: false,
      feedbackUserId: userId,
    };

    await Clients.updateOne(
      { _id: clientId },
      { $push: { clientFeedback: newFeedback } }
    );

    // send a notification for assigned person if he is not the one giving feedback, and to managers if the feedback is from the assigned person

    const assigned = await User.findOne({ _id: client.assignedTo });
    const assignedTokens = assigned.pushTokens;

    const manager = await User.findOne({ _id: user.parentId });
    const managerTokens = manager.pushTokens;

    const allTokens = new Set([...assignedTokens, ...managerTokens]);

    const feedbackFrom = await User.findOne({ _id: userId });
    const feedbackerName = feedbackFrom.firstName + " " + feedbackFrom.lastName;

    if (allTokens.length > 0) {
      const title = `New Feedback from ${feedbackerName}`;
      const body = `New feedback from ${feedbackerName}`;
      const data = { route: route, id: clientId };
      const sound = "custom-sound.wav";
      const subject = "New Feedback";
      const screen = "clients";

      for (const token of allTokens) {
        await sendNotification(token, title, body, data, route, screen, sound);
      }

      const newNotification = new Notifications({
        title,
        subject,
        body: body,
        type: "client",
        from: userId === client.assignedTo ? client.assignedTo : userId,
        to: userId === client.assignedTo ? userId : client.assignedTo,
        route: route,
        screen: screen,
      });

      await Notifications.insertMany(newNotification);
    }

    return res.status(200).json({
      message: "Feedback added successfully",
      client: client,
    });
  } catch (error) {
    return res.status(500).send({
      error: "ERROR!",
      message:
        "Something went wrong while trying to add your comment, please try again" +
        error.message,
    });
  }
});

//route to update seen property of feedback array
// @ route PUT api/clients/feedback/:userId/:clientId
router.put(
  "/update_feedback_seen/:userId/:clientId",
  auth,
  async (req, res) => {
    const { userId, clientId } = req.params;

    try {
      const client = await Clients.findOne({ _id: clientId });

      const clientFeedback = client.clientFeedback;

      let newFeedback = [];

      for (let item in clientFeedback) {
        newFeedback.push({
          feedback: clientFeedback[item].feedback,
          feedbackBy: clientFeedback[item].feedbackBy,
          feedbackByAvatar: clientFeedback[item].feedbackByAvatar,
          feedbackAt: clientFeedback[item].feedbackAt,
          feedbackSeen:
            clientFeedback[item].feedbackUserId !== userId ? true : false,
          feedbackUserId: clientFeedback[item].feedbackUserId,
        });
      }

      await Clients.updateMany(
        { _id: clientId },
        {
          $set: {
            clientFeedback: newFeedback,
          },
        }
      );

      return res.status(200).json({
        message: "Feedback seen updated successfully",
        client: newFeedback,
      });
    } catch (error) {
      return res.status(500).send({
        error: "ERROR!",
        message:
          "Something went wrong while trying to update your comment, please try again" +
          error.message,
      });
    }
  }
);

// @route   DELETE api/clients/:userId/:clientId
// @desc    Delete a client feedback by index

router.delete("/feedback/:userId/:clientId", auth, async (req, res) => {
  const { userId, clientId } = req.params;
  const { feedbackIndex } = req.body;

  try {
    const client = await Clients.findOne({ _id: clientId });

    const neededFeedback = client.clientFeedback[feedbackIndex];

    if (neededFeedback.feedbackUserId !== userId) {
      return res.status(403).json({
        message: "You are not allowed to delete this feedback",
      });
    }

    // Delete feedback by index
    client.clientFeedback.splice(feedbackIndex, 1);

    await client.save();

    return res.status(200).json({
      message: "Feedback deleted successfully",
      client: client,
    });
  } catch (error) {
    return res.status(500).send({
      error: "ERROR!",
      message:
        "Something went wrong while trying to delete your comment, please try again" +
        error.message,
    });
  }
});

// @route  DELETE api/clients/:userId/:clientId
// @desc   Delete a client
// @access Private
router.delete("/:userId/:clientId", auth, async (req, res) => {
  const { userId, clientId } = req.params;

  try {
    const client = await Clients.findOne({ _id: clientId });

    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    const user = await User.findOne({ _id: userId });

    if (client.clientCreatedBy.toString() !== userId || user.role !== "owner") {
      return res
        .status(403)
        .json({ message: "You are not allowed to delete this client" });
    }

    await client.remove();

    // send a notification for assigned and organization owner and manager
    const assigned = await User.findOne({ _id: client.assignedTo });
    const assignedTokens = assigned.pushTokens;

    const manager = await User.findOne({ _id: user.parentId });
    const managerTokens = manager.pushTokens;

    const owner = await User.find({ _id: user.organization, role: "owner" });
    const ownerTokens = owner.map((owner) => owner.pushTokens);

    const allTokens = new Set([
      ...assignedTokens,
      ...managerTokens,
      ...ownerTokens,
    ]);

    const allIds = new Set([assigned._id, manager._id, owner._id]);

    if (allTokens.length > 0) {
      const title = `Client ${client.clientName} has been deleted`;
      const body = `Client ${client.clientName} has been deleted`;
      const data = { route: route, id: clientId };
      const sound = "custom-sound.wav";
      const subject = "Client Deleted";
      const screen = "clients";

      for (const token of allTokens) {
        await sendNotification(token, title, body, data, route, screen, sound);
      }

      allIds.forEach(async (id) => {
        const newNotification = new Notifications({
          title,
          subject,
          body: body,
          type: "client",
          from: userId,
          to: id,
          route: route,
          screen: screen,
        });

        await Notifications.insertMany(newNotification);
      });
    }

    return res.status(200).json({ message: "Client deleted successfully" });
  } catch (error) {
    return res.status(500).send({
      error: "ERROR!",
      message:
        "Something went wrong while trying to delete the client, please try again" +
        error.message,
    });
  }
});

module.exports = router;
