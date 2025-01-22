const express = require("express");
const router = express.Router();
const Leads = require("../../models/Leads");
const auth = require("../../middleware/auth");
const User = require("../../models/User");
const { addShortClient } = require("../../helpers/addShortClient");
const sendNotification = require("../../helpers/sendNotifications");
const Notifications = require("../../models/Notifications");
const isCompanyAdmin = require("../../middleware/isCompanyAdmin");
const moment = require("moment");
const { default: mongoose } = require("mongoose");

// GET route to get all leads
router.get("/main/:userId", auth, async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findOne({ _id: userId });

    const matchCriteria = {};

    if (user.role === "owner") {
      matchCriteria.relatedOrganization = user.organization;
    } else if (user.role === "manager") {
      const managedUsers = await User.find({ parentId: userId }).select("_id");
      const managedUserIds = managedUsers.map((u) => u._id);

      matchCriteria.assignedTo = { $in: managedUserIds };
    } else if (user.role === "employee") {
      matchCriteria.assignedTo = userId;
    }

    const leadsData = await Leads.aggregate([
      {
        $match: matchCriteria,
      },
      {
        $lookup: {
          from: "users",
          localField: "assignedTo",
          foreignField: "_id",
          as: "assignedToDetails",
        },
      },
      {
        $unwind: {
          path: "$assignedToDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          assignedTo: {
            $cond: {
              if: { $not: ["$assignedToDetails"] },
              then: null,
              else: {
                $concat: [
                  "$assignedToDetails.firstName",
                  " ",
                  "$assignedToDetails.lastName",
                ],
              },
            },
          },
          assignedToAvatar: "$assignedToDetails.profile.avatar",
        },
      },

      // Step 2: Join with `organizations` collection for `relatedOrganization`
      {
        $lookup: {
          from: "organizations",
          localField: "relatedOrganization",
          foreignField: "_id",
          as: "organizationDetails",
        },
      },
      {
        $unwind: {
          path: "$organizationDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          relatedOrganization: "$organizationDetails.name",
          organizationLogo: "$organizationDetails.logo",
        },
      },
      {
        $lookup: {
          from: "branches",
          localField: "relatedBranch",
          foreignField: "_id",
          as: "branchDetails",
        },
      },
      {
        $unwind: {
          path: "$branchDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          branchName: "$branchDetails.branchName",
          branchManagerId: "$branchDetails.branchManager",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "branchDetails.branchManager",
          foreignField: "_id",
          as: "branchManagerDetails",
        },
      },
      {
        $unwind: {
          path: "$branchManagerDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          branchManager: {
            $cond: {
              if: { $not: ["$branchManagerDetails"] },
              then: null,
              else: {
                $concat: [
                  "$branchManagerDetails.firstName",
                  " ",
                  "$branchManagerDetails.lastName",
                ],
              },
            },
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "history.created_by",
          foreignField: "_id",
          as: "createdByDetails",
        },
      },
      {
        $unwind: {
          path: "$createdByDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          "history.created_by": {
            $cond: {
              if: { $not: ["$createdByDetails"] },
              then: null,
              else: {
                $concat: [
                  "$createdByDetails.firstName",
                  " ",
                  "$createdByDetails.lastName",
                ],
              },
            },
          },
        },
      },
      {
        $project: {
          assignedToDetails: 0,
          organizationDetails: 0,
          branchDetails: 0,
          branchManagerDetails: 0,
          createdByDetails: 0,
          __v: 0,
        },
      },
    ]);

    return res.status(200).send(leadsData);
  } catch (error) {
    return res.status(500).send({
      error: "ERROR !",
      message: error.message,
    });
  }
});

