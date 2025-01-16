const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const LeadsSchema = Schema(
  {
    name: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["individual", "organization"],
      default: "individual",
    },
    email: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    relatedOrganization: {
      type: Schema.Types.ObjectId,
      ref: "organizations",
    },
    relatedBranch: {
      type: Schema.Types.ObjectId,
      ref: "branches",
      required: true,
    },
    source: {
      type: String,
      required: true,
      enum: [
        "walkin",
        "call",
        "email",
        "website",
        "socialmedia",
        "referral",
        "other",
      ],
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    approval: {
      type: String,
      enum: ["approved", "rejected", "pending"],
      default: "pending",
    },
    status: {
      type: String,
      required: true,
      enum: ["pending", "active", "inactive", "closed", "in progress"],
      default: "pending",
    },
    notes: {
      type: String,
      default: "",
    },
    history: {
      createdAt: {
        type: Date,
        default: Date.now,
      },
      created_by: {
        type: Schema.Types.ObjectId,
        ref: "users",
      },
      updatedAt: {
        type: Date,
      },
      updated_by: {
        type: Schema.Types.ObjectId,
        ref: "users",
      },
      reason: {
        type: String,
      },
    },
    scheduledFollowupDate: {
      type: Date,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = Leads = mongoose.model("leads", LeadsSchema);
