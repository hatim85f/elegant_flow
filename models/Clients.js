const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ClientsSchema = Schema({
  // Basic client details
  clientName: {
    type: String,
    required: true,
  },
  clientType: {
    type: String,
    enum: ["individual", "organization"],
    default: "individual",
  },
  clientEmail: {
    type: String,
    validate: {
      validator: function (v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: (props) => `${props.value} is not a valid email!`,
    },
  },
  clientPhone: {
    type: String,
    required: true,
  },
  clientAddress: {
    type: String,
  },

  // Relationships
  clientForOrganization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "organization",
    required: true,
  },
  clientForBranch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "branch",
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
  },
  clientProjects: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "project",
    },
  ],

  // Additional details
  clientIndustry: {
    type: String,
  },
  clientNotes: {
    type: String,
  },
  clientFeedback: {
    type: Array,
  },
  preferredContactMethod: {
    type: String,
    enum: ["email", "phone", "whatsapp", "sms"],
    default: "email",
  },

  // Status and timestamps
  clientStatus: {
    type: String,
    default: "inactive",
    enum: ["active", "inactive"],
  },
  clientCreatedAt: {
    type: Date,
    default: Date.now,
  },
  clientUpdatedAt: {
    type: Date,
    default: Date.now,
  },

  // Audit fields
  clientCreatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
  },
  clientUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
  },

  clientProfileImage: {
    type: String,
  },
  clientProfileImageThumb: {
    type: String,
  },
  password: {
    type: String,
  },
});

module.exports = Clients = mongoose.model("clients", ClientsSchema);
