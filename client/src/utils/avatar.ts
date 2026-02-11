const palette = [
  "#2DB24A",
  "#4A8DFF",
  "#FF9F2D",
  "#D65353",
  "#7C5BFF",
  "#2BB7C6",
  "#7BA23A",
  "#D67AA8"
];

const hashName = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

export const getAvatarColor = (name: string) => {
  const index = hashName(name) % palette.length;
  return palette[index];
};

