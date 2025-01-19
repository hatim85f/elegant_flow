const express = require("express");
const router = express.Router();
const Notifications = require("../../models/Notifications");
const { default: mongoose } = require("mongoose");
const auth = require("../../middleware/auth");

// @route GET api/notifications
// @desc Get all notifications
// @access Private
router.get("/:userId", auth, async (req, res) => {
  try {
    const { userId } = req.params;

    // const notifications = await Notifications.find({ to: userId }).sort({
    //   date: -1,
    // });

    const notifications = await Notifications.aggregate([
      {
        $match: {
          to: new mongoose.Types.ObjectId(userId),
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "from",
          foreignField: "_id",
          as: "from",
        },
      },
      {
        $unwind: "$from",
      },
      {
        $project: {
          title: 1,
          subject: 1,
          message: 1,
          type: 1,
          from: { $concat: ["$from.firstName", " ", "$from.lastName"] },
          fromId: "$from._id",
          fromAvatar: "$from.profile.avatar",
          to: 1,
          route: 1,
          body: 1,
          screen: 1,
          date: 1,
          status: 1,
          date: 1,
        },
      },
    ]);

    return res
      .status(200)
      .send({ notifications: notifications.sort((a, b) => a.date - b.date) });
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
  const { title, subject, message, type, from, to, route, body, screen } =
    req.body;

  try {
    const newNotification = new Notifications({
      title,
      subject,
      message,
      type,
      from,
      to,
      route,
      body,
      screen,
    });

    const notification = await newNotification.save();

    return res.status(200).send({ notification });
  } catch (error) {
    console.error(error.message);
    res.status(500).send({
      error: "ERROR!",
      message: "Server Error, Please try again later" + error.message,
    });
  }
});

// @route PUT api/notifications/:id
// @desc Update a notification
// @access Private
router.put("/:notificationId", auth, async (req, res) => {
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
