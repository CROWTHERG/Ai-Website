// ai_brain.js
import fetch from "node-fetch";
import fs from "fs";
import path from "path";

const SITE_DIR = "./site";
const MEMORY_FILE = "./memory.json";

export async function runAI() {
  console.log("[ai] Starting AI generation...");

  const prompt = `
You are an autonomous creative AI website designer.
Generate complete HTML and CSS for a website of any kind or topic you choose.
Do not reuse templates. Be original each run.
You may include JS if needed.
Never remove or modify the footer that credits CrowtherTech (CrowtherTech.name.ng / techcrowther@gmail.com).
Return valid HTML (starting with <!DOCTYPE html>).
  `;

  try {
    const res = await fetch("https://api.cohere.ai/v1/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + process.env.COHERE_API_KEY
      },
      body: JSON.stringify({
        model: "command",
        prompt,
        max_tokens: 1500,
        temperature: 0.9
      })
    });

    const data = await res.json();
    const html = data.generations?.[0]?.text || "<h1>AI generation failed</h1>";

    if (!fs.existsSync(SITE_DIR)) fs.mkdirSync(SITE_DIR);
    fs.writeFileSync(
      path.join(SITE_DIR, "index.html"),
      html + '\n<footer>Created by CrowtherTech — <a href="https://CrowtherTech.name.ng">CrowtherTech.name.ng</a> — techcrowther@gmail.com</footer>'
    );

    fs.writeFileSync(MEMORY_FILE, JSON.stringify({ lastRun: new Date().toISOString() }, null, 2));
    console.log("[ai] Site generation complete.");
  } catch (err) {
    console.error("[ai error]", err);
  }
}