// ai_brain.js
import fetch from "node-fetch";
import fs from "fs";
import path from "path";

const SITE_DIR = "./site";
const MEMORY_FILE = "./memory.json";

export async function runAI() {
  console.log("[ai] Starting AI generation...");

  const prompt = `
Create a complete unique HTML5 website. Be fully creative and include inline CSS and JS if needed.
You can make it about technology, futuristic design, innovation, portfolio, AI, or creativity.
Start with <!DOCTYPE html>.
Never use templates or examples.
Include my footer:
"Created by CrowtherTech — CrowtherTech.name.ng — techcrowther@gmail.com"
Return only valid HTML code.
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
        // ✅ Correct structure for Cohere Chat (Oct 2025)
        chat_history: [
          {
            role: "USER",
            message: prompt.trim(),
          },
        ],
        temperature: 0.9,
        max_tokens: 2000,
      }),
    });

    const data = await response.json();
    console.log("[ai debug]", JSON.stringify(data, null, 2));

    // ✅ Extract generated text safely
    const html =
      data?.text ||
      data?.message ||
      data?.response ||
      data?.generations?.[0]?.text ||
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