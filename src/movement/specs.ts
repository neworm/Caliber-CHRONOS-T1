/**
 * Caliber CHRONOS-T1 — 60s Flying Tourbillon
 * Single Source of Truth for mechanical coordinates, gear modules,
 * exact meshing center distances, Z-axis layering, and escapement kinematics.
 *
 * Units: 1 Three.js world unit = 1 mm
 * Movement local coordinate frame:
 *   - XY plane: dial / movement plane (+Y = 12 o'clock, -Y = 6 o'clock, +X = 3 o'clock)
 *   - +Z axis: vertical stack height from Mainplate (Layer 0) up to Bridges & Screws (Layer 3)
 */

export const CALIBER_NAME = 'CHRONOS-T1';
export const CALIBER_SUBTITLE = '60秒飞行陀飞轮';

// Overall movement dimensions (mm)
export const MAINPLATE_RADIUS = 18.5;
export const CASE_RING_OUTER_RADIUS = 19.6;
export const MAINPLATE_THICKNESS = 1.0;

// Unified gear modules (mm)
export const TRAIN_MODULE = 0.22;
export const EPICYCLIC_MODULE = 0.10; // Fixed 4th wheel <-> Escape pinion inside tourbillon

// Z-Axis Layering Contract (strictly prevents vertical interpenetration)
export const Z_LAYERS = {
  // Layer 0 (z = 0): Mainplate
  MAINPLATE: 0.0,
  LOWER_JEWEL: 0.42,

  // Layer 1 (z = 1.2 ~ 2.8): Gear Train
  BARREL_WHEEL: 1.45,        // Barrel Great Wheel <-> Center Pinion
  MAINSPRING_MID: 1.98,      // Coiled mainspring inside openworked barrel
  CENTER_WHEEL: 2.05,        // Center Great Wheel <-> Third Pinion & Aux Wheel
  THIRD_WHEEL: 2.58,         // Third Great Wheel <-> Tourbillon Drive Pinion
  RATCHET_CROWN: 2.60,       // Ratchet Wheel <-> Crown Wheel (top of barrel)

  // Layer 2 (z = 3.2 ~ 4.5): Tourbillon Rotating Cage
  FIXED_FOURTH: 3.04,        // Stationary 4th wheel pedestal beneath cage
  CAGE_LOWER: 3.30,          // Lower 3-arm flying tourbillon carriage
  ESCAPEMENT_PLANE: 3.66,    // 15-tooth Escape Wheel & Swiss Lever Pallet Fork
  BALANCE_WHEEL: 4.08,       // Free-sprung balance wheel with timing screws
  HAIRSPRING: 4.34,          // Breathing Archimedes hairspring
  CAGE_UPPER: 4.50,          // Upper 3-arm tourbillon bridge & shock jewel

  // Layer 3 (z = 5.0 ~ 6.2): Skeletonized Bridges, Jewels & Blued Screws
  BRIDGES_BASE: 5.05,        // Bottom face of upper bridges (extruded +0.62 -> 5.67)
  BRIDGES_TOP: 5.67,
  UPPER_JEWEL: 5.68,
  UPPER_SCREW: 5.74,
} as const;

// Exploded view Z offsets per layer (mm)
export const EXPLODED_Z_OFFSETS = {
  layer0: -4.2,  // Mainplate drops cleanly below
  layer1: 0.0,   // Gear Train holds central reference datum
  layer2: 5.6,   // Flying Tourbillon rises as centerpiece
  layer3: 11.4,  // Upper Bridges, Jewels & Screws float above
} as const;

/**
 * Exact center-to-center meshing distance formula:
 *   d = m * (Z1 + Z2) / 2
 */
export function meshingDistance(z1: number, z2: number, moduleVal = TRAIN_MODULE): number {
  return (moduleVal * (z1 + z2)) / 2;
}

/**
 * Exact pitch radius:
 *   R = m * Z / 2
 */
