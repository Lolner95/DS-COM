import { WebSocketServer } from "ws";
import crypto from "crypto";
import { createRoom, getRoomById, roomDefs } from "./rooms.js";
const PORT = 8080;
const clients = new Map();
const roomUsers = new Map();
const wss = new WebSocketServer({ port: PORT });
const now = () => Date.now();
const toRoomInfo = () => roomDefs.map((room) => {
    const count = roomUsers.get(room.id)?.size ?? 0;
    const signal = count === 0 ? 4 : count < 4 ? 3 : count < 8 ? 2 : 1;
    return {
        id: room.id,
        name: room.name,
        letter: room.letter,
        count,
        capacity: room.capacity,
        signal
    };
});
const sanitizeText = (value, max) => {
    if (typeof value !== "string")
        return "";
    const cleaned = value
        .replace(/[\u0000-\u001F\u007F]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    return cleaned.length > max ? cleaned.slice(0, max) : cleaned;
};
const safeParse = (raw) => {
    try {
        const data = JSON.parse(raw);
        if (!data || typeof data !== "object" || typeof data.type !== "string") {
            return null;
        }
        return data;
    }
    catch {
        return null;
    }
};
const send = (ws, event) => {
    if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(event));
    }
};
const broadcastRoom = (roomId, event) => {
    for (const client of clients.values()) {
        if (client.room === roomId) {
            send(client.ws, event);
        }
    }
};
const broadcastAll = (event) => {
    for (const client of clients.values()) {
        send(client.ws, event);
    }
};
const updateRoomList = () => {
    broadcastAll({ type: "room_list", rooms: toRoomInfo() });
};
const sendUserList = (roomId) => {
    const users = [];
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
const leaveRoom = (client) => {
    if (!client.room)
        return;
    const users = roomUsers.get(client.room);
    if (users) {
        users.delete(client.id);
        if (users.size === 0) {
            roomUsers.delete(client.room);
        }
    }
    broadcastRoom(client.room, {
        type: "system",
        text: `${client.name} left the room.`,
        ts: now()
    });
    sendUserList(client.room);
    updateRoomList();
};
wss.on("connection", (ws) => {
    send(ws, { type: "room_list", rooms: toRoomInfo() });
    ws.on("message", (raw) => {
        const parsed = safeParse(raw.toString());
        if (!parsed)
            return;
        if (parsed.type === "join") {
            const nameInput = sanitizeText(parsed.name, 16);
            const avatarInput = sanitizeText(parsed.avatar, 12000);
            const requestedRoom = sanitizeText(parsed.room, 32);
            const room = getRoomById(requestedRoom)?.id ?? roomDefs[0].id;
            let client = clients.get(ws);
            if (!client) {
                const userName = nameInput || `Guest${Math.floor(Math.random() * 900 + 100)}`;
                client = {
                    id: crypto.randomUUID(),
                    name: userName,
                    avatar: avatarInput || "#6a7a8c",
                    room,
                    ws,
                    msgTimes: [],
                    lastNudgeAt: 0
                };
                clients.set(ws, client);
            }
            else {
                leaveRoom(client);
                client.name = nameInput || client.name;
                client.avatar = avatarInput || client.avatar;
                client.room = room;
            }
            if (!roomUsers.has(room)) {
                roomUsers.set(room, new Set());
            }
            roomUsers.get(room)?.add(client.id);
            broadcastRoom(room, {
                type: "system",
                text: `${client.name} joined the room.`,
                ts: now()
            });
            sendUserList(room);
            updateRoomList();
            return;
        }
        if (parsed.type === "message") {
            const client = clients.get(ws);
            if (!client)
                return;
            const text = sanitizeText(parsed.text, 300);
            if (!text)
                return;
            const timestamp = now();
            client.msgTimes = client.msgTimes.filter((t) => timestamp - t < 10000);
            if (client.msgTimes.length >= 5)
                return;
            client.msgTimes.push(timestamp);
            broadcastRoom(client.room, {
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
            });
            return;
        }
        if (parsed.type === "typing") {
            const client = clients.get(ws);
            if (!client)
                return;
            broadcastRoom(client.room, {
                type: "typing",
                userId: client.id,
                isTyping: !!parsed.isTyping
            });
            return;
        }
        if (parsed.type === "nudge") {
            const client = clients.get(ws);
            if (!client)
                return;
            const timestamp = now();
            if (timestamp - client.lastNudgeAt < 10000)
                return;
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
            broadcastRoom(client.room, {
                type: "system",
                text: `${client.name} sent a nudge!`,
                ts: timestamp
            });
            return;
        }
        if (parsed.type === "leave") {
            const client = clients.get(ws);
            if (!client)
                return;
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
            if (!client)
                return;
            const avatarInput = sanitizeText(parsed.avatar, 12000);
            if (avatarInput) {
                client.avatar = avatarInput;
                sendUserList(client.room);
            }
            return;
        }
        if (parsed.type === "create_room") {
            const nameInput = sanitizeText(parsed.name, 24);
            const created = createRoom(nameInput);
            if (created) {
                updateRoomList();
            }
            return;
        }
    });
    ws.on("close", () => {
        const client = clients.get(ws);
        if (client) {
            leaveRoom(client);
            clients.delete(ws);
        }
    });
});
console.log(`[server] ws listening on ${PORT}`);
