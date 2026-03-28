/* ===================================================
   NexCall — Three.js Animated Background
=================================================== */

export function initThreeBackground(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof THREE === 'undefined') return null;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.z = 600;

  // Particle system
  const particleCount = 1800;
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);

  const color1 = new THREE.Color(0x7c3aed); // purple
  const color2 = new THREE.Color(0x06b6d4); // cyan
  const color3 = new THREE.Color(0x8b5cf6); // violet
  const palette = [color1, color2, color3];

  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;
    positions[i3]     = (Math.random() - 0.5) * 2400;
    positions[i3 + 1] = (Math.random() - 0.5) * 1800;
    positions[i3 + 2] = (Math.random() - 0.5) * 1200;

    const c = palette[Math.floor(Math.random() * palette.length)];
    colors[i3]     = c.r;
    colors[i3 + 1] = c.g;
    colors[i3 + 2] = c.b;

    sizes[i] = Math.random() * 3 + 0.5;
  }

  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  particleGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const particleMat = new THREE.PointsMaterial({
    size: 2.5,
    vertexColors: true,
    transparent: true,
    opacity: 0.7,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const particles = new THREE.Points(particleGeo, particleMat);
  scene.add(particles);

  // Floating geometric shapes
  const shapes = [];
  const geometries = [
    new THREE.IcosahedronGeometry(30, 1),
    new THREE.OctahedronGeometry(25, 0),
    new THREE.TetrahedronGeometry(22, 0),
    new THREE.DodecahedronGeometry(20, 0),
  ];

  for (let i = 0; i < 12; i++) {
    const geo = geometries[i % geometries.length];
    const mat = new THREE.MeshBasicMaterial({
      color: i % 2 === 0 ? 0x7c3aed : 0x06b6d4,
      wireframe: true,
      transparent: true,
      opacity: 0.12 + Math.random() * 0.1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      (Math.random() - 0.5) * 1800,
      (Math.random() - 0.5) * 1200,
      (Math.random() - 0.5) * 600
    );
    mesh.rotation.set(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2
    );
    const scale = 0.5 + Math.random() * 1.5;
    mesh.scale.set(scale, scale, scale);
    mesh.userData = {
      rotSpeed: (Math.random() - 0.5) * 0.008,
      floatSpeed: 0.0008 + Math.random() * 0.001,
      floatOffset: Math.random() * Math.PI * 2,
    };
    scene.add(mesh);
    shapes.push(mesh);
  }

  // Connection lines between nearby particles (static)
  const linePositions = [];
  const lineSample = 200;
  for (let i = 0; i < lineSample; i++) {
    for (let j = i + 1; j < lineSample; j++) {
      const i3 = i * 3, j3 = j * 3;
      const dx = positions[i3] - positions[j3];
      const dy = positions[i3+1] - positions[j3+1];
      const dz = positions[i3+2] - positions[j3+2];
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
      if (dist < 180) {
        linePositions.push(positions[i3], positions[i3+1], positions[i3+2]);
        linePositions.push(positions[j3], positions[j3+1], positions[j3+2]);
      }
    }
  }

  if (linePositions.length > 0) {
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePositions), 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x7c3aed,
      transparent: true,
      opacity: 0.06,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    scene.add(new THREE.LineSegments(lineGeo, lineMat));
  }

  // Mouse interaction
  let mouseX = 0, mouseY = 0;
  let targetX = 0, targetY = 0;

  const onMouseMove = (e) => {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = -(e.clientY / window.innerHeight - 0.5) * 2;
  };

  window.addEventListener('mousemove', onMouseMove);

  // Resize handler
  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', onResize);

  let animId = null;
  let t = 0;
  let isRunning = true;

  const animate = () => {
    if (!isRunning) return;
    animId = requestAnimationFrame(animate);
    t += 0.005;

    // Smooth camera tracking
    targetX += (mouseX * 60 - targetX) * 0.05;
    targetY += (mouseY * 40 - targetY) * 0.05;
    camera.position.x = targetX;
    camera.position.y = targetY;
    camera.lookAt(scene.position);

    // Rotate particle cloud slowly
    particles.rotation.y = t * 0.04;
    particles.rotation.x = t * 0.02;

    // Animate shapes
    shapes.forEach((mesh) => {
      const d = mesh.userData;
      mesh.rotation.x += d.rotSpeed;
      mesh.rotation.y += d.rotSpeed * 0.7;
      mesh.position.y += Math.sin(t * d.floatSpeed * 300 + d.floatOffset) * 0.3;
    });

    renderer.render(scene, camera);
  };

  animate();

  return {
    stop() {
      isRunning = false;
      if (animId) cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    },
    restart() {
      if (!isRunning) {
        isRunning = true;
        animate();
      }
    }
  };
}