export function pitchRadius(teeth: number, moduleVal = TRAIN_MODULE): number {
  return (moduleVal * teeth) / 2;
}

/**
 * Computes exact initial rotation angle for Gear 2 (teeth Z2) at (x2, y2)
 * so that its tooth valleys interlock with Gear 1 (teeth Z1) at (x1, y1)
 * with zero tooth interpenetration.
 */
export function computeMeshingPhase(
  x1: number,
  y1: number,
  z1: number,
  theta1: number,
  x2: number,
  y2: number,
  z2: number,
): number {
  const alpha = Math.atan2(y2 - y1, x2 - x1);
  return alpha + Math.PI - Math.PI / z2 + (z1 / z2) * (alpha - theta1);
}

// Tooth counts for the complete kinematic chain
export const TEETH = {
  BARREL_GREAT: 68,
  RATCHET: 52,
  CROWN_WHEEL: 28,
  CENTER_PINION: 12,
  CENTER_GREAT: 56,
  THIRD_PINION: 10,
  THIRD_GREAT: 52,
  AUX_WHEEL: 34,
  TOURBILLON_PINION: 12,
  // Tourbillon epicyclic escapement (exact 72 / 6 = 12 revs per 60s = 360 beats!)
  FIXED_FOURTH: 72,
  ESCAPE_PINION: 6,
  ESCAPE_WHEEL: 15,
} as const;

// Analytically solved XY coordinates satisfying d = m * (Z1 + Z2) / 2
const dBarrelToCenter = meshingDistance(TEETH.BARREL_GREAT, TEETH.CENTER_PINION); // 8.80 mm
const dRatchetToCrown = meshingDistance(TEETH.RATCHET, TEETH.CROWN_WHEEL); // 8.80 mm
const dCenterToThird = meshingDistance(TEETH.CENTER_GREAT, TEETH.THIRD_PINION); // 7.26 mm
const dThirdToTourb = meshingDistance(TEETH.THIRD_GREAT, TEETH.TOURBILLON_PINION); // 7.04 mm
const dCenterToAux = meshingDistance(TEETH.CENTER_GREAT, TEETH.AUX_WHEEL); // 9.90 mm

const TOURB_Y = -8.60;
const THIRD_Y = -(TOURB_Y * TOURB_Y + dCenterToThird * dCenterToThird - dThirdToTourb * dThirdToTourb) / (2 * Math.abs(TOURB_Y));
const THIRD_X = Math.sqrt(Math.max(0, dCenterToThird * dCenterToThird - THIRD_Y * THIRD_Y));

const CROWN_ANGLE = (-25 * Math.PI) / 180;
const CROWN_X = dRatchetToCrown * Math.cos(CROWN_ANGLE);
const CROWN_Y = dBarrelToCenter + dRatchetToCrown * Math.sin(CROWN_ANGLE);

const AUX_ANGLE = (-152 * Math.PI) / 180;
const AUX_X = dCenterToAux * Math.cos(AUX_ANGLE);
const AUX_Y = dCenterToAux * Math.sin(AUX_ANGLE);

export const POSITIONS = {
  BARREL: { x: 0, y: dBarrelToCenter },       // (0.000, +8.800) — 12 o'clock
  CENTER: { x: 0, y: 0 },                     // (0.000,  0.000) — Center
  THIRD: { x: THIRD_X, y: THIRD_Y },          // (+5.711, -4.483) — 4:30
  TOURBILLON: { x: 0, y: TOURB_Y },           // (0.000, -8.600) — 6 o'clock
  CROWN_WHEEL: { x: CROWN_X, y: CROWN_Y },    // (+7.976, +5.081) — 2 o'clock
  AUX_WHEEL: { x: AUX_X, y: AUX_Y },          // (-8.741, -4.648) — 8 o'clock
} as const;

