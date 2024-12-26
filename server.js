const express = require("express");
const connectDB = require("./config/db");
var cors = require("cors");

const app = express();

connectDB();

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.status(200).send("Elegant Flow API is running");
});

app.use("/api/auth", require("./routes/api/auth"));
app.use("/api/organizations", require("./routes/api/organization"));
app.use("/api/clients", require("./routes/api/clients"));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
