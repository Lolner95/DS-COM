import { useMemo, type CSSProperties } from "react";
import catSrc from "../../../server/src/assets/cat.png?inline";
import dogSrc from "../../../server/src/assets/dog.png?inline";

export const TILE_SIZE = 96;
export const SPEED_A = 220;
export const SPEED_B = 200;
export const CAT_TINT = "#f6e7d7";
export const DOG_TINT = "#d9efe8";
export const CAT_BORDER = "#c3a28e";
export const DOG_BORDER = "#9bbfb7";
export const ICON_TINT_OVERLAY = 0.55;

const buildPatternSvg = (
  tileSize: number,
  catUrl: string,
  dogUrl: string,
  catTint: string,
  dogTint: string,
  catBorder: string,
  dogBorder: string
) => {
  const size = tileSize * 2;
  const frameInset = 2;
  const frameSize = tileSize - frameInset * 2;
  const radius = 2;
  const iconSize = Math.round(tileSize * 0.58);
  const iconOffset = Math.round((tileSize - iconSize) / 2);

  const tile = (
    x: number,
    y: number,
    icon: string,
    tint: string,
    border: string
  ) => {
    const frameX = x + frameInset;
    const frameY = y + frameInset;
    const iconX = x + iconOffset;
    const iconY = y + iconOffset;
    const overlayOpacity = ICON_TINT_OVERLAY;
    return `
      <rect x="${x}" y="${y}" width="${tileSize}" height="${tileSize}"
        rx="${radius}" ry="${radius}" fill="${tint}" opacity="0.85"
        stroke="${border}" stroke-width="2" />
      <rect x="${frameX}" y="${frameY}" width="${frameSize}" height="${frameSize}"
        rx="${radius}" ry="${radius}"
        fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.55)" stroke-width="1" />
      <image href="${icon}" x="${iconX}" y="${iconY}" width="${iconSize}" height="${iconSize}"
        style="image-rendering: pixelated;" />
      <rect x="${iconX}" y="${iconY}" width="${iconSize}" height="${iconSize}"
        fill="${tint}" opacity="${overlayOpacity}" style="mix-blend-mode:multiply;" />
    `;
  };

  const dotSize = 1;
  const dotStep = 4;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"
      viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">
      <defs>
        <pattern id="dots" width="${dotStep}" height="${dotStep}" patternUnits="userSpaceOnUse">
          <rect width="${dotSize}" height="${dotSize}" fill="rgba(0,0,0,0.045)" />
        </pattern>
      </defs>
      <rect width="${size}" height="${size}" fill="#dee3ea" />
      <rect width="${size}" height="${size}" fill="url(#dots)" opacity="0.35" />
      ${tile(0, 0, catUrl, catTint, catBorder)}
      ${tile(tileSize, 0, dogUrl, dogTint, dogBorder)}
      ${tile(0, tileSize, dogUrl, dogTint, dogBorder)}
      ${tile(tileSize, tileSize, catUrl, catTint, catBorder)}
    </svg>
  `;
};

const encodeSvg = (svg: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

export default function DSParallaxBackground() {
  const pattern = useMemo(() => {
    const svg = buildPatternSvg(
      TILE_SIZE,
      catSrc,
      dogSrc,
      CAT_TINT,
      DOG_TINT,
      CAT_BORDER,
      DOG_BORDER
    );
    return encodeSvg(svg);
  }, [
    catSrc,
    dogSrc,
    TILE_SIZE,
    CAT_TINT,
    DOG_TINT,
    CAT_BORDER,
    DOG_BORDER,
    ICON_TINT_OVERLAY
  ]);

  const patternSize = TILE_SIZE * 2;
  const baseStyle: CSSProperties & Record<string, string> = {
    backgroundImage: `url("${pattern}")`,
    backgroundSize: `${patternSize}px ${patternSize}px`,
    "--shift": `${patternSize}px`,
    "--steps": `${patternSize}`
  };
  const layerAStyle = {
    ...baseStyle,
    ["--speed" as string]: `${SPEED_A}s`
  } as CSSProperties & Record<string, string>;

  return (
    <div className="ds-parallax" aria-hidden="true">
      <div className="ds-parallax-layer layer-a" style={layerAStyle} />
    </div>
  );
}
