import { useRef, useState } from "react";
import { getAvatarColor } from "../utils/avatar";
import { pixelateImage } from "../utils/pixelate";

type Props = {
  initialName: string;
  initialAvatar: string;
  onSubmit: (name: string) => void;
  onAvatarChange: (avatar: string) => void;
};

const isImageAvatar = (value: string) => value.startsWith("data:image");

export default function NameScreen({
  initialName,
  initialAvatar,
  onSubmit,
  onAvatarChange
}: Props) {
  const [name, setName] = useState(initialName ?? "");
  const [avatar, setAvatar] = useState(initialAvatar ?? "");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = () => {
    const trimmed = name.trim().slice(0, 16);
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  const handleFile = async (file: File) => {
    setError("");
    try {
      const dataUrl = await pixelateImage(file, 256, 40);
      setAvatar(dataUrl);
      onAvatarChange(dataUrl);
    } catch (err) {
      setError("Could not process image. Try another file.");
    }
  };

  const previewAvatar = avatar || (name ? getAvatarColor(name) : "#b5c2d4");
  const previewIsImage = isImageAvatar(previewAvatar);

  return (
    <div className="screen name-screen">
      <div className="ds-panel name-panel">
        <h1 className="title ds-title-bar">Choose your name</h1>
        <div className="avatar-picker">
          <div
            className={`avatar-preview ${previewIsImage ? "has-image" : ""}`}
            style={
              previewIsImage
                ? { backgroundImage: `url(${previewAvatar})` }
                : { backgroundColor: previewAvatar }
            }
          >
            {!previewIsImage && (name.slice(0, 1) || "?").toUpperCase()}
          </div>
          <div className="avatar-controls">
            <input
              ref={fileRef}
              className="avatar-input"
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleFile(file);
                }
                event.currentTarget.value = "";
              }}
            />
            <button
              className="ds-button secondary"
              onClick={() => fileRef.current?.click()}
            >
              Upload avatar
            </button>
            {avatar && (
              <button
                className="ds-button secondary"
                onClick={() => {
                  setAvatar("");
                  onAvatarChange("");
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
        <input
          className="ds-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Display name"
          maxLength={16}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              handleSubmit();
            }
          }}
        />
        <button className="ds-button primary" onClick={handleSubmit}>
          Continue
        </button>
        <p className="hint">Max 16 characters. Avatar saved locally.</p>
        {error && <p className="hint error-text">{error}</p>}
      </div>
    </div>
  );
}

