import * as THREE from 'three';
import {
  BASE_PHASES,
  CASE_RING_OUTER_RADIUS,
  KINEMATICS,
  POSITIONS,
  TEETH,
  TRAIN_MODULE,
  Z_LAYERS,
  pitchRadius,
} from './specs';
import type { MovementMaterials } from './materials';

export interface GearGeometryOptions {
  teeth: number;
  moduleVal?: number;
  thickness: number;
  boreRadius: number;
  spokes?: number;
  hubRadius?: number;
  rimWidth?: number;
  bevelSize?: number;
  bevelThickness?: number;
  isPinion?: boolean;
}

/**
 * Procedural horological toothed gear generator (involute-approximated trapezoidal profile)
 * with curved skeletonized spoke cutouts, arbor bore, and specular chamfer bevels.
 * Tooth #0 is centered strictly along local +X (angle = 0), valleys at +/- pi/Z.
 */
export function createGearGeometry(opts: GearGeometryOptions): THREE.ExtrudeGeometry {
  const {
    teeth,
    moduleVal = TRAIN_MODULE,
    thickness,
    boreRadius,
    spokes = 0,
    bevelSize = 0.025,
    bevelThickness = 0.025,
    isPinion = false,
  } = opts;

  const rPitch = (moduleVal * teeth) / 2;
  const addendum = isPinion ? moduleVal * 0.85 : moduleVal * 0.92;
  const dedendum = isPinion ? moduleVal * 1.05 : moduleVal * 1.12;
  const rOuter = rPitch + addendum;
  const rRoot = Math.max(boreRadius + 0.16, rPitch - dedendum);

  const shape = new THREE.Shape();
  const pitchAngle = (Math.PI * 2) / teeth;

  // Half-angular widths for clean involute-like tooth flanks with clearance backlash
  const halfRoot = pitchAngle * (isPinion ? 0.29 : 0.30);
  const halfPitch = pitchAngle * (isPinion ? 0.22 : 0.23);
  const halfTip = pitchAngle * (isPinion ? 0.13 : 0.14);

  for (let i = 0; i < teeth; i++) {
    const a = i * pitchAngle;
    const aValleyStart = a - pitchAngle * 0.5;
    const aRootL = a - halfRoot;
    const aPitchL = a - halfPitch;
    const aTipL = a - halfTip;
    const aTipR = a + halfTip;
    const aPitchR = a + halfPitch;
    const aRootR = a + halfRoot;

    const p0x = Math.cos(aValleyStart) * rRoot;
    const p0y = Math.sin(aValleyStart) * rRoot;
    if (i === 0) {
      shape.moveTo(p0x, p0y);
    } else {
      shape.lineTo(p0x, p0y);
    }
    shape.lineTo(Math.cos(aRootL) * rRoot, Math.sin(aRootL) * rRoot);
    shape.lineTo(Math.cos(aPitchL) * rPitch, Math.sin(aPitchL) * rPitch);
    shape.lineTo(Math.cos(aTipL) * rOuter, Math.sin(aTipL) * rOuter);
    shape.lineTo(Math.cos(aTipR) * rOuter, Math.sin(aTipR) * rOuter);
    shape.lineTo(Math.cos(aPitchR) * rPitch, Math.sin(aPitchR) * rPitch);
    shape.lineTo(Math.cos(aRootR) * rRoot, Math.sin(aRootR) * rRoot);
  }
  shape.closePath();

  // Central arbor bore
  if (boreRadius > 0.05) {
    const boreHole = new THREE.Path();
    boreHole.absarc(0, 0, boreRadius, 0, Math.PI * 2, true);
    shape.holes.push(boreHole);
  }

  // Skeletonized curved spoke cutouts for wheels large enough to carry spokes
  const hubR = opts.hubRadius ?? Math.max(boreRadius + 0.55, rRoot * 0.28);
  const rimW = opts.rimWidth ?? Math.max(0.55, rRoot * 0.16);
  const rInnerRim = rRoot - rimW;

  if (spokes >= 3 && rInnerRim - hubR > 0.7) {
    const sector = (Math.PI * 2) / spokes;
    const spokeHalfAngInner = Math.max(0.11, 0.28 / hubR);
    const spokeHalfAngOuter = Math.max(0.065, 0.26 / rInnerRim);

    for (let s = 0; s < spokes; s++) {
      const a0 = s * sector;
      const a1 = (s + 1) * sector;
      const innerStart = a0 + spokeHalfAngInner;
      const innerEnd = a1 - spokeHalfAngInner;
      const outerStart = a0 + spokeHalfAngOuter;
      const outerEnd = a1 - spokeHalfAngOuter;
      if (innerEnd <= innerStart + 0.08 || outerEnd <= outerStart + 0.08) continue;

      const cutout = new THREE.Path();
      const segs = 12;
      cutout.moveTo(Math.cos(outerStart) * rInnerRim, Math.sin(outerStart) * rInnerRim);
      for (let k = 1; k <= segs; k++) {
        const ang = THREE.MathUtils.lerp(outerStart, outerEnd, k / segs);
        cutout.lineTo(Math.cos(ang) * rInnerRim, Math.sin(ang) * rInnerRim);
      }
      cutout.lineTo(Math.cos(innerEnd) * hubR, Math.sin(innerEnd) * hubR);
      for (let k = segs - 1; k >= 0; k--) {
        const ang = THREE.MathUtils.lerp(innerStart, innerEnd, k / segs);
        cutout.lineTo(Math.cos(ang) * hubR, Math.sin(ang) * hubR);
      }
      cutout.closePath();
      shape.holes.push(cutout);
    }
  }

  const extrudeDepth = Math.max(0.05, thickness - bevelThickness * 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: extrudeDepth,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize,
    bevelThickness,
    curveSegments: 12,
  });

  // Center extrusion symmetrically on Z = 0 so local Z placement equals exact mid-plane
  geo.translate(0, 0, -extrudeDepth * 0.5);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Generates an Archimedes spiral TubeGeometry for the Mainspring inside the openworked barrel.
 */