// POST route to create a new lead
router.post("/create/:userId", auth, async (req, res) => {
  const { userId } = req.params;

  try {
    const {
      name,
      type,
      email,
      phone,
      address,
      relatedOrganization,
      relatedBranch,
      source,
      assignedTo,
      approval,
      status,
      notes,
      scheduledFollowupDate,
    } = req.body;

    // Validate required fields
    if (!name || !type || !email || !phone || !address) {
      return res
        .status(400)
        .json({ message: "All required fields must be provided." });
    }

    const user = await User.findOne({ _id: userId });

    // Create a new lead
    const newLead = new Leads({
      name,
      type,
      email,
      phone,
      address,
      relatedOrganization: user.organization,
      relatedBranch: relatedBranch || null,
      source,
      assignedTo: assignedTo ? assignedTo : userId,
      approval,
      status,
      notes,
      history: {
        created_by: userId,
      },
      scheduledFollowupDate,
    });

    await newLead.save();

    const title = `A new lead has been created`;
    const body = `New lead data has been added for ${name}`;
    const message = `${user.firstName} ${user.lastName} has created a new lead for a new lead named ${name}, Lead type: ${type}, 
    Email: ${email}, Phone: ${phone}, Address: ${address}, Source: ${source}`;
    const data = { route: "leads" };
    const sound = "custom-sound.wav";
    const subject = "New Lead Created";
    const screen = "leads";

    if (user.role === "owner") {
      const assignedUser = await User.findOne({ _id: assignedTo });
      const manager = await User.findOne({ _id: assignedUser.parentId });

      const assignedUserTokens = assignedUser.pushTokens || []; // Default to empty array
      const managerTokens = manager?.pushTokens || []; // Default to empty array and handle missing manager

      const allTokens = [...assignedUserTokens, ...managerTokens];

      if (allTokens.length > 0) {
        for (const token of allTokens) {
          await sendNotification(
            token,
            title,
            body,
            data,
            "leads",
            screen,
            sound
          );
        }
      }

      const newNotification = new Notifications({
        title: subject,
        subject,
        message,
        type: "lead",
        from: userId,
        to: assignedTo,
        route: "leads",
        body,
        screen,
      });

      await newNotification.save();
    } else if (user.role === "manager") {
      const assignedUser = await User.findOne({ _id: assignedTo });
      const owner = await User.findOne({
        organization: user.organization,
        role: "owner",
      });

      const assignedUserTokens = assignedUser.pushTokens || []; // Default to empty array
      const ownerTokens = owner?.pushTokens || []; // Default to empty array and handle missing owner

      const allTokens = [...assignedUserTokens, ...ownerTokens];

      if (allTokens.length > 0) {
        for (const token of allTokens) {
          await sendNotification(
            token,
            title,
            body,
            data,
            "leads",
            screen,
            sound
          );
        }
      }

      const newNotification = new Notifications({
        title: subject,
        subject,
        message,
        type: "lead",
        from: userId,
        to: assignedTo,
        route: "leads",
        body,
        screen,
      });

      await newNotification.save();

      const ownerNotification = new Notifications({
        title: subject,
        subject,
        message,
        type: "lead",
        from: userId,
        to: owner?._id || null, // Handle missing owner
        route: "leads",
        body,
        screen,
      });

      await ownerNotification.save();
    } else {
      const owner = await User.findOne({ organization: user.organization });
      const manager = await User.findOne({ _id: user.parentId });

      const ownerTokens = owner?.pushTokens || []; // Default to empty array
      const managerTokens = manager?.pushTokens || []; // Default to empty array

      const allTokens = [...ownerTokens, ...managerTokens];

      if (allTokens.length > 0) {
        for (const token of allTokens) {
          await sendNotification(
            token,
            title,
            body,
            data,
            "leads",
            screen,
            sound
          );
        }
      }

      const newNotification = new Notifications({
        title: subject,
        subject,
        message,
        type: "lead",
        from: userId,
        to: assignedTo,
        route: "leads",
        body,
        screen,
      });

      await newNotification.save();

      const ownerNotification = new Notifications({
        title: subject,
        subject,
        message,
        type: "lead",
        from: userId,
        to: owner?._id || null, // Handle missing owner
        route: "leads",
        body,
        screen,
      });

      await ownerNotification.save();
    }

    res.status(201).json({
      message: "Lead created successfully.",
      lead: newLead, // Correctly reference the created lead
    });
  } catch (error) {
    console.error("Error creating lead:", error);
    res.status(500).json({
      message: "An error occurred while creating the lead.",
      error: error.message,
    });
  }
});

