import * as THREE from 'three';

export interface MovementMaterials {
  // Primary PBR materials
  rhodiumBridge: THREE.MeshPhysicalMaterial;
  engravedPlaque: THREE.MeshPhysicalMaterial;
  mainplateRhodium: THREE.MeshPhysicalMaterial;
  caseRingSteel: THREE.MeshPhysicalMaterial;
  brassGear: THREE.MeshPhysicalMaterial;
  roseGoldGear: THREE.MeshPhysicalMaterial;
  polishedSteel: THREE.MeshPhysicalMaterial;
  darkSteel: THREE.MeshPhysicalMaterial;
  heatBluedSteel: THREE.MeshPhysicalMaterial;
  mainspringSteel: THREE.MeshPhysicalMaterial;
  syntheticRuby: THREE.MeshPhysicalMaterial;
  goldChaton: THREE.MeshPhysicalMaterial;
  // Special visualization materials
  xrayPlateGlass: THREE.ShaderMaterial;
  xrayBridgeGlass: THREE.ShaderMaterial;
  // Shared clipping plane for Cutaway mode
  cutawayPlane: THREE.Plane;
  // Helpers
  setCutawayEnabled: (enabled: boolean) => void;
  setCutawayOffset: (worldX: number) => void;
  setWireframe: (enabled: boolean) => void;
  dispose: () => void;
}

/**
 * Generates procedural Côtes de Genève (Geneva Stripes) albedo, normal, and roughness maps.
 */
function createGenevaStripeTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const size = 512;
  const stripeCount = 12;
  const stripeWidth = size / stripeCount;

  // Albedo canvas (subtle metallic luminance banding)
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const aCtx = albedoCanvas.getContext('2d')!;

  // Normal canvas (tangent space: RGB = (nx*0.5+0.5, ny*0.5+0.5, nz*0.5+0.5))
  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = size;
  normalCanvas.height = size;
  const nCtx = normalCanvas.getContext('2d')!;
  const nImg = nCtx.createImageData(size, size);

  // Roughness canvas (linear grayscale)
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;
  const rImg = rCtx.createImageData(size, size);

  // Base metallic silver tone
  aCtx.fillStyle = '#d4d8de';
  aCtx.fillRect(0, 0, size, size);

  for (let s = 0; s < stripeCount; s++) {
    const x0 = s * stripeWidth;
    const grad = aCtx.createLinearGradient(x0, 0, x0 + stripeWidth, 0);
    grad.addColorStop(0.0, '#aeb4be');
    grad.addColorStop(0.14, '#dfe3ea');
    grad.addColorStop(0.55, '#eceff4');
    grad.addColorStop(0.88, '#c5cbd4');
    grad.addColorStop(1.0, '#9ba2ad');
    aCtx.fillStyle = grad;
    aCtx.fillRect(x0, 0, stripeWidth + 1, size);

    // Subtle crisp ridge line between adjacent Geneva bands
    aCtx.fillStyle = 'rgba(85, 92, 105, 0.45)';
    aCtx.fillRect(x0, 0, 1.5, size);
  }

  // Pixel-level curved abrasive lapping waves for normal & roughness
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const localX = (x % stripeWidth) / stripeWidth; // 0..1 inside each band
      // Curved arc abrasive groove characteristic of Geneva striping
      const arcPhase = (y / size) * 28.0 + Math.sin(localX * Math.PI) * 3.8;
      const microGroove = Math.sin(arcPhase * Math.PI * 2) * 0.14;
      const bandSlope = Math.cos(localX * Math.PI) * 0.36;
      const ridgeDip = localX < 0.04 ? -0.45 : localX > 0.96 ? 0.45 : 0;

      const nx = THREE.MathUtils.clamp(bandSlope + ridgeDip + microGroove * 0.4, -0.85, 0.85);
      const ny = THREE.MathUtils.clamp(microGroove, -0.5, 0.5);
      const nz = Math.sqrt(Math.max(0.05, 1.0 - nx * nx - ny * ny));

      const idx = (y * size + x) * 4;
      nImg.data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      nImg.data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      nImg.data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      nImg.data[idx + 3] = 255;

      // Roughness varies from satin valley (0.28) to bright brushed crown (0.14)
      const rVal = 0.21 + Math.abs(bandSlope) * 0.16 + Math.sin(arcPhase * Math.PI * 2) * 0.03;
      const rByte = Math.round(THREE.MathUtils.clamp(rVal, 0.11, 0.38) * 255);
      rImg.data[idx] = rByte;
      rImg.data[idx + 1] = rByte;
      rImg.data[idx + 2] = rByte;
      rImg.data[idx + 3] = 255;
    }
  }
  nCtx.putImageData(nImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  const map = new THREE.CanvasTexture(albedoCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(0.07, 0.07);
  map.anisotropy = maxAnisotropy;

  const normalMap = new THREE.CanvasTexture(normalCanvas);
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.repeat.set(0.07, 0.07);
  normalMap.anisotropy = maxAnisotropy;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(0.07, 0.07);
  roughnessMap.anisotropy = maxAnisotropy;

  return { map, normalMap, roughnessMap };
}

/**
 * Generates procedural Perlage (circular overlapping spun graining) for the Mainplate.
 */
function createPerlageTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const size = 512;
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const aCtx = albedoCanvas.getContext('2d')!;

  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = size;
  normalCanvas.height = size;
  const nCtx = normalCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  // Warm dark champagne-rhodium base for visual depth beneath brass gears
  aCtx.fillStyle = '#8b8f99';
  aCtx.fillRect(0, 0, size, size);

  nCtx.fillStyle = 'rgb(128,128,255)';
  nCtx.fillRect(0, 0, size, size);

  rCtx.fillStyle = 'rgb(88,88,88)';
  rCtx.fillRect(0, 0, size, size);

  const step = 32;
  const radius = 22;

  for (let row = -1; row <= size / step + 1; row++) {
    for (let col = -1; col <= size / step + 1; col++) {
      const cx = col * step + (row % 2 === 0 ? 0 : step * 0.5);
      const cy = row * step * 0.85;

      // Albedo spun rosette
      const aGrad = aCtx.createRadialGradient(cx, cy, 1, cx, cy, radius);
      aGrad.addColorStop(0.0, 'rgba(218, 222, 230, 0.65)');
      aGrad.addColorStop(0.35, 'rgba(150, 155, 166, 0.55)');
      aGrad.addColorStop(0.68, 'rgba(205, 210, 220, 0.50)');
      aGrad.addColorStop(0.92, 'rgba(110, 114, 124, 0.65)');
      aGrad.addColorStop(1.0, 'rgba(110, 114, 124, 0)');
      aCtx.fillStyle = aGrad;
      aCtx.beginPath();
      aCtx.arc(cx, cy, radius, 0, Math.PI * 2);
      aCtx.fill();

      // Concentric fine rings inside each perlage circle
      aCtx.strokeStyle = 'rgba(235, 240, 248, 0.22)';
      aCtx.lineWidth = 1;
      for (let rr = 4; rr < radius - 2; rr += 4) {
        aCtx.beginPath();
        aCtx.arc(cx, cy, rr, 0, Math.PI * 2);
        aCtx.stroke();
      }

      // Normal swirl hint (conic-like directional slope)
      const nGrad = nCtx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
      nGrad.addColorStop(0.0, 'rgb(165, 165, 242)');
      nGrad.addColorStop(0.5, 'rgb(128, 128, 255)');
      nGrad.addColorStop(1.0, 'rgb(92, 92, 242)');
      nCtx.fillStyle = nGrad;
      nCtx.beginPath();
      nCtx.arc(cx, cy, radius * 0.9, 0, Math.PI * 2);
      nCtx.fill();

      // Roughness rosette
      const rGrad = rCtx.createRadialGradient(cx, cy, 2, cx, cy, radius);
      rGrad.addColorStop(0.0, 'rgb(64,64,64)');
      rGrad.addColorStop(0.5, 'rgb(96,96,96)');
      rGrad.addColorStop(0.9, 'rgb(58,58,58)');
      rGrad.addColorStop(1.0, 'rgba(80,80,80,0)');
      rCtx.fillStyle = rGrad;
      rCtx.beginPath();
      rCtx.arc(cx, cy, radius, 0, Math.PI * 2);
      rCtx.fill();
    }
  }

  const map = new THREE.CanvasTexture(albedoCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(0.085, 0.085);
  map.anisotropy = maxAnisotropy;

  const normalMap = new THREE.CanvasTexture(normalCanvas);
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.repeat.set(0.085, 0.085);
  normalMap.anisotropy = maxAnisotropy;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(0.085, 0.085);
  roughnessMap.anisotropy = maxAnisotropy;

  return { map, normalMap, roughnessMap };
}

/**
 * Generates circular satin brushing for horological gear wheels.
 */
function createCircularBrushedTextures(maxAnisotropy: number): {
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const size = 256;
  const nCanvas = document.createElement('canvas');
  nCanvas.width = size;
  nCanvas.height = size;
  const nCtx = nCanvas.getContext('2d')!;
  const nImg = nCtx.createImageData(size, size);

  const rCanvas = document.createElement('canvas');
  rCanvas.width = size;
  rCanvas.height = size;
  const rCtx = rCanvas.getContext('2d')!;
  const rImg = rCtx.createImageData(size, size);

  const half = size * 0.5;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - half;
      const dy = y - half;
      const r = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      const brush = Math.sin(r * 1.45) * 0.16 + Math.sin(r * 3.7 + angle * 2) * 0.05;
      const nx = -Math.sin(angle) * brush;
      const ny = Math.cos(angle) * brush;
      const nz = Math.sqrt(Math.max(0.1, 1 - nx * nx - ny * ny));

      const idx = (y * size + x) * 4;
      nImg.data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      nImg.data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      nImg.data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      nImg.data[idx + 3] = 255;

      const rv = Math.round(THREE.MathUtils.clamp(0.22 + Math.sin(r * 1.45) * 0.06, 0.12, 0.34) * 255);
      rImg.data[idx] = rv;
      rImg.data[idx + 1] = rv;
      rImg.data[idx + 2] = rv;
      rImg.data[idx + 3] = 255;
    }
  }
  nCtx.putImageData(nImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  const normalMap = new THREE.CanvasTexture(nCanvas);
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.repeat.set(0.12, 0.12);
  normalMap.anisotropy = maxAnisotropy;

  const roughnessMap = new THREE.CanvasTexture(rCanvas);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(0.12, 0.12);
  roughnessMap.anisotropy = maxAnisotropy;

  return { normalMap, roughnessMap };
}

