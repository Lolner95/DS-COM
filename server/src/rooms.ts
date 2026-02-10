export type RoomDef = {
  id: string;
  name: string;
  letter: string;
  image?: string;
  capacity: number;
};

export const roomDefs: RoomDef[] = [
  { id: "room-a", name: "Chat Room A", letter: "A", capacity: 16 },
  { id: "room-b", name: "Chat Room B", letter: "B", capacity: 16 },
  { id: "room-c", name: "Chat Room C", letter: "C", capacity: 16 },
  { id: "room-d", name: "Chat Room D", letter: "D", capacity: 16 }
];

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

export const getRoomById = (id: string) => roomDefs.find((room) => room.id === id);

export const createRoom = (name: string, image?: string) => {
  const trimmed = name.trim();
  if (!trimmed) return null;
  if (roomDefs.length >= 12) return null;

  const existing = roomDefs.find(
    (room) => room.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (existing) return existing;

  const base = slugify(trimmed) || `room-${roomDefs.length + 1}`;
  let id = `room-${base}`;
  let suffix = 1;
  while (roomDefs.some((room) => room.id === id)) {
    suffix += 1;
    id = `room-${base}-${suffix}`;
  }

  const letter = trimmed[0]?.toUpperCase() ?? "N";
  const newRoom: RoomDef = {
    id,
    name: trimmed,
    letter,
    image,
    capacity: 16
  };
  roomDefs.push(newRoom);
  return newRoom;
};

