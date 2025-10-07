# autonomous-ai-freewill

Autonomous AI website that may create any files it wants inside `site/`. Protected footer: `Created by CrowtherTech`.

## Modes
- simulate (no-cost): `MODE=simulate node ai_brain.js`
- real: set `COHERE_API_KEY` environment variable then `node server.js` (server will call ai_brain.js)

## Run locally
1. `npm install`
2. Set env vars:
   - `COHERE_API_KEY=...` (or use simulate)
   - `ADMIN_TOKEN=choose-a-secret` (recommended)
3. `node server.js`
4. Visit `http://localhost:3000` (the server serves files in ./site)
5. Manually trigger generation: `curl "http://localhost:3000/run-ai?token=YOUR_TOKEN"`

## Safety & limits
- No external <script src=> or <iframe src=> allowed.
- Each file limited to 150 KB, total site limited to 2 MB.
- All HTML files must include the footer text or generation is rejected.
- Backups stored in `backups/` before each run.