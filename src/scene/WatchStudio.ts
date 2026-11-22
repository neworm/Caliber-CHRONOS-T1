import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {
  AssemblyMode,
  CAMERA_PRESETS,
  CameraPresetId,
  KINEMATICS,
  LayerVisibility,
  TEETH,
  TOURBILLON_SPEC,
  TelemetrySnapshot,
  VisualizationMode,
} from '../movement/specs';
import { createMovementMaterials } from '../movement/materials';
import { buildGearTrain } from '../movement/gears';
import { buildTourbillonAssembly } from '../movement/tourbillon';
import { buildPlatesBridgesAndHardware } from '../movement/plates';
import { createVisualController } from '../visuals/VisualModes';
import { TickTockAudio } from '../audio/TickTockAudio';

export interface WatchStudioAPI {
  setRunning: (running: boolean) => void;
  setTimeScale: (scale: number) => void;
  setAssemblyMode: (mode: AssemblyMode) => void;
  setVisualizationMode: (mode: VisualizationMode) => void;
  setCutawayPosition: (normalizedPos: number) => void;
  setLayerVisibility: (vis: LayerVisibility) => void;
  setCameraPreset: (preset: CameraPresetId) => void;
  windCrown: () => void;
  setAudioEnabled: (enabled: boolean) => void;
  dispose: () => void;
}

function detectSoftwareWebGL(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

/**
 * Generates a radial soft dark contact shadow texture to ground the watch movement in the studio.
 */
function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 16, size / 2, size / 2, size / 2);
  grad.addColorStop(0.0, 'rgba(0, 0, 0, 0.78)');
  grad.addColorStop(0.58, 'rgba(0, 0, 0, 0.42)');
  grad.addColorStop(0.84, 'rgba(0, 0, 0, 0.12)');
  grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Builds an enhanced high-contrast horology lightbox RoomEnvironment for sharp metallic bevel highlights.
 */
function buildStudioEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  const envScene = new RoomEnvironment();
  // Add high-contrast luminous studio softbox strips so brushed bevels & blued steel pop cleanly
  const stripMatWarm = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.25, 2.0) });
  const stripMatCool = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 2.1, 2.55) });
  const stripGeo1 = new THREE.PlaneGeometry(14, 3.5);
  const stripGeo2 = new THREE.PlaneGeometry(12, 2.8);

  const overheadStrip = new THREE.Mesh(stripGeo1, stripMatWarm);
  overheadStrip.position.set(4, 12, 6);
  overheadStrip.lookAt(0, 0, 0);
  envScene.add(overheadStrip);

  const sideRimStrip = new THREE.Mesh(stripGeo2, stripMatCool);
  sideRimStrip.position.set(-12, 6, -5);
  sideRimStrip.lookAt(0, 0, 0);
  envScene.add(sideRimStrip);

  const sideFillStrip = new THREE.Mesh(stripGeo2, stripMatWarm);
  sideFillStrip.position.set(12, 4, -8);
  sideFillStrip.lookAt(0, 0, 0);
  envScene.add(sideFillStrip);

  const envRT = pmremGenerator.fromScene(envScene, 0.035);
  stripGeo1.dispose();
  stripGeo2.dispose();
  stripMatWarm.dispose();
  stripMatCool.dispose();
  pmremGenerator.dispose();
  return envRT.texture;
}

// Reusable math scratch vectors (zero per-frame GC)
const _camTargetPos = new THREE.Vector3();
const _camTargetLook = new THREE.Vector3();

