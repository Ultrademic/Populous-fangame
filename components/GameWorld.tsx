
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
  selectedVillagerId: string | null;
  onVillagerSelect: (id: string | null) => void;
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
  onSpellCastComplete,
  selectedVillagerId,
  onVillagerSelect
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const planetGroupRef = useRef<THREE.Group | null>(null);
  const treesGroupRef = useRef<THREE.Group | null>(null);
  const blueprintsGroupRef = useRef<THREE.Group | null>(null);
  const villagersGroupRef = useRef<THREE.Group | null>(null);
  const buildingsGroupRef = useRef<THREE.Group | null>(null);
  const selectionRingRef = useRef<THREE.Group | null>(null);
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());

  // Configuration Constants
  const PLANET_RADIUS = 10;
  const TERRAIN_SCALE = 0.8;
  const TERRAIN_STRENGTH = 0.25;
  const MAX_TREES = 140; 
  const REGROWTH_INTERVAL = 5; 
  const GROWTH_SPEED = 0.0015;
  const HUT_CAPACITY = 4;

  const lastRegrowthTime = useRef(0);
  const isRotating = useRef(false);
  const rotationVelocity = useRef({ x: 0, y: 0 });
  const keysPressed = useRef<Record<string, boolean>>({});
  const cameraDistance = useRef(70);
  const targetDistance = useRef(70);

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
    onCancel,
    selectedVillagerId,
    onVillagerSelect,
    onWoodGathered
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
      onCancel,
      selectedVillagerId,
      onVillagerSelect,
      onWoodGathered
    };
  }, [isZoomed, isPlacingFlag, isPlacingBuilding, activeSpell, onFlagPlaced, onBuildingPlaced, onHutCompleted, onLog, onSpellCastComplete, onCancel, selectedVillagerId, onVillagerSelect, onWoodGathered]);

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

  const createBillboardTexture = (text: string, color: string = 'white') => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    
    // Glossy glass backing
    const gradient = ctx.createLinearGradient(0, 0, 0, 64);
    gradient.addColorStop(0, 'rgba(20, 20, 30, 0.95)');
    gradient.addColorStop(1, 'rgba(5, 5, 10, 0.98)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(4, 4, 120, 56, 16);
    ctx.fill();
    
    // Tech border
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.3;
    ctx.stroke();
    ctx.globalAlpha = 1.0;
    
    // Status text
    ctx.fillStyle = color;
    ctx.font = 'bold 32px "Segoe UI", Tahoma, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Slight glow effect for text
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillText(text, 64, 32);
    
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  };

  const updateHutBillboard = (hut: THREE.Group, playPulse: boolean = false) => {
    const population = hut.userData.population || 0;
    const sprite = hut.getObjectByName('billboard') as THREE.Sprite;
    if (sprite) {
      if (sprite.material.map) sprite.material.map.dispose();
      let color = '#ffffff';
      if (population >= HUT_CAPACITY) color = '#ff3333';
      else if (population > 0) color = '#ffdd44';
      
      sprite.material.map = createBillboardTexture(`${population}/${HUT_CAPACITY}`, color);
      sprite.material.needsUpdate = true;

      if (playPulse) {
        sprite.scale.set(2.2, 1.1, 1); // Temporary pulse scale
        setTimeout(() => {
          if (sprite) sprite.scale.set(1.5, 0.75, 1);
        }, 300);
      }
    }
  };

  const createCobblestoneTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const r = 12 + Math.random() * 18;
      ctx.fillStyle = `rgb(${70 + Math.random() * 40}, ${70 + Math.random() * 40}, ${75 + Math.random() * 40})`;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.8, Math.random() * Math.PI, 0, Math.PI * 2);
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
    const foliage = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 1), new THREE.MeshStandardMaterial({ color: 0x2e7d32 }));
    foliage.position.y = 1.0;
    tree.add(foliage);
    
    const scaleFactor = isSapling ? 0.1 : 1.0;
    tree.userData = { type: 'tree', health: 100, scaleFactor };
    tree.scale.setScalar(scaleFactor);
    return tree;
  };

  const ghostHutRef = useRef<THREE.Group | null>(null);
  const planetMeshRef = useRef<THREE.Mesh | null>(null);

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
    const planetMaterial = new THREE.MeshStandardMaterial({ color: 0x3a6b35, roughness: 1.0 });
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

    // Ocean layer
    const water = new THREE.Mesh(
      new THREE.SphereGeometry(PLANET_RADIUS - 0.1, 64, 64),
      new THREE.MeshStandardMaterial({ color: 0x0077be, transparent: true, opacity: 0.65 })
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

    // Selection Ring
    const selectionRing = new THREE.Group();
    const ringGeo = new THREE.TorusGeometry(0.35, 0.03, 16, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.8 });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI/2;
    selectionRing.add(ringMesh);
    selectionRing.visible = false;
    planetGroup.add(selectionRing);
    selectionRingRef.current = selectionRing;

    const createBlueprint = (isGhost: boolean = false) => {
      const group = new THREE.Group();
      const baseGeo = new THREE.BoxGeometry(1.8, 0.2, 1.8);
      const baseMat = new THREE.MeshStandardMaterial({ 
        map: cobbleTex,
        color: isGhost ? 0x60a5fa : 0xffffff, 
        transparent: isGhost, 
        opacity: isGhost ? 0.4 : 1.0 
      });
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.position.y = 0.1;
      group.add(base);

      const stakeGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.2, 8);
      const stakeMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f });
      [[-0.8, -0.8], [0.8, -0.8], [0.8, 0.8], [-0.8, 0.8]].forEach(([x, z]) => {
        const s = new THREE.Mesh(stakeGeo, stakeMat);
        s.position.set(x, -0.4, z);
        group.add(s);
      });

      if (isGhost) {
        group.traverse((child) => { child.raycast = () => {}; });
      } else {
        group.userData = { type: 'blueprint', progress: 0 };
      }
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
      group.userData = { 
        id: Math.random().toString(36).substr(2, 9),
        type: 'villager', 
        state: 'idle', 
        animTime: Math.random() * 10, 
        target: null,
        targetPos: null
      };
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

    for (let i = 0; i < 70; i++) {
      const t = createTree();
      let pos = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      const surf = getSurfacePos(pos);
      if (surf.length() > PLANET_RADIUS + 0.15) {
        t.position.copy(surf);
        t.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), surf.clone().normalize());
        treesGroup.add(t);
      }
    }

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(50, 100, 50);
    scene.add(sun);

    const animate = () => {
      const delta = 0.016; 
      const time = performance.now() / 1000;
      requestAnimationFrame(animate);
      
      const { isZoomed, isPlacingBuilding, onHutCompleted, selectedVillagerId, onWoodGathered, onLog } = propsRef.current;

      // 1. FOREST REGROWTH
      if (time - lastRegrowthTime.current > REGROWTH_INTERVAL) {
        if (treesGroup.children.length < MAX_TREES) {
          const t = createTree(true);
          let randDir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
          const surf = getSurfacePos(randDir);
          if (surf.length() > PLANET_RADIUS + 0.12) {
            t.position.copy(surf);
            t.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), surf.clone().normalize());
            treesGroup.add(t);
            lastRegrowthTime.current = time;
          }
        }
      }

      // 2. TREE GROWTH
      treesGroup.children.forEach((t: any) => {
        if (t.userData.scaleFactor < 1.0) {
          t.userData.scaleFactor += GROWTH_SPEED;
          t.scale.setScalar(t.userData.scaleFactor);
        }
      });

      // 3. CAMERA & CONTROLS
      if (keysPressed.current['KeyW'] || keysPressed.current['ArrowUp']) rotationVelocity.current.y += 0.025;
      if (keysPressed.current['KeyS'] || keysPressed.current['ArrowDown']) rotationVelocity.current.y -= 0.025;
      if (keysPressed.current['KeyA'] || keysPressed.current['ArrowLeft']) rotationVelocity.current.x -= 0.025;
      if (keysPressed.current['KeyD'] || keysPressed.current['ArrowRight']) rotationVelocity.current.x += 0.025;

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
      
      // GHOST PLACEMENT
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
      } else if (ghostHutRef.current) {
        ghostHutRef.current.visible = false;
      }

      // 4. VILLAGER AI
      if (isZoomed) {
        camera.position.lerp(new THREE.Vector3(0, cameraDistance.current * 0.3, cameraDistance.current), 0.1);
        camera.lookAt(0, PLANET_RADIUS, 0);

        villagersGroup.children.forEach((v: any) => {
          v.userData.animTime += delta;
          
          if (v.userData.id === selectedVillagerId && selectionRingRef.current) {
            selectionRingRef.current.visible = true;
            selectionRingRef.current.position.copy(v.position);
            selectionRingRef.current.quaternion.copy(v.quaternion);
          }

          if (v.userData.state === 'moving' && v.userData.targetPos) {
            if (v.position.distanceTo(v.userData.targetPos) > 0.4) {
              const dir = new THREE.Vector3().subVectors(v.userData.targetPos, v.position).normalize();
              v.position.addScaledVector(dir, 0.12);
              const snapped = getSurfacePos(v.position);
              v.position.copy(snapped);
              v.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), snapped.clone().normalize());
            } else {
              v.userData.state = 'idle';
              v.userData.targetPos = null;
            }
          }
          else if (v.userData.state === 'gathering' && v.userData.target) {
            const target = v.userData.target;
            if (v.position.distanceTo(target.position) > 1.4) {
              const dir = new THREE.Vector3().subVectors(target.position, v.position).normalize();
              v.position.addScaledVector(dir, 0.12);
              const snapped = getSurfacePos(v.position);
              v.position.copy(snapped);
              v.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), snapped.clone().normalize());
            } else {
              v.children[0].position.y = 0.2 + Math.sin(v.userData.animTime * 14) * 0.05;
              target.userData.health -= 0.5;
              if (target.userData.health <= 0) {
                treesGroup.remove(target);
                v.userData.state = 'idle';
                v.userData.target = null;
                onWoodGathered(15);
              }
            }
          }
          else if (v.userData.state === 'building' && v.userData.target) {
            const target = v.userData.target;
            if (v.position.distanceTo(target.position) > 1.4) {
              const dir = new THREE.Vector3().subVectors(target.position, v.position).normalize();
              v.position.addScaledVector(dir, 0.1);
              const snapped = getSurfacePos(v.position);
              v.position.copy(snapped);
              v.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), snapped.clone().normalize());
            } else {
              target.userData.progress += 0.25;
              v.children[0].position.y = 0.2 + Math.sin(v.userData.animTime * 14) * 0.05;
              if (target.userData.progress >= 100) {
                const pos = target.position.clone();
                const quat = target.quaternion.clone();
                blueprintsGroup.remove(target);
                
                const hut = new THREE.Group();
                hut.userData = { type: 'hut', population: 0 };
                
                const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 1.6), new THREE.MeshStandardMaterial({ color: 0x5d4037 }));
                base.position.y = 0.5;
                hut.add(base);
                
                const roof = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.9, 4), new THREE.MeshStandardMaterial({ color: 0x8b4513 }));
                roof.position.y = 1.4;
                roof.rotation.y = Math.PI/4;
                hut.add(roof);

                const spriteMaterial = new THREE.SpriteMaterial({ map: createBillboardTexture('0/4', 'white') });
                const sprite = new THREE.Sprite(spriteMaterial);
                sprite.name = 'billboard';
                sprite.position.y = 2.4;
                sprite.scale.set(1.5, 0.75, 1);
                hut.add(sprite);

                hut.position.copy(pos);
                hut.quaternion.copy(quat);
                buildingsGroup.add(hut);
                
                v.userData.state = 'idle';
                v.userData.target = null;
                onHutCompleted();
              }
            }
          }
          else if (v.userData.state === 'entering' && v.userData.target) {
            const target = v.userData.target;
            // Villagers must reach the foundation to enter
            if (v.position.distanceTo(target.position) > 0.45) {
              const dir = new THREE.Vector3().subVectors(target.position, v.position).normalize();
              v.position.addScaledVector(dir, 0.15);
              const snapped = getSurfacePos(v.position);
              v.position.copy(snapped);
              v.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), snapped.clone().normalize());
            } else {
              // Final check: hut might have filled while unit was walking
              if (target.userData.population < HUT_CAPACITY) {
                target.userData.population++;
                updateHutBillboard(target, true);
                villagersGroup.remove(v);
                onLog("Unit has entered domicile. Occupancy updated.");
                
                // Clear selection if this was the unit
                if (propsRef.current.selectedVillagerId === v.userData.id) {
                    propsRef.current.onVillagerSelect(null);
                    if (selectionRingRef.current) selectionRingRef.current.visible = false;
                }
              } else {
                v.userData.state = 'idle';
                v.userData.target = null;
                onLog("Domicile is full! Unit returning to idle.");
              }
            }
          }
          else {
            v.position.add(new THREE.Vector3(Math.sin(v.userData.animTime * 0.4) * 0.005, 0, Math.cos(v.userData.animTime * 0.4) * 0.005));
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
        const sens = 0.04;
        targetDistance.current = THREE.MathUtils.clamp(targetDistance.current + e.deltaY * sens, 15, 120);
      }
    };

    const handleClick = (e: MouseEvent) => {
      const { isZoomed, isPlacingBuilding, onBuildingPlaced, onVillagerSelect, selectedVillagerId, onLog } = propsRef.current;
      if (!isZoomed || e.button !== 0) return;
      
      raycaster.current.setFromCamera(mouse.current, camera);
      const intersects = raycaster.current.intersectObjects(scene.children, true);
      
      if (intersects.length > 0) {
        let vObj: THREE.Object3D | null = null;
        let tObj: THREE.Object3D | null = null;
        let bObj: THREE.Object3D | null = null;
        let hObj: THREE.Object3D | null = null;
        let pObj: THREE.Object3D | null = null;

        for (const intersection of intersects) {
          let cur: THREE.Object3D | null = intersection.object;
          while (cur && cur.parent) {
            if (cur.userData?.type === 'villager') vObj = cur;
            if (cur.userData?.type === 'tree') tObj = cur;
            if (cur.userData?.type === 'blueprint') bObj = cur;
            if (cur.userData?.type === 'hut') hObj = cur;
            if (cur.name === 'Planet') pObj = cur;
            cur = cur.parent;
          }
          if (vObj || tObj || bObj || hObj || pObj) break;
        }

        // 1. Selection logic
        if (vObj && !isPlacingBuilding) {
          onVillagerSelect(vObj.userData.id);
          return;
        }

        // 2. Tasking logic
        if (selectedVillagerId && !isPlacingBuilding) {
          const villager = villagersGroup.children.find((v: any) => v.userData.id === selectedVillagerId) as any;
          if (villager) {
            // Task: Enter Domicile
            if (hObj) {
              if (hObj.userData.population < HUT_CAPACITY) {
                villager.userData.state = 'entering';
                villager.userData.target = hObj;
                onLog("Unit pathing to domicile...");
              } else {
                onLog("Domicile is full, Shaman.");
              }
              return;
            }
            // Task: Gather Wood
            if (tObj) {
              villager.userData.state = 'gathering';
              villager.userData.target = tObj;
              onLog("Unit assigned to forest duty.");
              return;
            }
            // Task: Build
            if (bObj) {
              villager.userData.state = 'building';
              villager.userData.target = bObj;
              onLog("Unit assigned to construction.");
              return;
            }
            // Task: Move
            if (pObj) {
              const point = intersects.find(i => i.object.name === 'Planet')?.point;
              if (point) {
                villager.userData.state = 'moving';
                villager.userData.targetPos = getSurfacePos(point);
                return;
              }
            }
          }
        }

        // 3. Placement logic
        if (isPlacingBuilding && pObj) {
          const point = intersects.find(i => i.object.name === 'Planet')?.point;
          if (point) {
            const snapped = getSurfacePos(point);
            const bp = createBlueprint();
            bp.position.copy(snapped);
            bp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), snapped.clone().normalize());
            blueprintsGroup.add(bp);
            
            // Auto-task nearest idle
            const idleVillagers = villagersGroup.children.filter((v: any) => v.userData.state === 'idle');
            idleVillagers.slice(0, 3).forEach((v: any) => {
              v.userData.state = 'building';
              v.userData.target = bp;
            });

            onBuildingPlaced(snapped);
            return;
          }
        }

        // 4. Background click deselect
        if (!vObj && !tObj && !bObj && !hObj) {
          onVillagerSelect(null);
          if (selectionRingRef.current) selectionRingRef.current.visible = false;
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

    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = true;
      if (e.code === 'Escape') propsRef.current.onCancel();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('click', handleClick);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', (e) => keysPressed.current[e.code] = false);
    window.addEventListener('resize', handleResize);

    return () => { 
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
      if (containerRef.current) containerRef.current.innerHTML = ""; 
    };
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 z-0 bg-[#010103]">
    </div>
  );
};

export default GameWorld;
