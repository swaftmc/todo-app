# Todo App

A single-file todo list built with Vite + React + TypeScript. Features:

- Unlimited nested sublists
- Due dates, priorities, tags
- Recurring tasks
- Drag-and-drop reorder / reparent (plus keyboard)
- Search & filters
- Export / import JSON
- Dark / light theme
- Reminders via system notifications (fires while open; overdue surfaced on open)
- AI Coach (chat, propose changes, approve) with multi-provider support: Kilo Gateway, OpenRouter, AnyRouter

## Run

```bash
cd todo
npm install
npm run dev
```

## Build (single HTML file)

```bash
npm run build
```

Output: `dist/index.html` (fully inlined, works offline from `file://`).

## AI providers

Open Settings → choose a provider (OpenRouter or AnyRouter recommended for in-browser use; Kilo Gateway may be blocked by CORS in browsers). Paste an API key (optional for free tiers) and pick a model.

## License

MIT
