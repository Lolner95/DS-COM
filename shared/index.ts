export type RoomInfo = {
  id: string;
  name: string;
  letter: string;
  image?: string;
  count: number;
  capacity: number;
  signal: number;
};

export type UserInfo = {
  id: string;
  name: string;
  avatar: string;
  room: string;
};

export type ServerToClientEvent =
  | { type: "room_list"; rooms: RoomInfo[] }
  | { type: "user_list"; users: UserInfo[] }
  | { type: "message"; id: string; user: UserInfo; text: string; ts: number }
  | { type: "typing"; userId: string; isTyping: boolean }
  | { type: "nudge"; fromUser: UserInfo }
  | { type: "system"; text: string; ts: number };

export type ClientToServerEvent =
  | {
      type: "join";
      name: string;
      room: string;
      avatar: string;
      clientKey: string;
    }
  | { type: "message"; text: string }
  | { type: "typing"; isTyping: boolean }
  | { type: "nudge" }
  | { type: "leave" }
  | { type: "update_profile"; avatar: string }
  | { type: "create_room"; name: string; image?: string };