// Tourbillon internal local coordinates (relative to POSITIONS.TOURBILLON)
const dFixed4ToEscPin = meshingDistance(TEETH.FIXED_FOURTH, TEETH.ESCAPE_PINION, EPICYCLIC_MODULE); // 3.90 mm
export const TOURBILLON_SPEC = {
  CAGE_OUTER_RADIUS: 6.65,
  CAGE_PILLAR_RADIUS: 6.18,
  MAINPLATE_APERTURE_RADIUS: 7.15,
  BALANCE_RADIUS: 5.38,
  HAIRSPRING_INNER_R: 0.72,
  HAIRSPRING_OUTER_R: 2.95,
  HAIRSPRING_TURNS: 6.5,
  ESCAPE_LOCAL_POS: { x: dFixed4ToEscPin, y: 0 }, // (3.90, 0)
  ESCAPE_OUTER_RADIUS: 1.92,
  PALLET_PIVOT_LOCAL_POS: { x: 1.98, y: 1.48 },
  PALLET_SWING_DEG: 11.5,
  IMPULSE_ROLLER_RADIUS: 0.62,
} as const;

// Escapement & kinematic constants
export const KINEMATICS = {
  FREQUENCY_HZ: 3.0,          // 3 Hz
  BEATS_PER_SECOND: 6.0,      // 6 half-oscillations/sec
  VPH: 21600,                 // 21,600 vibrations per hour
  TOURBILLON_PERIOD_SEC: 60,  // 1 full revolution per 60 simulated seconds
  NOMINAL_AMPLITUDE_DEG: 270, // Default balance amplitude at full power
  MAX_POWER_RESERVE_H: 72.0,  // 72-hour power reserve
  INITIAL_POWER_RESERVE_H: 58.5,
  WIND_INCREMENT_H: 8.5,      // Power added per manual crown wind click
  // Angular speed ratios relative to Tourbillon Cage (omega_cage = 2*PI / 60 rad/s)
  // Tourbillon Pinion (Z=12) is fixed to cage, driven by Third Great Wheel (Z=52)
  RATIO_THIRD_TO_CAGE: -TEETH.TOURBILLON_PINION / TEETH.THIRD_GREAT,
  // Center Great Wheel (Z=56) drives Third Pinion (Z=10)
  RATIO_CENTER_TO_THIRD: -TEETH.THIRD_PINION / TEETH.CENTER_GREAT,
  // Barrel Great Wheel (Z=68) drives Center Pinion (Z=12)
  RATIO_BARREL_TO_CENTER: -TEETH.CENTER_PINION / TEETH.BARREL_GREAT,
  // Aux Wheel (Z=34) driven by Center Great Wheel (Z=56)
  RATIO_AUX_TO_CENTER: -TEETH.CENTER_GREAT / TEETH.AUX_WHEEL,
  // Crown Wheel (Z=28) drives Ratchet Wheel (Z=52) during winding
  RATIO_CROWN_TO_RATCHET: -TEETH.RATCHET / TEETH.CROWN_WHEEL,
} as const;

