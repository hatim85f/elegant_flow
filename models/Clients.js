const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ClientsSchema = Schema({
  clientName: {
    type: String,
    required: true,
  },
  clientEmail: {
    type: String,
  },
  clientPhone: {
    type: String,
    required: true,
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
  },
  clientProject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "project",
  },
  clientStatus: {
    type: String,
    default: "active",
    enum: ["active", "inactive"],
  },
  clientForOrganization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "organization",
    required: true,
  },
  clientCreatedAt: {
    type: Date,
    default: Date.now,
  },
  clientUpdatedAt: {
    type: Date,
    default: Date.now,
  },
  clientCreatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
  },
  clientUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
  },
});

module.exports = Clients = mongoose.model("clients", ClientsSchema);
