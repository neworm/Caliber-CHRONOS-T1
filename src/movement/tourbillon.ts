import * as THREE from 'three';
import {
  BASE_PHASES,
  EPICYCLIC_MODULE,
  POSITIONS,
  TEETH,
  TOURBILLON_SPEC,
  Z_LAYERS,
} from './specs';
import { createGearGeometry } from './gears';
import type { MovementMaterials } from './materials';

/**
 * Generates an authentic Swiss 15-tooth Club-Tooth Escape Wheel (擒纵轮) geometry
 * with hooked forward-raked club teeth and hollowed 3-arm spokes.
 */
function createClubToothEscapeWheelGeometry(
  teeth: number,
  outerRadius: number,
  thickness: number,
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const rRoot = outerRadius * 0.68;
  const rRimInner = outerRadius * 0.52;
  const rHub = 0.42;
  const step = (Math.PI * 2) / teeth;

  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    // Asymmetric hooked club-tooth silhouette (forward-raked impulse face + concave back)
    const aBaseBack = a - step * 0.32;
    const aTipBack = a + step * 0.04;
    const aTipFront = a + step * 0.24;
    const aUnderCut = a + step * 0.06;
    const aBaseFront = a + step * 0.36;

    const bx = Math.cos(aBaseBack) * rRoot;
    const by = Math.sin(aBaseBack) * rRoot;
    if (i === 0) shape.moveTo(bx, by);
    else shape.lineTo(bx, by);

    shape.lineTo(Math.cos(aTipBack) * outerRadius, Math.sin(aTipBack) * outerRadius);
    shape.lineTo(Math.cos(aTipFront) * (outerRadius * 0.96), Math.sin(aTipFront) * (outerRadius * 0.96));
    shape.lineTo(Math.cos(aUnderCut) * (rRoot * 1.08), Math.sin(aUnderCut) * (rRoot * 1.08));
    shape.lineTo(Math.cos(aBaseFront) * rRoot, Math.sin(aBaseFront) * rRoot);
  }
  shape.closePath();

  // Central bore
  const bore = new THREE.Path();
  bore.absarc(0, 0, 0.2, 0, Math.PI * 2, true);
  shape.holes.push(bore);

  // 3 skeletonized spoke cutouts
  const spokes = 3;
  const sec = (Math.PI * 2) / spokes;
  for (let s = 0; s < spokes; s++) {
    const a0 = s * sec + 0.24;
    const a1 = (s + 1) * sec - 0.24;
    const hole = new THREE.Path();
    const segs = 10;
    hole.moveTo(Math.cos(a0) * rRimInner, Math.sin(a0) * rRimInner);
    for (let k = 1; k <= segs; k++) {
      const ang = THREE.MathUtils.lerp(a0, a1, k / segs);
      hole.lineTo(Math.cos(ang) * rRimInner, Math.sin(ang) * rRimInner);
    }
    hole.lineTo(Math.cos(a1) * rHub, Math.sin(a1) * rHub);
    for (let k = segs - 1; k >= 0; k--) {
      const ang = THREE.MathUtils.lerp(a0, a1, k / segs);
      hole.lineTo(Math.cos(ang) * rHub, Math.sin(ang) * rHub);
    }
    hole.closePath();
    shape.holes.push(hole);
  }

  const depth = Math.max(0.06, thickness - 0.03);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSize: 0.015,
    bevelThickness: 0.015,
    bevelSegments: 2,
  });
  geo.translate(0, 0, -depth * 0.5);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates the sculpted 3-arm Flying Tourbillon Carriage Ring (upper or lower).
 */