// Precomputed exact static base phases (with Tourbillon Cage base = 0)
const PHASE_CAGE_0 = 0;
const PHASE_THIRD_0 = computeMeshingPhase(
  POSITIONS.TOURBILLON.x,
  POSITIONS.TOURBILLON.y,
  TEETH.TOURBILLON_PINION,
  PHASE_CAGE_0,
  POSITIONS.THIRD.x,
  POSITIONS.THIRD.y,
  TEETH.THIRD_GREAT,
);
const PHASE_CENTER_0 = computeMeshingPhase(
  POSITIONS.THIRD.x,
  POSITIONS.THIRD.y,
  TEETH.THIRD_PINION,
  PHASE_THIRD_0,
  POSITIONS.CENTER.x,
  POSITIONS.CENTER.y,
  TEETH.CENTER_GREAT,
);
const PHASE_BARREL_0 = computeMeshingPhase(
  POSITIONS.CENTER.x,
  POSITIONS.CENTER.y,
  TEETH.CENTER_PINION,
  PHASE_CENTER_0,
  POSITIONS.BARREL.x,
  POSITIONS.BARREL.y,
  TEETH.BARREL_GREAT,
);
const PHASE_AUX_0 = computeMeshingPhase(
  POSITIONS.CENTER.x,
  POSITIONS.CENTER.y,
  TEETH.CENTER_GREAT,
  PHASE_CENTER_0,
  POSITIONS.AUX_WHEEL.x,
  POSITIONS.AUX_WHEEL.y,
  TEETH.AUX_WHEEL,
);
const PHASE_RATCHET_0 = 0;
const PHASE_CROWN_0 = computeMeshingPhase(
  POSITIONS.BARREL.x,
  POSITIONS.BARREL.y,
  TEETH.RATCHET,
  PHASE_RATCHET_0,
  POSITIONS.CROWN_WHEEL.x,
  POSITIONS.CROWN_WHEEL.y,
  TEETH.CROWN_WHEEL,
);
const PHASE_FIXED_4TH_0 = 0;
const PHASE_ESCAPE_PINION_0 = computeMeshingPhase(
  0,
  0,
  TEETH.FIXED_FOURTH,
  PHASE_FIXED_4TH_0,
  TOURBILLON_SPEC.ESCAPE_LOCAL_POS.x,
  TOURBILLON_SPEC.ESCAPE_LOCAL_POS.y,
  TEETH.ESCAPE_PINION,
);

export const BASE_PHASES = {
  TOURBILLON_CAGE: PHASE_CAGE_0,
  THIRD: PHASE_THIRD_0,
  CENTER: PHASE_CENTER_0,
  BARREL: PHASE_BARREL_0,
  AUX: PHASE_AUX_0,
  RATCHET: PHASE_RATCHET_0,
  CROWN: PHASE_CROWN_0,
  FIXED_FOURTH: PHASE_FIXED_4TH_0,
  ESCAPE_PINION: PHASE_ESCAPE_PINION_0,
} as const;

// Pivot coordinates for Instanced Ruby Bearings (Layer 0 & Layer 3)
export interface JewelPlacement {
  x: number;
  y: number;
  z: number;
  radius: number;
  layer: 0 | 3;
}

export const JEWEL_PLACEMENTS: JewelPlacement[] = [
  // Layer 3 Upper Bridge Ruby Bearings
  { x: POSITIONS.CENTER.x, y: POSITIONS.CENTER.y, z: Z_LAYERS.UPPER_JEWEL, radius: 1.45, layer: 3 },
  { x: POSITIONS.THIRD.x, y: POSITIONS.THIRD.y, z: Z_LAYERS.UPPER_JEWEL, radius: 1.15, layer: 3 },
  { x: POSITIONS.AUX_WHEEL.x, y: POSITIONS.AUX_WHEEL.y, z: Z_LAYERS.UPPER_JEWEL, radius: 1.15, layer: 3 },
  { x: POSITIONS.BARREL.x, y: POSITIONS.BARREL.y, z: Z_LAYERS.UPPER_JEWEL, radius: 1.65, layer: 3 },
  { x: POSITIONS.CROWN_WHEEL.x, y: POSITIONS.CROWN_WHEEL.y, z: Z_LAYERS.UPPER_JEWEL, radius: 1.10, layer: 3 },
  // Decorative perimeter balance & train jewel chatons on bridges
  { x: -10.2, y: 6.8, z: Z_LAYERS.UPPER_JEWEL, radius: 0.95, layer: 3 },
  { x: 10.2, y: -3.4, z: Z_LAYERS.UPPER_JEWEL, radius: 0.95, layer: 3 },
  // Layer 0 Mainplate Lower Ruby Bearings (visible from caseback & exploded view)
  { x: POSITIONS.CENTER.x, y: POSITIONS.CENTER.y, z: Z_LAYERS.LOWER_JEWEL, radius: 1.35, layer: 0 },
  { x: POSITIONS.THIRD.x, y: POSITIONS.THIRD.y, z: Z_LAYERS.LOWER_JEWEL, radius: 1.05, layer: 0 },
  { x: POSITIONS.AUX_WHEEL.x, y: POSITIONS.AUX_WHEEL.y, z: Z_LAYERS.LOWER_JEWEL, radius: 1.05, layer: 0 },
  { x: POSITIONS.BARREL.x, y: POSITIONS.BARREL.y, z: Z_LAYERS.LOWER_JEWEL, radius: 1.50, layer: 0 },
  { x: POSITIONS.TOURBILLON.x, y: POSITIONS.TOURBILLON.y, z: -0.35, radius: 1.30, layer: 0 },
];

