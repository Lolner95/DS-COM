const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const quantize = (value: number, step: number) =>
  clamp(Math.round(value / step) * step, 0, 255);

export const pixelateImage = (
  file: File,
  outputSize = 256,
  pixelSize = 40
): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Invalid image"));
      img.onload = () => {
        const sampleCanvas = document.createElement("canvas");
        sampleCanvas.width = pixelSize;
        sampleCanvas.height = pixelSize;
        const sampleCtx = sampleCanvas.getContext("2d");
        if (!sampleCtx) {
          reject(new Error("Canvas not supported"));
          return;
        }

        const side = Math.min(img.width, img.height);
        const sx = Math.floor((img.width - side) / 2);
        const sy = Math.floor((img.height - side) / 2);

        sampleCtx.imageSmoothingEnabled = false;
        sampleCtx.fillStyle = "#d7dce3";
        sampleCtx.fillRect(0, 0, pixelSize, pixelSize);
        sampleCtx.drawImage(img, sx, sy, side, side, 0, 0, pixelSize, pixelSize);

        const imageData = sampleCtx.getImageData(0, 0, pixelSize, pixelSize);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          data[i] = quantize(data[i], 32);
          data[i + 1] = quantize(data[i + 1], 32);
          data[i + 2] = quantize(data[i + 2], 32);
        }
        sampleCtx.putImageData(imageData, 0, 0);

        const outputCanvas = document.createElement("canvas");
        outputCanvas.width = outputSize;
        outputCanvas.height = outputSize;
        const outputCtx = outputCanvas.getContext("2d");
        if (!outputCtx) {
          reject(new Error("Canvas not supported"));
          return;
        }
        outputCtx.imageSmoothingEnabled = false;
        outputCtx.drawImage(sampleCanvas, 0, 0, outputSize, outputSize);

        resolve(outputCanvas.toDataURL("image/png"));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

