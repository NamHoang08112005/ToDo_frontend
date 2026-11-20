const express = require("express");
const path = require("path");
const app = express();
require("./media")(app);
const build = path.join(__dirname, "../build");
app.use(express.static(build));
app.get("*", (req, res) => res.sendFile(path.join(build, "index.html")));
app.listen(process.env.PORT || 3000, "0.0.0.0");
