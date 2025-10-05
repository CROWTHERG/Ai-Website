import { generateSEO, updateMetaTags } from './seo.js';

async function updateContent() {
  const cohereKey = "YOUR_COHERE_API_KEY";
  const response = await fetch("https://api.cohere.ai/generate", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${cohereKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "command-r-plus",
      prompt: "Generate new homepage content with sections and topics.",
      max_tokens: 500
    })
  });
  const data = await response.json();
  const newContent = data.generations[0].text;

  document.querySelector("#main").innerHTML = newContent;

  // SEO optimization
  const meta = generateSEO(newContent);
  updateMetaTags(meta);

  console.log("✅ AI updated site with SEO optimization.");
}
updateContent();