router.put("/edit-status/:leadId", auth, async (req, res) => {
  const { leadId } = req.params;
  const { newStatus, reason, userId } = req.body;

  try {
    const lead = await Leads.findOne({ _id: leadId });

    const user = await User.findOne({ _id: userId });

    let returnMessage = "";

    const assignedToUser = await User.findOne({ _id: lead.assignedTo });
    const assignedToManager = await User.findOne({
      _id: assignedToUser.parentId,
    });
    const owner = await User.findOne({
      organization: lead.relatedOrganization,
      role: "owner",
    });

    const assignedUserTokens = assignedToUser.pushTokens || [];
    const assignedManagerTokens = assignedToManager.pushTokens || [];
    const ownerTokens = owner.pushTokens || [];

    const allTokens = [
      ...assignedUserTokens,
      ...assignedManagerTokens,
      ...ownerTokens,
    ];

    if (newStatus === "active") {
      await Leads.updateOne(
        { _id: leadId },
        {
          $set: {
            status: newStatus,
            "history.updatedAt": new Date(),
            "history.updated_by": userId,
          },
        }
      );

      const title = `Lead status updated to active`;
      const message = `Lead status has been updated to active for ${lead.name}`;
      const data = { route: "leads" };
      const sound = "custom-sound.wav";
      const subject = "Lead Status Updated";
      const screen = "leads";
      const body = `Lead status has been updated to active for ${
        lead.name
      }, change has been done by ${user.firstName} ${
        user.lastName
      }, active status reason: ${reason}, date: ${moment().format(
        "YYYY-MM-DD"
      )}`;

      for (let token of allTokens) {
        await sendNotification(
          token,
          title,
          body,
          data,
          "leads",
          screen,
          sound
        );
      }

      const newNotification = new Notifications({
        title: subject,
        subject,
        message,
        type: "lead",
        from: userId,
        to: assignedToManager._id,
        route: "leads",
        body,
        screen,
      });

      await newNotification.save();

      returnMessage = "Lead status updated to active.";
    }

    if (newStatus === "inactive") {
      if (user.role === "employee") {
        //send notificiation to owner and manager to request change

        const title = `Lead status change request`;
        const message = `Lead status change request for ${lead.name}`;
        const data = { route: "leads" };
        const sound = "custom-sound.wav";
        const subject = "Lead Status Change Request";
        const screen = "leads";
        const body = `Lead status change request for ${lead.name}, change has been requested by ${user.firstName} ${user.lastName}`;

        for (const token of assignedManagerTokens) {
          await sendNotification(
            token,
            title,
            body,
            data,
            "leads",
            screen,
            sound
          );
        }

        returnMessage = "Lead status change request sent to manager.";

        const newNotification = new Notifications({
          title: subject,
          subject,
          message,
          type: "lead",
          from: userId,
          to: lead.assignedTo,
          route: "leads",
          body,
          screen,
        });

        await newNotification.save();
      } else {
        await Leads.updateOne(
          { _id: leadId },
          {
            $set: {
              status: newStatus,
              "history.updatedAt": new Date(),
              "history.updated_by": userId,
            },
          }
        );

        returnMessage = "Lead status updated to inactive.";

        const title = `Lead status updated to inactive`;
        const message = `Lead status has been updated to inactive for ${lead.name}`;
        const data = { route: "leads" };
        const sound = "custom-sound.wav";
        const subject = "Lead Status Updated";
        const screen = "leads";
        const body = `Lead status has been updated to inactive for ${
          lead.name
        }, change has been done by ${user.firstName} ${
          user.lastName
        }, inactive status reason: ${reason}, date: ${moment().format(
          "YYYY-MM-DD"
        )}`;

        for (const token of allTokens) {
          await sendNotification(
            token,
            title,
            body,
            data,
            "leads",
            screen,
            sound
          );
        }

        const newNotification = new Notifications({
          title: subject,
          subject,
          message,
          type: "lead",
          from: userId,
          to: lead.assignedTo,
          route: "leads",
          body,
          screen,
        });
        await newNotification.save();
        const ownerNotification = new Notifications({
          title: subject,
          subject,
          message,
          type: "lead",
          from: userId,
          to: owner._id,
          route: "leads",
          body,
          screen,
        });

        await ownerNotification.save();
      }
    }

    return res.status(200).json({ message: returnMessage });
  } catch (error) {
    console.error("Error updating lead status:", error);
    return res.status(500).json({
      error: "ERROR!",
      message: error.message,
    });
  }
});

router.delete("/delete/:leadId", auth, isCompanyAdmin, async (req, res) => {
  const { leadId } = req.params;

  try {
    const lead = await Leads.deleteOne({ _id: leadId });

    if (!lead) {
      return res.status(404).json({
        message: "Lead not found.",
      });
    }

    res.status(200).json({
      message: "Lead deleted successfully.",
      lead,
    });
  } catch (error) {
    console.error("Error deleting lead:", error);
    res.status(500).json({
      error: "ERROR!",
      message: "An error occurred while deleting the lead.",
    });
  }
});

module.exports = router;
