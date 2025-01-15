const express = require("express");
const router = express.Router();
const Leads = require("../../models/Leads");
const auth = require("../../middleware/auth");
const User = require("../../models/User");
const { addShortClient } = require("../../helpers/addShortClient");
const sendNotification = require("../../helpers/sendNotifications");
const Notifications = require("../../models/Notifications");
const isCompanyAdmin = require("../../middleware/isCompanyAdmin");

// GET route to get all leads
router.get("/:userId", auth, async (req, res) => {
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
    } = req.body;

    // Validate required fields
    if (
      !name ||
      !type ||
      !email ||
      !phone ||
      !address ||
      !relatedBranch ||
      !source ||
      !assignedTo
    ) {
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
      relatedBranch,
      source,
      assignedTo: assignedTo ? assignedTo : userId,
      approval,
      status,
      notes,
      history: {
        created_by: userId,
      },
    });

    const savedLead = await newLead.save();

    res.status(201).json({
      message: "Lead created successfully.",
      lead: savedLead,
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
    const user = await User.findOne({ _id: userId });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (!newStatus) {
      return res.status(400).json({ message: "New status is required." });
    }

    const lead = await Leads.findOne({ _id: leadId });
    if (!lead) {
      return res.status(404).json({ message: "Lead not found." });
    }

    // Handle "inactive" status changes requiring approval
    if (newStatus === "inactive") {
      if (user.role !== "manager" && user.role !== "owner") {
        // Find the manager (parentId) of the assignedTo user
        const assignedUser = await User.findOne({ _id: lead.assignedTo });
        const managerId = assignedUser.parentId;

        // Send notification to manager
        const manager = await User.findOne({ _id: managerId });
        const managerTokens = manager.pushTokens || [];

        managerTokens.forEach((token) => {
          sendNotification({
            token,
            title: "Lead status change request",
            body: `${user.firstName} ${user.lastName} is requesting to change lead status to 'inactive'`,
            data: { type: "lead", id: leadId },
          });
        });

        const newNotification = new Notifications({
          title: "Lead status change request",
          subject: "Lead status change request",
          body: `${user.firstName} ${user.lastName} is requesting to change lead status to 'inactive'`,
          type: "lead",
          from: userId,
          to: managerId,
          route: "leads",
          screen: "leads",
        });

        await newNotification.save();

        return res.status(200).json({
          message: "Approval request sent to manager.",
        });
      }
    }

    // Update lead status and history for managers/owners or "active" status
    lead.status = newStatus;
    lead.history.updatedAt = new Date();
    lead.history.updated_by = userId;
    lead.history.reason = reason || "No reason provided";

    if (newStatus === "active") {
      await addShortClient({
        clientName: lead.name,
        clientEmail: lead.email,
        clientPhone: lead.phone,
        branch: lead.relatedBranch,
        userId,
      });
    }

    const updatedLead = await lead.save();

    res.status(200).json({
      message: "Lead status updated successfully.",
      lead: updatedLead,
    });
  } catch (error) {
    console.error("Error updating lead status:", error);
    return res.status(500).json({
      error: "ERROR!",
      message: "An error occurred while updating the lead status.",
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