// Coordinates for Instanced Heat-Blued Slotted Screws (Layer 0 & Layer 3)
export interface ScrewPlacement {
  x: number;
  y: number;
  z: number;
  radius: number;
  angle: number;
  layer: 0 | 3;
}

export const SCREW_PLACEMENTS: ScrewPlacement[] = [
  // Barrel Bridge screws (Layer 3)
  { x: -8.6, y: 12.2, z: Z_LAYERS.UPPER_SCREW, radius: 0.95, angle: 0.4, layer: 3 },
  { x: 0.0, y: 15.8, z: Z_LAYERS.UPPER_SCREW, radius: 1.0, angle: 1.2, layer: 3 },
  { x: 8.6, y: 12.2, z: Z_LAYERS.UPPER_SCREW, radius: 0.95, angle: 2.1, layer: 3 },
  { x: 13.5, y: 5.8, z: Z_LAYERS.UPPER_SCREW, radius: 0.9, angle: 0.8, layer: 3 },
  { x: -12.4, y: 7.4, z: Z_LAYERS.UPPER_SCREW, radius: 0.9, angle: 1.9, layer: 3 },
  // Train Wheel Bridge screws (Layer 3)
  { x: -14.2, y: -2.4, z: Z_LAYERS.UPPER_SCREW, radius: 0.95, angle: 0.3, layer: 3 },
  { x: -11.4, y: -9.8, z: Z_LAYERS.UPPER_SCREW, radius: 0.95, angle: 2.5, layer: 3 },
  { x: 13.6, y: -4.6, z: Z_LAYERS.UPPER_SCREW, radius: 0.95, angle: 1.1, layer: 3 },
  { x: 10.6, y: -11.2, z: Z_LAYERS.UPPER_SCREW, radius: 0.95, angle: 0.6, layer: 3 },
  { x: -4.2, y: 1.6, z: Z_LAYERS.UPPER_SCREW, radius: 0.82, angle: 2.8, layer: 3 },
  { x: 4.5, y: 1.2, z: Z_LAYERS.UPPER_SCREW, radius: 0.82, angle: 1.5, layer: 3 },
  // Tourbillon Crescent Bezel Arch screws (Layer 3)
  { x: -8.2, y: -14.5, z: Z_LAYERS.UPPER_SCREW, radius: 0.88, angle: 0.9, layer: 3 },
  { x: 0.0, y: -16.9, z: Z_LAYERS.UPPER_SCREW, radius: 0.92, angle: 0.0, layer: 3 },
  { x: 8.2, y: -14.5, z: Z_LAYERS.UPPER_SCREW, radius: 0.88, angle: 2.2, layer: 3 },
  // Mainplate perimeter casing screws (Layer 0)
  { x: 16.4, y: 0.0, z: 0.54, radius: 0.85, angle: 0.7, layer: 0 },
  { x: -16.4, y: 0.0, z: 0.54, radius: 0.85, angle: 1.8, layer: 0 },
  { x: 11.6, y: 11.6, z: 0.54, radius: 0.85, angle: 2.4, layer: 0 },
  { x: -11.6, y: 11.6, z: 0.54, radius: 0.85, angle: 0.5, layer: 0 },
  { x: 11.6, y: -11.6, z: 0.54, radius: 0.85, angle: 1.3, layer: 0 },
  { x: -11.6, y: -11.6, z: 0.54, radius: 0.85, angle: 2.9, layer: 0 },
];

