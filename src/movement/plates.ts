import * as THREE from 'three';
import {
  CASE_RING_OUTER_RADIUS,
  JEWEL_PLACEMENTS,
  MAINPLATE_RADIUS,
  MAINPLATE_THICKNESS,
  PILLAR_PLACEMENTS,
  POSITIONS,
  SCREW_PLACEMENTS,
  TOURBILLON_SPEC,
  Z_LAYERS,
} from './specs';
import type { MovementMaterials } from './materials';

/**
 * Generates a slotted watchmaker screw head geometry (genuine recessed straight slot!).
 */
function createSlottedScrewGeometry(): THREE.BufferGeometry {
  // Build two half-cylinder domes separated by a crisp recessed screwdriver slot,
  // joined onto a lower cylindrical base collar so the slot catches specular light cleanly.
  const shape = new THREE.Shape();
  shape.absarc(0, 0, 1.0, 0, Math.PI * 2, false);

  // Lower base disc
  const baseGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.24,
    bevelEnabled: true,
    bevelSize: 0.06,
    bevelThickness: 0.05,
    bevelSegments: 2,
    curveSegments: 20,
  });

  // Upper half-head (positive Y side of slot)
  const slotHalf = 0.16;
  const upperHalf = new THREE.Shape();
  const aStart = Math.asin(slotHalf);
  const aEnd = Math.PI - aStart;
  upperHalf.moveTo(Math.cos(aStart), slotHalf);
  upperHalf.absarc(0, 0, 1.0, aStart, aEnd, false);
  upperHalf.lineTo(Math.cos(aStart), slotHalf);

  const lowerHalf = new THREE.Shape();
  const bStart = Math.PI + aStart;
  const bEnd = Math.PI * 2 - aStart;
  lowerHalf.moveTo(Math.cos(bStart), -slotHalf);
  lowerHalf.absarc(0, 0, 1.0, bStart, bEnd, false);
  lowerHalf.lineTo(Math.cos(bStart), -slotHalf);

  const capGeo = new THREE.ExtrudeGeometry([upperHalf, lowerHalf], {
    depth: 0.22,
    bevelEnabled: true,
    bevelSize: 0.07,
    bevelThickness: 0.06,
    bevelSegments: 2,
    curveSegments: 16,
  });
  capGeo.translate(0, 0, 0.24);

  // Merge non-indexed geometries cleanly without extra dependencies
  const g1 = baseGeo.toNonIndexed();
  const g2 = capGeo.toNonIndexed();
  const pos1 = g1.attributes.position.array as Float32Array;
  const pos2 = g2.attributes.position.array as Float32Array;
  const norm1 = g1.attributes.normal.array as Float32Array;
  const norm2 = g2.attributes.normal.array as Float32Array;

  const mergedPos = new Float32Array(pos1.length + pos2.length);
  mergedPos.set(pos1, 0);
  mergedPos.set(pos2, pos1.length);

  const mergedNorm = new Float32Array(norm1.length + norm2.length);
  mergedNorm.set(norm1, 0);
  mergedNorm.set(norm2, norm1.length);

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(mergedPos, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(mergedNorm, 3));
  merged.translate(0, 0, -0.2);
  merged.computeBoundingSphere();

  baseGeo.dispose();
  capGeo.dispose();
  g1.dispose();
  g2.dispose();
  return merged;
}

/**
 * Creates a rounded horological bridge polygon via smooth Catmull-Rom closed loop.
 */
function createSmoothBridgeGeometry(
  controlPoints: Array<[number, number]>,
  holes: Array<{ x: number; y: number; r: number }>,
  thickness: number,
): THREE.ExtrudeGeometry {
  const vecs = controlPoints.map(([x, y]) => new THREE.Vector2(x, y));
  const curve = new THREE.SplineCurve([...vecs, vecs[0]]);
  const sampled = curve.getPoints(96);

  const shape = new THREE.Shape();
  shape.moveTo(sampled[0].x, sampled[0].y);
  for (let i = 1; i < sampled.length; i++) {
    shape.lineTo(sampled[i].x, sampled[i].y);
  }
  shape.closePath();

  for (const h of holes) {
    const p = new THREE.Path();
    p.absarc(h.x, h.y, h.r, 0, Math.PI * 2, true);
    shape.holes.push(p);
  }

  const bevelT = 0.08;
  const depth = Math.max(0.1, thickness - bevelT * 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSize: 0.14,
    bevelThickness: bevelT,
    bevelSegments: 3,
    curveSegments: 24,
  });
  // Shift by +bevelT so geometry spans exactly [0, thickness] along local Z
  geo.translate(0, 0, bevelT);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

