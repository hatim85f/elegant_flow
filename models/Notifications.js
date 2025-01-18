const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const NotificationsSchema = Schema({
  title: {
    type: String,
    required: true,
  },
  subject: {
    type: String,
    required: true,
  },
  body: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    default: "unread",
  },
  date: {
    type: Date,
    default: Date.now,
  },
  from: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
  },
  to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
  },
  route: {
    type: String,
    required: true,
  },
  screen: {
    type: String,
    required: true,
  },
});

module.exports = Notifications = mongoose.model(
  "notifications",
  NotificationsSchema
);
