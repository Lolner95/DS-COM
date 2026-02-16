type EmoteToken = { type: "text"; value: string };

export const tokenizeEmotes = (text: string): EmoteToken[] => [
  { type: "text", value: text }
];

