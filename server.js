const express = require("express");
const connectDB = require("./config/db");
var cors = require("cors");

const app = express();

connectDB();

app.get("/", (req, res) => {
  res.status(200).send("Elegant Flow API is running");
});

app.use(express.json());
app.use(cors());

app.use("/api/auth", require("./routes/api/auth"));
app.use("/api/organizations", require("./routes/api/organization"));
app.use("/api/clients", require("./routes/api/clients"));
app.use("/api/teams", require("./routes/api/team"));
app.use("/api/notifications", require("./routes/api/notifications"));
app.use("/api/branches", require("./routes/api/branches"));
app.use("/api/leads", require("./routes/api/leads"));
app.use("/api/dashboard", require("./routes/api/dashboard"));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
