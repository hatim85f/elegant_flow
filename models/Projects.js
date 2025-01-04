const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ProjectSchema = Schema({
  projectName: {
    type: String,
    required: true,
  },
  projectDescription: {
    type: String,
  },
  projectClient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "client",
  },
  projectBudget: {
    type: Number,
    default: 0,
  },
  projectStatus: {
    type: String,
    default: "active",
    enum: ["active", "inactive"],
  },
  projectForOrganization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "organization",
    required: true,
  },
  projectDeadline: {
    type: Date,
  },
  projectAssignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
  },
  projectCreatedAt: {
    type: Date,
    default: Date.now,
  },
  projectUpdatedAt: {
    type: Date,
    default: Date.now,
  },
  projectCreatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
  },
  projectUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
  },
});

module.exports = Project = mongoose.model("project", ProjectSchema);
