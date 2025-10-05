# Autonomous AI Full — CrowtherTech

Protected creator info:

## Modes
- **simulate (no cost)**: `MODE=simulate node ai_brain.js` or `npm run simulate`
- **cohere (real)**: add `COHERE_API_KEY` to env or GitHub Secrets
- **openai (real)**: add `OPENAI_API_KEY` to env or GitHub Secrets

## Install & test locally
1. `npm install`
2. `node validator.js`  # ensures protected info & markers exist
3. `npm run simulate`   # test without any API keys
4. For real runs set COHERE_API_KEY or OPENAI_API_KEY:
   - `COHERE_API_KEY=... node ai_brain.js` or add to GitHub Secrets to run daily

## Notes
- The AI may change site type, name, CSS, and HTML content — but **cannot modify** the protected creator info.
- Real API usage may cost money; simulate mode is free.
- The GitHub Action runs once every 24 hours (adjust cron if you want another schedule).