export interface PlatesAndHardwareRig {
  mainplateGroup: THREE.Group;    // Layer 0
  bridgesGroup: THREE.Group;      // Layer 3
  jewelsAndScrewsLayer0: THREE.Group;
  jewelsAndScrewsLayer3: THREE.Group;
  xraySwappablePlates: Array<{ mesh: THREE.Mesh; standardMat: THREE.Material; xrayMat: THREE.Material }>;
  dispose: () => void;
}

export function buildPlatesBridgesAndHardware(
  materials: MovementMaterials,
): PlatesAndHardwareRig {
  const mainplateGroup = new THREE.Group();
  mainplateGroup.name = 'Layer0_Mainplate';

  const bridgesGroup = new THREE.Group();
  bridgesGroup.name = 'Layer3_UpperBridges';

  const jewelsAndScrewsLayer0 = new THREE.Group();
  jewelsAndScrewsLayer0.name = 'Layer0_JewelsAndScrews';
  mainplateGroup.add(jewelsAndScrewsLayer0);

  const jewelsAndScrewsLayer3 = new THREE.Group();
  jewelsAndScrewsLayer3.name = 'Layer3_JewelsAndScrews';
  bridgesGroup.add(jewelsAndScrewsLayer3);

  const xraySwappablePlates: Array<{
    mesh: THREE.Mesh;
    standardMat: THREE.Material;
    xrayMat: THREE.Material;
  }> = [];

  const geometries: THREE.BufferGeometry[] = [];
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };

  // =========================================================================
  // LAYER 0: OPENWORKED MAINPLATE WITH TOURBILLON APERTURE & BEZEL RING
  // =========================================================================
  const plateShape = new THREE.Shape();
  plateShape.absarc(0, 0, MAINPLATE_RADIUS, 0, Math.PI * 2, false);

  // Large circular openworked aperture directly beneath the Flying Tourbillon (6 o'clock)
  const tourbAperture = new THREE.Path();
  tourbAperture.absarc(
    POSITIONS.TOURBILLON.x,
    POSITIONS.TOURBILLON.y,
    TOURBILLON_SPEC.MAINPLATE_APERTURE_RADIUS,
    0,
    Math.PI * 2,
    true,
  );
  plateShape.holes.push(tourbAperture);

  // Openworked architectural inspection windows beneath the upper-left & upper-right quadrants
  const leftWindow = new THREE.Path();
  leftWindow.absarc(-10.5, 4.2, 3.1, 0, Math.PI * 2, true);
  plateShape.holes.push(leftWindow);

  const rightWindow = new THREE.Path();
  rightWindow.absarc(10.6, -0.5, 2.7, 0, Math.PI * 2, true);
  plateShape.holes.push(rightWindow);

  const mainplateGeo = trackGeo(
    new THREE.ExtrudeGeometry(plateShape, {
      depth: MAINPLATE_THICKNESS - 0.16,
      bevelEnabled: true,
      bevelSize: 0.14,
      bevelThickness: 0.08,
      bevelSegments: 3,
      curveSegments: 64,
    }),
  );
  mainplateGeo.translate(0, 0, -(MAINPLATE_THICKNESS - 0.16) * 0.5);
  mainplateGeo.computeVertexNormals();

  const mainplateMesh = new THREE.Mesh(mainplateGeo, materials.mainplateRhodium);
  mainplateMesh.position.z = Z_LAYERS.MAINPLATE;
  mainplateMesh.castShadow = true;
  mainplateMesh.receiveShadow = true;
  mainplateGroup.add(mainplateMesh);
  xraySwappablePlates.push({
    mesh: mainplateMesh,
    standardMat: materials.mainplateRhodium,
    xrayMat: materials.xrayPlateGlass,
  });

  // Lower Flying Tourbillon Support Bar (cantilevered slim spider spanning tourbillon aperture on Layer 0)
  const supportBarShape = new THREE.Shape();
  const rAp = TOURBILLON_SPEC.MAINPLATE_APERTURE_RADIUS + 0.35;
  supportBarShape.moveTo(-rAp, -0.85);
  supportBarShape.lineTo(rAp, -0.85);
  supportBarShape.lineTo(rAp, 0.85);
  supportBarShape.lineTo(-rAp, 0.85);
  supportBarShape.closePath();

  const supportBarGeo = trackGeo(
    new THREE.ExtrudeGeometry(supportBarShape, {
      depth: 0.52,
      bevelEnabled: true,
      bevelSize: 0.06,
      bevelThickness: 0.06,
      bevelSegments: 2,
    }),
  );
  supportBarGeo.translate(0, 0, -0.26);
  const supportBarMesh = new THREE.Mesh(supportBarGeo, materials.polishedSteel);
  supportBarMesh.position.set(POSITIONS.TOURBILLON.x, POSITIONS.TOURBILLON.y, -0.05);
  supportBarMesh.castShadow = true;
  supportBarMesh.receiveShadow = true;
  mainplateGroup.add(supportBarMesh);

  // Central lower pedestal rising from support bar to hold the Stationary Fixed 4th Wheel
  const pedestalGeo = trackGeo(new THREE.CylinderGeometry(1.45, 1.85, 2.75, 24));
  pedestalGeo.rotateX(Math.PI / 2);
  const pedestalMesh = new THREE.Mesh(pedestalGeo, materials.darkSteel);
  pedestalMesh.position.set(POSITIONS.TOURBILLON.x, POSITIONS.TOURBILLON.y, 1.4);
  mainplateGroup.add(pedestalMesh);

  // Chamfered Outer Movement Casing Ring (Brushed Steel Bezel Framing the Caliber)
  const ringShape = new THREE.Shape();
  ringShape.absarc(0, 0, CASE_RING_OUTER_RADIUS, 0, Math.PI * 2, false);
  const ringHole = new THREE.Path();
  ringHole.absarc(0, 0, MAINPLATE_RADIUS - 0.15, 0, Math.PI * 2, true);
  ringShape.holes.push(ringHole);

  const caseRingGeo = trackGeo(
    new THREE.ExtrudeGeometry(ringShape, {
      depth: 5.1,
      bevelEnabled: true,
      bevelSize: 0.18,
      bevelThickness: 0.16,
      bevelSegments: 3,
      curveSegments: 72,
    }),
  );
  const caseRingMesh = new THREE.Mesh(caseRingGeo, materials.caseRingSteel);
  caseRingMesh.position.z = -0.35;
  caseRingMesh.castShadow = true;
  caseRingMesh.receiveShadow = true;
  mainplateGroup.add(caseRingMesh);
  xraySwappablePlates.push({
    mesh: caseRingMesh,
    standardMat: materials.caseRingSteel,
    xrayMat: materials.xrayPlateGlass,
  });

  // =========================================================================
  // LAYER 3: SKELETONIZED UPPER BRIDGES (CÔTES DE GENÈVE + ANGLAGE BEVELS)
  // =========================================================================
  const bridgeThickness = Z_LAYERS.BRIDGES_TOP - Z_LAYERS.BRIDGES_BASE;

  // 3A. Barrel & Winding Bridge (12 o'clock arch spanning Barrel & Crown Wheel)
  const barrelBridgeGeo = trackGeo(
    createSmoothBridgeGeometry(
      [
        [-13.8, 7.6],
        [-10.2, 13.6],
        [-3.5, 16.9],
        [3.5, 16.9],
        [10.2, 13.6],
        [15.2, 6.4],
        [14.0, 3.2],
        [9.8, 2.8],
        [5.4, 5.2],
        [0.0, 6.1],
        [-5.4, 5.2],
        [-11.8, 4.6],
      ],
      [
        { x: POSITIONS.BARREL.x, y: POSITIONS.BARREL.y, r: 1.55 },
        { x: POSITIONS.CROWN_WHEEL.x, y: POSITIONS.CROWN_WHEEL.y, r: 1.05 },
        // Decorative cutout revealing coiled mainspring teeth below, well clear of plaque
        { x: -5.2, y: 8.4, r: 1.85 },
      ],
      bridgeThickness,
    ),
  );
  const barrelBridgeMesh = new THREE.Mesh(barrelBridgeGeo, materials.rhodiumBridge);
  barrelBridgeMesh.position.z = Z_LAYERS.BRIDGES_BASE;
  barrelBridgeMesh.castShadow = true;
  barrelBridgeMesh.receiveShadow = true;
  bridgesGroup.add(barrelBridgeMesh);
  xraySwappablePlates.push({
    mesh: barrelBridgeMesh,
    standardMat: materials.rhodiumBridge,
    xrayMat: materials.xrayBridgeGlass,
  });

  // Engraved Caliber Nameplate Plaque inlaid atop the Barrel Bridge
  const plaqueGeo = trackGeo(new THREE.BoxGeometry(9.4, 2.3, 0.12));
  const plaqueMesh = new THREE.Mesh(plaqueGeo, materials.engravedPlaque);
  plaqueMesh.position.set(0.0, 13.2, Z_LAYERS.BRIDGES_TOP + 0.03);
  bridgesGroup.add(plaqueMesh);
  xraySwappablePlates.push({
    mesh: plaqueMesh,
    standardMat: materials.engravedPlaque,
    xrayMat: materials.xrayBridgeGlass,
  });

  // 3B. Sweeping Skeletonized Center & Train Wheel Bridge (spans Center, Third & Aux Wheels)
  const trainBridgeGeo = trackGeo(
    createSmoothBridgeGeometry(
      [
        [-15.6, -1.6],
        [-12.6, 1.8],
        [-4.8, 2.8],
        [0.0, 2.9],
        [5.2, 2.6],
        [14.6, -2.6],
        [14.8, -6.2],
        [11.4, -12.6],
        [8.4, -12.2],
        [7.4, -7.0],
        [4.0, -2.5],
        [0.0, -2.3],
        [-4.5, -2.5],
        [-8.6, -7.8],
        [-10.4, -11.6],
        [-13.4, -10.8],
        [-15.4, -6.4],
      ],
      [
        { x: POSITIONS.CENTER.x, y: POSITIONS.CENTER.y, r: 1.38 },
        { x: POSITIONS.THIRD.x, y: POSITIONS.THIRD.y, r: 1.1 },
        { x: POSITIONS.AUX_WHEEL.x, y: POSITIONS.AUX_WHEEL.y, r: 1.1 },
      ],
      bridgeThickness,
    ),
  );
  const trainBridgeMesh = new THREE.Mesh(trainBridgeGeo, materials.rhodiumBridge);
  trainBridgeMesh.position.z = Z_LAYERS.BRIDGES_BASE;
  trainBridgeMesh.castShadow = true;
  trainBridgeMesh.receiveShadow = true;
  bridgesGroup.add(trainBridgeMesh);
  xraySwappablePlates.push({
    mesh: trainBridgeMesh,
    standardMat: materials.rhodiumBridge,
    xrayMat: materials.xrayBridgeGlass,
  });

  // 3C. Flying Tourbillon Lower Crescent Framing Arch (frames 6 o'clock perimeter without obstructing cage!)
  const crescentGeo = trackGeo(
    createSmoothBridgeGeometry(
      [
        [-10.4, -13.0],
        [-6.6, -13.6],
        [-3.4, -15.6],
        [0.0, -16.1],
        [3.4, -15.6],
        [6.6, -13.6],
        [10.4, -13.0],
        [9.0, -15.8],
        [4.2, -17.6],
        [0.0, -18.0],
        [-4.2, -17.6],
        [-9.0, -15.8],
      ],
      [],
      bridgeThickness * 0.85,
    ),
  );
  const crescentMesh = new THREE.Mesh(crescentGeo, materials.rhodiumBridge);
  crescentMesh.position.z = Z_LAYERS.BRIDGES_BASE;
  crescentMesh.castShadow = true;
  crescentMesh.receiveShadow = true;
  bridgesGroup.add(crescentMesh);
  xraySwappablePlates.push({
    mesh: crescentMesh,
    standardMat: materials.rhodiumBridge,
    xrayMat: materials.xrayBridgeGlass,
  });

  // =========================================================================
  // STRUCTURAL BRIDGE PILLARS (InstancedMesh on Layer 3 descending to Layer 0)
  // =========================================================================
  const pillarLen = Z_LAYERS.BRIDGES_BASE - 0.35;
  const structPillarGeo = trackGeo(new THREE.CylinderGeometry(0.62, 0.72, pillarLen, 16));
  structPillarGeo.rotateX(Math.PI / 2);
  const pillarInst = new THREE.InstancedMesh(
    structPillarGeo,
    materials.darkSteel,
    PILLAR_PLACEMENTS.length,
  );
  const dummy = new THREE.Object3D();
  PILLAR_PLACEMENTS.forEach((p, idx) => {
    dummy.position.set(p.x, p.y, 0.35 + pillarLen * 0.5);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    pillarInst.setMatrixAt(idx, dummy.matrix);
  });
  pillarInst.instanceMatrix.needsUpdate = true;
  pillarInst.computeBoundingSphere();
  pillarInst.castShadow = true;
  bridgesGroup.add(pillarInst);

  // =========================================================================
  // INSTANCED SYNTHETIC RUBY BEARINGS & GOLD CHATONS (Layer 0 & Layer 3)
  // =========================================================================
  const rubyToroidGeo = trackGeo(new THREE.TorusGeometry(0.62, 0.34, 14, 24));
  const chatonRingGeo = trackGeo(new THREE.TorusGeometry(0.95, 0.2, 12, 24));

  const buildJewelInstances = (layerNum: 0 | 3, targetGroup: THREE.Group) => {
    const items = JEWEL_PLACEMENTS.filter((j) => j.layer === layerNum);
    const rubyInst = new THREE.InstancedMesh(rubyToroidGeo, materials.syntheticRuby, items.length);
    const chatonInst = new THREE.InstancedMesh(chatonRingGeo, materials.goldChaton, items.length);

    items.forEach((j, idx) => {
      dummy.position.set(j.x, j.y, j.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(j.radius, j.radius, j.radius * 0.65);
      dummy.updateMatrix();
      rubyInst.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(j.x, j.y, j.z - 0.04);
      dummy.scale.set(j.radius, j.radius, j.radius * 0.72);
      dummy.updateMatrix();
      chatonInst.setMatrixAt(idx, dummy.matrix);
    });

    rubyInst.instanceMatrix.needsUpdate = true;
    chatonInst.instanceMatrix.needsUpdate = true;
    rubyInst.computeBoundingSphere();
    chatonInst.computeBoundingSphere();
    rubyInst.castShadow = true;

    targetGroup.add(chatonInst);
    targetGroup.add(rubyInst);
  };

  buildJewelInstances(0, jewelsAndScrewsLayer0);
  buildJewelInstances(3, jewelsAndScrewsLayer3);

  // =========================================================================
  // INSTANCED HEAT-BLUED SLOTTED SCREWS (Layer 0 & Layer 3)
  // =========================================================================
  const screwGeo = trackGeo(createSlottedScrewGeometry());

  const buildScrewInstances = (layerNum: 0 | 3, targetGroup: THREE.Group) => {
    const items = SCREW_PLACEMENTS.filter((s) => s.layer === layerNum);
    const screwInst = new THREE.InstancedMesh(screwGeo, materials.heatBluedSteel, items.length);

    items.forEach((s, idx) => {
      dummy.position.set(s.x, s.y, s.z);
      dummy.rotation.set(0, 0, s.angle);
      dummy.scale.set(s.radius, s.radius, s.radius * 0.78);
      dummy.updateMatrix();
      screwInst.setMatrixAt(idx, dummy.matrix);
    });

    screwInst.instanceMatrix.needsUpdate = true;
    screwInst.computeBoundingSphere();
    screwInst.castShadow = true;
    targetGroup.add(screwInst);
  };

  buildScrewInstances(0, jewelsAndScrewsLayer0);
  buildScrewInstances(3, jewelsAndScrewsLayer3);

  const dispose = () => {
    geometries.forEach((g) => g.dispose());
    rubyToroidGeo.dispose();
    chatonRingGeo.dispose();
  };

  return {
    mainplateGroup,
    bridgesGroup,
    jewelsAndScrewsLayer0,
    jewelsAndScrewsLayer3,
    xraySwappablePlates,
    dispose,
  };
}
