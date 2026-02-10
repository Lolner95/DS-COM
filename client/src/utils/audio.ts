type Tone = {
  freq: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
};

const makeTone = (
  ctx: AudioContext,
  { freq, duration, type = "sine", gain = 0.08 }: Tone
) => {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  amp.gain.value = gain;
  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
};

export const createAudioController = () => {
  let ctx: AudioContext | null = null;
  let muted = false;

  const ensure = () => {
    if (muted) return null;
    if (!ctx) {
      ctx = new AudioContext();
    }
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    return ctx;
  };

  return {
    unlock() {
      const current = ensure();
      if (!current) return;
      const buffer = current.createBuffer(1, 1, current.sampleRate);
      const source = current.createBufferSource();
      source.buffer = buffer;
      source.connect(current.destination);
      source.start(0);
    },
    setMuted(value: boolean) {
      muted = value;
    },
    playClick() {
      const current = ensure();
      if (!current) return;
      makeTone(current, { freq: 420, duration: 0.06, type: "square", gain: 0.05 });
    },
    playPing() {
      const current = ensure();
      if (!current) return;
      makeTone(current, { freq: 860, duration: 0.08, type: "triangle", gain: 0.06 });
    },
    playNudge() {
      const current = ensure();
      if (!current) return;
      makeTone(current, { freq: 140, duration: 0.12, type: "sawtooth", gain: 0.08 });
    }
  };
};