function createTourbillonCageFrameGeometry(
  outerR: number,
  innerR: number,
  hubR: number,
  thickness: number,
  includeOuterRing: boolean,
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();

  if (includeOuterRing) {
    shape.absarc(0, 0, outerR, 0, Math.PI * 2, false);

    // 3 large sweeping skeleton windows leaving 3 tapered lyrical arms
    const spokes = 3;
    const sec = (Math.PI * 2) / spokes;
    for (let s = 0; s < spokes; s++) {
      const a0 = s * sec + 0.14;
      const a1 = (s + 1) * sec - 0.14;
      const hole = new THREE.Path();
      const segs = 18;
      hole.moveTo(Math.cos(a0) * innerR, Math.sin(a0) * innerR);
      for (let k = 1; k <= segs; k++) {
        const ang = THREE.MathUtils.lerp(a0, a1, k / segs);
        hole.lineTo(Math.cos(ang) * innerR, Math.sin(ang) * innerR);
      }
      const hubA1 = a1 - 0.24;
      const hubA0 = a0 + 0.24;
      hole.lineTo(Math.cos(hubA1) * hubR, Math.sin(hubA1) * hubR);
      for (let k = segs - 1; k >= 0; k--) {
        const ang = THREE.MathUtils.lerp(hubA0, hubA1, k / segs);
        hole.lineTo(Math.cos(ang) * hubR, Math.sin(ang) * hubR);
      }
      hole.closePath();
      shape.holes.push(hole);
    }
  } else {
    // Upper minimalist 3-arm flying bridge (leaves balance wheel & hairspring completely visible!)
    const armCount = 3;
    const sec = (Math.PI * 2) / armCount;
    const tipR = TOURBILLON_SPEC.CAGE_PILLAR_RADIUS + 0.45;
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < armCount; i++) {
      const a = i * sec;
      const aL = a - 0.38;
      const aTipL = a - 0.085;
      const aTipR = a + 0.085;
      const aR = a + 0.38;
      pts.push([Math.cos(aL) * hubR, Math.sin(aL) * hubR]);
      pts.push([Math.cos(a - 0.15) * (tipR * 0.55), Math.sin(a - 0.15) * (tipR * 0.55)]);
      pts.push([Math.cos(aTipL) * tipR, Math.sin(aTipL) * tipR]);
      pts.push([Math.cos(a) * (tipR + 0.14), Math.sin(a) * (tipR + 0.14)]);
      pts.push([Math.cos(aTipR) * tipR, Math.sin(aTipR) * tipR]);
      pts.push([Math.cos(a + 0.15) * (tipR * 0.55), Math.sin(a + 0.15) * (tipR * 0.55)]);
      pts.push([Math.cos(aR) * hubR, Math.sin(aR) * hubR]);
    }
    shape.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      shape.lineTo(pts[i][0], pts[i][1]);
    }
    shape.closePath();
  }

  // Central bore for balance jewel chaton
  const bore = new THREE.Path();
  bore.absarc(0, 0, 0.72, 0, Math.PI * 2, true);
  shape.holes.push(bore);

  const depth = Math.max(0.08, thickness - 0.05);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSize: 0.035,
    bevelThickness: 0.025,
    bevelSegments: 2,
    curveSegments: 24,
  });
  geo.translate(0, 0, -depth * 0.5);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates an Archimedes Spiral TubeGeometry for the Balance Hairspring (游丝).
 */
function createHairspringGeometry(): THREE.TubeGeometry {
  const { HAIRSPRING_INNER_R, HAIRSPRING_OUTER_R, HAIRSPRING_TURNS } = TOURBILLON_SPEC;
  const segments = 260;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const theta = t * HAIRSPRING_TURNS * Math.PI * 2;
    const r = THREE.MathUtils.lerp(HAIRSPRING_INNER_R, HAIRSPRING_OUTER_R, t);
    // Subtle Breguet overcoil lift on outer terminal turn
    const zLift = t > 0.88 ? Math.pow((t - 0.88) / 0.12, 2) * 0.12 : 0;
    pts.push(new THREE.Vector3(Math.cos(theta) * r, Math.sin(theta) * r, zLift));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, segments, 0.042, 6, false);
  geo.scale(1, 1, 1.85); // Flat ribbon cross-section
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates the authentic lateral-angle Swiss Lever Pallet Fork body.
 * Local origin (0,0) = pallet pivot.
 * Local +X points directly toward the Escape Wheel center (distance ~2.42 mm).
 * The fork lever arm is angled at -105.6 deg to point directly at the Balance Staff (distance ~2.47 mm).
 */
function createPalletForkBodyGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();

  // Anchor arms straddling the Escape Wheel along +X
  const leverAngle = (-105.6 * Math.PI) / 180;
  const cosL = Math.cos(leverAngle);
  const sinL = Math.sin(leverAngle);
  const perpX = -sinL;
  const perpY = cosL;
  const pt = (along: number, across: number): [number, number] => [
    cosL * along + perpX * across,
    sinL * along + perpY * across,
  ];

  const [h1x, h1y] = pt(1.94, 0.2);
  const [h2x, h2y] = pt(1.66, 0.18);
  const [h3x, h3y] = pt(1.66, 0.07);
  const [n1x, n1y] = pt(0.38, 0.09);
  const [n2x, n2y] = pt(0.38, -0.09);
  const [h4x, h4y] = pt(1.66, -0.07);
  const [h5x, h5y] = pt(1.66, -0.18);
  const [h6x, h6y] = pt(1.94, -0.2);
  const [s1x, s1y] = pt(1.76, -0.06);
  const [s2x, s2y] = pt(1.76, 0.06);

  shape.moveTo(n1x, n1y);
  shape.lineTo(0.2, 0.36);   // Upper anchor arm
  shape.lineTo(1.12, 1.18);
  shape.lineTo(1.26, 0.98);
  shape.lineTo(0.34, 0.14);
  shape.lineTo(0.34, -0.14);
  shape.lineTo(1.26, -0.98); // Lower anchor arm
  shape.lineTo(1.12, -1.18);
  shape.lineTo(0.2, -0.36);
  shape.lineTo(n2x, n2y);
  shape.lineTo(h4x, h4y);
  shape.lineTo(h5x, h5y);
  shape.lineTo(h6x, h6y);
  shape.lineTo(s1x, s1y);
  shape.lineTo(s2x, s2y);
  shape.lineTo(h1x, h1y);
  shape.lineTo(h2x, h2y);
  shape.lineTo(h3x, h3y);
  shape.closePath();

  const bore = new THREE.Path();
  bore.absarc(0, 0, 0.13, 0, Math.PI * 2, true);
  shape.holes.push(bore);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.18,
    bevelEnabled: true,
    bevelSize: 0.012,
    bevelThickness: 0.012,
    bevelSegments: 1,
  });
  geo.translate(0, 0, -0.09);
  geo.computeVertexNormals();
  return geo;
}

export interface TourbillonRig {
  group: THREE.Group;
  updateTourbillon: (
    cageAngleRad: number,
    balanceAngleRad: number,
    palletForkAngleRad: number,
    escapeWheelStepRad: number,
    amplitudeRatio: number,
  ) => void;
  dispose: () => void;
}

