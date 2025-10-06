// server.js — autonomous free-will AI website manager
import express from "express";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import cron from "node-cron";
import { WebSocketServer } from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const AI_SCRIPT = path.join(__dirname, "ai_brain.js");
const LOG_FILE = path.join(__dirname, "logs.txt");

// ---------- Utility ----------
function log(msg) {
  const stamp = new Date().toISOString();
  fs.appendFileSync(LOG_FILE, `[${stamp}] ${msg}\n`);
  console.log(msg);
}

function runAI() {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [AI_SCRIPT], { cwd: __dirname });
    let output = "";
    child.stdout.on("data", (data) => {
      const text = data.toString();
      output += text;
      broadcastThinking(text);
      log(`[AI] ${text.trim()}`);
    });
    child.stderr.on("data", (data) => {
      const err = data.toString();
      log(`[ERR] ${err}`);
    });
    child.on("close", (code) => {
      log(`AI process exited with code ${code}`);
      resolve(output);
    });
  });
}

// ---------- WebSocket: Live Thinking ----------
const server = app.listen(PORT, () => {
  log(`Server running on port ${PORT}`);
  log("Initial AI run starting...");
  runAI().then(() => log("First AI run done."));
});

const wss = new WebSocketServer({ server });
const clients = new Set();

wss.on("connection", (ws) => {
  clients.add(ws);
  ws.send("🤖 AI Connected — watching real-time thoughts...");
  ws.on("close", () => clients.delete(ws));
});

function broadcastThinking(text) {
  for (const ws of clients) {
    try {
      ws.send(`🤔 ${text.trim()}`);
    } catch {}
  }
}

// ---------- Serve Files ----------
app.use(express.static(__dirname));

// ---------- Manual Trigger ----------
app.get("/run-ai", async (req, res) => {
  log("Manual AI trigger");
  const out = await runAI();
  res.type("text/plain").send(out.slice(-1000));
});

// ---------- Auto Schedule (every 3 hours) ----------
cron.schedule("0 */3 * * *", () => {
  log("⏰ 3-hour AI auto-update triggered");
  runAI();
});