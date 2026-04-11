# KnowledgeMelon Frontend

This is the Next.js frontend for KnowledgeMelon.

## Development

1. Install dependencies:

```bash
npm install
```

2. Create a local environment file:

```bash
copy .env.example .env.local
```

3. Set `NEXT_PUBLIC_API_URL` to the backend host and port you want the frontend to use. Do this for local development too if the backend is not running at the default `http://localhost:8000`.

4. Start the dev server:

```bash
npm run dev
```

## Notes

- The frontend can run locally or on a separate machine from the backend stack.
- Always set `frontend/.env.local` so `NEXT_PUBLIC_API_URL` points to the backend instance you want to use.
