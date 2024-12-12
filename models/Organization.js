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
    ref: "User",
    required: true,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
});

module.exports = Organization = mongoose.model(
  "organization",
  OrganizationSchema
);
