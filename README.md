# DS Chat MVP

Nostalgic MSN Messenger + Nintendo DS Chat inspired web app. Simple, fast, and lightweight.

## Requirements
- Node.js 18+
- npm 9+

## Install
```bash
npm install
```

## Dev
```bash
npm run dev
```

Open:
- Client: http://localhost:5173
- Server: ws://localhost:8080

## Config
- `VITE_WS_URL` (optional) to point client to a different WS endpoint.
- When unset in production, the client uses `ws(s)://<host>/ws` so it can
  work for both a domain and direct IP (via reverse proxy).

## Build
```bash
npm run build
```

## Start (server)
```bash
npm run start
```

## Deploy notes
- Client is a static build in `client/dist`.
- Server is a Node.js WebSocket service in `server/dist`.
- Data is in-memory only and resets on restart.
- Reverse proxy `/ws` to the server (default `localhost:8080`) so
  `https://<host>` works for both domain and IP.

