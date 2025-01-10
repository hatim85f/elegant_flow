const axios = require("axios");

/**
 * Function to send push notifications using Expo Push API
 * @param {string} pushToken - Expo push token of the recipient
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Custom data to send with the notification
 * @param {string} route - Route for navigation when the notification is clicked
 * @param {string} sound - Sound file name or "default" (optional)
 * @returns {Promise<object>} - Response from Expo Push API
 */
const sendNotification = async (
  pushToken,
  title,
  body,
  data = {},
  route = "",
  screen = "",
  sound = "notifications-sound.wav"
) => {
  // Validate the push token
  if (!pushToken || !pushToken.startsWith("ExponentPushToken")) {
    throw new Error("Invalid Expo push token");
  }

  // Include the route in the data payload
  const payload = {
    to: pushToken,
    sound: sound,
    title: title,
    body: body,
    data: { ...data, route, screen }, // Add the route here
  };

  try {
    // Send the notification via Expo's Push API
    const response = await axios.post(
      "https://exp.host/--/api/v2/push/send",
      payload
    );
    return response.data;
  } catch (error) {
    console.error(
      "Error sending notification:",
      error.response?.data || error.message
    );
    throw error;
  }
};

module.exports = sendNotification;
