import { useEffect, useMemo, useRef, useState } from "react";
import type { RoomInfo } from "@ds/shared";
import { pixelateImage } from "../utils/pixelate";

type Props = {
  rooms: RoomInfo[];
  onJoin: (room: RoomInfo) => void;
  onCreateRoom: (name: string, image?: string) => void;
  error: string;
  onBack: () => void;
};

export default function RoomSelectScreen({
  rooms,
  onJoin,
  onCreateRoom,
  error,
  onBack
}: Props) {
  const [selected, setSelected] = useState(0);
  const [newRoom, setNewRoom] = useState("");
  const [newRoomImage, setNewRoomImage] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (selected >= rooms.length) {
      setSelected(0);
    }
  }, [rooms, selected]);

  const selectedRoom = useMemo(() => rooms[selected], [rooms, selected]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) {
        return;
      }
      if (rooms.length === 0) return;
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelected((prev) => (prev - 1 + rooms.length) % rooms.length);
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelected((prev) => (prev + 1) % rooms.length);
      }
      if (event.key === "Enter") {
        event.preventDefault();
        if (selectedRoom) onJoin(selectedRoom);
      }
      if (event.key === "Escape") {
        event.preventDefault();
        onBack();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack, onJoin, rooms.length, selectedRoom]);

  const handleCreate = () => {
    const trimmed = newRoom.trim();
    if (!trimmed) return;
    onCreateRoom(trimmed, newRoomImage || undefined);
    setNewRoom("");
    setNewRoomImage("");
    setSelected(rooms.length);
  };

  const handleRoomImage = async (file: File) => {
    try {
      const dataUrl = await pixelateImage(file, 256, 40);
      setNewRoomImage(dataUrl);
    } catch {
      // ignore invalid file
    }
  };

  return (
    <div className="screen room-screen">
      <div className="ds-panel room-panel">
        <h1 className="title ds-title-bar">Choose a Chat Room to join.</h1>
        <div className="room-list">
          {rooms.map((room, index) => (
            <button
              key={room.id}
              className={`room-row ${index === selected ? "selected" : ""}`}
              aria-pressed={index === selected}
              onClick={() => setSelected(index)}
            >
              <div className="room-left">
                <div
                  className={`room-tile ${room.image ? "has-image" : ""}`}
                  style={
                    room.image
                      ? { backgroundImage: `url(${room.image})` }
                      : undefined
                  }
                >
                  {!room.image && room.letter}
                </div>
              </div>
              <div className="room-center">
                <div className="room-name">{room.name}</div>
              </div>
              <div className="room-right">
                <div className="room-capacity">
                  <span className="capacity-icon" aria-hidden="true" />
                  {room.count}/{room.capacity}
                </div>
              </div>
              <div className="room-signal">
                <div className="signal-box">
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <span
                      key={idx}
                      className={`signal-bar ${
                        idx < room.signal ? "on" : "off"
                      }`}
                      style={{ height: 6 + idx * 3 }}
                    />
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>
        <div className="room-create">
          <div className="room-create-label">Create new room</div>
          <div className="room-create-row">
            <input
              className="ds-input"
              value={newRoom}
              onChange={(event) => setNewRoom(event.target.value)}
              placeholder="Room name"
              maxLength={24}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleCreate();
                }
              }}
            />
            <button
              className="ds-button primary"
              onClick={handleCreate}
            >
              Create
            </button>
          </div>
          <div className="room-image-row">
            <div
              className={`room-image-preview ${newRoomImage ? "has-image" : ""}`}
              style={
                newRoomImage
                  ? { backgroundImage: `url(${newRoomImage})` }
                  : undefined
              }
            >
              {!newRoomImage && "IMG"}
            </div>
            <div className="room-image-actions">
              <input
                ref={fileRef}
                className="avatar-input"
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void handleRoomImage(file);
                  }
                  event.currentTarget.value = "";
                }}
              />
              <button
                className="ds-button secondary"
                onClick={() => fileRef.current?.click()}
              >
                Upload image
              </button>
              {newRoomImage && (
                <button
                  className="ds-button secondary"
                  onClick={() => setNewRoomImage("")}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          {error && <div className="room-error">{error}</div>}
        </div>
        <div className="bottom-bar">
          <button className="ds-button secondary" onClick={onBack}>
            <span className="button-letter">B</span> Go back
          </button>
          <button
            className="ds-button primary"
            onClick={() => selectedRoom && onJoin(selectedRoom)}
          >
            <span className="button-letter">A</span> Join
          </button>
        </div>
      </div>
    </div>
  );
}

