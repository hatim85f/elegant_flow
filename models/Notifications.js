const mongoose = require("mongoose");
const { route } = require("../routes/api/clients");
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
  message: {
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
    type: String,
    required: true,
  },
  to: {
    type: String,
    required: true,
  },
  route: {
    type: String,
    required: true,
  },
});

module.exports = Notifications = mongoose.model(
  "notifications",
  NotificationsSchema
);