// Bridge structural pillar positions (connect Layer 0 to Layer 3)
export const PILLAR_PLACEMENTS: Array<{ x: number; y: number }> = [
  { x: -8.6, y: 12.2 },
  { x: 0.0, y: 15.8 },
  { x: 8.6, y: 12.2 },
  { x: 13.5, y: 5.8 },
  { x: -12.4, y: 7.4 },
  { x: -14.2, y: -2.4 },
  { x: -11.4, y: -9.8 },
  { x: 13.6, y: -4.6 },
  { x: 10.6, y: -11.2 },
  { x: -8.2, y: -14.5 },
  { x: 0.0, y: -16.9 },
  { x: 8.2, y: -14.5 },
];

// Visualization & Camera types
export type AssemblyMode = 'assembled' | 'exploded';
export type VisualizationMode = 'standard' | 'xray' | 'cutaway' | 'wireframe';
export type CameraPresetId = 'hero' | 'tourbillon' | 'top' | 'side' | 'caseback';

export interface LayerVisibility {
  bridges: boolean;
  gearTrain: boolean;
  tourbillon: boolean;
  jewelsAndScrews: boolean;
}

export interface CameraPresetConfig {
  id: CameraPresetId;
  label: string;
  shortLabel: string;
  // Coordinates in Three.js world space (where movement local +Z maps to world +Y, local +Y maps to world -Z)
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

/**
 * World-space coordinate mapping:
 * movementRoot.rotation.x = -Math.PI / 2
 *   local (x, y, z) -> world (x, z, -y)
 * So Tourbillon at local (0, -8.60, 3.85) sits at world (0, 3.85, +8.60)!
 * Barrel at local (0, +8.80, 2.0) sits at world (0, 2.0, -8.80)!
 */
export const CAMERA_PRESETS: Record<CameraPresetId, CameraPresetConfig> = {
  hero: {
    id: 'hero',
    label: '主视角 45°',
    shortLabel: '主视角',
    position: [26, 32, 34],
    target: [0, 2.6, 0.5],
    fov: 38,
  },
  tourbillon: {
    id: 'tourbillon',
    label: '陀飞轮微距',
    shortLabel: '陀飞轮',
    position: [5.5, 13.8, 19.5],
    target: [0.4, 3.9, 8.6],
    fov: 34,
  },
  top: {
    id: 'top',
    label: '顶部俯视',
    shortLabel: '俯视',
    position: [0.01, 52, 2.5],
    target: [0, 2.5, 0],
    fov: 38,
  },
  side: {
    id: 'side',
    label: '侧面分层',
    shortLabel: '侧视',
    position: [42, 7.5, 16],
    target: [0, 3.2, 0],
    fov: 36,
  },
  caseback: {
    id: 'caseback',
    label: '表背透视',
    shortLabel: '背面',
    position: [-22, -30, 30],
    target: [0, 1.5, 0],
    fov: 38,
  },
};

export interface TelemetrySnapshot {
  frequencyHz: number;
  vph: number;
  amplitudeDeg: number;
  balanceAngleDeg: number;
  powerReserveHours: number;
  powerReservePct: number;
  tourbillonAzimuthDeg: number;
  beatPhase: number;       // 0..1 within current half-oscillation
  beatImpulse: number;     // 0..1 instantaneous escapement impulse spike for waveform
  beatPolarity: 1 | -1;    // +1 tick, -1 tock
  isRunning: boolean;
}
