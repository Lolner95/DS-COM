# DS Chat Fresh-Clone Setup

This tutorial walks you through running the project from a new git clone.

## Requirements
- Node.js 18+
- npm 9+

## 1) Clone the repository
```bash
git clone <your-repo-url>
cd DS-COM
```

## 2) Install dependencies
This repo uses npm workspaces, so install once from the root:
```bash
npm install
```

## 3) Run in development
Starts both the client and the WebSocket server:
```bash
npm run dev
```

Open:
- Client: http://localhost:5173
- Server: ws://localhost:8080

## 4) Configure the WebSocket URL (optional)
To point the client at a different WS endpoint, set `VITE_WS_URL`:
```bash
VITE_WS_URL=ws://localhost:8080 npm run dev
```

Production example:
```bash
VITE_WS_URL=wss://your-domain.com/ws npm run dev
```

When unset in production, the client uses `ws(s)://<host>/ws`.

## 5) Build for production
```bash
npm run build
```

Outputs:
- Client build: `client/dist`
- Server build: `server/dist`

## 6) Start the production server
```bash
npm run start
```

## 7) Serve the client in production
Serve `client/dist` from a static host (Nginx, Caddy, etc.).

Reverse proxy `/ws` to the Node WS server (default `localhost:8080`) so
`https://<host>` works for both domain and IP.

## 8) Data persistence
Server data is stored here:
```
server/data/db.json
```

Make sure the server can write to `server/data/`. Delete the file to reset data.

## 9) Common issues
- Port 8080 already in use: change `PORT` in `server/src/index.ts`, then rebuild.
- Client not connecting: verify `VITE_WS_URL` or your `/ws` reverse proxy.
