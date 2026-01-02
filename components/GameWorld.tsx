
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface GameWorldProps {
  isZoomed: boolean;
  onWoodGathered: (amount: number) => void;
  onLog: (msg: string) => void;
  isPlacingFlag: boolean;
  isPlacingBuilding: boolean;
  onFlagPlaced: (pos: THREE.Vector3) => void;
  onBuildingPlaced: (pos: THREE.Vector3) => void;
  onHutCompleted: () => void;
  onCancel: () => void;
  flagPosition: { x: number; y: number; z: number } | null;
  activeSpell?: string | null;
  onSpellCastComplete?: () => void;
}

const GameWorld: React.FC<GameWorldProps> = ({ 
  isZoomed, 
  onWoodGathered, 
  onLog, 
  isPlacingFlag, 
  isPlacingBuilding,
  onFlagPlaced,
  onBuildingPlaced,
  onHutCompleted,
  onCancel,
  flagPosition,
  activeSpell,
  onSpellCastComplete
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const planetGroupRef = useRef<THREE.Group | null>(null);
  const treesGroupRef = useRef<THREE.Group | null>(null);
  const blueprintsGroupRef = useRef<THREE.Group | null>(null);
  const villagersGroupRef = useRef<THREE.Group | null>(null);
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());

  const lastRegrowthTime = useRef(0);
  const MAX_TREES = 120;
  const REGROWTH_INTERVAL = 5; // seconds

  const propsRef = useRef({
    isZoomed,
    isPlacingFlag,
    isPlacingBuilding,
    activeSpell,
    onFlagPlaced,
    onBuildingPlaced,
    onHutCompleted,
    onLog,
    onSpellCastComplete,
    onCancel
  });

  useEffect(() => {
    propsRef.current = {
      isZoomed,
      isPlacingFlag,
      isPlacingBuilding,
      activeSpell,
      onFlagPlaced,
      onBuildingPlaced,
      onHutCompleted,
      onLog,
      onSpellCastComplete,
      onCancel
    };
  }, [isZoomed, isPlacingFlag, isPlacingBuilding, activeSpell, onFlagPlaced, onBuildingPlaced, onHutCompleted, onLog, onSpellCastComplete, onCancel]);

  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; text: string } | null>(null);

  const isRotating = useRef(false);
  const rotationVelocity = useRef({ x: 0, y: 0 });
  const keysPressed = useRef<Record<string, boolean>>({});
  const cameraDistance = useRef(70);
  const targetDistance = useRef(70);

  const PLANET_RADIUS = 10;
  const TERRAIN_SCALE = 0.8;
  const TERRAIN_STRENGTH = 0.25;

  const cameraShake = useRef(0);

  const getDisplacement = (v: THREE.Vector3) => {
    const nv = v.clone().normalize();
    return (Math.sin(nv.x * PLANET_RADIUS * TERRAIN_SCALE) + 
            Math.cos(nv.y * PLANET_RADIUS * TERRAIN_SCALE) + 
            // @ts-ignore
            Math.sin(nv.z * PLANET_RADIUS * TERRAIN_SCALE)) * TERRAIN_STRENGTH;
  };

  const getSurfacePos = (v: THREE.Vector3) => {
    const disp = getDisplacement(v);
    return v.clone().normalize().multiplyScalar(PLANET_RADIUS + disp);
  };

  const createCobblestoneTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#444';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 4;
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const r = 15 + Math.random() * 25;
      ctx.fillStyle = `rgb(${80 + Math.random() * 40}, ${80 + Math.random() * 40}, ${80 + Math.random() * 40})`;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.7, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  };

  const createTree = (isSapling = false) => {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 0.8), new THREE.MeshStandardMaterial({ color: 0x5d4037 }));
    trunk.position.y = 0.4;
    tree.add(trunk);
    const foliage = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45, 1), new THREE.MeshStandardMaterial({ color: 0x2e7d32 }));
    foliage.position.y = 0.95;
    tree.add(foliage);
    tree.userData = { type: 'tree', health: 100, scaleFactor: isSapling ? 0.1 : 1.0 };
    if (isSapling) tree.scale.setScalar(0.1);
    return tree;
  };

  const flagRef = useRef<THREE.Group | null>(null);
  const ghostHutRef = useRef<THREE.Group | null>(null);
  const planetMeshRef = useRef<THREE.Mesh | null>(null);
  const buildingsGroupRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    cameraRef.current = camera;
    
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);

    const planetGroup = new THREE.Group();
    planetGroupRef.current = planetGroup;
    scene.add(planetGroup);

    const cobbleTex = createCobblestoneTexture();

    const planetGeometry = new THREE.SphereGeometry(PLANET_RADIUS, 128, 128);
    const planetMaterial = new THREE.MeshStandardMaterial({ color: 0x3a6b35, roughness: 0.9 });
    const posAttr = planetGeometry.getAttribute('position');
    const vertex = new THREE.Vector3();
    for (let i = 0; i < posAttr.count; i++) {
      vertex.fromBufferAttribute(posAttr, i);
      const surfacePos = getSurfacePos(vertex);
      posAttr.setXYZ(i, surfacePos.x, surfacePos.y, surfacePos.z);
    }
    planetGeometry.computeVertexNormals();
    const planet = new THREE.Mesh(planetGeometry, planetMaterial);
    planet.name = "Planet";
    planetGroup.add(planet);
    planetMeshRef.current = planet;

    const water = new THREE.Mesh(
      new THREE.SphereGeometry(PLANET_RADIUS - 0.1, 64, 64),
      new THREE.MeshStandardMaterial({ color: 0x0077be, transparent: true, opacity: 0.6 })
    );
    planetGroup.add(water);

    const villagersGroup = new THREE.Group();
    villagersGroupRef.current = villagersGroup;
    const treesGroup = new THREE.Group();
    treesGroupRef.current = treesGroup;
    const blueprintsGroup = new THREE.Group();
    blueprintsGroupRef.current = blueprintsGroup;
    const buildingsGroup = new THREE.Group();
    buildingsGroupRef.current = buildingsGroup;
    planetGroup.add(villagersGroup, treesGroup, blueprintsGroup, buildingsGroup);

    const createBlueprint = (isGhost: boolean = false) => {
      const group = new THREE.Group();
      const baseGeo = new THREE.BoxGeometry(1.8, 0.15, 1.8);
      const baseMat = new THREE.MeshStandardMaterial({ 
        map: cobbleTex,
        color: isGhost ? 0x60a5fa : 0xffffff, 
        transparent: isGhost, 
        opacity: isGhost ? 0.3 : 1.0 
      });
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.position.y = 0.05;
      group.add(base);

      // Add support stakes
      const stakeGeo = new THREE.CylinderGeometry(0.05, 0.05, 1, 8);
      const stakeMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f });
      [[-0.8, -0.8], [0.8, -0.8], [0.8, 0.8], [-0.8, 0.8]].forEach(([x, z]) => {
        const s = new THREE.Mesh(stakeGeo, stakeMat);
        s.position.set(x, -0.4, z);
        group.add(s);
      });

      if (isGhost) group.traverse((child) => { child.raycast = () => {}; });
      else group.userData = { type: 'blueprint', progress: 0, builders: 0 };
      return group;
    };

    const ghostHut = createBlueprint(true);
    ghostHut.visible = false;
    planetGroup.add(ghostHut);
    ghostHutRef.current = ghostHut;

    const createHumanoid = (tribeColor: number) => {
      const group = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.18, 4, 8), new THREE.MeshStandardMaterial({ color: tribeColor }));
      body.position.y = 0.2;
      group.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), new THREE.MeshStandardMaterial({ color: 0xffdbac }));
      head.position.y = 0.42;
      group.add(head);
      group.userData = { type: 'villager', state: 'idle', id: Math.random().toString(36).substr(2, 9), animTime: Math.random() * 10, target: null };
      return group;
    };

    for (let i = 0; i < 8; i++) {
      const v = createHumanoid(0x3b82f6);
      const angle = Math.random() * Math.PI * 2;
      const spawnPos = getSurfacePos(new THREE.Vector3(Math.cos(angle) * 3, PLANET_RADIUS, Math.sin(angle) * 3));
      v.position.copy(spawnPos);
      v.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), spawnPos.clone().normalize());
      villagersGroup.add(v);
    }

    // Initial forest
    for (let i = 0; i < 60; i++) {
      const t = createTree();
      let pos = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      const surf = getSurfacePos(pos);
      if (surf.length() > PLANET_RADIUS + 0.1) { // Only place if above water
        t.position.copy(surf);
        t.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), surf.clone().normalize());
        treesGroup.add(t);
      }
    }

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(50, 50, 50);
    scene.add(sun);

    const animate = () => {
      const delta = 0.016; 
      const time = performance.now() / 1000;
      requestAnimationFrame(animate);
      
      const { isZoomed, isPlacingBuilding, onHutCompleted } = propsRef.current;

      // TREE REGROWTH
      if (time - lastRegrowthTime.current > REGROWTH_INTERVAL) {
        if (treesGroup.children.length < MAX_TREES) {
          const t = createTree(true);
          let pos = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
          const surf = getSurfacePos(pos);
          if (surf.length() > PLANET_RADIUS + 0.1) {
            t.position.copy(surf);
            t.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), surf.clone().normalize());
            treesGroup.add(t);
            lastRegrowthTime.current = time;
          }
        }
      }

      // TREE GROWTH SCALE
      treesGroup.children.forEach((t: any) => {
        if (t.userData.scaleFactor < 1.0) {
          t.userData.scaleFactor += 0.002;
          t.scale.setScalar(t.userData.scaleFactor);
        }
      });

      if (cameraShake.current > 0) {
        camera.position.x += (Math.random() - 0.5) * cameraShake.current;
        camera.position.y += (Math.random() - 0.5) * cameraShake.current;
        cameraShake.current *= 0.9;
      }

      // ROTATION VELOCITY (KEYBOARD)
      if (keysPressed.current['KeyW'] || keysPressed.current['ArrowUp']) rotationVelocity.current.y += 0.025;
      if (keysPressed.current['KeyS'] || keysPressed.current['ArrowDown']) rotationVelocity.current.y -= 0.025;
      if (keysPressed.current['KeyA'] || keysPressed.current['ArrowLeft']) rotationVelocity.current.x -= 0.025;
      if (keysPressed.current['KeyD'] || keysPressed.current['ArrowRight']) rotationVelocity.current.x += 0.025;
      if (keysPressed.current['KeyQ']) targetDistance.current = Math.max(15, targetDistance.current - 1);
      if (keysPressed.current['KeyE']) targetDistance.current = Math.min(120, targetDistance.current + 1);

      if (isRotating.current || Math.abs(rotationVelocity.current.x) > 0.001 || Math.abs(rotationVelocity.current.y) > 0.001) {
        planetGroup.rotation.y += rotationVelocity.current.x * 0.01;
        const nextX = planetGroup.rotation.x + rotationVelocity.current.y * 0.01;
        planetGroup.rotation.x = THREE.MathUtils.clamp(nextX, -Math.PI / 2.2, Math.PI / 2.2);
        rotationVelocity.current.x *= 0.92;
        rotationVelocity.current.y *= 0.92;
      } else if (!isZoomed) {
        planetGroup.rotation.y += 0.001;
      }

      cameraDistance.current = THREE.MathUtils.lerp(cameraDistance.current, targetDistance.current, 0.08);
      raycaster.current.setFromCamera(mouse.current, camera);
      
      if (isPlacingBuilding && ghostHutRef.current && planetMeshRef.current) {
        const intersects = raycaster.current.intersectObject(planetMeshRef.current, true);
        if (intersects.length > 0) {
          ghostHutRef.current.visible = true;
          const snapped = getSurfacePos(intersects[0].point);
          ghostHutRef.current.position.copy(snapped);
          ghostHutRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), snapped.clone().normalize());
        } else {
          ghostHutRef.current.visible = false;
        }
      }

      if (isZoomed) {
        camera.position.lerp(new THREE.Vector3(0, cameraDistance.current * 0.25, cameraDistance.current), 0.1);
        camera.lookAt(0, 10, 0);

        villagersGroup.children.forEach((v: any) => {
          v.userData.animTime += delta;
          
          if (v.userData.state === 'building' && v.userData.target) {
            const target = v.userData.target;
            if (v.position.distanceTo(target.position) > 1.4) {
              const dir = new THREE.Vector3().subVectors(target.position, v.position).normalize();
              v.position.addScaledVector(dir, 0.06);
              const snapped = getSurfacePos(v.position);
              v.position.copy(snapped);
              v.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), snapped.clone().normalize());
            } else {
              target.userData.progress += 0.2;
              v.children[0].position.y = 0.2 + Math.sin(v.userData.animTime * 15) * 0.05;
              if (target.userData.progress >= 100) {
                const pos = target.position.clone();
                const quat = target.quaternion.clone();
                blueprintsGroup.remove(target);
                const hut = new THREE.Group();
                const wall = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1, 1.5), new THREE.MeshStandardMaterial({ color: 0x5d4037 }));
                wall.position.y = 0.5;
                hut.add(wall);
                const roof = new THREE.Mesh(new THREE.ConeGeometry(1.2, 0.8, 4), new THREE.MeshStandardMaterial({ color: 0x8b4513 }));
                roof.position.y = 1.4;
                roof.rotation.y = Math.PI / 4;
                hut.add(roof);

                hut.position.copy(pos);
                hut.quaternion.copy(quat);
                buildingsGroup.add(hut);
                v.userData.state = 'idle';
                v.userData.target = null;
                onHutCompleted();
              }
            }
          } else {
            v.position.add(new THREE.Vector3(Math.sin(v.userData.animTime * 0.5) * 0.005, 0, Math.cos(v.userData.animTime * 0.5) * 0.005));
            const snapped = getSurfacePos(v.position);
            v.position.copy(snapped);
            v.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), snapped.clone().normalize());
          }
        });
      } else {
        camera.position.lerp(new THREE.Vector3(0, 45, 70), 0.05);
        camera.lookAt(0, 0, 0);
      }
      
      renderer.render(scene, camera);
    };

    animate();

    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === containerRef.current) {
        rotationVelocity.current.x += e.movementX * 0.05;
        rotationVelocity.current.y += e.movementY * 0.05;
      } else {
        mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (propsRef.current.isZoomed) {
        // e.preventDefault(); // Might trigger warning if not passive, but we want it for better control
        const sensitivity = 0.04;
        targetDistance.current = THREE.MathUtils.clamp(targetDistance.current + e.deltaY * sensitivity, 15, 120);
      }
    };

    const handleClick = (e: MouseEvent) => {
      const { isZoomed, isPlacingBuilding, onBuildingPlaced } = propsRef.current;
      if (!isZoomed || e.button !== 0) return;
      
      raycaster.current.setFromCamera(mouse.current, camera);
      const intersects = raycaster.current.intersectObjects(scene.children, true);
      
      if (intersects.length > 0) {
        const clickedObj = intersects[0].object;
        
        if (isPlacingBuilding && clickedObj.name === "Planet") {
          const point = intersects[0].point;
          const snapped = getSurfacePos(point);
          const bp = createBlueprint();
          bp.position.copy(snapped);
          bp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), snapped.clone().normalize());
          blueprintsGroup.add(bp);
          
          const idleVillagers = villagersGroup.children.filter((v: any) => v.userData.state === 'idle');
          idleVillagers.slice(0, 3).forEach((v: any) => {
            v.userData.state = 'building';
            v.userData.target = bp;
          });

          onBuildingPlaced(snapped);
          return;
        }
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 2) {
        containerRef.current?.requestPointerLock();
        isRotating.current = true;
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 2) {
        document.exitPointerLock();
        isRotating.current = false;
      }
    };

    const handleResize = () => {
      if (cameraRef.current) {
        cameraRef.current.aspect = window.innerWidth / window.innerHeight;
        cameraRef.current.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('click', handleClick);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', (e) => keysPressed.current[e.code] = true);
    window.addEventListener('keyup', (e) => keysPressed.current[e.code] = false);
    window.addEventListener('resize', handleResize);

    return () => { 
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('resize', handleResize);
      if (containerRef.current) containerRef.current.innerHTML = ""; 
    };
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 z-0 bg-[#020205]">
      {hoverInfo && (
        <div 
          className="absolute pointer-events-none bg-black/80 border border-white/20 px-2 py-1 rounded text-[10px] text-white z-50 shadow-xl"
          style={{ left: hoverInfo.x + 10, top: hoverInfo.y - 30 }}
        >
          {hoverInfo.text}
        </div>
      )}
    </div>
  );
};

export default GameWorld;
