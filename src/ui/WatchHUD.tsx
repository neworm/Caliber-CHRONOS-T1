import {
  Camera,
  Eye,
  EyeOff,
  Layers,
  Pause,
  Play,
  RotateCw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  AssemblyMode,
  CALIBER_NAME,
  CALIBER_SUBTITLE,
  CAMERA_PRESETS,
  CameraPresetId,
  KINEMATICS,
  LayerVisibility,
  TelemetrySnapshot,
  VisualizationMode,
} from '../movement/specs';
import { BeatWaveform } from './BeatWaveform';

export interface WatchHUDProps {
  hudVisible: boolean;
  onToggleHud: () => void;
  audioEnabled: boolean;
  onToggleAudio: () => void;
  isRunning: boolean;
  onToggleRunning: () => void;
  assemblyMode: AssemblyMode;
  onAssemblyModeChange: (mode: AssemblyMode) => void;
  visualMode: VisualizationMode;
  onVisualModeChange: (mode: VisualizationMode) => void;
  cutawayPos: number;
  onCutawayPosChange: (pos: number) => void;
  activeCamera: CameraPresetId;
  onCameraPresetChange: (preset: CameraPresetId) => void;
  timeScale: number;
  onTimeScaleChange: (scale: number) => void;
  layerVisibility: LayerVisibility;
  onToggleLayer: (key: keyof LayerVisibility) => void;
  onWindCrown: () => void;
  telemetry: TelemetrySnapshot;
}

const CAMERA_ORDER: CameraPresetId[] = ['hero', 'tourbillon', 'top', 'side', 'caseback'];
const VISUAL_MODES: Array<{ id: VisualizationMode; label: string }> = [
  { id: 'standard', label: '标准材质' },
  { id: 'xray', label: 'X-Ray 透视' },
  { id: 'cutaway', label: '实时剖切' },
  { id: 'wireframe', label: '线框拓扑' },
];
const SPEED_PRESETS = [0.05, 0.25, 1.0, 3.0];

