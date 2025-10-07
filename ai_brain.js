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
You are an autonomous AI website creator.
You have complete freedom to invent any website — portfolio, tech blog, digital art, game portal, futuristic lab — anything.
You can include HTML, CSS, and JS directly.
Always start with <!DOCTYPE html>.
Never use templates or examples; be original.
At the bottom, always include:
"Created by CrowtherTech — CrowtherTech.name.ng — techcrowther@gmail.com"
Return only the HTML code.
`;

  try {
    const res = await fetch("https://api.cohere.ai/v1/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.COHERE_API_KEY}`
      },
      body: JSON.stringify({
        model: "command-r-plus",
        messages: [
          { role: "system", content: "You are an autonomous creative web AI." },
          { role: "user", content: prompt }
        ],
        temperature: 0.9,
        max_tokens: 1500
      })
    });

    const data = await res.json();
    console.log("[ai debug]", data);

    const html = data.text || data.message?.content?.[0]?.text || "";

    if (!html.trim()) {
      console.error("[ai error] No valid HTML received from Cohere.");
      if (!fs.existsSync(SITE_DIR)) fs.mkdirSync(SITE_DIR);
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