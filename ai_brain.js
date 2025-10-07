// ai_brain.js
import fetch from "node-fetch";
import fs from "fs";
import path from "path";

const SITE_DIR = "./site";
const MEMORY_FILE = "./memory.json";

// Main AI generation function
export async function runAI() {
  console.log("[ai] Starting AI generation...");

  const prompt = `
You are a fully autonomous AI website creator.
You have complete freedom to design any type of website: portfolio, game, tech hub, shop, art site—whatever you imagine.
You can include HTML, CSS, and JS directly in your output.
Do NOT follow any template or example.
Every generation must be unique and creative.
Return a full valid HTML page beginning with <!DOCTYPE html>.
At the bottom of the page, always include:
"Created by CrowtherTech — CrowtherTech.name.ng — techcrowther@gmail.com"
`;

  try {
    const res = await fetch("https://api.cohere.ai/v1/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.COHERE_API_KEY}`
      },
      body: JSON.stringify({
        model: "command-r-plus",
        prompt,
        max_tokens: 1500,
        temperature: 0.9
      })
    });

    const data = await res.json();
    console.log("[ai debug]", data); // log response for debugging

    const html = data.generations?.[0]?.text?.trim();

    if (!html) {
      console.error("[ai error] No valid HTML received from Cohere");
      fs.writeFileSync(
        path.join(SITE_DIR, "index.html"),
        `<h1>AI generation failed</h1>
         <footer>Created by CrowtherTech — 
         <a href="https://CrowtherTech.name.ng">CrowtherTech.name.ng</a> — 
         techcrowther@gmail.com</footer>`
      );
      return;
    }

    if (!fs.existsSync(SITE_DIR)) fs.mkdirSync(SITE_DIR);

    fs.writeFileSync(
      path.join(SITE_DIR, "index.html"),
      html + `\n<footer>Created by CrowtherTech — 
      <a href="https://CrowtherTech.name.ng">CrowtherTech.name.ng</a> — 
      techcrowther@gmail.com</footer>`
    );

    fs.writeFileSync(MEMORY_FILE, JSON.stringify({ lastRun: new Date().toISOString() }, null, 2));
    console.log("[ai] Site generation complete.");
  } catch (err) {
    console.error("[ai err]", err);
  }
}