export function createWatchStudio(
  container: HTMLElement,
  onTelemetry: (snapshot: TelemetrySnapshot) => void,
  onContextLost?: (lost: boolean) => void,
): WatchStudioAPI {
  const isSoftwareGl = detectSoftwareWebGL();

  // =========================================================================
  // 1. RENDERER & STUDIO SCENE
  // =========================================================================
  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = false;

  const initW = Math.max(1, container.clientWidth);
  const initH = Math.max(1, container.clientHeight);
  renderer.setSize(initW, initH);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const bgColor = new THREE.Color(0x0b0c10);
  scene.background = bgColor;
  scene.fog = new THREE.FogExp2(0x0b0c10, 0.0055);

  const envTexture = buildStudioEnvironment(renderer);
  scene.environment = envTexture;

  // =========================================================================
  // 2. CAMERA & ORBIT CONTROLS
  // =========================================================================
  const heroPreset = CAMERA_PRESETS.hero;
  const camera = new THREE.PerspectiveCamera(heroPreset.fov, initW / initH, 0.2, 400);
  camera.position.set(...heroPreset.position);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...heroPreset.target);
  controls.enableDamping = !isSoftwareGl;
  controls.dampingFactor = 0.075;
  controls.minDistance = 8.5;
  controls.maxDistance = 95;
  controls.maxPolarAngle = Math.PI * 0.96;
  controls.update();

  // Smooth camera preset transition state
  let camTransitionActive = false;
  let camTargetFov = heroPreset.fov;
  _camTargetPos.set(...heroPreset.position);
  _camTargetLook.set(...heroPreset.target);

  const onControlsStart = () => {
    // Cancel scripted camera transition immediately so user orbit never fights it
    camTransitionActive = false;
  };
  controls.addEventListener('start', onControlsStart);

  // =========================================================================
  // 3. STUDIO LIGHTING RIG (Balanced Warm/Cool 3-Point + Softboxes on GPU)
  // =========================================================================
  const hemiLight = new THREE.HemisphereLight(0xcbd9f0, 0x26201a, 0.75);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xfff3df, 2.35);
  keyLight.position.set(24, 42, 26);
  keyLight.castShadow = !isSoftwareGl;
  if (!isSoftwareGl) {
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 5;
    keyLight.shadow.camera.far = 110;
    const d = 26;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.025;
  }
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xaac8f0, 1.05);
  fillLight.position.set(-28, 22, 18);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xffe1b5, 1.35);
  rimLight.position.set(-6, 18, -32);
  scene.add(rimLight);

  const underBounce = new THREE.DirectionalLight(0x6d84a8, 0.45);
  underBounce.position.set(0, -25, 12);
  scene.add(underBounce);

  if (!isSoftwareGl) {
    RectAreaLightUniformsLib.init();
    const softboxTop = new THREE.RectAreaLight(0xfff8ed, 3.2, 26, 12);
    softboxTop.position.set(8, 28, 14);
    softboxTop.lookAt(0, 3, 2);
    scene.add(softboxTop);

    const softboxSide = new THREE.RectAreaLight(0xc2dcff, 2.2, 18, 10);
    softboxSide.position.set(-24, 14, 10);
    softboxSide.lookAt(0, 3, 0);
    scene.add(softboxSide);
  }

  // Subtle dark slate workbench pedestal + radial contact shadow grounding
  const shadowTex = createContactShadowTexture();
  const shadowPlaneGeo = new THREE.PlaneGeometry(54, 54);
  const shadowPlaneMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.72,
  });
  const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = -2.2;
  scene.add(shadowPlane);

  const benchGeo = new THREE.CylinderGeometry(42, 44, 0.6, 64);
  const benchMat = new THREE.MeshStandardMaterial({
    color: 0x111319,
    roughness: 0.86,
    metalness: 0.14,
  });
  const benchMesh = new THREE.Mesh(benchGeo, benchMat);
  benchMesh.position.y = -2.55;
  benchMesh.receiveShadow = true;
  scene.add(benchMesh);

  // Subtle metallic workbench calibration ring around the caliber
  const ringGeo = new THREE.RingGeometry(22.5, 22.72, 96);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xd8b272,
    transparent: true,
    opacity: 0.14,
    side: THREE.DoubleSide,
  });
  const benchRing = new THREE.Mesh(ringGeo, ringMat);
  benchRing.rotation.x = -Math.PI / 2;
  benchRing.position.y = -2.22;
  scene.add(benchRing);

  // =========================================================================
  // 4. ASSEMBLE CALIBER CHRONOS-T1 MOVEMENT HIERARCHY
  // =========================================================================
  // movementRoot rotates -PI/2 around X so local XY = horizontal watch plane, local +Z = world +Y
  const movementRoot = new THREE.Group();
  movementRoot.name = 'Caliber_CHRONOS_T1';
  movementRoot.rotation.x = -Math.PI / 2;
  scene.add(movementRoot);

  const materials = createMovementMaterials(renderer, isSoftwareGl);
  const platesRig = buildPlatesBridgesAndHardware(materials);
  const gearTrainRig = buildGearTrain(materials);
  const tourbillonRig = buildTourbillonAssembly(materials);

  movementRoot.add(platesRig.mainplateGroup);
  movementRoot.add(gearTrainRig.group);
  movementRoot.add(tourbillonRig.group);
  movementRoot.add(platesRig.bridgesGroup);

  const visualCtrl = createVisualController(
    renderer,
    movementRoot,
    platesRig.mainplateGroup,
    gearTrainRig.group,
    tourbillonRig.group,
    platesRig.bridgesGroup,
    platesRig,
    materials,
  );

  const audio = new TickTockAudio();

  // Pre-warm shaders on hardware GPU
  if (!isSoftwareGl) {
    renderer.compile(scene, camera);
  }

  // =========================================================================
  // 5. SIMULATION & KINEMATIC STATE (21,600 vph Swiss Lever Escapement)
  // =========================================================================
  let isRunning = true;
  let timeScale = 1.0;
  let powerReserveHours: number = KINEMATICS.INITIAL_POWER_RESERVE_H;
  let simPhaseCycles = 0; // Full 3 Hz cycles accumulated (1 cycle = 2 beats)
  let lastBeatIndex = -1;

  // Manual winding animation state (smooth crown & ratchet spin)
  let targetWindingRad = 0;
  let currentWindingRad = 0;

  // Telemetry throttle (24 Hz UI updates for smooth waveform without React overhead)
  let lastTelemetryPush = 0;

  const handleContextLost = (e: Event) => {
    e.preventDefault();
    onContextLost?.(true);
  };
  const handleContextRestored = () => {
    onContextLost?.(false);
  };
  renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
  renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

  const handleResize = () => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener('resize', handleResize);

  // =========================================================================
  // 6. MAIN RENDER & KINEMATIC LOOP (Software-WebGL Safe Pacing!)
  // =========================================================================
  let disposed = false;
  let frameId = 0;
  let lastPerfTime = performance.now();

  const smoothstep01 = (x: number) => {
    const t = Math.max(0, Math.min(1, x));
    return t * t * (3 - 2 * t);
  };

  function afterDraw(cb: () => void) {
    const gl = renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        frameId = window.setTimeout(cb, 80);
      }
    };
    frameId = window.setTimeout(poll, 5);
  }

  function stepSimulation(realDeltaSec: number) {
    const dt = Math.min(realDeltaSec, 0.1);
    const simDt = isRunning && powerReserveHours > 0 ? dt * timeScale : 0;

    // Drain power reserve gently (noticeable at 5x, authentic 72h scale)
    if (simDt > 0) {
      // Scale drain slightly faster than real-time (1 sim minute ~ 0.04h) so user can observe decay & wind
      powerReserveHours = Math.max(0, powerReserveHours - (simDt / 3600) * 6.0);
    }

    const reservePct = powerReserveHours / KINEMATICS.MAX_POWER_RESERVE_H;
    // Amplitude drops realistically as power reserve approaches zero
    const amplitudeFactor =
      powerReserveHours <= 0
        ? 0
        : 0.42 + 0.58 * Math.min(1, Math.sqrt(powerReserveHours / 48.0));
    const amplitudeDeg = KINEMATICS.NOMINAL_AMPLITUDE_DEG * amplitudeFactor;
    const amplitudeRad = THREE.MathUtils.degToRad(amplitudeDeg);

    // Advance 3.0 Hz balance oscillation phase (6 beats per second)
    if (simDt > 0) {
      simPhaseCycles += simDt * KINEMATICS.FREQUENCY_HZ;
    }

    // Balance wheel sinusoidal swing: theta(t) = A * sin(2*pi*f*t)
    const balanceAngleRad = amplitudeRad * Math.sin(2 * Math.PI * simPhaseCycles);

    // Discrete Swiss lever beat tracking (every half-cycle = balance crosses zero)
    const totalBeats = simPhaseCycles * 2.0;
    const beatIndex = Math.floor(totalBeats);
    const beatFrac = totalBeats - beatIndex; // 0..1 within current half-oscillation
    const beatPolarity: 1 | -1 = beatIndex % 2 === 0 ? 1 : -1;

    // Trigger crisp acoustic tick/tock on each beat crossing
    if (isRunning && powerReserveHours > 0 && beatIndex !== lastBeatIndex) {
      if (lastBeatIndex >= 0 && timeScale <= 2.5) {
        audio.playBeat(beatPolarity, amplitudeFactor);
      }
      lastBeatIndex = beatIndex;
    }

    // Discrete Pallet Fork impulse flip during [0.00 .. 0.17] of beat, then locked against banking pin!
    const palletMaxRad = THREE.MathUtils.degToRad(TOURBILLON_SPEC.PALLET_SWING_DEG);
    const palletFlipT = smoothstep01(beatFrac / 0.17);
    const palletAngleRad =
      beatPolarity > 0
        ? THREE.MathUtils.lerp(-palletMaxRad, palletMaxRad, palletFlipT)
        : THREE.MathUtils.lerp(palletMaxRad, -palletMaxRad, palletFlipT);

    // Discrete 15-tooth Escape Wheel step: advances 1/2 tooth pitch (12 deg) during [0.03 .. 0.21], then dead-locked!
    const halfToothStepRad = Math.PI / TEETH.ESCAPE_WHEEL; // 2*PI / 30 = 12 deg
    const escStepT = smoothstep01((beatFrac - 0.03) / 0.18);
    // Tiny realistic recoil settle at end of lock
    const lockRecoil = beatFrac > 0.21 && beatFrac < 0.27 ? Math.sin(((beatFrac - 0.21) / 0.06) * Math.PI) * -0.025 : 0;
    const steppedBeats = beatIndex + escStepT + lockRecoil;
    const escapeWheelRad = -steppedBeats * halfToothStepRad;

    // Tourbillon Cage: exact 360 beats = 60 seconds = 1 full revolution (1.0 deg per beat!)
    // Tie cage advance to stepped beats so slow-mo shows authentic 6 Hz mechanical stepping!
    const cageAngleRad = -(steppedBeats / 360.0) * (Math.PI * 2);

    // Smooth manual winding spring-damped motion
    currentWindingRad = THREE.MathUtils.damp(currentWindingRad, targetWindingRad, 8.5, dt);

    // Update all mechanical sub-assemblies strictly from single kinematic state
    gearTrainRig.updateKinematics(cageAngleRad, currentWindingRad, reservePct);
    tourbillonRig.updateTourbillon(
      cageAngleRad,
      balanceAngleRad,
      palletAngleRad,
      escapeWheelRad,
      amplitudeFactor,
    );

    // Update Exploded View / Visual Mode transitions
    visualCtrl.update(dt);

    // Smooth Camera Preset interpolation
    if (camTransitionActive) {
      const lambda = 6.2;
      camera.position.x = THREE.MathUtils.damp(camera.position.x, _camTargetPos.x, lambda, dt);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, _camTargetPos.y, lambda, dt);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, _camTargetPos.z, lambda, dt);

      controls.target.x = THREE.MathUtils.damp(controls.target.x, _camTargetLook.x, lambda, dt);
      controls.target.y = THREE.MathUtils.damp(controls.target.y, _camTargetLook.y, lambda, dt);
      controls.target.z = THREE.MathUtils.damp(controls.target.z, _camTargetLook.z, lambda, dt);

      camera.fov = THREE.MathUtils.damp(camera.fov, camTargetFov, lambda, dt);
      camera.updateProjectionMatrix();

      const posDist = camera.position.distanceTo(_camTargetPos);
      const tgtDist = controls.target.distanceTo(_camTargetLook);
      if (posDist < 0.06 && tgtDist < 0.04) {
        camera.position.copy(_camTargetPos);
        controls.target.copy(_camTargetLook);
        camera.fov = camTargetFov;
        camera.updateProjectionMatrix();
        camTransitionActive = false;
      }
    }

    // Adjust studio contact shadow subtly when exploded so mainplate never clips into workbench
    const exp = visualCtrl.getExplodedProgress();
    shadowPlane.position.y = -2.2 - exp * 4.4;
    benchMesh.position.y = -2.55 - exp * 4.4;
    benchRing.position.y = -2.22 - exp * 4.4;

    controls.update();

    // Emit live telemetry to HUD (~30 Hz max)
    const nowMs = performance.now();
    if (nowMs - lastTelemetryPush >= 33) {
      lastTelemetryPush = nowMs;
      const rawAzimuth = ((-THREE.MathUtils.radToDeg(cageAngleRad)) % 360 + 360) % 360;
      // Sharp impulse spike during pallet release window for the tick-tock waveform
      const impulse =
        isRunning && powerReserveHours > 0
          ? Math.exp(-Math.pow((beatFrac - 0.08) / 0.045, 2))
          : 0;

      onTelemetry({
        frequencyHz: isRunning && powerReserveHours > 0 ? KINEMATICS.FREQUENCY_HZ * timeScale : 0,
        vph: isRunning && powerReserveHours > 0 ? Math.round(KINEMATICS.VPH * timeScale) : 0,
        amplitudeDeg,
        balanceAngleDeg: THREE.MathUtils.radToDeg(balanceAngleRad),
        powerReserveHours,
        powerReservePct: reservePct,
        tourbillonAzimuthDeg: rawAzimuth,
        beatPhase: beatFrac,
        beatImpulse: impulse,
        beatPolarity,
        isRunning: isRunning && powerReserveHours > 0,
      });
    }
  }

  function tick() {
    if (disposed) return;
    const now = performance.now();
    const realDelta = (now - lastPerfTime) / 1000;
    lastPerfTime = now;

    stepSimulation(realDelta);
    renderer.render(scene, camera);

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }
  }

  // Kick off render loop
  tick();

  // =========================================================================
  // 7. PUBLIC CONTROL API
  // =========================================================================
  const api: WatchStudioAPI = {
    setRunning: (running) => {
      isRunning = running;
    },
    setTimeScale: (scale) => {
      timeScale = THREE.MathUtils.clamp(scale, 0.05, 5.0);
    },
    setAssemblyMode: (mode) => {
      visualCtrl.setAssemblyMode(mode);
      // When switching to exploded in default views, gently ensure enough vertical headroom
      if (mode === 'exploded' && !camTransitionActive) {
        // Keep user's current camera unless they trigger a preset
      }
    },
    setVisualizationMode: (mode) => {
      visualCtrl.setVisualizationMode(mode);
    },
    setCutawayPosition: (normalizedPos) => {
      visualCtrl.setCutawayPosition(normalizedPos);
    },
    setLayerVisibility: (vis) => {
      visualCtrl.setLayerVisibility(vis);
    },
    setCameraPreset: (presetId) => {
      const cfg = CAMERA_PRESETS[presetId];
      if (!cfg) return;
      _camTargetPos.set(...cfg.position);
      _camTargetLook.set(...cfg.target);
      camTargetFov = cfg.fov;
      camTransitionActive = true;
    },
    windCrown: () => {
      powerReserveHours = Math.min(
        KINEMATICS.MAX_POWER_RESERVE_H,
        powerReserveHours + KINEMATICS.WIND_INCREMENT_H,
      );
      targetWindingRad += (Math.PI * 2) / 3.5; // Spin ratchet & crown wheel briskly
      audio.playWindClick();
    },
    setAudioEnabled: (enabled) => {
      audio.setEnabled(enabled);
    },
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      controls.removeEventListener('start', onControlsStart);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);

      controls.dispose();
      visualCtrl.dispose();
      gearTrainRig.dispose();
      tourbillonRig.dispose();
      platesRig.dispose();
      materials.dispose();
      audio.dispose();

      shadowTex.dispose();
      shadowPlaneGeo.dispose();
      shadowPlaneMat.dispose();
      benchGeo.dispose();
      benchMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      envTexture.dispose();

      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    },
  };

  return api;
}