function createMainspringGeometry(
  innerR: number,
  outerR: number,
  turns: number,
  wireRadius: number,
  segments = 240,
): THREE.TubeGeometry {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const theta = t * turns * Math.PI * 2;
    const r = THREE.MathUtils.lerp(innerR, outerR, t);
    pts.push(new THREE.Vector3(Math.cos(theta) * r, Math.sin(theta) * r, 0));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, segments, wireRadius, 8, false);
  // Flatten tube slightly in Z to resemble a flat steel mainspring ribbon
  geo.scale(1, 1, 2.2);
  geo.computeVertexNormals();
  return geo;
}

export interface GearTrainRig {
  group: THREE.Group;
  updateKinematics: (
    tourbillonCageDeltaRad: number,
    windingAngleRad: number,
    powerReservePct: number,
  ) => void;
  dispose: () => void;
}

export function buildGearTrain(materials: MovementMaterials): GearTrainRig {
  const group = new THREE.Group();
  group.name = 'Layer1_GearTrain';

  const geometries: THREE.BufferGeometry[] = [];
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };

  // =========================================================================
  // 1. MAINSPRING BARREL ASSEMBLY (12 o'clock)
  // =========================================================================
  const barrelAssembly = new THREE.Group();
  barrelAssembly.position.set(POSITIONS.BARREL.x, POSITIONS.BARREL.y, 0);
  group.add(barrelAssembly);

  // Rotating Barrel Drum + Great Wheel (Z=68 at z = BARREL_WHEEL)
  const barrelDrumGroup = new THREE.Group();
  barrelAssembly.add(barrelDrumGroup);

  const barrelGreatGeo = trackGeo(
    createGearGeometry({
      teeth: TEETH.BARREL_GREAT,
      thickness: 0.42,
      boreRadius: 1.15,
      spokes: 6,
      hubRadius: 2.1,
      rimWidth: 0.95,
    }),
  );
  const barrelGreatMesh = new THREE.Mesh(barrelGreatGeo, materials.brassGear);
  barrelGreatMesh.position.z = Z_LAYERS.BARREL_WHEEL;
  barrelGreatMesh.castShadow = true;
  barrelGreatMesh.receiveShadow = true;
  barrelDrumGroup.add(barrelGreatMesh);

  // Openworked Barrel Side Wall Ring (lets you inspect the coiled mainspring)
  const barrelWallShape = new THREE.Shape();
  const barrelOuterWallR = pitchRadius(TEETH.BARREL_GREAT) - 0.55;
  barrelWallShape.absarc(0, 0, barrelOuterWallR, 0, Math.PI * 2, false);
  const barrelWallHole = new THREE.Path();
  barrelWallHole.absarc(0, 0, barrelOuterWallR - 0.58, 0, Math.PI * 2, true);
  barrelWallShape.holes.push(barrelWallHole);

  const barrelWallGeo = trackGeo(
    new THREE.ExtrudeGeometry(barrelWallShape, {
      depth: 0.85,
      bevelEnabled: true,
      bevelSize: 0.04,
      bevelThickness: 0.04,
      bevelSegments: 2,
      curveSegments: 48,
    }),
  );
  const barrelWallMesh = new THREE.Mesh(barrelWallGeo, materials.roseGoldGear);
  barrelWallMesh.position.z = Z_LAYERS.BARREL_WHEEL + 0.16;
  barrelWallMesh.castShadow = true;
  barrelWallMesh.receiveShadow = true;
  barrelDrumGroup.add(barrelWallMesh);

  // Coiled Archimedes Mainspring inside the openworked barrel
  const mainspringGeo = trackGeo(
    createMainspringGeometry(1.75, barrelOuterWallR - 0.82, 7.2, 0.11, 220),
  );
  const mainspringMesh = new THREE.Mesh(mainspringGeo, materials.mainspringSteel);
  mainspringMesh.position.z = Z_LAYERS.MAINSPRING_MID;
  mainspringMesh.castShadow = true;
  barrelAssembly.add(mainspringMesh);

  // Barrel Arbor (steel core shaft connecting Layer 0 to Layer 3)
  const barrelArborGeo = trackGeo(new THREE.CylinderGeometry(1.05, 1.05, 5.2, 24));
  barrelArborGeo.rotateX(Math.PI / 2);
  const barrelArborMesh = new THREE.Mesh(barrelArborGeo, materials.polishedSteel);
  barrelArborMesh.position.z = 2.95;
  barrelAssembly.add(barrelArborMesh);

  // Ratchet Wheel (大钢轮, Z=52 at z = RATCHET_CROWN, rotates when winding!)
  const ratchetGroup = new THREE.Group();
  ratchetGroup.position.z = Z_LAYERS.RATCHET_CROWN;
  barrelAssembly.add(ratchetGroup);

  const ratchetGeo = trackGeo(
    createGearGeometry({
      teeth: TEETH.RATCHET,
      thickness: 0.34,
      boreRadius: 1.08,
      spokes: 5,
      hubRadius: 2.0,
      rimWidth: 0.85,
    }),
  );
  const ratchetMesh = new THREE.Mesh(ratchetGeo, materials.polishedSteel);
  ratchetMesh.castShadow = true;
  ratchetMesh.receiveShadow = true;
  ratchetGroup.add(ratchetMesh);

  // Ratchet hub cap with blued center screw
  const ratchetCapGeo = trackGeo(new THREE.CylinderGeometry(1.45, 1.6, 0.18, 24));
  ratchetCapGeo.rotateX(Math.PI / 2);
  const ratchetCap = new THREE.Mesh(ratchetCapGeo, materials.heatBluedSteel);
  ratchetCap.position.z = 0.22;
  ratchetGroup.add(ratchetCap);

  // Click Pawl & Blued Click Spring engaging the Ratchet Wheel (upper-left of barrel)
  const clickShape = new THREE.Shape();
  clickShape.moveTo(0, 0);
  clickShape.lineTo(1.8, 0.35);
  clickShape.lineTo(2.3, -0.2);
  clickShape.lineTo(1.2, -0.55);
  clickShape.lineTo(-0.3, -0.35);
  clickShape.closePath();
  const clickGeo = trackGeo(
    new THREE.ExtrudeGeometry(clickShape, {
      depth: 0.26,
      bevelEnabled: true,
      bevelSize: 0.02,
      bevelThickness: 0.02,
    }),
  );
  const clickMesh = new THREE.Mesh(clickGeo, materials.polishedSteel);
  clickMesh.position.set(-5.95, 2.5, Z_LAYERS.RATCHET_CROWN - 0.13);
  clickMesh.rotation.z = -0.58;
  barrelAssembly.add(clickMesh);

  // Curved heat-blued click spring
  const clickSpringCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-6.4, 2.1, Z_LAYERS.RATCHET_CROWN),
    new THREE.Vector3(-7.4, 0.3, Z_LAYERS.RATCHET_CROWN),
    new THREE.Vector3(-6.9, -2.0, Z_LAYERS.RATCHET_CROWN),
  ]);
  const clickSpringGeo = trackGeo(new THREE.TubeGeometry(clickSpringCurve, 28, 0.11, 8, false));
  const clickSpringMesh = new THREE.Mesh(clickSpringGeo, materials.heatBluedSteel);
  barrelAssembly.add(clickSpringMesh);

  // =========================================================================
  // 2. CROWN WHEEL & WINDING STEM + FLUTED CROWN (2~3 o'clock)
  // =========================================================================
  const crownWheelGroup = new THREE.Group();
  crownWheelGroup.position.set(
    POSITIONS.CROWN_WHEEL.x,
    POSITIONS.CROWN_WHEEL.y,
    Z_LAYERS.RATCHET_CROWN,
  );
  group.add(crownWheelGroup);

  const crownWheelGeo = trackGeo(
    createGearGeometry({
      teeth: TEETH.CROWN_WHEEL,
      thickness: 0.34,
      boreRadius: 0.72,
      spokes: 4,
      hubRadius: 1.25,
      rimWidth: 0.55,
    }),
  );
  const crownWheelMesh = new THREE.Mesh(crownWheelGeo, materials.polishedSteel);
  crownWheelMesh.castShadow = true;
  crownWheelMesh.receiveShadow = true;
  crownWheelGroup.add(crownWheelMesh);

  const crownArborGeo = trackGeo(new THREE.CylinderGeometry(0.68, 0.68, 4.8, 16));
  crownArborGeo.rotateX(Math.PI / 2);
  const crownArbor = new THREE.Mesh(crownArborGeo, materials.darkSteel);
  crownArbor.position.z = 0.3;
  crownWheelGroup.add(crownArbor);

  // Winding Stem & Knurled Fluted Crown extending radially past case edge
  const windingStemGroup = new THREE.Group();
  windingStemGroup.position.set(
    POSITIONS.CROWN_WHEEL.x + 2.8,
    POSITIONS.CROWN_WHEEL.y,
    Z_LAYERS.RATCHET_CROWN,
  );
  group.add(windingStemGroup);

  const stemLength = CASE_RING_OUTER_RADIUS - (POSITIONS.CROWN_WHEEL.x + 2.8) + 2.4;
  const stemGeo = trackGeo(new THREE.CylinderGeometry(0.42, 0.42, stemLength, 16));
  stemGeo.rotateZ(Math.PI / 2);
  const stemMesh = new THREE.Mesh(stemGeo, materials.polishedSteel);
  stemMesh.position.x = stemLength * 0.5;
  windingStemGroup.add(stemMesh);

  // Sliding bevel clutch collar
  const clutchGeo = trackGeo(new THREE.CylinderGeometry(0.92, 0.78, 1.35, 16));
  clutchGeo.rotateZ(Math.PI / 2);
  const clutchMesh = new THREE.Mesh(clutchGeo, materials.darkSteel);
  clutchMesh.position.x = 1.6;
  windingStemGroup.add(clutchMesh);

  // Fluted Exterior Winding Crown (gear-like fluted knurling)
  const flutedCrownGeo = trackGeo(
    createGearGeometry({
      teeth: 24,
      moduleVal: 0.19,
      thickness: 2.0,
      boreRadius: 0.35,
      bevelSize: 0.08,
      bevelThickness: 0.08,
    }),
  );
  flutedCrownGeo.rotateY(Math.PI / 2);
  const flutedCrownMesh = new THREE.Mesh(flutedCrownGeo, materials.roseGoldGear);
  flutedCrownMesh.position.x = stemLength + 0.9;
  flutedCrownMesh.castShadow = true;
  windingStemGroup.add(flutedCrownMesh);

  // Crown end cap medallion
  const crownCapGeo = trackGeo(new THREE.CylinderGeometry(1.75, 2.05, 0.32, 24));
  crownCapGeo.rotateZ(Math.PI / 2);
  const crownCapMesh = new THREE.Mesh(crownCapGeo, materials.roseGoldGear);
  crownCapMesh.position.x = stemLength + 2.0;
  windingStemGroup.add(crownCapMesh);

  // =========================================================================
  // 3. CENTER WHEEL & PINION (Origin 0, 0)
  // =========================================================================
  const centerGroup = new THREE.Group();
  centerGroup.position.set(POSITIONS.CENTER.x, POSITIONS.CENTER.y, 0);
  group.add(centerGroup);

  // Center Pinion (Z=12 at z = BARREL_WHEEL, meshes directly with Barrel Great Wheel)
  const centerPinionGeo = trackGeo(
    createGearGeometry({
      teeth: TEETH.CENTER_PINION,
      thickness: 0.44,
      boreRadius: 0.48,
      isPinion: true,
    }),
  );
  const centerPinionMesh = new THREE.Mesh(centerPinionGeo, materials.polishedSteel);
  centerPinionMesh.position.z = Z_LAYERS.BARREL_WHEEL;
  centerPinionMesh.castShadow = true;
  centerGroup.add(centerPinionMesh);

  // Center Great Wheel (Z=56 at z = CENTER_WHEEL)
  const centerGreatGeo = trackGeo(
    createGearGeometry({
      teeth: TEETH.CENTER_GREAT,
      thickness: 0.36,
      boreRadius: 0.52,
      spokes: 5,
      hubRadius: 1.55,
      rimWidth: 0.8,
    }),
  );
  const centerGreatMesh = new THREE.Mesh(centerGreatGeo, materials.brassGear);
  centerGreatMesh.position.z = Z_LAYERS.CENTER_WHEEL;
  centerGreatMesh.castShadow = true;
  centerGreatMesh.receiveShadow = true;
  centerGroup.add(centerGreatMesh);

  // Center Cannon Arbor connecting mainplate to upper bridge ruby
  const centerArborGeo = trackGeo(new THREE.CylinderGeometry(0.5, 0.5, 5.4, 20));
  centerArborGeo.rotateX(Math.PI / 2);
  const centerArborMesh = new THREE.Mesh(centerArborGeo, materials.polishedSteel);
  centerArborMesh.position.z = 2.95;
  centerGroup.add(centerArborMesh);

  // =========================================================================
  // 4. THIRD WHEEL & PINION (Lower-Right)
  // =========================================================================
  const thirdGroup = new THREE.Group();
  thirdGroup.position.set(POSITIONS.THIRD.x, POSITIONS.THIRD.y, 0);
  group.add(thirdGroup);

  // Third Pinion (Z=10 at z = CENTER_WHEEL, meshes directly with Center Great Wheel)
  const thirdPinionGeo = trackGeo(
    createGearGeometry({
      teeth: TEETH.THIRD_PINION,
      thickness: 0.4,
      boreRadius: 0.36,
      isPinion: true,
    }),
  );
  const thirdPinionMesh = new THREE.Mesh(thirdPinionGeo, materials.polishedSteel);
  thirdPinionMesh.position.z = Z_LAYERS.CENTER_WHEEL;
  thirdPinionMesh.castShadow = true;
  thirdGroup.add(thirdPinionMesh);

  // Third Great Wheel (Z=52 at z = THIRD_WHEEL, meshes directly with Tourbillon Drive Pinion)
  const thirdGreatGeo = trackGeo(
    createGearGeometry({
      teeth: TEETH.THIRD_GREAT,
      thickness: 0.34,
      boreRadius: 0.4,
      spokes: 5,
      hubRadius: 1.35,
      rimWidth: 0.72,
    }),
  );
  const thirdGreatMesh = new THREE.Mesh(thirdGreatGeo, materials.roseGoldGear);
  thirdGreatMesh.position.z = Z_LAYERS.THIRD_WHEEL;
  thirdGreatMesh.castShadow = true;
  thirdGreatMesh.receiveShadow = true;
  thirdGroup.add(thirdGreatMesh);

  const thirdArborGeo = trackGeo(new THREE.CylinderGeometry(0.38, 0.38, 5.3, 16));
  thirdArborGeo.rotateX(Math.PI / 2);
  const thirdArbor = new THREE.Mesh(thirdArborGeo, materials.polishedSteel);
  thirdArbor.position.z = 2.95;
  thirdGroup.add(thirdArbor);

  // =========================================================================
  // 5. AUXILIARY POWER-RESERVE WHEEL (Lower-Left balance wheel of the train)
  // =========================================================================
  const auxGroup = new THREE.Group();
  auxGroup.position.set(POSITIONS.AUX_WHEEL.x, POSITIONS.AUX_WHEEL.y, 0);
  group.add(auxGroup);

  const auxWheelGeo = trackGeo(
    createGearGeometry({
      teeth: TEETH.AUX_WHEEL,
      thickness: 0.36,
      boreRadius: 0.42,
      spokes: 5,
      hubRadius: 1.15,
      rimWidth: 0.62,
    }),
  );
  const auxWheelMesh = new THREE.Mesh(auxWheelGeo, materials.brassGear);
  auxWheelMesh.position.z = Z_LAYERS.CENTER_WHEEL;
  auxWheelMesh.castShadow = true;
  auxWheelMesh.receiveShadow = true;
  auxGroup.add(auxWheelMesh);

  // Coaxial decorative blued indicator hand / sector star atop aux wheel
  const auxStarGeo = trackGeo(
    createGearGeometry({
      teeth: 12,
      moduleVal: 0.15,
      thickness: 0.22,
      boreRadius: 0.42,
      isPinion: true,
    }),
  );
  const auxStarMesh = new THREE.Mesh(auxStarGeo, materials.heatBluedSteel);
  auxStarMesh.position.z = Z_LAYERS.THIRD_WHEEL;
  auxGroup.add(auxStarMesh);

  const auxArborGeo = trackGeo(new THREE.CylinderGeometry(0.4, 0.4, 5.3, 16));
  auxArborGeo.rotateX(Math.PI / 2);
  const auxArbor = new THREE.Mesh(auxArborGeo, materials.polishedSteel);
  auxArbor.position.z = 2.95;
  auxGroup.add(auxArbor);

  // =========================================================================
  // 6. TOURBILLON DRIVE PINION (Layer 1 interface at 6 o'clock)
  // =========================================================================
  const tourbPinionGroup = new THREE.Group();
  tourbPinionGroup.position.set(POSITIONS.TOURBILLON.x, POSITIONS.TOURBILLON.y, 0);
  group.add(tourbPinionGroup);

  const tourbPinionGeo = trackGeo(
    createGearGeometry({
      teeth: TEETH.TOURBILLON_PINION,
      thickness: 0.4,
      boreRadius: 0.46,
      isPinion: true,
    }),
  );
  const tourbPinionMesh = new THREE.Mesh(tourbPinionGeo, materials.polishedSteel);
  tourbPinionMesh.position.z = Z_LAYERS.THIRD_WHEEL;
  tourbPinionMesh.castShadow = true;
  tourbPinionGroup.add(tourbPinionMesh);

  // Vertical drive quill shaft linking Tourbillon Pinion up to Cage Lower Ring
  const tourbQuillGeo = trackGeo(new THREE.CylinderGeometry(0.46, 0.52, 1.35, 18));
  tourbQuillGeo.rotateX(Math.PI / 2);
  const tourbQuill = new THREE.Mesh(tourbQuillGeo, materials.polishedSteel);
  tourbQuill.position.z = Z_LAYERS.THIRD_WHEEL + 0.35;
  tourbPinionGroup.add(tourbQuill);

  // =========================================================================
  // KINEMATIC UPDATE (Zero GC, Exact Tooth Ratios & Phase Interlock)
  // =========================================================================
  const updateKinematics = (
    tourbillonCageDeltaRad: number,
    windingAngleRad: number,
    powerReservePct: number,
  ) => {
    // 1. Tourbillon Drive Pinion rotates identically with Tourbillon Cage
    const cageAngle = BASE_PHASES.TOURBILLON_CAGE + tourbillonCageDeltaRad;
    tourbPinionGroup.rotation.z = cageAngle;

    // 2. Third Wheel driven by/driving Tourbillon Pinion: omega_3 = -(Z_tourbPin / Z_thirdGreat) * omega_cage
    const thirdDelta = tourbillonCageDeltaRad * KINEMATICS.RATIO_THIRD_TO_CAGE;
    thirdGroup.rotation.z = BASE_PHASES.THIRD + thirdDelta;

    // 3. Center Wheel coupled to Third Pinion: omega_c = -(Z_thirdPin / Z_centerGreat) * omega_3
    const centerDelta = thirdDelta * KINEMATICS.RATIO_CENTER_TO_THIRD;
    centerGroup.rotation.z = BASE_PHASES.CENTER + centerDelta;

    // 4. Barrel Great Wheel coupled to Center Pinion: omega_b = -(Z_centerPin / Z_barrelGreat) * omega_c
    const barrelDelta = centerDelta * KINEMATICS.RATIO_BARREL_TO_CENTER;
    barrelDrumGroup.rotation.z = BASE_PHASES.BARREL + barrelDelta;

    // 5. Aux Power-Reserve Wheel coupled to Center Great Wheel
    const auxDelta = centerDelta * KINEMATICS.RATIO_AUX_TO_CENTER;
    auxGroup.rotation.z = BASE_PHASES.AUX + auxDelta;

    // 6. Ratchet Wheel & Crown Wheel & Fluted Winding Crown spin during manual winding
    const ratchetAngle = BASE_PHASES.RATCHET + windingAngleRad;
    ratchetGroup.rotation.z = ratchetAngle;
    crownWheelGroup.rotation.z =
      BASE_PHASES.CROWN + windingAngleRad * KINEMATICS.RATIO_CROWN_TO_RATCHET;
    windingStemGroup.rotation.x = windingAngleRad * 2.5;
    // Click pawl oscillates over each passing ratchet tooth
    clickMesh.rotation.z = -0.58 + Math.abs(Math.sin(windingAngleRad * TEETH.RATCHET * 0.5)) * 0.11;

    // 7. Mainspring tightens inward smoothly as power reserve increases
    const tightScale = 0.86 + (1.0 - powerReservePct) * 0.14;
    mainspringMesh.scale.set(tightScale, tightScale, 1);
    mainspringMesh.rotation.z = barrelDelta + windingAngleRad * 0.35;
  };

  // Initialize starting interlocking phase at t = 0
  updateKinematics(0, 0, KINEMATICS.INITIAL_POWER_RESERVE_H / KINEMATICS.MAX_POWER_RESERVE_H);

  const dispose = () => {
    geometries.forEach((g) => g.dispose());
  };

  return { group, updateKinematics, dispose };
}
