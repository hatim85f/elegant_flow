const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const BranchSchema = Schema({
  branchName: {
    type: String,
    required: true,
  },
  branchLocation: {
    type: String,
    required: true,
  },
  branchContact: {
    type: String,
  },
  branchEmail: {
    type: String,
  },
  branchManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
  },
});

module.exports = Branc = mongoose.model("branch", BranchSchema);
