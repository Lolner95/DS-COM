import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { defaultRooms, roomDefs, setRooms } from "./rooms.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "../data");
const DB_PATH = path.join(DATA_DIR, "db.json");
let db = {
    rooms: [...defaultRooms],
    profiles: {},
    messages: {}
};
let saveTimer = null;
const scheduleSave = () => {
    if (saveTimer)
        return;
    saveTimer = setTimeout(async () => {
        saveTimer = null;
        try {
            await fs.mkdir(DATA_DIR, { recursive: true });
            await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
        }
        catch {
            // ignore write failures
        }
    }, 200);
};
export const initDb = async () => {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        const raw = await fs.readFile(DB_PATH, "utf-8");
        const parsed = JSON.parse(raw);
        db = {
            rooms: parsed.rooms?.length ? parsed.rooms : [...defaultRooms],
            profiles: parsed.profiles ?? {},
            messages: parsed.messages ?? {}
        };
    }
    catch {
        db = {
            rooms: [...defaultRooms],
            profiles: {},
            messages: {}
        };
    }
    setRooms(db.rooms);
    db.rooms = roomDefs;
};
export const getDb = () => db;
export const saveDb = () => {
    scheduleSave();
};
export const setProfile = (name, avatar) => {
    db.profiles[name] = { avatar };
    scheduleSave();
};
export const getProfile = (name) => db.profiles[name]?.avatar ?? "";
export const appendHistory = (roomId, item) => {
    const history = db.messages[roomId] ?? [];
    const next = [...history, item].slice(-200);
    db.messages[roomId] = next;
    scheduleSave();
};
