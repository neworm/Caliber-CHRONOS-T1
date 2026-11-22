import { useEffect, useRef } from 'react';

interface BeatWaveformProps {
  balanceAngleDeg: number;
  beatImpulse: number;
  beatPolarity: 1 | -1;
  isRunning: boolean;
}

const SAMPLE_COUNT = 96;

export function BeatWaveform({
  balanceAngleDeg,
  beatImpulse,
  beatPolarity,
  isRunning,
}: BeatWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const waveBufferRef = useRef<Float32Array>(new Float32Array(SAMPLE_COUNT));
  const spikeBufferRef = useRef<Float32Array>(new Float32Array(SAMPLE_COUNT));

  useEffect(() => {
    const wave = waveBufferRef.current;
    const spikes = spikeBufferRef.current;

    if (isRunning) {
      wave.copyWithin(0, 1);
      spikes.copyWithin(0, 1);
      wave[SAMPLE_COUNT - 1] = Math.max(-1, Math.min(1, balanceAngleDeg / 270));
      spikes[SAMPLE_COUNT - 1] = beatImpulse * beatPolarity;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = 192;
    const height = 56;
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const midY = height * 0.5;

    // Subtle horological oscilloscope reticle
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(width, midY);
    ctx.stroke();

    for (let x = 32; x < width; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 4);
      ctx.lineTo(x, height - 4);
      ctx.stroke();
    }

    // Balance oscillation sine waveform (cool silver-blue trace)
    ctx.strokeStyle = 'rgba(174, 198, 232, 0.55)';
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const x = (i / (SAMPLE_COUNT - 1)) * width;
      const y = midY - wave[i] * (height * 0.34);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Escapement tick/tock impulse spikes (warm champagne gold & ruby ticks)
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const sp = spikes[i];
      if (Math.abs(sp) > 0.08) {
        const x = (i / (SAMPLE_COUNT - 1)) * width;
        const yEnd = midY - sp * (height * 0.44);
        ctx.strokeStyle = sp > 0 ? '#e3bd6e' : '#e04f77';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x, midY);
        ctx.lineTo(x, yEnd);
        ctx.stroke();
      }
    }

    ctx.restore();
  }, [balanceAngleDeg, beatImpulse, beatPolarity, isRunning]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: 192, height: 56 }}
      className="block w-full h-[56px] rounded bg-[#08090c] border border-white/[0.06]"
    />
  );
}
