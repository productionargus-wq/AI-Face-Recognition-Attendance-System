import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Precision Identity Matrix
 * A 3D WebGL background powered by Three.js embodying high-assurance biometric infrastructure,
 * landmark triangulation, and computational identity telemetry.
 */
export const PrecisionIdentityMatrix = () => {
  const mountRef = useRef(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let animationFrameId;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // --- 1. Scene & Camera Setup ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#f8f9ff'); // Theme surface
    scene.fog = new THREE.FogExp2('#f8f9ff', 0.022);

    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
    camera.position.set(0, 6, 26);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // --- 2. Circular Sprite Texture for Luminous Biometric Nodes ---
    const createCircleTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(0.25, 'rgba(0, 123, 185, 0.9)');
      gradient.addColorStop(0.6, 'rgba(0, 97, 148, 0.35)');
      gradient.addColorStop(1, 'rgba(0, 97, 148, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 64);
      const texture = new THREE.CanvasTexture(canvas);
      return texture;
    };
    const circleTexture = createCircleTexture();

    // --- 3. Undulating 3D Biometric Matrix Terrain ---
    const planeWidth = 70;
    const planeHeight = 55;
    const segmentsX = 48;
    const segmentsY = 38;
    const planeGeometry = new THREE.PlaneGeometry(planeWidth, planeHeight, segmentsX, segmentsY);
    planeGeometry.rotateX(-Math.PI / 2.15);
    planeGeometry.translate(0, -5, -4);

    // Store original vertex coordinates for procedural wave calculation
    const originalPositions = planeGeometry.attributes.position.clone();

    // Grid wireframe material (#cbdbf5 surface-dim & #006194 primary)
    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0xcbdbf5,
      wireframe: true,
      transparent: true,
      opacity: 0.65
    });
    const matrixMesh = new THREE.Mesh(planeGeometry, wireframeMaterial);
    scene.add(matrixMesh);

    // Dynamic Nodes on Matrix Vertices
    const vertexCount = planeGeometry.attributes.position.count;
    const colors = new Float32Array(vertexCount * 3);
    const colorPrimary = new THREE.Color('#006194');
    const colorAccent = new THREE.Color('#93ccff');
    const colorVerified = new THREE.Color('#00855d');
    const colorDim = new THREE.Color('#cbdbf5');

    for (let i = 0; i < vertexCount; i++) {
      const rand = Math.random();
      let c = colorDim;
      if (rand > 0.88) c = colorVerified; // Authenticated telemetry node
      else if (rand > 0.7) c = colorPrimary; // Active optical focus node
      else if (rand > 0.5) c = colorAccent;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    planeGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const matrixPointsMaterial = new THREE.PointsMaterial({
      size: 0.6,
      map: circleTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.NormalBlending,
      depthWrite: false
    });
    const matrixPoints = new THREE.Points(planeGeometry, matrixPointsMaterial);
    scene.add(matrixPoints);

    // --- 4. Floating Biometric Landmark Constellations ---
    const constellationCount = 65;
    const constellationGeometry = new THREE.BufferGeometry();
    const constellationPositions = new Float32Array(constellationCount * 3);
    const constellationVelocities = [];

    for (let i = 0; i < constellationCount; i++) {
      constellationPositions[i * 3] = (Math.random() - 0.5) * 44;
      constellationPositions[i * 3 + 1] = Math.random() * 16 - 1;
      constellationPositions[i * 3 + 2] = (Math.random() - 0.5) * 24;

      constellationVelocities.push({
        vx: (Math.random() - 0.5) * 0.008,
        vy: (Math.random() - 0.5) * 0.006,
        vz: (Math.random() - 0.5) * 0.008
      });
    }
    constellationGeometry.setAttribute('position', new THREE.BufferAttribute(constellationPositions, 3));

    const constellationMaterial = new THREE.PointsMaterial({
      size: 0.85,
      map: circleTexture,
      color: 0x007bb9,
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    });
    const constellationPoints = new THREE.Points(constellationGeometry, constellationMaterial);
    scene.add(constellationPoints);

    // Triangulation connecting lines between proximate nodes
    const maxConnections = constellationCount * 4;
    const linePositions = new Float32Array(maxConnections * 6);
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));

    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x93ccff,
      transparent: true,
      opacity: 0.35,
      blending: THREE.NormalBlending
    });
    const linesMesh = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(linesMesh);

    // --- 5. Mouse Parallax Tracking ---
    let mouseX = 0;
    let mouseY = 0;
    let targetCameraX = 0;
    let targetCameraY = 6;

    const handleMouseMove = (e) => {
      const normX = (e.clientX / window.innerWidth) * 2 - 1;
      const normY = -(e.clientY / window.innerHeight) * 2 + 1;
      mouseX = normX * 3.5;
      mouseY = normY * 1.8;
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    // --- 6. Window Resize Handler ---
    const handleResize = () => {
      if (!container) return;
      const newW = window.innerWidth;
      const newH = window.innerHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };
    window.addEventListener('resize', handleResize);

    // --- 7. Animation Loop ---
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Undulate terrain vertices to simulate biometric wave & feature topography
      const posAttr = planeGeometry.attributes.position;
      const origPos = originalPositions.array;
      const currentPos = posAttr.array;

      for (let i = 0; i < vertexCount; i++) {
        const idx = i * 3;
        const ox = origPos[idx];
        const oy = origPos[idx + 1];

        // Complex biological wave harmonic formula
        const zWave =
          Math.sin(ox * 0.12 + elapsedTime * 0.9) * Math.cos(oy * 0.12 + elapsedTime * 0.7) * 1.6 +
          Math.sin((ox + oy) * 0.08 + elapsedTime * 0.45) * 0.9;

        currentPos[idx + 2] = zWave;
      }
      posAttr.needsUpdate = true;

      // Update floating landmark constellation positions
      const constAttr = constellationGeometry.attributes.position;
      const constPos = constAttr.array;
      let lineVertexIdx = 0;
      const linePos = lineGeometry.attributes.position.array;

      for (let i = 0; i < constellationCount; i++) {
        const idx = i * 3;
        constPos[idx] += constellationVelocities[i].vx;
        constPos[idx + 1] += constellationVelocities[i].vy;
        constPos[idx + 2] += constellationVelocities[i].vz;

        // Boundary reflection
        if (Math.abs(constPos[idx]) > 22) constellationVelocities[i].vx *= -1;
        if (constPos[idx + 1] > 16 || constPos[idx + 1] < -2) constellationVelocities[i].vy *= -1;
        if (Math.abs(constPos[idx + 2]) > 14) constellationVelocities[i].vz *= -1;

        // Triangulate with proximate nodes
        for (let j = i + 1; j < constellationCount; j++) {
          const jdx = j * 3;
          const dx = constPos[idx] - constPos[jdx];
          const dy = constPos[idx + 1] - constPos[jdx + 1];
          const dz = constPos[idx + 2] - constPos[jdx + 2];
          const distSq = dx * dx + dy * dy + dz * dz;

          if (distSq < 55 && lineVertexIdx < maxConnections * 6 - 6) {
            linePos[lineVertexIdx++] = constPos[idx];
            linePos[lineVertexIdx++] = constPos[idx + 1];
            linePos[lineVertexIdx++] = constPos[idx + 2];
            linePos[lineVertexIdx++] = constPos[jdx];
            linePos[lineVertexIdx++] = constPos[jdx + 1];
            linePos[lineVertexIdx++] = constPos[jdx + 2];
          }
        }
      }
      constAttr.needsUpdate = true;
      lineGeometry.setDrawRange(0, lineVertexIdx / 3);
      lineGeometry.attributes.position.needsUpdate = true;

      // Smooth camera interpolation with mouse movement
      targetCameraX = mouseX;
      targetCameraY = 6 + mouseY;
      camera.position.x += (targetCameraX - camera.position.x) * 0.04;
      camera.position.y += (targetCameraY - camera.position.y) * 0.04;
      camera.lookAt(0, 1.5, 0);

      renderer.render(scene, camera);
    };

    animate();

    // --- 8. Cleanup & Disposal ---
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);

      if (container && renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      planeGeometry.dispose();
      wireframeMaterial.dispose();
      matrixPointsMaterial.dispose();
      circleTexture.dispose();
      constellationGeometry.dispose();
      constellationMaterial.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden select-none">
      {/* 3D WebGL Canvas Viewport */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Engineering HUD Telemetry Accents */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,rgba(0,97,148,0.06),transparent_70%)]" />

      {/* Discrete Corner Optical Reticles */}
      <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-[#006194]/40" />
      <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-[#006194]/40" />
      <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-[#006194]/40" />
      <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-[#006194]/40" />

      {/* Micro-telemetry Status Watermark */}
      <div className="absolute bottom-3 left-12 text-[9px] font-mono tracking-widest text-[#006194]/50 uppercase hidden md:flex items-center gap-2">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00855d] animate-pulse" />
        ARGUS // PRECISION IDENTITY MATRIX // NODE-SEC-V3 // BIOMETRIC MESH ACTIVE
      </div>
    </div>
  );
};