export function WatchHUD({
  hudVisible,
  onToggleHud,
  audioEnabled,
  onToggleAudio,
  isRunning,
  onToggleRunning,
  assemblyMode,
  onAssemblyModeChange,
  visualMode,
  onVisualModeChange,
  cutawayPos,
  onCutawayPosChange,
  activeCamera,
  onCameraPresetChange,
  timeScale,
  onTimeScaleChange,
  layerVisibility,
  onToggleLayer,
  onWindCrown,
  telemetry,
}: WatchHUDProps) {
  const azimuthRad = ((telemetry.tourbillonAzimuthDeg - 90) * Math.PI) / 180;
  const handX = 20 + Math.cos(azimuthRad) * 14;
  const handY = 20 + Math.sin(azimuthRad) * 14;

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-4">
      {/* ================================================================= */}
      {/* 顶部栏：机芯标识与音效/界面开关                                    */}
      {/* ================================================================= */}
      <header className="flex items-start justify-between gap-4">
        <div className="pointer-events-auto px-3.5 py-2 rounded-lg bg-[#0c0d12]/88 border border-white/[0.08]">
          <div className="flex items-baseline gap-2.5">
            <h1 className="font-display text-xl font-semibold tracking-wider text-[#f2ece1] whitespace-nowrap">
              {CALIBER_NAME}
            </h1>
            <span className="text-xs text-[#a7a49c] whitespace-nowrap">
              {CALIBER_SUBTITLE}
            </span>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleAudio}
            aria-label={audioEnabled ? '关闭机械擒纵音效' : '开启机械擒纵音效'}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              audioEnabled
                ? 'bg-[#d8b272]/18 border-[#d8b272]/45 text-[#f0d59f]'
                : 'bg-[#0c0d12]/88 border-white/[0.08] text-[#b4b8c2] hover:text-white hover:border-white/20'
            }`}
          >
            {audioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{audioEnabled ? '擒纵音效' : '静音'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleHud}
            aria-label={hudVisible ? '隐藏仪表盘界面' : '显示仪表盘界面'}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-[#0c0d12]/88 border border-white/[0.08] text-[#b4b8c2] hover:text-white hover:border-white/20 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {hudVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{hudVisible ? '隐藏界面' : '显示界面'}</span>
          </button>
        </div>
      </header>

      {/* ================================================================= */}
      {/* 两侧纤细控制栏（保留中央 70%+ 无遮挡视野）                          */}
      {/* ================================================================= */}
      {hudVisible && (
        <div className="flex-1 flex items-center justify-between my-3 min-h-0">
          {/* 左侧栏：模式、可视化、机位 */}
          <aside className="pointer-events-auto w-[216px] rounded-xl bg-[#0c0d12]/90 border border-white/[0.09] p-3.5 flex flex-col gap-3.5 max-h-full overflow-y-auto">
            {/* 运行模式 */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium tracking-wider text-[#9297a3]">
                  装配与运行
                </span>
                <span className="text-[10px] text-[#7a808d]">
                  {isRunning ? '运行中' : '已暂停'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                <button
                  type="button"
                  onClick={() => onAssemblyModeChange('assembled')}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                    assemblyMode === 'assembled'
                      ? 'bg-[#e6e8ee] text-[#0c0d12] border-[#e6e8ee]'
                      : 'bg-white/[0.03] text-[#c2c6d0] border-white/[0.08] hover:border-white/20'
                  }`}
                >
                  组装视图
                </button>
                <button
                  type="button"
                  onClick={() => onAssemblyModeChange('exploded')}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                    assemblyMode === 'exploded'
                      ? 'bg-[#d8b272] text-[#0c0d12] border-[#d8b272]'
                      : 'bg-white/[0.03] text-[#c2c6d0] border-white/[0.08] hover:border-white/20'
                  }`}
                >
                  分层爆炸
                </button>
              </div>
              <button
                type="button"
                onClick={onToggleRunning}
                className={`w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                  isRunning
                    ? 'bg-white/[0.04] text-[#dce0e8] border-white/[0.1] hover:border-white/25'
                    : 'bg-[#d8b272]/20 text-[#f2d69f] border-[#d8b272]/50'
                }`}
              >
                {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isRunning ? '暂停机芯' : '启动机芯'}</span>
              </button>
            </section>

            <div className="h-px bg-white/[0.07]" />

            {/* 视图模式 */}
            <section>
              <div className="text-[11px] font-medium tracking-wider text-[#9297a3] mb-2">
                可视化透视
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {VISUAL_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onVisualModeChange(m.id)}
                    className={`px-2 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                      visualMode === m.id
                        ? 'bg-[#2c4e7a]/55 text-[#d7ebff] border-[#66a8e8]/60'
                        : 'bg-white/[0.03] text-[#b9bec9] border-white/[0.08] hover:border-white/20'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              {visualMode === 'cutaway' && (
                <div className="mt-2.5 pt-2 border-t border-white/[0.07]">
                  <div className="flex items-center justify-between text-[11px] text-[#9ea3b0] mb-1">
                    <span>剖切平面</span>
                    <span className="font-mono-num">{(cutawayPos * 18).toFixed(1)} mm</span>
                  </div>
                  <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.02}
                    value={cutawayPos}
                    onChange={(e) => onCutawayPosChange(parseFloat(e.target.value))}
                    aria-label="剖切平面位置"
                    className="horology-slider w-full"
                  />
                </div>
              )}
            </section>

            <div className="h-px bg-white/[0.07]" />

            {/* 机位预设 */}
            <section>
              <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider text-[#9297a3] mb-2">
                <Camera className="w-3 h-3" />
                <span>预设机位</span>
              </div>
              <div className="flex flex-col gap-1">
                {CAMERA_ORDER.map((id) => {
                  const preset = CAMERA_PRESETS[id];
                  const isActive = activeCamera === id;
                  const isMacro = id === 'tourbillon';
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onCameraPresetChange(id)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors flex items-center justify-between cursor-pointer whitespace-nowrap ${
                        isActive
                          ? isMacro
                            ? 'bg-[#d8b272]/24 text-[#f5dba6] border-[#d8b272]/60'
                            : 'bg-white/[0.12] text-white border-white/25'
                          : isMacro
                            ? 'bg-[#d8b272]/[0.07] text-[#e5c88e] border-[#d8b272]/25 hover:border-[#d8b272]/50'
                            : 'bg-transparent text-[#b4b9c4] border-transparent hover:bg-white/[0.04] hover:text-white'
                      }`}
                    >
                      <span>{preset.label}</span>
                      {isMacro && (
                        <span className="font-mono-num text-[10px] text-[#d8b272]">60s</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          </aside>

          {/* 右侧栏：实时制表遥测仪表 */}
          <aside className="pointer-events-auto w-[228px] rounded-xl bg-[#0c0d12]/90 border border-white/[0.09] p-3.5 flex flex-col gap-3 max-h-full overflow-y-auto">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-medium tracking-wider text-[#9297a3]">
                机芯遥测
              </span>
              <span className="font-mono-num text-[10px] text-[#d8b272]">
                {timeScale.toFixed(2)}× 倍速
              </span>
            </div>

            {/* 振频 */}
            <div className="flex items-baseline justify-between pb-2.5 border-b border-white/[0.07]">
              <div>
                <div className="text-[11px] text-[#8d929e]">振频</div>
                <div className="font-mono-num text-base font-semibold text-[#f2ece1] mt-0.5">
                  {telemetry.vph.toLocaleString()}{' '}
                  <span className="text-[11px] font-normal text-[#9ea3b0]">vph</span>
                </div>
              </div>
              <div className="font-mono-num text-xs text-[#c8cdd8]">
                {telemetry.frequencyHz.toFixed(2)} Hz
              </div>
            </div>

            {/* 摆轮摆幅 */}
            <div className="pb-2.5 border-b border-white/[0.07]">
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-[11px] text-[#8d929e]">摆轮摆幅</span>
                <span className="font-mono-num text-sm font-semibold text-[#f2ece1]">
                  {telemetry.amplitudeDeg.toFixed(1)}°
                </span>
              </div>
              {/* 双向实时摆角指示条 */}
              <div className="relative h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/30" />
                <div
                  className="absolute top-0 bottom-0 bg-[#9ec5f0] transition-none"
                  style={{
                    left:
                      telemetry.balanceAngleDeg >= 0
                        ? '50%'
                        : `${50 + (telemetry.balanceAngleDeg / 270) * 50}%`,
                    width: `${(Math.abs(telemetry.balanceAngleDeg) / 270) * 50}%`,
                  }}
                />
              </div>
            </div>

            {/* 动力储备 */}
            <div className="pb-2.5 border-b border-white/[0.07]">
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-[11px] text-[#8d929e]">动力储备</span>
                <span className="font-mono-num text-xs text-[#f2ece1]">
                  {telemetry.powerReserveHours.toFixed(1)} / {KINEMATICS.MAX_POWER_RESERVE_H.toFixed(0)} h
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width] duration-150"
                  style={{
                    width: `${Math.max(0, Math.min(100, telemetry.powerReservePct * 100))}%`,
                    backgroundColor:
                      telemetry.powerReservePct < 0.2 ? '#e0526c' : '#d8b272',
                  }}
                />
              </div>
            </div>

            {/* 陀飞轮方位角 */}
            <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.07]">
              <div>
                <div className="text-[11px] text-[#8d929e]">陀飞轮方位角</div>
                <div className="font-mono-num text-sm font-semibold text-[#f2ece1] mt-0.5">
                  {telemetry.tourbillonAzimuthDeg.toFixed(1).padStart(5, '0')}°
                </div>
                <div className="font-mono-num text-[10px] text-[#8d929e]">
                  {((telemetry.tourbillonAzimuthDeg / 360) * 60).toFixed(1)}s / 60s
                </div>
              </div>
              {/* 60秒陀飞轮方位罗盘 */}
              <svg width="40" height="40" viewBox="0 0 40 40" className="shrink-0">
                <circle
                  cx="20"
                  cy="20"
                  r="17"
                  fill="none"
                  stroke="rgba(255,255,255,0.14)"
                  strokeWidth="1.2"
                />
                <line x1="20" y1="3" x2="20" y2="6" stroke="#d8b272" strokeWidth="1.2" />
                <line x1="37" y1="20" x2="34" y2="20" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                <line x1="20" y1="37" x2="20" y2="34" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                <line x1="3" y1="20" x2="6" y2="20" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                <line
                  x1="20"
                  y1="20"
                  x2={handX}
                  y2={handY}
                  stroke="#d8b272"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <circle cx="20" cy="20" r="2.2" fill="#e04f77" />
              </svg>
            </div>

            {/* 实时滴答波形图 */}
            <div>
              <div className="flex items-center justify-between text-[11px] text-[#8d929e] mb-1.5">
                <span>擒纵节拍波形</span>
                <span className="text-[11px] text-[#c4c8d2]">
                  {telemetry.beatPolarity > 0 ? '滴 · Tick' : '答 · Tock'}
                </span>
              </div>
              <BeatWaveform
                balanceAngleDeg={telemetry.balanceAngleDeg}
                beatImpulse={telemetry.beatImpulse}
                beatPolarity={telemetry.beatPolarity}
                isRunning={telemetry.isRunning}
              />
            </div>
          </aside>
        </div>
      )}

      {/* ================================================================= */}
      {/* 底部控制栏：手动上链 · 时间缩放 · 子系统显隐                        */}
      {/* ================================================================= */}
      {hudVisible && (
        <footer className="flex justify-center">
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-4 px-4 py-2.5 rounded-xl bg-[#0c0d12]/92 border border-white/[0.09] max-w-[min(960px,96vw)]">
            {/* 手动上链按钮 */}
            <button
              type="button"
              onClick={onWindCrown}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#d8b272] hover:bg-[#e5c386] active:scale-[0.98] text-[#0c0d12] text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>手动上链</span>
            </button>

            <div className="hidden sm:block w-px h-6 bg-white/[0.1]" />

            {/* 时间缩放滑块 (0.05x 极慢动作 ～ 5.0x 加速) */}
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] text-[#9ea3b0] whitespace-nowrap">时间缩放</span>
              <input
                type="range"
                min={0.05}
                max={5.0}
                step={0.05}
                value={timeScale}
                onChange={(e) => onTimeScaleChange(parseFloat(e.target.value))}
                aria-label="时间缩放倍率"
                className="horology-slider w-28"
              />
              <span className="font-mono-num text-xs text-[#f2ece1] w-11 text-right">
                {timeScale.toFixed(2)}×
              </span>
              <div className="hidden md:flex items-center gap-1">
                {SPEED_PRESETS.map((sp) => (
                  <button
                    key={sp}
                    type="button"
                    onClick={() => onTimeScaleChange(sp)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono-num border transition-colors cursor-pointer ${
                      Math.abs(timeScale - sp) < 0.02
                        ? 'bg-[#d8b272]/25 text-[#f4d7a0] border-[#d8b272]/50'
                        : 'bg-white/[0.03] text-[#9ea3b0] border-white/[0.08] hover:text-white'
                    }`}
                  >
                    {sp}×
                  </button>
                ))}
              </div>
            </div>

            <div className="hidden sm:block w-px h-6 bg-white/[0.1]" />

            {/* 子系统显隐开关 */}
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#8d929e] mr-0.5 shrink-0" />
              {(
                [
                  ['bridges', '桥板'],
                  ['gearTrain', '传动轮系'],
                  ['tourbillon', '陀飞轮'],
                  ['jewelsAndScrews', '宝石与螺丝'],
                ] as Array<[keyof LayerVisibility, string]>
              ).map(([key, label]) => {
                const active = layerVisibility[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onToggleLayer(key)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-white/[0.1] text-[#eceae4] border-white/20'
                        : 'bg-transparent text-[#6f7480] border-white/[0.06] hover:text-[#b4b8c2]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
