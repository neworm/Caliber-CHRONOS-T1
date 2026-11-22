import * as THREE from 'three';
import {
  AssemblyMode,
  EXPLODED_Z_OFFSETS,
  LayerVisibility,
  VisualizationMode,
} from '../movement/specs';
import type { MovementMaterials } from '../movement/materials';
import type { PlatesAndHardwareRig } from '../movement/plates';

export interface VisualController {
  setAssemblyMode: (mode: AssemblyMode) => void;
  setVisualizationMode: (mode: VisualizationMode) => void;
  setCutawayPosition: (normalizedPos: number) => void; // -1 .. +1 across caliber width
  setLayerVisibility: (vis: LayerVisibility) => void;
  update: (delta: number) => void;
  getExplodedProgress: () => number;
  dispose: () => void;
}

export function createVisualController(
  renderer: THREE.WebGLRenderer,
  movementRoot: THREE.Group,
  layer0Mainplate: THREE.Group,
  layer1GearTrain: THREE.Group,
  layer2Tourbillon: THREE.Group,
  layer3Bridges: THREE.Group,
  platesRig: PlatesAndHardwareRig,
  materials: MovementMaterials,
): VisualController {
  let targetExploded = 0;
  let currentExploded = 0;
  let currentVisMode: VisualizationMode = 'standard';
  let cutawayWorldX = 2.5;

  // Crisp luminous laser-section guide frame shown only during Cutaway mode
  const guideGeo = new THREE.PlaneGeometry(0.12, 42);
  const guideMat = new THREE.MeshBasicMaterial({
    color: 0xd8b272,
    transparent: true,
    opacity: 0.32,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const cutawayGuide = new THREE.Mesh(guideGeo, guideMat);
  cutawayGuide.rotation.y = Math.PI / 2;
  cutawayGuide.position.set(cutawayWorldX, 3.2, 0);
  cutawayGuide.visible = false;
  // Add to movementRoot's parent once mounted (or attach in world-aligned orientation)
  // Since movementRoot is rotated -PI/2 around X, add cutaway guide in movementRoot local coords:
  // Local XY plane: guide is a thin vertical bar along local Y at x = cutawayWorldX, z = 3.2
  cutawayGuide.rotation.set(0, Math.PI / 2, 0);
  cutawayGuide.position.set(cutawayWorldX, 0, 3.2);
  movementRoot.add(cutawayGuide);

  // Subtle vertical alignment axis guide lines visible only when Exploded > 0.08
  const axisMaterial = new THREE.LineDashedMaterial({
    color: 0xd8b272,
    dashSize: 0.45,
    gapSize: 0.35,
    transparent: true,
    opacity: 0,
  });
  const axisGroup = new THREE.Group();
  const axisGeos: THREE.BufferGeometry[] = [];
  const axisCoords: Array<[number, number]> = [
    [0, 0],
    [0, 8.8],
    [0, -8.6],
  ];
  for (const [ax, ay] of axisCoords) {
    const pts = [new THREE.Vector3(ax, ay, -4.5), new THREE.Vector3(ax, ay, 17.5)];
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    axisGeos.push(g);
    const line = new THREE.Line(g, axisMaterial);
    line.computeLineDistances();
    axisGroup.add(line);
  }
  axisGroup.visible = false;
  movementRoot.add(axisGroup);

  const applyXraySwap = (enableXray: boolean) => {
    for (const entry of platesRig.xraySwappablePlates) {
      entry.mesh.material = enableXray ? entry.xrayMat : entry.standardMat;
      entry.mesh.castShadow = !enableXray;
    }
  };

  const setAssemblyMode = (mode: AssemblyMode) => {
    targetExploded = mode === 'exploded' ? 1 : 0;
  };

  const setVisualizationMode = (mode: VisualizationMode) => {
    currentVisMode = mode;

    // Reset all modes cleanly first
    applyXraySwap(mode === 'xray');

    const cutawayActive = mode === 'cutaway';
    renderer.localClippingEnabled = cutawayActive;
    materials.setCutawayEnabled(cutawayActive);
    materials.setCutawayOffset(cutawayWorldX);
    cutawayGuide.visible = cutawayActive;

    materials.setWireframe(mode === 'wireframe');
  };

  const setCutawayPosition = (normalizedPos: number) => {
    // Map -1 .. +1 to -18mm .. +18mm along X
    cutawayWorldX = THREE.MathUtils.clamp(normalizedPos, -1, 1) * 18.0;
    materials.setCutawayOffset(cutawayWorldX);
    cutawayGuide.position.x = cutawayWorldX;
  };

  const setLayerVisibility = (vis: LayerVisibility) => {
    // Keep structural bridge meshes vs jewels/screws independently toggleable
    platesRig.bridgesGroup.children.forEach((child) => {
      if (child === platesRig.jewelsAndScrewsLayer3) {
        child.visible = vis.jewelsAndScrews;
      } else {
        child.visible = vis.bridges;
      }
    });
    platesRig.jewelsAndScrewsLayer0.visible = vis.jewelsAndScrews;
    layer1GearTrain.visible = vis.gearTrain;
    layer2Tourbillon.visible = vis.tourbillon;
  };

  const update = (delta: number) => {
    const dt = Math.min(delta, 0.1);
    currentExploded = THREE.MathUtils.damp(currentExploded, targetExploded, 5.5, dt);
    if (Math.abs(currentExploded - targetExploded) < 0.0005) {
      currentExploded = targetExploded;
    }

    // Smoothly separate Layers 0..3 strictly along local Z-axis contract
    layer0Mainplate.position.z = EXPLODED_Z_OFFSETS.layer0 * currentExploded;
    layer1GearTrain.position.z = EXPLODED_Z_OFFSETS.layer1 * currentExploded;
    layer2Tourbillon.position.z = EXPLODED_Z_OFFSETS.layer2 * currentExploded;
    layer3Bridges.position.z = EXPLODED_Z_OFFSETS.layer3 * currentExploded;

    // Fade in horological datum axes during exploded view
    if (currentExploded > 0.04) {
      axisGroup.visible = true;
      axisMaterial.opacity = Math.min(0.45, currentExploded * 0.45);
    } else {
      axisGroup.visible = false;
    }

    // Subtle visual pulse on cutaway guide only in cutaway mode
    if (currentVisMode === 'cutaway') {
      cutawayGuide.position.z = 3.2 + currentExploded * 3.5;
    }
  };

  const getExplodedProgress = () => currentExploded;

  const dispose = () => {
    guideGeo.dispose();
    guideMat.dispose();
    axisGeos.forEach((g) => g.dispose());
    axisMaterial.dispose();
  };

  return {
    setAssemblyMode,
    setVisualizationMode,
    setCutawayPosition,
    setLayerVisibility,
    update,
    getExplodedProgress,
    dispose,
  };
}
