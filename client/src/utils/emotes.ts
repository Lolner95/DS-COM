const EMOTES = [":)", ":(", ":D", ";)", "<3"] as const;

type EmoteToken =
  | { type: "text"; value: string }
  | { type: "emote"; value: "emote-smile" | "emote-sad" | "emote-grin" | "emote-wink" | "emote-heart" };

const emoteClass: Record<(typeof EMOTES)[number], EmoteToken["value"]> = {
  ":)": "emote-smile",
  ":(": "emote-sad",
  ":D": "emote-grin",
  ";)": "emote-wink",
  "<3": "emote-heart"
};

const pattern = /(:\)|:\(|:D|;\)|<3)/g;

export const tokenizeEmotes = (text: string): EmoteToken[] => {
  const parts = text.split(pattern);
  return parts
    .filter((part) => part.length > 0)
    .map((part) =>
      EMOTES.includes(part as (typeof EMOTES)[number])
        ? { type: "emote", value: emoteClass[part as (typeof EMOTES)[number]] }
        : { type: "text", value: part }
    );
};

