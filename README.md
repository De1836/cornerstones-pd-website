# Smart Electric Trash Can Survey App

A survey app for the Smart/Electric Trash Can project. It persists submissions to a local JSON file on the server.

## Features
- Smart Trash Can survey questions as specified.
- Validation for required fields, including “Other” text when selected.
- Server-side persistence to `data/submissions.json`.
- Submissions table with live updates from the server.
- Export all submissions to JSON or CSV (from server data).
- Optional auto-download JSON on each submit (client preference).

## Getting Started (Server Mode)
1. Install Node.js (v18+ recommended).
2. From the `survey-app/` directory, install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
4. Open the app in your browser at:
   - http://localhost:3000
5. Submit responses. Data will be appended to `data/submissions.json`.

## Data Storage
- Server writes all submissions to `data/submissions.json` (created automatically on first run).
- Safe write via temp file + rename.

## API Endpoints
- `GET /api/submissions` → returns all submissions (JSON array)
- `POST /api/submissions` → append one submission (JSON body)
- `DELETE /api/submissions` → clear all submissions

## Notes
- App serves static files and API from the same Express server.
- If deploying behind a reverse proxy, ensure requests to `/api/*` are routed to this server.
