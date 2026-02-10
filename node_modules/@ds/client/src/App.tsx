import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ChatHistoryItem,
  ClientToServerEvent,
  RoomInfo,
  ServerToClientEvent,
  UserInfo
} from "@ds/shared";
import NameScreen from "./screens/NameScreen";
import RoomSelectScreen from "./screens/RoomSelectScreen";
import ChatScreen, { type ChatItem } from "./screens/ChatScreen";
import { createAudioController } from "./utils/audio";
import { getAvatarColor } from "./utils/avatar";
import { pixelateImage } from "./utils/pixelate";

const STORAGE_NAME = "ds_name";
const STORAGE_AVATAR = "ds_avatar";
const STORAGE_MUTE = "ds_mute";
const STORAGE_CLIENT_KEY = "ds_client_key";

const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:8080";

const fallbackRooms: RoomInfo[] = [
  { id: "room-a", name: "Chat Room A", letter: "A", count: 3, capacity: 16, signal: 3 },
  { id: "room-b", name: "Chat Room B", letter: "B", count: 1, capacity: 16, signal: 3 },
  { id: "room-c", name: "Chat Room C", letter: "C", count: 0, capacity: 16, signal: 4 },
  { id: "room-d", name: "Chat Room D", letter: "D", count: 0, capacity: 16, signal: 4 }
];

type Screen = "name" | "rooms" | "chat";
type Status = "connected" | "reconnecting" | "disconnected";

const readStorage = (key: string) => {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
};

const readSession = (key: string) => {
  try {
    return sessionStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
};

const readStorageBool = (key: string) => {
  try {
    return localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
};

const writeStorage = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore storage failures
  }
};

const writeSession = (key: string, value: string) => {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // ignore storage failures
  }
};

const removeStorage = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore storage failures
  }
};

const getClientKey = () => {
  const existing = readSession(STORAGE_CLIENT_KEY);
  if (existing) return existing;
  const next =
    (globalThis.crypto?.randomUUID?.() as string | undefined) ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  writeSession(STORAGE_CLIENT_KEY, next);
  removeStorage(STORAGE_CLIENT_KEY);
  return next;
};

