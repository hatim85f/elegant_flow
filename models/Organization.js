const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const OrganizationSchema = Schema({
  name: {
    type: String,
    required: true,
  },
  logo: {
    type: String,
    default: null,
  },
  industry: {
    type: String,
    default: null,
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
  branches: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "branch",
    },
  ],
  website: {
    type: String,
    required: true,
  },
});

module.exports = Organization = mongoose.model(
  "organization",
  OrganizationSchema
);
