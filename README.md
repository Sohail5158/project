# Corner Cube

Dashboard for Ditto Design Studio, now with a ChatGPT assistant that can answer questions about ratings, clients, to-dos, and recent feedback.

## Run locally

1. Copy `.env.example` to `.env` and add an [OpenAI API key](https://platform.openai.com/api-keys):

   ```bash
   cp .env.example .env
   ```

2. Install dependencies and start the server:

   ```bash
   npm install
   npm start
   ```

3. Open [http://localhost:3000](http://localhost:3000).

The orange **Ask ChatGPT** button (and **Help & Support** in the sidebar) opens the assistant. If you do not want a server-side key, paste a key in the chat **Settings** panel. That key stays in the current browser tab only.

## Demo without calling OpenAI

```bash
MOCK_OPENAI=1 npm start
```

This still uses the same chat UI, but replies come from local dashboard data instead of ChatGPT.

## Tests

```bash
npm test
```
