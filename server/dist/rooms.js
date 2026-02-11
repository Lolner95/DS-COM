export const defaultRooms = [
    { id: "room-a", name: "Chat Room A", letter: "A", capacity: 128 },
    { id: "room-b", name: "Chat Room B", letter: "B", capacity: 128 },
    { id: "room-c", name: "Chat Room C", letter: "C", capacity: 128 },
    { id: "room-d", name: "Chat Room D", letter: "D", capacity: 128 }
];
export const roomDefs = [...defaultRooms];
export const setRooms = (rooms) => {
    roomDefs.length = 0;
    roomDefs.push(...rooms);
};
const slugify = (value) => value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
export const getRoomById = (id) => roomDefs.find((room) => room.id === id);
export const createRoom = (name, image) => {
    const trimmed = name.trim();
    if (!trimmed)
        return null;
    if (roomDefs.length >= 12)
        return null;
    const existing = roomDefs.find((room) => room.name.toLowerCase() === trimmed.toLowerCase());
    if (existing)
        return existing;
    const base = slugify(trimmed) || `room-${roomDefs.length + 1}`;
    let id = `room-${base}`;
    let suffix = 1;
    while (roomDefs.some((room) => room.id === id)) {
        suffix += 1;
        id = `room-${base}-${suffix}`;
    }
    const letter = trimmed[0]?.toUpperCase() ?? "N";
    const newRoom = {
        id,
        name: trimmed,
        letter,
        image,
        capacity: 128
    };
    roomDefs.push(newRoom);
    return newRoom;
};
