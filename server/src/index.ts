import { WebSocketServer, type WebSocket } from "ws";
import crypto from "crypto";
import type {
  ChatHistoryItem,
  ClientToServerEvent,
  RoomInfo,
  ServerToClientEvent,
  UserInfo
} from "@ds/shared";
import { createRoom, getRoomById, roomDefs, type RoomDef } from "./rooms.js";
import { appendHistory, getDb, getProfile, initDb, saveDb, setProfile } from "./db.js";
import { censorProfanity, containsUrl } from "./moderation.js";

type ClientState = {
  id: string;
  name: string;
  avatar: string;
  room: string;
  clientKey: string;
  ws: WebSocket;
  msgTimes: number[];
  lastNudgeAt: number;
};

const PORT = 8080;
const HEARTBEAT_INTERVAL_MS = 5000;

const clients = new Map<WebSocket, ClientState>();
const clientKeys = new Map<string, ClientState>();
const roomUsers = new Map<string, Set<string>>();

const now = () => Date.now();

const toRoomInfo = (): RoomInfo[] =>
  roomDefs.map((room: RoomDef) => {
    const count = roomUsers.get(room.id)?.size ?? 0;
    const signal = count === 0 ? 4 : count < 4 ? 3 : count < 8 ? 2 : 1;
    return {
      id: room.id,
      name: room.name,
      letter: room.letter,
      image: room.image,
      count,
      capacity: room.capacity,
      signal
    };
  });

const sanitizeText = (value: unknown, max: number): string => {
  if (typeof value !== "string") return "";
  const cleaned = value
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > max ? cleaned.slice(0, max) : cleaned;
};

const sanitizeMessageText = (value: unknown, max: number): string => {
  if (typeof value !== "string") return "";
  const normalized = value.replace(/\r\n?/g, "\n");
  const cleaned = normalized
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return cleaned.length > max ? cleaned.slice(0, max) : cleaned;
};

const safeParse = (raw: string): ClientToServerEvent | null => {
  try {
    const data = JSON.parse(raw) as ClientToServerEvent;
    if (!data || typeof data !== "object" || typeof data.type !== "string") {
      return null;
    }
    return data;
  } catch {
    return null;
  }
};

const send = (ws: WebSocket, event: ServerToClientEvent) => {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(event));
  }
};

const broadcastRoom = (roomId: string, event: ServerToClientEvent) => {
  for (const client of clients.values()) {
    if (client.room === roomId) {
      send(client.ws, event);
    }
  }
};

const broadcastAll = (event: ServerToClientEvent) => {
  for (const client of clients.values()) {
    send(client.ws, event);
  }
};

const updateRoomList = () => {
  broadcastAll({ type: "room_list", rooms: toRoomInfo() });
};

const isNameTaken = (name: string, clientKey?: string) => {
  const target = name.toLowerCase();
  for (const client of clients.values()) {
    if (client.name.toLowerCase() === target && client.clientKey !== clientKey) {
      return true;
    }
  }
  return false;
};

const generateGuestName = () => {
  let candidate = "";
  for (let i = 0; i < 5; i += 1) {
    candidate = `Guest${Math.floor(Math.random() * 900 + 100)}`;
    if (!isNameTaken(candidate)) return candidate;
  }
  return `Guest${Date.now().toString().slice(-4)}`;
};

const sendUserList = (roomId: string) => {
  const users: UserInfo[] = [];
  for (const client of clients.values()) {
    if (client.room === roomId) {
      users.push({
        id: client.id,
        name: client.name,
        avatar: client.avatar,
        room: client.room
      });
    }
  }
  broadcastRoom(roomId, { type: "user_list", users });
};

const leaveRoom = (client: ClientState) => {
  if (!client.room) return;
  const users = roomUsers.get(client.room);
  if (users) {
    users.delete(client.id);
    if (users.size === 0) {
      roomUsers.delete(client.room);
    }
  }
  const event = {
    type: "system",
    text: `${client.name} left the room.`,
    ts: now()
  } as const;
  broadcastRoom(client.room, event);
  appendHistory(client.room, { kind: "system", text: event.text, ts: event.ts });
  sendUserList(client.room);
  updateRoomList();
};

const cleanupClient = (ws: WebSocket) => {
  const client = clients.get(ws);
  if (!client) return;
  leaveRoom(client);
  clients.delete(ws);
  if (client.clientKey) {
    clientKeys.delete(client.clientKey);
  }
};