export default function App() {
  const [screen, setScreen] = useState<Screen>("name");
  const [name, setName] = useState(() => readStorage(STORAGE_NAME));
  const [avatar, setAvatar] = useState(() => readStorage(STORAGE_AVATAR));
  const [roomId, setRoomId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<RoomInfo[]>(fallbackRooms);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [roomError, setRoomError] = useState("");
  const [status, setStatus] = useState<Status>("disconnected");
  const [selfId, setSelfId] = useState<string | null>(null);
  const [mute, setMute] = useState(() => readStorageBool(STORAGE_MUTE));
  const [nudgeActive, setNudgeActive] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number | null>(null);
  const reconnectAttempts = useRef(0);
  const nameRef = useRef(name);
  const avatarRef = useRef(avatar);
  const roomRef = useRef(roomId);
  const selfIdRef = useRef(selfId);
  const screenRef = useRef<Screen>(screen);
  const nudgeTimerRef = useRef<number | null>(null);
  const avatarUpdateRef = useRef(avatar);
  const clientKeyRef = useRef(getClientKey());
  const messagesByRoomRef = useRef<Record<string, ChatItem[]>>({});
  const typingTimeouts = useRef(new Map<string, number>());
  const [typingMap, setTypingMap] = useState<Record<string, boolean>>({});
  const audioRef = useRef(createAudioController());

  const sendEvent = useCallback((event: ClientToServerEvent) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    }
  }, []);

  useEffect(() => {
    audioRef.current.setMuted(mute);
    writeStorage(STORAGE_MUTE, String(mute));
  }, [mute]);

  useEffect(() => {
    nameRef.current = name;
    if (name) {
      writeStorage(STORAGE_NAME, name);
    } else {
      removeStorage(STORAGE_NAME);
    }
  }, [name]);

  useEffect(() => {
    avatarRef.current = avatar;
    if (avatar) {
      writeStorage(STORAGE_AVATAR, avatar);
    } else {
      removeStorage(STORAGE_AVATAR);
    }
  }, [avatar]);

  useEffect(() => {
    if (avatarUpdateRef.current === avatar) return;
    avatarUpdateRef.current = avatar;
    if (screen === "chat" && roomRef.current && avatar) {
      sendEvent({ type: "update_profile", avatar });
    }
  }, [avatar, screen, sendEvent]);

  useEffect(() => {
    roomRef.current = roomId;
  }, [roomId]);

  useEffect(() => {
    selfIdRef.current = selfId;
  }, [selfId]);

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  const appendMessage = useCallback((room: string, item: ChatItem) => {
    const history = messagesByRoomRef.current[room] ?? [];
    const next = [...history, item].slice(-200);
    messagesByRoomRef.current[room] = next;
    if (roomRef.current === room) {
      setMessages(next);
    }
  }, []);

  const handleServerEvent = useCallback(
    (event: ServerToClientEvent) => {
      switch (event.type) {
        case "room_list":
          setRooms(event.rooms.length ? event.rooms : fallbackRooms);
          return;
        case "history":
          messagesByRoomRef.current[event.roomId] = event.items as ChatItem[];
          if (roomRef.current === event.roomId) {
            setMessages(event.items as ChatItem[]);
          }
          return;
        case "user_list":
          setUsers(event.users);
          if (nameRef.current) {
            const match = event.users.find(
              (user) =>
                user.name === nameRef.current && user.avatar === avatarRef.current
            );
            setSelfId(match?.id ?? null);
          }
          return;
        case "message": {
          if (roomRef.current) {
            appendMessage(roomRef.current, { kind: "message", ...event });
          }
          const isSelf = selfIdRef.current && event.user.id === selfIdRef.current;
          if (!isSelf) {
            audioRef.current.playClick();
            if (
              nameRef.current &&
              event.text
                .toLowerCase()
                .includes(`@${nameRef.current.toLowerCase()}`)
            ) {
              audioRef.current.playPing();
            }
          }
          return;
        }
        case "system":
          if (screenRef.current !== "chat") {
            if (event.text.toLowerCase().includes("name already in use")) {
              setRoomError(event.text);
              return;
            }
          }
          if (event.text.toLowerCase().includes("name already in use")) {
            setRoomError(event.text);
            setRoomId(null);
            setUsers([]);
            setTypingMap({});
            setScreen("rooms");
            return;
          }
          if (roomRef.current) {
            appendMessage(roomRef.current, {
              kind: "system",
              text: event.text,
              ts: event.ts
            });
          }
          return;
        case "typing":
          setTypingMap((prev) => {
            const next = { ...prev };
            if (event.isTyping) {
              next[event.userId] = true;
            } else {
              delete next[event.userId];
            }
            return next;
          });
          if (event.isTyping) {
            const existing = typingTimeouts.current.get(event.userId);
            if (existing) {
              window.clearTimeout(existing);
            }
            const timeout = window.setTimeout(() => {
              setTypingMap((prev) => {
                const next = { ...prev };
                delete next[event.userId];
                return next;
              });
              typingTimeouts.current.delete(event.userId);
            }, 1800);
            typingTimeouts.current.set(event.userId, timeout);
          }
          return;
        case "nudge":
          if (nudgeTimerRef.current) {
            window.clearTimeout(nudgeTimerRef.current);
          }
          setNudgeActive(true);
          nudgeTimerRef.current = window.setTimeout(() => setNudgeActive(false), 450);
          audioRef.current.playNudge();
          return;
      }
    },
    [appendMessage]
  );

  const connect = useCallback(() => {
    if (reconnectRef.current) {
      window.clearTimeout(reconnectRef.current);
    }
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.addEventListener("open", () => {
      reconnectAttempts.current = 0;
      setStatus("connected");
      if (nameRef.current && roomRef.current) {
        sendEvent({
          type: "join",
          name: nameRef.current,
          room: roomRef.current,
          avatar: avatarRef.current,
          clientKey: clientKeyRef.current
        });
      }
    });

    ws.addEventListener("message", (event) => {
      const raw = typeof event.data === "string" ? event.data : "";
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as ServerToClientEvent;
        if (parsed?.type) {
          handleServerEvent(parsed);
        }
      } catch {
        // ignore invalid payloads
      }
    });

    ws.addEventListener("close", () => {
      setStatus("reconnecting");
      reconnectAttempts.current += 1;
      const delay = Math.min(8000, 800 * reconnectAttempts.current);
      reconnectRef.current = window.setTimeout(connect, delay);
    });

    ws.addEventListener("error", () => {
      ws.close();
    });
  }, [handleServerEvent, sendEvent]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      if (reconnectRef.current) {
        window.clearTimeout(reconnectRef.current);
      }
    };
  }, [connect]);

  useEffect(() => {
    if (name) {
      setScreen("rooms");
    }
  }, [name]);

  const handleNameSubmit = useCallback(
    (nextName: string) => {
      const trimmed = nextName.trim().slice(0, 16);
      if (!trimmed) return;
      setName(trimmed);
      setRoomError("");
      if (!avatar) {
        const nextAvatar = getAvatarColor(trimmed);
        setAvatar(nextAvatar);
      }
      audioRef.current.unlock();
      setScreen("rooms");
    },
    [avatar]
  );

  const applyAvatar = useCallback(
    (nextAvatar: string) => {
      const resolved =
        nextAvatar || getAvatarColor(nameRef.current || "User");
      setAvatar(resolved);
    },
    []
  );

  const handleAvatarFile = useCallback(
    async (file: File) => {
      try {
        const dataUrl = await pixelateImage(file, 256, 40);
        applyAvatar(dataUrl);
      } catch {
        // ignore invalid files
      }
    },
    [applyAvatar]
  );

  const handleJoinRoom = useCallback(
    (room: RoomInfo) => {
      if (!name) return;
      setRoomId(room.id);
      setMessages([]);
      setUsers([]);
      setTypingMap({});
      setRoomError("");
      const cached = messagesByRoomRef.current[room.id] ?? [];
      setMessages(cached);
      sendEvent({
        type: "join",
        name,
        room: room.id,
        avatar,
        clientKey: clientKeyRef.current
      });
      audioRef.current.unlock();
      setScreen("chat");
    },
    [avatar, name, sendEvent]
  );

  const handleBackToName = useCallback(() => {
    sendEvent({ type: "leave" });
    setRoomId(null);
    setScreen("name");
  }, []);

  const handleBackToRooms = useCallback(() => {
    sendEvent({ type: "leave" });
    setRoomId(null);
    setUsers([]);
    setTypingMap({});
    setScreen("rooms");
  }, [sendEvent]);

  const handleSendMessage = useCallback(
    (text: string) => {
      sendEvent({ type: "message", text });
      audioRef.current.playClick();
    },
    [sendEvent]
  );

  const handleTyping = useCallback(
    (isTyping: boolean) => {
      sendEvent({ type: "typing", isTyping });
    },
    [sendEvent]
  );

  const handleNudge = useCallback(() => {
    sendEvent({ type: "nudge" });
  }, [sendEvent]);

  const handleCreateRoom = useCallback(
    (roomName: string, image?: string) => {
      const trimmed = roomName.trim();
      if (!trimmed) return;
      sendEvent({ type: "create_room", name: trimmed, image });
      setRooms((prev) => {
        const exists = prev.some(
          (room) => room.name.toLowerCase() === trimmed.toLowerCase()
        );
        if (exists) return prev;
        const letter = trimmed.slice(0, 1).toUpperCase() || "N";
        const next = [
          ...prev,
          {
            id: `local-${Date.now()}`,
            name: trimmed,
            letter,
            image,
            count: 0,
            capacity: 16,
            signal: 4
          }
        ];
        return next;
      });
    },
    [sendEvent]
  );

  const typingNames = useMemo(() => {
    const names = users
      .filter((user) => typingMap[user.id] && user.id !== selfId)
      .map((user) => user.name);
    return names;
  }, [typingMap, users, selfId]);

  const currentRoom = rooms.find((room) => room.id === roomId) ?? rooms[0];

  return (
    <div className={`app-shell ${nudgeActive ? "nudge" : ""}`}>
      {screen === "name" && (
        <NameScreen
          initialName={name}
          initialAvatar={avatar}
          onAvatarChange={applyAvatar}
          onSubmit={handleNameSubmit}
        />
      )}
      {screen === "rooms" && (
        <RoomSelectScreen
          rooms={rooms}
          onJoin={handleJoinRoom}
          onCreateRoom={handleCreateRoom}
          error={roomError}
          onBack={handleBackToName}
        />
      )}
      {screen === "chat" && currentRoom && (
        <ChatScreen
          name={name}
          selfAvatar={avatar}
          roomName={currentRoom.name}
          status={status}
          users={users}
          messages={messages}
          typingNames={typingNames}
          mute={mute}
          nudgeActive={nudgeActive}
          onToggleMute={() => setMute((prev) => !prev)}
          onSendMessage={handleSendMessage}
          onTyping={handleTyping}
          onNudge={handleNudge}
          onBack={handleBackToRooms}
          onAvatarFile={handleAvatarFile}
        />
      )}
    </div>
  );
}

