const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const UserSchema = Schema({
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    required: true,
  },
  userName: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
    required: true,
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastLoggedIn: {
    type: Date,
    default: Date.now,
  },
  role: {
    type: String,
    default: "user",
    enum: ["employee", "manager", "owner"],
  },
  status: {
    type: String,
    default: "active",
    enum: ["active", "inactive"],
  },
  jobTitle: {
    type: String,
    required: false,
  },
  department: {
    type: String,
    required: false,
  },
  employmentType: {
    type: String,
    enum: ["full-time", "part-time", "contractor", "intern"],
    default: "full-time",
  },
  officeLocation: {
    type: String,
    required: false,
  },
  subordinates: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
  ],
  accessLevel: {
    type: String,
    enum: ["admin", "manager", "employee"],
    default: "employee",
  },
  profile: {
    firstName: {
      type: String,
    },
    lastName: {
      type: String,
    },
    phone: {
      type: String,
      validate: {
        validator: function (v) {
          return /^\+?[1-9]\d{1,14}$/.test(v); // E.164 format for international phone numbers
        },
        message: "Invalid phone number format",
      },
    },
    avatar: {
      type: String,
    },
  },
  settings: {
    theme: {
      type: String,
      default: "dark",
      enum: ["light", "dark"],
    },
    mode: {
      type: String,
      default: "basic",
      enum: ["basic", "pro"],
    },
    chatOn: {
      type: Boolean,
      default: false,
    },
    notificationsOn: {
      type: Boolean,
      default: false,
    },
    newsletterOn: {
      type: Boolean,
      default: false,
    },
  },
  social: {
    facebook: {
      type: String,
      validate: {
        validator: function (v) {
          return /^(https?:\/\/)?(www\.)?facebook\.com\/[A-Za-z0-9_.]+$/.test(
            v
          );
        },
        message: "Invalid Facebook URL",
      },
    },
    x: {
      type: String,
    },
    linkedin: {
      type: String,
    },
    instagram: {
      type: String,
    },
  },
  pushTokens: [
    {
      type: String,
    },
  ],
});

module.exports = User = mongoose.model("user", UserSchema);
