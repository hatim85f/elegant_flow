const express = require("express");
const router = express.Router();
const Notifications = require("../../models/Notifications");

// @route GET api/notifications
// @desc Get all notifications
// @access Private
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const notifications = await Notifications.find({ to: userId }).sort({
      date: -1,
    });
    res.json(notifications);
  } catch (error) {
    console.error(error.message);
    res.status(500).send({
      error: "ERROR!",
      message: "Server Error, Please try again later",
    });
  }
});

// @route POST api/notifications
// @desc Create a notification
// @access Private
router.post("/", async (req, res) => {
  const { title, subject, message, type, from, to, route } = req.body;

  try {
    const newNotification = new Notifications({
      title,
      subject,
      message,
      type,
      from,
      to,
      route,
    });

    const notification = await newNotification.save();
    res.json({ notification });
  } catch (error) {
    console.error(error.message);
    res.status(500).send({
      error: "ERROR!",
      message: "Server Error, Please try again later",
    });
  }
});

// @route PUT api/notifications/:id
// @desc Update a notification
// @access Private
router.put("/:notificationId", async (req, res) => {
  const { notificationId } = req.params;

  try {
    await Notifications.updateOne({ _id: notificationId }, { status: "read" });

    return res.status(200).json({ message: "Notification updated" });
  } catch (error) {
    console.error(error.message);
    res.status(500).send({
      error: "ERROR!",
      message: "Server Error, Please try again later",
    });
  }
});

// @route DELETE api/notifications/:id
// @desc Delete a notification
// @access Private
router.delete("/:notificationId", async (req, res) => {
  const { notificationId } = req.params;

  try {
    await Notifications.deleteOne({ _id: notificationId });

    return res.status(200).json({ message: "Notification deleted" });
  } catch (error) {
    console.error(error.message);
    res.status(500).send({
      error: "ERROR!",
      message: "Server Error, Please try again later",
    });
  }
});

module.exports = router;
