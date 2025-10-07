// ai_brain.js
import fetch from "node-fetch";
import fs from "fs";
import path from "path";

const SITE_DIR = "./site";
const MEMORY_FILE = "./memory.json";

export async function runAI() {
  console.log("[ai] Starting AI generation...");

  const prompt = `
Generate a full creative website (HTML, CSS, and JS).
You can decide what the site is about — total freedom.
You may create one or multiple pages if you wish.
Avoid templates. Be unique and modern.
Always include this footer:
"Created by CrowtherTech — CrowtherTech.name.ng — techcrowther@gmail.com"
Return only the HTML starting with <!DOCTYPE html>.
`;

  try {
    const response = await fetch("https://api.cohere.ai/v1/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.COHERE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "command-r-plus",
        // ✅ Correct structure for the new Cohere Chat API (v2)
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: prompt.trim() }],
          },
        ],
        temperature: 0.9,
        max_tokens: 2000,
      }),
    });

    const data = await response.json();
    console.log("[ai debug]", JSON.stringify(data, null, 2));

    const html =
      data?.text ||
      data?.message ||
      data?.response ||
      data?.generations?.[0]?.text ||
      data?.output_text ||
      data?.reply ||
      "";

    if (!html || !html.trim()) {
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
      html.trim() +
        `\n<footer>Created by CrowtherTech —
        <a href="https://CrowtherTech.name.ng">CrowtherTech.name.ng</a> —
        techcrowther@gmail.com</footer>`
    );

    fs.writeFileSync(
      MEMORY_FILE,
      JSON.stringify({ lastRun: new Date().toISOString() }, null, 2)
    );

    console.log("[ai] ✅ Site generation complete.");
  } catch (err) {
    console.error("[ai err]", err);
  }
}