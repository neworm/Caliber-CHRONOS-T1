/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AssemblyMode,
  CameraPresetId,
  KINEMATICS,
  LayerVisibility,
  TelemetrySnapshot,
  VisualizationMode,
} from './movement/specs';
import { createWatchStudio, WatchStudioAPI } from './scene/WatchStudio';
import { WatchHUD } from './ui/WatchHUD';

const INITIAL_TELEMETRY: TelemetrySnapshot = {
  frequencyHz: KINEMATICS.FREQUENCY_HZ,
  vph: KINEMATICS.VPH,
  amplitudeDeg: KINEMATICS.NOMINAL_AMPLITUDE_DEG,
  balanceAngleDeg: 0,
  powerReserveHours: KINEMATICS.INITIAL_POWER_RESERVE_H,
  powerReservePct: KINEMATICS.INITIAL_POWER_RESERVE_H / KINEMATICS.MAX_POWER_RESERVE_H,
  tourbillonAzimuthDeg: 0,
  beatPhase: 0,
  beatImpulse: 0,
  beatPolarity: 1,
  isRunning: true,
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const studioRef = useRef<WatchStudioAPI | null>(null);

  const [hudVisible, setHudVisible] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [isRunning, setIsRunning] = useState(true);
  const [assemblyMode, setAssemblyMode] = useState<AssemblyMode>('assembled');
  const [visualMode, setVisualMode] = useState<VisualizationMode>('standard');
  const [cutawayPos, setCutawayPos] = useState(0.14);
  const [activeCamera, setActiveCamera] = useState<CameraPresetId>('hero');
  const [timeScale, setTimeScale] = useState(1.0);
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>({
    bridges: true,
    gearTrain: true,
    tourbillon: true,
    jewelsAndScrews: true,
  });
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot>(INITIAL_TELEMETRY);
  const [contextLost, setContextLost] = useState(false);

  // Mount Three.js WebGL Studio strictly once inside isolated ref container
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const studio = createWatchStudio(
      el,
      (snapshot) => setTelemetry(snapshot),
      (lost) => setContextLost(lost),
    );
    studioRef.current = studio;

    return () => {
      studio.dispose();
      studioRef.current = null;
    };
  }, []);

  // Keyboard shortcut 'H' to toggle HUD Zen Mode & Space to pause/run
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'h' || e.key === 'H') {
        setHudVisible((v) => !v);
      } else if (e.code === 'Space') {
        e.preventDefault();
        setIsRunning((prev) => {
          const next = !prev;
          studioRef.current?.setRunning(next);
          return next;
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleToggleAudio = useCallback(() => {
    setAudioEnabled((prev) => {
      const next = !prev;
      studioRef.current?.setAudioEnabled(next);
      return next;
    });
  }, []);

  const handleToggleRunning = useCallback(() => {
    setIsRunning((prev) => {
      const next = !prev;
      studioRef.current?.setRunning(next);
      return next;
    });
  }, []);

  const handleAssemblyModeChange = useCallback((mode: AssemblyMode) => {
    setAssemblyMode(mode);
    studioRef.current?.setAssemblyMode(mode);
  }, []);

  const handleVisualModeChange = useCallback((mode: VisualizationMode) => {
    setVisualMode(mode);
    studioRef.current?.setVisualizationMode(mode);
  }, []);

  const handleCutawayPosChange = useCallback((pos: number) => {
    setCutawayPos(pos);
    studioRef.current?.setCutawayPosition(pos);
  }, []);

  const handleCameraPresetChange = useCallback((preset: CameraPresetId) => {
    setActiveCamera(preset);
    studioRef.current?.setCameraPreset(preset);
  }, []);

  const handleTimeScaleChange = useCallback((scale: number) => {
    setTimeScale(scale);
    studioRef.current?.setTimeScale(scale);
  }, []);

  const handleToggleLayer = useCallback((key: keyof LayerVisibility) => {
    setLayerVisibility((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      studioRef.current?.setLayerVisibility(next);
      return next;
    });
  }, []);

  const handleWindCrown = useCallback(() => {
    studioRef.current?.windCrown();
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#090a0d]">
      {/* Isolated WebGL canvas mount point */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* WebGL 上下文中断降级提示 */}
      {contextLost && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#090a0d]/95 text-center p-6">
          <div className="max-w-sm rounded-xl bg-[#12141c] border border-white/10 p-6">
            <h2 className="font-display text-xl text-[#f2ece1] mb-2">
              WebGL 渲染上下文中断
            </h2>
            <p className="text-xs text-[#9ea3b0] leading-relaxed">
              浏览器暂时挂起了 3D 图形上下文，若画面未自动恢复，请刷新页面重试。
            </p>
          </div>
        </div>
      )}

      {/* Haute Horlogerie HUD Overlay */}
      <WatchHUD
        hudVisible={hudVisible}
        onToggleHud={() => setHudVisible((v) => !v)}
        audioEnabled={audioEnabled}
        onToggleAudio={handleToggleAudio}
        isRunning={isRunning}
        onToggleRunning={handleToggleRunning}
        assemblyMode={assemblyMode}
        onAssemblyModeChange={handleAssemblyModeChange}
        visualMode={visualMode}
        onVisualModeChange={handleVisualModeChange}
        cutawayPos={cutawayPos}
        onCutawayPosChange={handleCutawayPosChange}
        activeCamera={activeCamera}
        onCameraPresetChange={handleCameraPresetChange}
        timeScale={timeScale}
        onTimeScaleChange={handleTimeScaleChange}
        layerVisibility={layerVisibility}
        onToggleLayer={handleToggleLayer}
        onWindCrown={handleWindCrown}
        telemetry={telemetry}
      />
    </main>
  );
}
