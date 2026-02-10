import { useEffect, useMemo, useRef, useState } from "react";
import type { UserInfo } from "@ds/shared";
import { tokenizeEmotes } from "../utils/emotes";

export type ChatItem =
  | {
      kind: "message";
      id: string;
      user: UserInfo;
      text: string;
      ts: number;
    }
  | { kind: "system"; text: string; ts: number };

type Props = {
  name: string;
  selfAvatar: string;
  roomName: string;
  status: "connected" | "reconnecting" | "disconnected";
  users: UserInfo[];
  messages: ChatItem[];
  typingNames: string[];
  mute: boolean;
  nudgeActive: boolean;
  onToggleMute: () => void;
  onSendMessage: (text: string) => void;
  onTyping: (isTyping: boolean) => void;
  onNudge: () => void;
  onBack: () => void;
  onAvatarFile: (file: File) => void;
};

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const isImageAvatar = (value: string) => value.startsWith("data:image");

export default function ChatScreen({
  name,
  selfAvatar,
  roomName,
  status,
  users,
  messages,
  typingNames,
  mute,
  nudgeActive,
  onToggleMute,
  onSendMessage,
  onTyping,
  onNudge,
  onBack,
  onAvatarFile
}: Props) {
  const [text, setText] = useState("");
  const [atBottom, setAtBottom] = useState(true);
  const typingTimer = useRef<number | null>(null);
  const typingActive = useRef(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!listRef.current) return;
    if (!atBottom) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, atBottom]);

  useEffect(() => {
    return () => {
      if (typingTimer.current) {
        window.clearTimeout(typingTimer.current);
      }
    };
  }, []);

  const handleScroll = () => {
    if (!listRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    const nearBottom = scrollHeight - (scrollTop + clientHeight) < 32;
    setAtBottom(nearBottom);
  };

  const sendTyping = (value: boolean) => {
    if (typingActive.current === value) {
      if (!value) {
        return;
      }
    } else {
      typingActive.current = value;
      onTyping(value);
    }
    if (typingTimer.current) {
      window.clearTimeout(typingTimer.current);
    }
    if (value) {
      typingTimer.current = window.setTimeout(() => {
        typingActive.current = false;
        onTyping(false);
      }, 900);
    }
  };

  const handleSend = () => {
    const trimmed = text.trim().slice(0, 300);
    if (!trimmed) return;
    onSendMessage(trimmed);
    setText("");
    sendTyping(false);
  };

  const typingLabel = useMemo(() => {
    if (!typingNames.length) return "";
    if (typingNames.length === 1) {
      return `${typingNames[0]} is typing...`;
    }
    return `${typingNames.join(", ")} are typing...`;
  }, [typingNames]);

  const selfHasImage = isImageAvatar(selfAvatar);

  return (
    <div className="screen chat-screen">
      <div className="ds-panel chat-panel">
        <div
          className={`chat-header ${status === "reconnecting" ? "flash" : ""} ${
            nudgeActive ? "nudge-flash" : ""
          }`}
        >
          <div className="chat-title ds-title-bar">{roomName}</div>
          <div className="chat-status">
            <span className={`status-dot ${status}`}></span>
            {status === "connected" ? "Connected" : "Reconnecting..."}
          </div>
          <button
            className="chat-self"
            onClick={() => avatarInputRef.current?.click()}
          >
            <span
              className={`avatar tiny ${selfHasImage ? "has-image" : ""}`}
              style={
                selfHasImage
                  ? { backgroundImage: `url(${selfAvatar})` }
                  : { backgroundColor: selfAvatar }
              }
            >
              {!selfHasImage && name.slice(0, 1).toUpperCase()}
            </span>
            <span className="chat-self-name">You</span>
          </button>
          <div className="chat-actions">
            <button className="ds-button tiny" onClick={onBack}>
              Rooms
            </button>
            <button className="ds-button tiny" onClick={onToggleMute}>
              {mute ? "Unmute" : "Mute"}
            </button>
            <button className="ds-button tiny" onClick={onNudge}>
              Nudge
            </button>
          </div>
        </div>
        <input
          ref={avatarInputRef}
          className="avatar-input"
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void onAvatarFile(file);
            }
            event.currentTarget.value = "";
          }}
        />
        <div className="chat-body">
          <div className="chat-main">
            <div className="chat-messages" ref={listRef} onScroll={handleScroll}>
              {messages.map((item) =>
                item.kind === "system" ? (
                  <div className="system-row" key={`${item.ts}-${item.text}`}>
                    <span className="system-pill">{item.text}</span>
                  </div>
                ) : (
                  <div
                    className={`message-row ${
                      item.text.toLowerCase().includes(`@${name.toLowerCase()}`)
                        ? "mention"
                        : ""
                    }`}
                    key={item.id}
                  >
                    {(() => {
                      const hasImage = isImageAvatar(item.user.avatar);
                      return (
                        <div
                          className={`avatar ${hasImage ? "has-image" : ""}`}
                          style={
                            hasImage
                              ? { backgroundImage: `url(${item.user.avatar})` }
                              : { backgroundColor: item.user.avatar }
                          }
                        >
                          {!hasImage && item.user.name.slice(0, 1).toUpperCase()}
                        </div>
                      );
                    })()}
                    <div className="message-content">
                      <div className="message-meta">
                        <span className="message-name">{item.user.name}</span>
                        <span className="message-time">{formatTime(item.ts)}</span>
                      </div>
                      <div className="message-bubble">
                        {tokenizeEmotes(item.text).map((token, idx) =>
                          token.type === "emote" ? (
                            <span key={idx} className={`emote ${token.value}`} />
                          ) : (
                            <span key={idx}>{token.value}</span>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
            {!atBottom && (
              <button
                className="jump-latest ds-button tiny"
                onClick={() => {
                  if (listRef.current) {
                    listRef.current.scrollTop = listRef.current.scrollHeight;
                  }
                  setAtBottom(true);
                }}
              >
                Jump to latest
              </button>
            )}
            <div className="typing-indicator">{typingLabel}</div>
            <div className="chat-input">
              <input
                className="ds-input"
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                  if (event.target.value) {
                    sendTyping(true);
                  } else {
                    sendTyping(false);
                  }
                }}
                onBlur={() => sendTyping(false)}
                maxLength={300}
                placeholder="Type a message..."
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleSend();
                  }
                }}
              />
              <button className="ds-button primary" onClick={handleSend}>
                Send
              </button>
            </div>
          </div>
          <aside className="user-panel">
            <div className="panel-title">Online</div>
            <div className="user-list">
              {users.map((user) => (
                <div className="user-row" key={user.id}>
                  {(() => {
                    const hasImage = isImageAvatar(user.avatar);
                    return (
                      <span
                        className={`avatar tiny ${hasImage ? "has-image" : ""}`}
                        style={
                          hasImage
                            ? { backgroundImage: `url(${user.avatar})` }
                            : { backgroundColor: user.avatar }
                        }
                      >
                        {!hasImage && user.name.slice(0, 1).toUpperCase()}
                      </span>
                    );
                  })()}
                  <span className="user-name">{user.name}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