/**
 * Generates an engraved golden-inlaid horology nameplate texture for the barrel bridge.
 */
function createEngravedPlaqueTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0, '#c6cbd4');
  grad.addColorStop(0.5, '#e2e6ee');
  grad.addColorStop(1, '#bcc2cc');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 128);

  // Subtle horizontal hairline border
  ctx.strokeStyle = 'rgba(164, 128, 66, 0.75)';
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 10, 492, 108);

  // Gold-gilt engraved lettering
  ctx.fillStyle = '#b48a3e';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '600 34px Georgia, serif';
  ctx.fillText('CAL. CHRONOS-T1', 256, 48);

  ctx.fillStyle = '#535b69';
  ctx.font = '600 18px monospace';
  ctx.fillText('21,600 VPH  ·  33 JEWELS  ·  SWISS', 256, 88);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Custom Fresnel sapphire-glass shader for X-Ray visualization of plates & bridges.
 * Supports Three.js clipping planes cleanly via world position.
 */
function createFresnelGlassMaterial(tintHex: number, baseOpacity: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(tintHex) },
      uRimColor: { value: new THREE.Color(0x9bd8ff) },
      uBaseOpacity: { value: baseOpacity },
    },
    vertexShader: `
      varying vec3 vNormalWorld;
      varying vec3 vWorldPos;

      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vNormalWorld = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform vec3 uRimColor;
      uniform float uBaseOpacity;
      varying vec3 vNormalWorld;
      varying vec3 vWorldPos;

      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float ndotv = abs(dot(normalize(vNormalWorld), viewDir));
        float fresnel = pow(1.0 - clamp(ndotv, 0.0, 1.0), 2.4);
        vec3 col = mix(uColor, uRimColor, fresnel * 0.85 + 0.15);
        float alpha = clamp(uBaseOpacity + fresnel * 0.62, 0.08, 0.78);
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

export function createMovementMaterials(
  renderer: THREE.WebGLRenderer,
  isSoftwareGl: boolean,
): MovementMaterials {
  const maxAniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  const geneva = createGenevaStripeTextures(maxAniso);
  const perlage = createPerlageTextures(maxAniso);
  const brushed = createCircularBrushedTextures(maxAniso);
  const plaqueMap = createEngravedPlaqueTexture(maxAniso);

  // World-space clipping plane slicing from +X toward -X
  const cutawayPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 2.0);

  const rhodiumBridge = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xdce1e8),
    map: geneva.map,
    normalMap: geneva.normalMap,
    normalScale: new THREE.Vector2(0.45, 0.45),
    roughnessMap: geneva.roughnessMap,
    roughness: 0.24,
    metalness: 0.92,
    clearcoat: 0.2,
    clearcoatRoughness: 0.18,
    envMapIntensity: 1.35,
  });

  const engravedPlaque = new THREE.MeshPhysicalMaterial({
    map: plaqueMap,
    roughness: 0.26,
    metalness: 0.85,
    clearcoat: 0.25,
    envMapIntensity: 1.2,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const mainplateRhodium = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xb8bec8),
    map: perlage.map,
    normalMap: perlage.normalMap,
    normalScale: new THREE.Vector2(0.4, 0.4),
    roughnessMap: perlage.roughnessMap,
    roughness: 0.34,
    metalness: 0.88,
    envMapIntensity: 1.2,
  });

  const caseRingSteel = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xcfd4dc),
    roughness: 0.18,
    metalness: 0.96,
    clearcoat: 0.3,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.4,
  });

  const brassGear = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xe3bd6e),
    normalMap: brushed.normalMap,
    normalScale: new THREE.Vector2(0.28, 0.28),
    roughnessMap: brushed.roughnessMap,
    roughness: 0.22,
    metalness: 0.94,
    anisotropy: 0.65,
    envMapIntensity: 1.4,
  });

  const roseGoldGear = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xdfa07b),
    normalMap: brushed.normalMap,
    normalScale: new THREE.Vector2(0.25, 0.25),
    roughnessMap: brushed.roughnessMap,
    roughness: 0.2,
    metalness: 0.95,
    anisotropy: 0.7,
    envMapIntensity: 1.45,
  });

  const polishedSteel = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xe8edf5),
    roughness: 0.12,
    metalness: 0.97,
    clearcoat: 0.4,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.55,
  });

  const darkSteel = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x6c7585),
    roughness: 0.36,
    metalness: 0.9,
    envMapIntensity: 1.25,
  });

  const heatBluedSteel = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x1434a4),
    emissive: new THREE.Color(0x061038),
    emissiveIntensity: 0.35,
    roughness: 0.15,
    metalness: 0.95,
    clearcoat: 0.65,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.65,
  });

  const mainspringSteel = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x304269),
    roughness: 0.26,
    metalness: 0.92,
    envMapIntensity: 1.35,
  });

  // Synthetic Ruby (Corundum, IOR 1.77, transmission disabled on software GL to avoid extra pass)
  const syntheticRuby = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xd8124b),
    emissive: new THREE.Color(0x4c041a),
    emissiveIntensity: 0.55,
    roughness: 0.06,
    metalness: 0.08,
    transmission: isSoftwareGl ? 0 : 0.85,
    ior: 1.77,
    thickness: 1.2,
    attenuationColor: new THREE.Color(0x9e0834),
    attenuationDistance: 1.4,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    transparent: isSoftwareGl,
    opacity: isSoftwareGl ? 0.88 : 1.0,
    envMapIntensity: 1.7,
  });

  const goldChaton = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xf0c96a),
    roughness: 0.16,
    metalness: 0.96,
    clearcoat: 0.25,
    envMapIntensity: 1.45,
  });

  const xrayPlateGlass = createFresnelGlassMaterial(0x1e4c7a, 0.12);
  const xrayBridgeGlass = createFresnelGlassMaterial(0x3a82c4, 0.16);

  // Materials clipped by Cutaway mode (plates, bridges, case ring, plaque)
  const clippableMaterials: THREE.Material[] = [
    rhodiumBridge,
    engravedPlaque,
    mainplateRhodium,
    caseRingSteel,
  ];

  // All PBR materials toggled by Wireframe mode
  const allPbrMaterials: THREE.MeshPhysicalMaterial[] = [
    rhodiumBridge,
    engravedPlaque,
    mainplateRhodium,
    caseRingSteel,
    brassGear,
    roseGoldGear,
    polishedSteel,
    darkSteel,
    heatBluedSteel,
    mainspringSteel,
    syntheticRuby,
    goldChaton,
  ];

  const setCutawayEnabled = (enabled: boolean) => {
    const planes = enabled ? [cutawayPlane] : [];
    for (const mat of clippableMaterials) {
      mat.clippingPlanes = planes;
      mat.clipShadows = enabled;
      mat.side = enabled ? THREE.DoubleSide : THREE.FrontSide;
      mat.needsUpdate = true;
    }
  };

  const setCutawayOffset = (worldX: number) => {
    // Plane equation: normal · p + constant >= 0 kept -> -x + worldX >= 0 => x <= worldX kept
    cutawayPlane.constant = worldX;
  };

  const setWireframe = (enabled: boolean) => {
    for (const mat of allPbrMaterials) {
      mat.wireframe = enabled;
    }
    xrayPlateGlass.wireframe = enabled;
    xrayBridgeGlass.wireframe = enabled;
  };

  const dispose = () => {
    [
      geneva.map,
      geneva.normalMap,
      geneva.roughnessMap,
      perlage.map,
      perlage.normalMap,
      perlage.roughnessMap,
      brushed.normalMap,
      brushed.roughnessMap,
      plaqueMap,
    ].forEach((t) => t.dispose());

    allPbrMaterials.forEach((m) => m.dispose());
    xrayPlateGlass.dispose();
    xrayBridgeGlass.dispose();
  };

  return {
    rhodiumBridge,
    engravedPlaque,
    mainplateRhodium,
    caseRingSteel,
    brassGear,
    roseGoldGear,
    polishedSteel,
    darkSteel,
    heatBluedSteel,
    mainspringSteel,
    syntheticRuby,
    goldChaton,
    xrayPlateGlass,
    xrayBridgeGlass,
    cutawayPlane,
    setCutawayEnabled,
    setCutawayOffset,
    setWireframe,
    dispose,
  };
}