export function buildTourbillonAssembly(materials: MovementMaterials): TourbillonRig {
  const group = new THREE.Group();
  group.name = 'Layer2_TourbillonAssembly';
  group.position.set(POSITIONS.TOURBILLON.x, POSITIONS.TOURBILLON.y, 0);

  const geometries: THREE.BufferGeometry[] = [];
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };

  // =========================================================================
  // 1. STATIONARY FIXED FOURTH WHEEL (mounted below cage on mainplate pedestal)
  // =========================================================================
  const fixedFourthGeo = trackGeo(
    createGearGeometry({
      teeth: TEETH.FIXED_FOURTH,
      moduleVal: EPICYCLIC_MODULE,
      thickness: 0.24,
      boreRadius: 0.9,
      spokes: 6,
      hubRadius: 1.55,
      rimWidth: 0.55,
      bevelSize: 0.015,
      bevelThickness: 0.015,
    }),
  );
  const fixedFourthMesh = new THREE.Mesh(fixedFourthGeo, materials.brassGear);
  fixedFourthMesh.position.z = Z_LAYERS.FIXED_FOURTH;
  fixedFourthMesh.rotation.z = BASE_PHASES.FIXED_FOURTH;
  fixedFourthMesh.castShadow = true;
  fixedFourthMesh.receiveShadow = true;
  group.add(fixedFourthMesh);

  // =========================================================================
  // 2. ROTATING 60s FLYING TOURBILLON CARRIAGE (Cage)
  // =========================================================================
  const cageGroup = new THREE.Group();
  cageGroup.name = 'TourbillonCage';
  group.add(cageGroup);

  // Lower 3-arm carriage ring (z = CAGE_LOWER)
  const lowerCageGeo = trackGeo(
    createTourbillonCageFrameGeometry(
      TOURBILLON_SPEC.CAGE_OUTER_RADIUS,
      TOURBILLON_SPEC.CAGE_OUTER_RADIUS - 0.68,
      1.35,
      0.26,
      true,
    ),
  );
  const lowerCageMesh = new THREE.Mesh(lowerCageGeo, materials.polishedSteel);
  lowerCageMesh.position.z = Z_LAYERS.CAGE_LOWER;
  lowerCageMesh.castShadow = true;
  lowerCageMesh.receiveShadow = true;
  cageGroup.add(lowerCageMesh);

  // 3 Vertical Cage Pillars connecting Lower Carriage to Upper Bridge
  const pillarHeight = Z_LAYERS.CAGE_UPPER - Z_LAYERS.CAGE_LOWER;
  const pillarGeo = trackGeo(new THREE.CylinderGeometry(0.24, 0.28, pillarHeight, 16));
  pillarGeo.rotateX(Math.PI / 2);
  const cageScrewGeo = trackGeo(new THREE.CylinderGeometry(0.32, 0.32, 0.14, 16));
  cageScrewGeo.rotateX(Math.PI / 2);

  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3;
    const px = Math.cos(a) * TOURBILLON_SPEC.CAGE_PILLAR_RADIUS;
    const py = Math.sin(a) * TOURBILLON_SPEC.CAGE_PILLAR_RADIUS;

    const pillar = new THREE.Mesh(pillarGeo, materials.polishedSteel);
    pillar.position.set(px, py, (Z_LAYERS.CAGE_LOWER + Z_LAYERS.CAGE_UPPER) * 0.5);
    pillar.castShadow = true;
    cageGroup.add(pillar);

    // Heat-blued cap screw atop each cage pillar
    const screw = new THREE.Mesh(cageScrewGeo, materials.heatBluedSteel);
    screw.position.set(px, py, Z_LAYERS.CAGE_UPPER + 0.14);
    cageGroup.add(screw);
  }

  // Upper 3-arm Skeletonized Carriage Bridge (z = CAGE_UPPER)
  const upperCageGeo = trackGeo(
    createTourbillonCageFrameGeometry(
      TOURBILLON_SPEC.CAGE_OUTER_RADIUS,
      TOURBILLON_SPEC.CAGE_OUTER_RADIUS - 0.7,
      1.32,
      0.24,
      false,
    ),
  );
  const upperCageMesh = new THREE.Mesh(upperCageGeo, materials.polishedSteel);
  upperCageMesh.position.z = Z_LAYERS.CAGE_UPPER;
  upperCageMesh.castShadow = true;
  upperCageMesh.receiveShadow = true;
  cageGroup.add(upperCageMesh);

  // Blued Seconds Pointer Needle integrated on one cage arm (tracks 0–60s azimuth!)
  const pointerGeo = trackGeo(new THREE.ConeGeometry(0.22, 1.35, 6));
  const pointerMesh = new THREE.Mesh(pointerGeo, materials.heatBluedSteel);
  pointerMesh.position.set(TOURBILLON_SPEC.CAGE_OUTER_RADIUS + 0.15, 0, Z_LAYERS.CAGE_UPPER + 0.08);
  pointerMesh.rotation.z = -Math.PI / 2;
  cageGroup.add(pointerMesh);

  // Central Incabloc Shock Protection Assembly atop Upper Cage Bridge
  const shockChatonGeo = trackGeo(new THREE.CylinderGeometry(1.05, 1.15, 0.22, 24));
  shockChatonGeo.rotateX(Math.PI / 2);
  const shockChaton = new THREE.Mesh(shockChatonGeo, materials.goldChaton);
  shockChaton.position.z = Z_LAYERS.CAGE_UPPER + 0.1;
  cageGroup.add(shockChaton);

  const shockRubyGeo = trackGeo(new THREE.CylinderGeometry(0.68, 0.72, 0.28, 24));
  shockRubyGeo.rotateX(Math.PI / 2);
  const shockRuby = new THREE.Mesh(shockRubyGeo, materials.syntheticRuby);
  shockRuby.position.z = Z_LAYERS.CAGE_UPPER + 0.14;
  cageGroup.add(shockRuby);

  // =========================================================================
  // 3. 15-TOOTH CLUB-TOOTH ESCAPE WHEEL & 6-LEAF PINION (inside cage)
  // =========================================================================
  const escapeGroup = new THREE.Group();
  escapeGroup.position.set(
    TOURBILLON_SPEC.ESCAPE_LOCAL_POS.x,
    TOURBILLON_SPEC.ESCAPE_LOCAL_POS.y,
    0,
  );
  cageGroup.add(escapeGroup);

  // 6-leaf Escape Pinion meshing with Stationary Fixed 4th Wheel at z = FIXED_FOURTH
  const escPinionGeo = trackGeo(
    createGearGeometry({
      teeth: TEETH.ESCAPE_PINION,
      moduleVal: EPICYCLIC_MODULE,
      thickness: 0.3,
      boreRadius: 0.12,
      isPinion: true,
      bevelSize: 0.01,
      bevelThickness: 0.01,
    }),
  );
  const escPinionMesh = new THREE.Mesh(escPinionGeo, materials.polishedSteel);
  escPinionMesh.position.z = Z_LAYERS.FIXED_FOURTH;
  escapeGroup.add(escPinionMesh);

  // 15-tooth Club-Tooth Escape Wheel at z = ESCAPEMENT_PLANE
  const escapeWheelGeo = trackGeo(
    createClubToothEscapeWheelGeometry(
      TEETH.ESCAPE_WHEEL,
      TOURBILLON_SPEC.ESCAPE_OUTER_RADIUS,
      0.24,
    ),
  );
  const escapeWheelMesh = new THREE.Mesh(escapeWheelGeo, materials.roseGoldGear);
  escapeWheelMesh.position.z = Z_LAYERS.ESCAPEMENT_PLANE;
  escapeWheelMesh.castShadow = true;
  escapeGroup.add(escapeWheelMesh);

  // Escape Wheel steel arbor & ruby bearing cap
  const escArborGeo = trackGeo(new THREE.CylinderGeometry(0.18, 0.18, 1.35, 12));
  escArborGeo.rotateX(Math.PI / 2);
  const escArbor = new THREE.Mesh(escArborGeo, materials.polishedSteel);
  escArbor.position.z = (Z_LAYERS.FIXED_FOURTH + Z_LAYERS.ESCAPEMENT_PLANE) * 0.5 + 0.25;
  escapeGroup.add(escArbor);

  // =========================================================================
  // 4. SWISS LEVER PALLET FORK WITH 2 SYNTHETIC RUBY PALLET STONES
  // =========================================================================
  const palletAnchorGroup = new THREE.Group();
  palletAnchorGroup.position.set(
    TOURBILLON_SPEC.PALLET_PIVOT_LOCAL_POS.x,
    TOURBILLON_SPEC.PALLET_PIVOT_LOCAL_POS.y,
    Z_LAYERS.ESCAPEMENT_PLANE,
  );
  // Base aim angle from pallet pivot toward escape wheel center
  const basePalletAim = Math.atan2(
    TOURBILLON_SPEC.ESCAPE_LOCAL_POS.y - TOURBILLON_SPEC.PALLET_PIVOT_LOCAL_POS.y,
    TOURBILLON_SPEC.ESCAPE_LOCAL_POS.x - TOURBILLON_SPEC.PALLET_PIVOT_LOCAL_POS.x,
  );
  palletAnchorGroup.rotation.z = basePalletAim;
  cageGroup.add(palletAnchorGroup);

  const palletForkGroup = new THREE.Group();
  palletAnchorGroup.add(palletForkGroup);

  const palletBodyGeo = trackGeo(createPalletForkBodyGeometry());
  const palletBodyMesh = new THREE.Mesh(palletBodyGeo, materials.polishedSteel);
  palletBodyMesh.castShadow = true;
  palletForkGroup.add(palletBodyMesh);

  // Entry & Exit Synthetic Ruby Pallet Stones (红宝石叉瓦)
  const stoneGeo = trackGeo(new THREE.BoxGeometry(0.46, 0.16, 0.22));
  const entryStone = new THREE.Mesh(stoneGeo, materials.syntheticRuby);
  entryStone.position.set(1.22, 1.05, 0);
  entryStone.rotation.z = -0.78;
  palletForkGroup.add(entryStone);

  const exitStone = new THREE.Mesh(stoneGeo, materials.syntheticRuby);
  exitStone.position.set(1.22, -1.05, 0);
  exitStone.rotation.z = 0.78;
  palletForkGroup.add(exitStone);

  // Pallet Pivot Arbor
  const palletArborGeo = trackGeo(new THREE.CylinderGeometry(0.14, 0.14, 0.85, 12));
  palletArborGeo.rotateX(Math.PI / 2);
  const palletArbor = new THREE.Mesh(palletArborGeo, materials.goldChaton);
  palletArbor.position.z = -0.15;
  palletAnchorGroup.add(palletArbor);

  // =========================================================================
  // 5. FREE-SPRUNG BALANCE WHEEL WITH 8 INERTIAL TIMING SCREWS (z = BALANCE_WHEEL)
  // =========================================================================
  const balanceGroup = new THREE.Group();
  balanceGroup.position.z = Z_LAYERS.BALANCE_WHEEL;
  cageGroup.add(balanceGroup);

  // Sculpted beveled golden balance rim with 3 spokes
  const balR = TOURBILLON_SPEC.BALANCE_RADIUS;
  const balShape = new THREE.Shape();
  balShape.absarc(0, 0, balR, 0, Math.PI * 2, false);
  const balRimInner = balR - 0.62;
  const balHubR = 1.05;
  for (let s = 0; s < 3; s++) {
    const a0 = (s * Math.PI * 2) / 3 + 0.11;
    const a1 = ((s + 1) * Math.PI * 2) / 3 - 0.11;
    const hole = new THREE.Path();
    const segs = 16;
    hole.moveTo(Math.cos(a0) * balRimInner, Math.sin(a0) * balRimInner);
    for (let k = 1; k <= segs; k++) {
      const ang = THREE.MathUtils.lerp(a0, a1, k / segs);
      hole.lineTo(Math.cos(ang) * balRimInner, Math.sin(ang) * balRimInner);
    }
    hole.lineTo(Math.cos(a1 - 0.18) * balHubR, Math.sin(a1 - 0.18) * balHubR);
    for (let k = segs - 1; k >= 0; k--) {
      const ang = THREE.MathUtils.lerp(a0 + 0.18, a1 - 0.18, k / segs);
      hole.lineTo(Math.cos(ang) * balHubR, Math.sin(ang) * balHubR);
    }
    hole.closePath();
    balShape.holes.push(hole);
  }
  const balBore = new THREE.Path();
  balBore.absarc(0, 0, 0.38, 0, Math.PI * 2, true);
  balShape.holes.push(balBore);

  const balRimGeo = trackGeo(
    new THREE.ExtrudeGeometry(balShape, {
      depth: 0.28,
      bevelEnabled: true,
      bevelSize: 0.035,
      bevelThickness: 0.035,
      bevelSegments: 2,
      curveSegments: 32,
    }),
  );
  balRimGeo.translate(0, 0, -0.14);
  balRimGeo.computeVertexNormals();
  const balRimMesh = new THREE.Mesh(balRimGeo, materials.brassGear);
  balRimMesh.castShadow = true;
  balRimMesh.receiveShadow = true;
  balanceGroup.add(balRimMesh);

  // 8 Inertial Timing Weight Screws (微调砝码螺丝) radially seated around balance rim
  const weightStemGeo = trackGeo(new THREE.CylinderGeometry(0.11, 0.11, 0.42, 10));
  const weightHeadGeo = trackGeo(new THREE.CylinderGeometry(0.24, 0.21, 0.18, 12));
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI * 2) / 8 + Math.PI / 8;
    const weightGroup = new THREE.Group();
    weightGroup.position.set(Math.cos(a) * (balR + 0.05), Math.sin(a) * (balR + 0.05), 0);
    weightGroup.rotation.z = a - Math.PI / 2;

    const stem = new THREE.Mesh(weightStemGeo, materials.polishedSteel);
    stem.position.y = 0.1;
    weightGroup.add(stem);

    const head = new THREE.Mesh(weightHeadGeo, materials.goldChaton);
    head.position.y = 0.28;
    weightGroup.add(head);

    balanceGroup.add(weightGroup);
  }

  // Central Balance Staff + Impulse Roller Table + Ruby Impulse Jewel (圆盘宝石)
  const balStaffGeo = trackGeo(new THREE.CylinderGeometry(0.32, 0.32, 1.35, 16));
  balStaffGeo.rotateX(Math.PI / 2);
  const balStaff = new THREE.Mesh(balStaffGeo, materials.polishedSteel);
  balStaff.position.z = -0.15;
  balanceGroup.add(balStaff);

  const rollerTableGeo = trackGeo(
    new THREE.CylinderGeometry(
      TOURBILLON_SPEC.IMPULSE_ROLLER_RADIUS,
      TOURBILLON_SPEC.IMPULSE_ROLLER_RADIUS,
      0.16,
      20,
    ),
  );
  rollerTableGeo.rotateX(Math.PI / 2);
  const rollerTable = new THREE.Mesh(rollerTableGeo, materials.polishedSteel);
  rollerTable.position.z = Z_LAYERS.ESCAPEMENT_PLANE - Z_LAYERS.BALANCE_WHEEL;
  balanceGroup.add(rollerTable);

  // Ruby Impulse Pin pointing toward pallet fork horn at zero balance crossing
  const impulsePinGeo = trackGeo(new THREE.CylinderGeometry(0.1, 0.1, 0.26, 10));
  impulsePinGeo.rotateX(Math.PI / 2);
  const impulsePin = new THREE.Mesh(impulsePinGeo, materials.syntheticRuby);
  const impulseAngle = Math.atan2(
    TOURBILLON_SPEC.PALLET_PIVOT_LOCAL_POS.y,
    TOURBILLON_SPEC.PALLET_PIVOT_LOCAL_POS.x,
  );
  impulsePin.position.set(
    Math.cos(impulseAngle) * (TOURBILLON_SPEC.IMPULSE_ROLLER_RADIUS - 0.12),
    Math.sin(impulseAngle) * (TOURBILLON_SPEC.IMPULSE_ROLLER_RADIUS - 0.12),
    Z_LAYERS.ESCAPEMENT_PLANE - Z_LAYERS.BALANCE_WHEEL,
  );
  balanceGroup.add(impulsePin);

  // =========================================================================
  // 6. BREATHING HEAT-BLUED ARCHIMEDES HAIRSPRING (z = HAIRSPRING)
  // =========================================================================
  const hairspringGroup = new THREE.Group();
  hairspringGroup.position.z = Z_LAYERS.HAIRSPRING;
  cageGroup.add(hairspringGroup);

  const hairspringGeo = trackGeo(createHairspringGeometry());
  const hairspringMesh = new THREE.Mesh(hairspringGeo, materials.heatBluedSteel);
  hairspringGroup.add(hairspringMesh);

  // Hairspring Collet (brass ring clamping inner end to balance staff)
  const colletGeo = trackGeo(new THREE.CylinderGeometry(0.76, 0.76, 0.18, 20));
  colletGeo.rotateX(Math.PI / 2);
  const collet = new THREE.Mesh(colletGeo, materials.goldChaton);
  hairspringGroup.add(collet);

  // Hairspring Outer Stud Holder pinned to upper cage arm at hairspring plane
  const studGeo = trackGeo(new THREE.BoxGeometry(0.55, 0.34, 0.28));
  const studMesh = new THREE.Mesh(studGeo, materials.goldChaton);
  const outerEndAngle = TOURBILLON_SPEC.HAIRSPRING_TURNS * Math.PI * 2;
  studMesh.position.set(
    Math.cos(outerEndAngle) * TOURBILLON_SPEC.HAIRSPRING_OUTER_R,
    Math.sin(outerEndAngle) * TOURBILLON_SPEC.HAIRSPRING_OUTER_R,
    0.1,
  );
  hairspringGroup.add(studMesh);

  // =========================================================================
  // REAL-TIME TOURBILLON & ESCAPEMENT KINEMATIC UPDATE
  // =========================================================================
  const updateTourbillon = (
    cageAngleRad: number,
    balanceAngleRad: number,
    palletForkAngleRad: number,
    escapeWheelStepRad: number,
    amplitudeRatio: number,
  ) => {
    // 1. Rotate entire Tourbillon Carriage (60s per full revolution)
    cageGroup.rotation.z = BASE_PHASES.TOURBILLON_CAGE + cageAngleRad;

    // 2. Balance wheel oscillates sinusoidally inside the rotating cage
    balanceGroup.rotation.z = balanceAngleRad;

    // 3. Hairspring breathes radially in/out & twists subtly in exact phase with balance wheel
    // Normalized signed deflection (-1 .. +1)
    const normSwing = Math.sin(balanceAngleRad / Math.max(0.5, amplitudeRatio * 4.71));
    const breathScale = 1.0 + normSwing * 0.085 * amplitudeRatio;
    hairspringMesh.scale.set(breathScale, breathScale, 1.0);
    // Slight angular wind-up of inner coils while outer stud remains anchored
    hairspringMesh.rotation.z = balanceAngleRad * 0.085;

    // 4. Swiss Lever Pallet Fork snaps discretely between banking pins on each beat
    palletForkGroup.rotation.z = palletForkAngleRad;

    // 5. 15-Tooth Escape Wheel steps discretely by half a tooth pitch (12 deg) per beat
    escapeGroup.rotation.z = BASE_PHASES.ESCAPE_PINION + escapeWheelStepRad;
  };

  const dispose = () => {
    geometries.forEach((g) => g.dispose());
  };

  return { group, updateTourbillon, dispose };
}
