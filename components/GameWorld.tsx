
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
  flagPosition: { x: number; y: number; z: number } | null;
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
  flagPosition 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const planetGroupRef = useRef<THREE.Group | null>(null);
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());

  // Navigation State
  const isRotating = useRef(false);
  const rotationVelocity = useRef({ x: 0, y: 0 });

  const [selectedVillager, setSelectedVillager] = useState<THREE.Group | null>(null);
  const selectedRef = useRef<THREE.Group | null>(null);
  const prevSelectedId = useRef<string | null>(null);

  // Constants
  const PLANET_RADIUS = 10;
  const TERRAIN_SCALE = 0.8;
  const TERRAIN_STRENGTH = 0.25;

  // Effects state
  const cameraShake = useRef(0);
  const particlesRef = useRef<THREE.Group | null>(null);

  // Shared terrain displacement function
  const getDisplacement = (v: THREE.Vector3) => {
    const nv = v.clone().normalize();
    return (Math.sin(nv.x * PLANET_RADIUS * TERRAIN_SCALE) + 
            Math.cos(nv.y * PLANET_RADIUS * TERRAIN_SCALE) + 
            Math.sin(nv.z * PLANET_RADIUS * TERRAIN_SCALE)) * TERRAIN_STRENGTH;
  };

  const getSurfacePos = (v: THREE.Vector3) => {
    const disp = getDisplacement(v);
    return v.clone().normalize().multiplyScalar(PLANET_RADIUS + disp);
  };

  // Helper for health bar texture
  const createHealthBarTexture = (percent: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, 128, 16);
      ctx.fillStyle = percent > 50 ? '#22c55e' : percent > 20 ? '#eab308' : '#ef4444';
      ctx.fillRect(2, 2, (124 * percent) / 100, 12);
    }
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  };

  // Assets refs
  const flagRef = useRef<THREE.Group | null>(null);
  const flagClothRef = useRef<THREE.Mesh | null>(null);
  const ghostHutRef = useRef<THREE.Group | null>(null);
  const planetMeshRef = useRef<THREE.Mesh | null>(null);

  // Particle System Factory for "Thuds" and construction
  const createDustPuff = (pos: THREE.Vector3, quat: THREE.Quaternion) => {
    if (!particlesRef.current) return;
    const puff = new THREE.Group();
    puff.position.copy(pos);
    puff.quaternion.copy(quat);
    
    for (let i = 0; i < 15; i++) {
      const p = new THREE.Mesh(
        new THREE.SphereGeometry(0.1 + Math.random() * 0.15, 6, 6),
        new THREE.MeshStandardMaterial({ color: 0x8b7355, transparent: true, opacity: 0.8, roughness: 1 })
      );
      const angle = Math.random() * Math.PI * 2;
      const dist = 0.4 + Math.random() * 0.4;
      p.position.set(Math.cos(angle) * dist, 0.1, Math.sin(angle) * dist);
      p.userData = { 
        vel: new THREE.Vector3(Math.cos(angle) * 0.04, 0.08 + Math.random() * 0.1, Math.sin(angle) * 0.04),
        life: 1.0 
      };
      puff.add(p);
    }
    particlesRef.current.add(puff);
    
    setTimeout(() => {
      particlesRef.current?.remove(puff);
    }, 1200);
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1500);
    cameraRef.current = camera;
    
    camera.position.set(0, 45, 70);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);

    const planetGroup = new THREE.Group();
    planetGroupRef.current = planetGroup;
    scene.add(planetGroup);

    // Planet setup
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
      new THREE.MeshStandardMaterial({ color: 0x0077be, transparent: true, opacity: 0.7 })
    );
    planetGroup.add(water);

    // Asset containers
    const villagersGroup = new THREE.Group();
    const treesGroup = new THREE.Group();
    const logsInWorldGroup = new THREE.Group();
    const blueprintsGroup = new THREE.Group();
    const buildingsGroup = new THREE.Group();
    const particlesGroup = new THREE.Group();
    particlesRef.current = particlesGroup;
    planetGroup.add(villagersGroup, treesGroup, logsInWorldGroup, blueprintsGroup, buildingsGroup, particlesGroup);

    const createLogMesh = () => {
      const log = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 0.4, 8),
        new THREE.MeshStandardMaterial({ color: 0x5d4037 })
      );
      log.rotation.z = Math.PI / 2;
      log.userData = { type: 'world_log' };
      return log;
    };

    const createFlag = () => {
      const group = new THREE.Group();
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.08, 4, 8),
        new THREE.MeshStandardMaterial({ color: 0x8b4513 })
      );
      pole.position.y = 2;
      group.add(pole);
      const clothGeo = new THREE.PlaneGeometry(1.2, 0.8, 10, 10);
      const clothMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, side: THREE.DoubleSide });
      const cloth = new THREE.Mesh(clothGeo, clothMat);
      cloth.position.set(0.65, 3.4, 0);
      cloth.name = "cloth";
      group.add(cloth);
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.12), new THREE.MeshStandardMaterial({ color: 0xffd700 }));
      orb.position.y = 4.1;
      group.add(orb);
      return group;
    };

    const tribalFlag = createFlag();
    tribalFlag.visible = false;
    planetGroup.add(tribalFlag);
    flagRef.current = tribalFlag;
    flagClothRef.current = tribalFlag.getObjectByName("cloth") as THREE.Mesh;

    const createHut = () => {
      const group = new THREE.Group();
      const wall = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.2), new THREE.MeshStandardMaterial({ color: 0x5d4037 }));
      wall.position.y = 0.4;
      group.add(wall);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1, 4), new THREE.MeshStandardMaterial({ color: 0xc4a484 }));
      roof.position.y = 1.3;
      roof.rotation.y = Math.PI / 4;
      group.add(roof);
      group.userData = { type: 'building' };
      return group;
    };

    const createBlueprint = (isGhost: boolean = false) => {
      const group = new THREE.Group();
      const rectGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.75, 0, -0.75),
        new THREE.Vector3(0.75, 0, -0.75),
        new THREE.Vector3(0.75, 0, 0.75),
        new THREE.Vector3(-0.75, 0, 0.75),
        new THREE.Vector3(-0.75, 0, -0.75)
      ]);
      const rectLine = new THREE.Line(rectGeo, new THREE.LineBasicMaterial({ 
        color: isGhost ? 0x60a5fa : 0xffffff, 
        transparent: true, 
        opacity: isGhost ? 0.6 : 1.0,
      }));
      rectLine.position.y = 0.1; 
      group.add(rectLine);

      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.8, 1.2),
        new THREE.MeshBasicMaterial({ 
          color: isGhost ? 0x3b82f6 : 0xffffff, 
          wireframe: true, 
          transparent: true, 
          opacity: isGhost ? 0.25 : 0.4 
        })
      );
      frame.position.y = 0.4;
      group.add(frame);

      if (isGhost) {
        group.traverse((child) => {
          child.raycast = () => {}; 
        });
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
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.35, 0.18), new THREE.MeshStandardMaterial({ color: tribeColor }));
      body.position.y = 0.175;
      group.add(body);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), new THREE.MeshStandardMaterial({ color: 0xffdbac }));
      head.position.y = 0.42;
      group.add(head);
      const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.08), new THREE.MeshStandardMaterial({ color: 0xffdbac }));
      leftArm.position.set(-0.18, 0.25, 0);
      leftArm.name = "leftArm";
      group.add(leftArm);
      const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.08), new THREE.MeshStandardMaterial({ color: 0xffdbac }));
      rightArm.position.set(0.18, 0.25, 0);
      rightArm.name = "rightArm";
      group.add(rightArm);
      const cargo = createLogMesh();
      cargo.name = "cargo";
      cargo.visible = false;
      cargo.position.set(0, 0.3, -0.15);
      cargo.rotation.set(0, 0, Math.PI / 2);
      group.add(cargo);
      group.userData = { 
        type: 'villager', 
        state: 'idle', 
        target: null, 
        id: Math.random().toString(36).substr(2, 9) 
      };
      return group;
    };

    const villagers: THREE.Group[] = [];
    for (let i = 0; i < 8; i++) {
      const v = createHumanoid(0x3b82f6);
      const angle = Math.random() * Math.PI * 2;
      const r = 1 + Math.random() * 2.5;
      const spawnPos = getSurfacePos(new THREE.Vector3(Math.cos(angle) * r, PLANET_RADIUS, Math.sin(angle) * r));
      v.position.copy(spawnPos);
      v.name = `Villager_${i + 1}`;
      villagersGroup.add(v);
      villagers.push(v);
    }

    const createTree = () => {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 0.8), new THREE.MeshStandardMaterial({ color: 0x5d4037 }));
      trunk.position.y = 0.4;
      tree.add(trunk);
      const foliage = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 1), new THREE.MeshStandardMaterial({ color: 0x2e7d32 }));
      foliage.position.y = 1.0;
      tree.add(foliage);

      const spriteMat = new THREE.SpriteMaterial({ map: createHealthBarTexture(100), transparent: true });
      const bar = new THREE.Sprite(spriteMat);
      bar.scale.set(0.8, 0.1, 1);
      bar.position.y = 1.8;
      bar.name = "healthBar";
      bar.visible = false;
      tree.add(bar);

      tree.userData = { type: 'tree', health: 100 };
      tree.name = "Tree";
      return tree;
    };

    const spawnTrees = () => {
      for (let i = 0; i < 30; i++) {
        const t = createTree();
        const angle = Math.random() * Math.PI * 2;
        const r = 5 + Math.random() * 8;
        const treePos = getSurfacePos(new THREE.Vector3(Math.cos(angle) * r, PLANET_RADIUS, Math.sin(angle) * r));
        t.position.copy(treePos);
        t.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), treePos.clone().normalize());
        treesGroup.add(t);
      }
    };
    spawnTrees();

    // Selection ring
    const selectionGroup = new THREE.Group();
    const ringGeo = new THREE.TorusGeometry(0.45, 0.025, 16, 64);
    const innerRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.9 }));
    innerRing.rotation.x = Math.PI / 2;
    selectionGroup.add(innerRing);
    
    const outerRingGeo = new THREE.TorusGeometry(0.6, 0.02, 16, 64);
    const outerRing = new THREE.Mesh(outerRingGeo, new THREE.MeshBasicMaterial({ color: 0xff3333, transparent: true, opacity: 0.6 }));
    outerRing.rotation.x = Math.PI / 2;
    selectionGroup.add(outerRing);
    
    selectionGroup.visible = false;
    planetGroup.add(selectionGroup);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(50, 50, 50);
    scene.add(sun);

    const animate = () => {
      const time = performance.now() * 0.001;
      requestAnimationFrame(animate);
      
      // Update Particles
      if (particlesRef.current) {
        particlesRef.current.children.forEach(puff => {
          puff.children.forEach((p: any) => {
            p.position.add(p.userData.vel);
            p.userData.vel.y -= 0.005; 
            p.userData.life -= 0.02;
            (p.material as THREE.MeshStandardMaterial).opacity = Math.max(0, p.userData.life);
            p.scale.setScalar(Math.max(0.1, p.userData.life));
          });
        });
      }

      // Camera Shake
      if (cameraShake.current > 0) {
        camera.position.x += (Math.random() - 0.5) * cameraShake.current;
        camera.position.y += (Math.random() - 0.5) * cameraShake.current;
        cameraShake.current *= 0.92;
        if (cameraShake.current < 0.005) cameraShake.current = 0;
      }

      // World Navigation (Rotation)
      if (isRotating.current) {
        // Rotate planet based on mouse velocity
        planetGroup.rotation.y += rotationVelocity.current.x * 0.005;
        planetGroup.rotation.x += rotationVelocity.current.y * 0.005;
        
        // Decay velocity for smoothness
        rotationVelocity.current.x *= 0.92;
        rotationVelocity.current.y *= 0.92;
      } else if (!isZoomed) {
        // Slow auto-rotation when in menu/zoom-out state
        planetGroup.rotation.y += 0.001;
      }

      // Ghost Placement Snap
      if (ghostHutRef.current && planetMeshRef.current) {
        if (isPlacingBuilding) {
          raycaster.current.setFromCamera(mouse.current, camera);
          const intersects = raycaster.current.intersectObject(planetMeshRef.current, true);
          if (intersects.length > 0) {
            ghostHutRef.current.visible = true;
            const snapped = getSurfacePos(intersects[0].point);
            ghostHutRef.current.position.copy(snapped);
            ghostHutRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), snapped.clone().normalize());
          } else {
            ghostHutRef.current.visible = false;
          }
        } else {
          ghostHutRef.current.visible = false;
        }
      }

      if (flagClothRef.current) {
        const cloth = flagClothRef.current;
        const posAttr = cloth.geometry.attributes.position;
        for (let i = 0; i < posAttr.count; i++) {
          const x = posAttr.getX(i);
          const wave = Math.sin(time * 5 + x * 2) * (x * 0.15);
          posAttr.setZ(i, wave);
        }
        posAttr.needsUpdate = true;
      }

      if (!isZoomed) {
        camera.position.lerp(new THREE.Vector3(0, 45, 70), 0.05);
        camera.lookAt(0, 0, 0);
      } else {
        camera.position.lerp(new THREE.Vector3(0, 16, 8), 0.04);
        camera.lookAt(0, 10, 0);

        // Villager AI cycle
        villagers.forEach((v, idx) => {
          const leftArm = v.getObjectByName("leftArm") as THREE.Mesh;
          const rightArm = v.getObjectByName("rightArm") as THREE.Mesh;
          const cargo = v.getObjectByName("cargo") as THREE.Mesh;

          if (v.userData.state === 'idle') {
            const moveVec = new THREE.Vector3(Math.sin(time + idx) * 0.005, 0, Math.cos(time + idx * 1.5) * 0.005);
            v.position.add(moveVec);
            const snapped = getSurfacePos(v.position);
            v.position.copy(snapped);
            v.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), snapped.clone().normalize());
            if (leftArm) leftArm.rotation.x = Math.sin(time * 2) * 0.1;
            if (rightArm) rightArm.rotation.x = Math.cos(time * 2) * 0.1;
          } 
          else if (v.userData.state === 'moving_to_tree' && v.userData.target) {
            const target = v.userData.target;
            if (!target.parent) { v.userData.state = 'idle'; return; }
            const dist = v.position.distanceTo(target.position);
            if (dist > 1.0) {
              const dir = new THREE.Vector3().subVectors(target.position, v.position).normalize();
              v.position.addScaledVector(dir, 0.06);
              const snapped = getSurfacePos(v.position);
              v.position.copy(snapped);
              v.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), snapped.clone().normalize());
              leftArm.rotation.x = Math.sin(time * 15) * 0.5;
              rightArm.rotation.x = -Math.sin(time * 15) * 0.5;
            } else {
              v.userData.state = 'chopping';
            }
          } 
          else if (v.userData.state === 'chopping' && v.userData.target) {
            const tree = v.userData.target;
            if (!tree.parent) { v.userData.state = 'idle'; return; }
            const chopFactor = Math.sin(time * 10);
            rightArm.rotation.x = -0.5 + chopFactor * 0.8; 
            if (chopFactor > 0.8) {
              tree.position.x += Math.sin(time * 50) * 0.01;
              tree.userData.health -= 0.5;
              
              const bar = tree.getObjectByName("healthBar") as THREE.Sprite;
              if (bar) {
                bar.visible = true;
                bar.material.map = createHealthBarTexture(tree.userData.health);
              }

              if (tree.userData.health <= 0) {
                const pos = tree.position.clone();
                treesGroup.remove(tree);
                onLog("Timber felled!");
                for(let i=0; i<3; i++) {
                  const logObj = createLogMesh();
                  logObj.position.copy(pos).add(new THREE.Vector3(Math.random()*0.5-0.25, 0.2, Math.random()*0.5-0.25));
                  logObj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pos.clone().normalize());
                  logsInWorldGroup.add(logObj);
                }
                v.userData.state = 'idle';
              }
            }
          }
          else if (v.userData.state === 'delivering') {
            const dest = flagRef.current?.visible ? flagRef.current.position : new THREE.Vector3(0, PLANET_RADIUS, 0);
            const dist = v.position.distanceTo(dest);
            if (dist > 1.2) {
              const dir = new THREE.Vector3().subVectors(dest, v.position).normalize();
              v.position.addScaledVector(dir, 0.05);
              const snapped = getSurfacePos(v.position);
              v.position.copy(snapped);
              v.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), snapped.clone().normalize());
              leftArm.rotation.x = Math.sin(time * 10) * 0.3;
              rightArm.rotation.x = -Math.sin(time * 10) * 0.3;
            } else {
              v.userData.state = 'idle';
              cargo.visible = false;
              onWoodGathered(10);
              onLog("Resource secured.");
            }
          }
          else if (v.userData.state === 'building' && v.userData.target) {
            const b = v.userData.target;
            if (!b.parent) { v.userData.state = 'idle'; return; }
            const dist = v.position.distanceTo(b.position);
            if (dist > 1.2) {
              const dir = new THREE.Vector3().subVectors(b.position, v.position).normalize();
              v.position.addScaledVector(dir, 0.06);
              const snapped = getSurfacePos(v.position);
              v.position.copy(snapped);
              v.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), snapped.clone().normalize());
              leftArm.rotation.x = Math.sin(time * 15) * 0.4;
              rightArm.rotation.x = -Math.sin(time * 15) * 0.4;
            } else {
              rightArm.rotation.x = -0.5 + Math.sin(time * 12) * 0.8;
              b.userData.progress += 0.15;
              if (b.userData.progress >= 100) {
                const pos = b.position.clone();
                const quat = b.quaternion.clone();
                blueprintsGroup.remove(b);
                const hut = createHut();
                hut.position.copy(pos);
                hut.quaternion.copy(quat);
                buildingsGroup.add(hut);
                v.userData.state = 'idle';
                onHutCompleted();
                createDustPuff(pos, quat); 
              }
            }
          }

          if (v.userData.state === 'idle' && logsInWorldGroup.children.length > 0) {
            const nearestLog = logsInWorldGroup.children[0] as THREE.Group;
            const dist = v.position.distanceTo(nearestLog.position);
            if (dist < 1.0) {
              logsInWorldGroup.remove(nearestLog);
              v.userData.state = 'delivering';
              cargo.visible = true;
            } else if (dist < 8) {
              const dir = new THREE.Vector3().subVectors(nearestLog.position, v.position).normalize();
              v.position.addScaledVector(dir, 0.05);
              const snapped = getSurfacePos(v.position);
              v.position.copy(snapped);
              v.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), snapped.clone().normalize());
            }
          }
        });
      }

      const activeVillager = selectedRef.current;
      if (activeVillager) {
        selectionGroup.visible = true;
        const currentTargetId = activeVillager.userData.id;
        if (prevSelectedId.current !== currentTargetId) {
          if (prevSelectedId.current === null) {
            selectionGroup.position.copy(activeVillager.position);
            selectionGroup.quaternion.copy(activeVillager.quaternion);
          }
          prevSelectedId.current = currentTargetId;
        }
        const targetDir = activeVillager.position.clone().normalize();
        const currentDir = selectionGroup.position.clone().normalize();
        currentDir.lerp(targetDir, 0.2);
        const elevation = getDisplacement(currentDir.clone().multiplyScalar(PLANET_RADIUS));
        const hoverHeight = 0.2 + Math.sin(time * 4) * 0.05;
        selectionGroup.position.copy(currentDir.multiplyScalar(PLANET_RADIUS + elevation + hoverHeight));
        selectionGroup.quaternion.slerp(activeVillager.quaternion, 0.2);
        const pulse = 1.0 + Math.sin(time * 6) * 0.05;
        innerRing.scale.set(pulse, pulse, 1);
        outerRing.scale.set(1.0 + Math.cos(time * 6) * 0.08, 1.0 + Math.cos(time * 6) * 0.08, 1);
        selectionGroup.rotateZ(0.01);
      } else {
        selectionGroup.visible = false;
        prevSelectedId.current = null;
      }
      
      renderer.render(scene, camera);
    };

    animate();

    const handleMouseMove = (event: MouseEvent) => {
      // If pointer is locked, use movement deltas for rotation
      if (document.pointerLockElement === containerRef.current) {
        rotationVelocity.current.x = event.movementX;
        rotationVelocity.current.y = event.movementY;
      } else {
        // Normal mouse position for raycasting
        mouse.current.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
      }
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button === 2) { // Right click for camera control
        event.preventDefault();
        containerRef.current?.requestPointerLock();
        isRotating.current = true;
      }
    };

    const handleMouseUp = (event: MouseEvent) => {
      if (event.button === 2) { // Release camera control
        document.exitPointerLock();
        isRotating.current = false;
      }
    };

    const handleClick = (event: MouseEvent) => {
      // Only process left clicks when zoomed in
      if (!isZoomed || event.button !== 0) return;
      
      raycaster.current.setFromCamera(mouse.current, camera);
      const intersects = raycaster.current.intersectObjects(scene.children, true);
      
      if (intersects.length > 0) {
        const clickedObj = intersects[0].object;
        
        // Handle Flag Placement
        if (isPlacingFlag && clickedObj.name === "Planet") {
          const point = intersects[0].point;
          const snapped = getSurfacePos(point);
          const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), snapped.clone().normalize());
          onFlagPlaced(snapped);
          if (flagRef.current) {
            flagRef.current.position.copy(snapped);
            flagRef.current.quaternion.copy(quat);
            flagRef.current.visible = true;
            createDustPuff(snapped, quat); 
            cameraShake.current = 0.35;
          }
          return;
        }

        // Handle Building Placement ("The Thud")
        if (isPlacingBuilding && clickedObj.name === "Planet") {
          const point = intersects[0].point;
          const snapped = getSurfacePos(point);
          const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), snapped.clone().normalize());
          const bp = createBlueprint();
          bp.position.copy(snapped);
          bp.quaternion.copy(quat);
          blueprintsGroup.add(bp);
          onBuildingPlaced(snapped);
          
          createDustPuff(snapped, quat);
          cameraShake.current = 0.65; // Massive thud for buildings
          onLog("Divine foundation set with a THUD.");
          return;
        }

        // Handle Selection/Commanding
        let group: any = clickedObj;
        while (group && group.type !== 'Group' && group.parent) group = group.parent;

        if (group && group.userData.type === 'villager') {
          setSelectedVillager(group);
          selectedRef.current = group;
          onLog(`Commanding ${group.name}.`);
        } else if (group && group.userData.type === 'tree') {
          if (selectedRef.current) {
            selectedRef.current.userData.state = 'moving_to_tree';
            selectedRef.current.userData.target = group;
            onLog(`${selectedRef.current.name} harvesting timber.`);
          }
        } else if (group && group.userData.type === 'blueprint') {
          if (selectedRef.current) {
            selectedRef.current.userData.state = 'building';
            selectedRef.current.userData.target = group;
            onLog(`${selectedRef.current.name} assigned to construction.`);
          }
        } else if (clickedObj.name === "Planet") {
          setSelectedVillager(null);
          selectedRef.current = null;
        }
      }
    };

    const handleContextMenu = (e: MouseEvent) => e.preventDefault();

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('click', handleClick);
    window.addEventListener('contextmenu', handleContextMenu);

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('resize', handleResize);
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, [isZoomed, isPlacingFlag, isPlacingBuilding]);

  useEffect(() => {
    if (flagPosition && flagRef.current) {
      const pos = new THREE.Vector3(flagPosition.x, flagPosition.y, flagPosition.z);
      flagRef.current.position.copy(pos);
      flagRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pos.clone().normalize());
      flagRef.current.visible = true;
    }
  }, [flagPosition]);

  return <div ref={containerRef} className="absolute inset-0 z-0 bg-[#020205]" />;
};

export default GameWorld;
