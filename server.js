// server.js
import express from "express";
import { runAI } from "./ai_brain.js";
import fs from "fs";

const PORT = process.env.PORT || 10000;
const SITE_DIR = "./site";

const app = express();
app.use(express.static(SITE_DIR));

app.get("/run-ai", async (req, res) => {
  await runAI();
  res.send("AI regeneration triggered.");
});

app.listen(PORT, async () => {
  console.log(`Server started on port ${PORT}. Serving ${SITE_DIR}`);
  if (process.env.RUN_ON_START === "true") {
    await runAI();
  } else if (!fs.existsSync(`${SITE_DIR}/index.html`)) {
    await runAI();
  }
});