const startServer = async () => {
  await initDb();
  const wss = new WebSocketServer({ port: PORT });
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      const socket = ws as WebSocket & { isAlive?: boolean };
      if (socket.isAlive === false) {
        cleanupClient(ws);
        try {
          ws.terminate();
        } catch {
          // ignore terminate failures
        }
        continue;
      }
      socket.isAlive = false;
      try {
        ws.ping();
      } catch {
        // ignore ping failures
      }
    }
  }, HEARTBEAT_INTERVAL_MS);

  wss.on("connection", (ws) => {
    const socket = ws as WebSocket & { isAlive?: boolean };
    socket.isAlive = true;
    ws.on("pong", () => {
      socket.isAlive = true;
    });
    send(ws, { type: "room_list", rooms: toRoomInfo() });

    ws.on("message", (raw) => {
      try {
        const parsed = safeParse(raw.toString());
        if (!parsed) return;

      if (parsed.type === "join") {
        const nameInput = sanitizeText(parsed.name, 16);
        const avatarInput = sanitizeText(parsed.avatar, 120000);
        const requestedRoom = sanitizeText(parsed.room, 32);
        const clientKeyInput = sanitizeText(parsed.clientKey, 64);
        const room = getRoomById(requestedRoom)?.id ?? roomDefs[0].id;

        if (nameInput && isNameTaken(nameInput, clientKeyInput)) {
          send(ws, {
            type: "system",
            text: "Name already in use. Choose another.",
            ts: now()
          });
          return;
        }

      const priorByKey =
        clientKeyInput && clientKeys.has(clientKeyInput)
          ? clientKeys.get(clientKeyInput)
          : undefined;
      if (priorByKey && priorByKey.ws !== ws) {
        leaveRoom(priorByKey);
        clients.delete(priorByKey.ws);
        clientKeys.delete(clientKeyInput);
        try {
          priorByKey.ws.close();
        } catch {
          // ignore close failures
        }
      }

        let client = clients.get(ws);
        if (!client) {
          const userName = nameInput || generateGuestName();
          const storedAvatar = nameInput ? getProfile(userName) : "";
          client = {
            id: priorByKey?.id ?? crypto.randomUUID(),
            name: userName,
            avatar: avatarInput || storedAvatar || "#6a7a8c",
            room,
            clientKey: clientKeyInput || priorByKey?.clientKey || crypto.randomUUID(),
            ws,
            msgTimes: [],
            lastNudgeAt: 0
          };
          clients.set(ws, client);
        } else {
          leaveRoom(client);
          const nextName = nameInput || client.name;
          const storedAvatar = nextName ? getProfile(nextName) : "";
          client.name = nextName;
          client.avatar = avatarInput || storedAvatar || client.avatar;
          client.room = room;
          if (clientKeyInput) {
            client.clientKey = clientKeyInput;
          }
        }

      if (client.clientKey) {
        clientKeys.set(client.clientKey, client);
      }

      if (!roomUsers.has(room)) {
        roomUsers.set(room, new Set());
      }
      roomUsers.get(room)?.add(client.id);

        const joinEvent = {
          type: "system",
          text: `${client.name} joined the room.`,
          ts: now()
        } as const;
        broadcastRoom(room, joinEvent);
        appendHistory(room, { kind: "system", text: joinEvent.text, ts: joinEvent.ts });
        const history = getDb().messages[room] ?? [];
        send(ws, { type: "history", roomId: room, items: history });
      sendUserList(room);
      updateRoomList();
      return;
      }

      if (parsed.type === "message") {
        const client = clients.get(ws);
        if (!client || !client.room) return;
        let text = sanitizeMessageText(parsed.text, 300);
        if (!text) return;
        if (containsUrl(text)) {
          send(ws, {
            type: "system",
            text: "Links are not allowed in chat.",
            ts: now()
          });
          return;
        }
        text = censorProfanity(text);
        const timestamp = now();
        client.msgTimes = client.msgTimes.filter((t) => timestamp - t < 10_000);
        if (client.msgTimes.length >= 5) return;
        client.msgTimes.push(timestamp);

        const event = {
          type: "message",
          id: crypto.randomUUID(),
          user: {
            id: client.id,
            name: client.name,
            avatar: client.avatar,
            room: client.room
          },
          text,
          ts: timestamp
        } as const;

        broadcastRoom(client.room, event);
        appendHistory(client.room, {
          kind: "message",
          id: event.id,
          user: event.user,
          text: event.text,
          ts: event.ts
        });
        return;
      }

      if (parsed.type === "typing") {
        const client = clients.get(ws);
        if (!client || !client.room) return;
        broadcastRoom(client.room, {
          type: "typing",
          userId: client.id,
          isTyping: !!parsed.isTyping
        });
        return;
      }

      if (parsed.type === "nudge") {
        const client = clients.get(ws);
        if (!client || !client.room) return;
        const timestamp = now();
        if (timestamp - client.lastNudgeAt < 10_000) return;
        client.lastNudgeAt = timestamp;
        broadcastRoom(client.room, {
          type: "nudge",
          fromUser: {
            id: client.id,
            name: client.name,
            avatar: client.avatar,
            room: client.room
          }
        });
        const event = {
          type: "system",
          text: `${client.name} sent a nudge!`,
          ts: timestamp
        } as const;
        broadcastRoom(client.room, event);
        appendHistory(client.room, { kind: "system", text: event.text, ts: event.ts });
        return;
      }

      if (parsed.type === "leave") {
        const client = clients.get(ws);
        if (!client) return;
        const priorRoom = client.room;
        leaveRoom(client);
        client.room = "";
        send(ws, { type: "room_list", rooms: toRoomInfo() });
        if (priorRoom) {
          sendUserList(priorRoom);
        }
        return;
      }

      if (parsed.type === "update_profile") {
        const client = clients.get(ws);
        if (!client) return;
        const avatarInput = sanitizeText(parsed.avatar, 120000);
        if (avatarInput) {
          client.avatar = avatarInput;
          setProfile(client.name, avatarInput);
          sendUserList(client.room);
        }
        return;
      }

      if (parsed.type === "create_room") {
        const nameInput = sanitizeText(parsed.name, 24);
        const imageInput = sanitizeText(parsed.image, 120000);
        const created = createRoom(nameInput, imageInput || undefined);
        if (created) {
          saveDb();
          updateRoomList();
        }
        return;
      }
      } catch (error) {
        console.error("[ws] message handler error", error);
        send(ws, { type: "system", text: "Server error. Try again.", ts: now() });
      }
    });

    ws.on("close", () => {
      cleanupClient(ws);
    });
  });
  wss.on("close", () => clearInterval(heartbeat));

  console.log(`[server] ws listening on ${PORT}`);
};

void startServer();

