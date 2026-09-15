import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PoseFrame } from '../../../../src/core/types/pose-frame';
import { Landmark, LandmarkId } from '../../../../src/core/types/landmark';
import { CameraViewAngle, SwingKinematics } from '../../../../src/core/types/golf-swing';
import { getLandmark } from '../../../../src/core/metrics/golf-swing-metrics';

interface NeonSentinel3DViewProps {
  currentFrame: PoseFrame | null;
  addressFrame?: PoseFrame | null;
  frames: PoseFrame[];
  activeIntFrame?: number;
  viewAngle: CameraViewAngle;
  isRightHanded: boolean;
  isMirroredView: boolean;
  showClubheadPath: boolean;
  showHandTrajectory: boolean;
  metrics?: SwingKinematics | null;
  onViewAngleChange?: (angle: CameraViewAngle) => void;
  className?: string;
}

export default function NeonSentinel3DView({
  currentFrame,
  frames,
  viewAngle,
  isRightHanded,
  isMirroredView,
  showClubheadPath,
  metrics,
  onViewAngleChange,
  className = ''
}: NeonSentinel3DViewProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const skinnedMeshRef = useRef<THREE.SkinnedMesh | null>(null);
  const bonesMapRef = useRef<Record<string, THREE.Bone>>({});
  const initialQuatsRef = useRef<Record<string, THREE.Quaternion>>({});
  const initialPosRef = useRef<Record<string, THREE.Vector3>>({});
  const clubGroupRef = useRef<THREE.Group | null>(null);
  const trailLineRef = useRef<THREE.Mesh | null>(null);
  const clubheadPingRef = useRef<THREE.Mesh | null>(null);

  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const animationsRef = useRef<THREE.AnimationClip[]>([]);
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [modelReady, setModelReady] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentCameraPreset, setCurrentCameraPreset] = useState<'FACE_ON' | 'DTL' | 'HERO' | 'FREE'>('FACE_ON');
  const [handPose, setHandPose] = useState<'grip' | 'open' | 'fist'>('grip');
  const [showClub, setShowClub] = useState<boolean>(false); // Hidden by default as requested

  // Dynamic tracking refs for 60fps render loop
  const currentFrameRef = useRef<PoseFrame | null>(currentFrame);
  currentFrameRef.current = currentFrame;
  const metricsRef = useRef<SwingKinematics | null | undefined>(metrics);
  metricsRef.current = metrics;
  const isRightHandedRef = useRef<boolean>(isRightHanded);
  isRightHandedRef.current = isRightHanded;
  const isMirroredViewRef = useRef<boolean>(isMirroredView);
  isMirroredViewRef.current = isMirroredView;
  const showClubRef = useRef<boolean>(showClub);
  showClubRef.current = showClub;

  // Switch hand pose (Golf Grip vs Open vs Fist)
  const applyHandPose = useCallback((pose: 'grip' | 'open' | 'fist') => {
    setHandPose(pose);
    const mixer = mixerRef.current;
    const anims = animationsRef.current;
    if (!mixer || !anims.length) return;

    let targetName = 'FingersOnly_GolfGrip';
    if (pose === 'open') {
      targetName = 'FingersOnly_OpenClose';
    } else if (pose === 'fist') {
      targetName = 'Hands_Fist';
    }

    const clip = anims.find(a => a.name === targetName) ||
                 anims.find(a => a.name.toLowerCase().includes(pose === 'grip' ? 'golfgrip' : pose));
    if (clip) {
      mixer.stopAllAction();
      const action = mixer.clipAction(clip);
      action.clampWhenFinished = true;
      action.setLoop(THREE.LoopOnce, 1);
      action.reset();
      action.fadeIn(0.15);
      action.play();
      currentActionRef.current = action;
    }
  }, []);

  // Camera preset positions
  const setCameraPreset = useCallback((preset: 'FACE_ON' | 'DTL' | 'HERO' | 'FREE') => {
    setCurrentCameraPreset(preset);
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    if (preset === 'FACE_ON') {
      camera.position.set(0, 0.95, 3.2);
      controls.target.set(0, 0.90, 0);
      onViewAngleChange?.('FACE_ON');
    } else if (preset === 'DTL') {
      camera.position.set(3.2, 0.95, 0.0);
      controls.target.set(0, 0.90, 0);
      onViewAngleChange?.('DOWN_THE_LINE');
    } else if (preset === 'HERO') {
      camera.position.set(2.2, 1.25, 2.2);
      controls.target.set(0, 0.90, 0);
    }
    controls.update();
  }, [onViewAngleChange]);

  // Sync initial viewAngle
  useEffect(() => {
    if (viewAngle === 'DOWN_THE_LINE') {
      setCameraPreset('DTL');
    } else {
      setCameraPreset('FACE_ON');
    }
  }, [viewAngle, setCameraPreset]);

  // Initialize Three.js Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 560;

    // 1. Scene - Crisp Pure White Studio
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color('#ffffff'); // Pure white studio
    scene.fog = new THREE.FogExp2('#ffffff', 0.03);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 50);
    camera.position.set(0, 0.95, 3.2);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // 4. Orbit Controls (360° interactive view)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0.90, 0);
    controls.maxPolarAngle = Math.PI / 2 + 0.02; // Don't go below floor
    controls.minDistance = 1.2;
    controls.maxDistance = 5.5;
    controlsRef.current = controls;

    // 5. Studio Environment & Lighting (Bright Apple/Design showroom lighting)
    const ambient = new THREE.AmbientLight('#ffffff', 1.4);
    scene.add(ambient);

    // Key front light (casts soft shadow beneath feet)
    const keyLight = new THREE.DirectionalLight('#ffffff', 2.5);
    keyLight.position.set(2.0, 4.0, 3.0);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    // Soft fill light
    const fillLight = new THREE.DirectionalLight('#f1f5f9', 0.9);
    fillLight.position.set(-2.5, 2.5, 2.0);
    scene.add(fillLight);

    // Cyan Accent Rim Light from behind (makes carbon armor edges pop against white)
    const rimLight = new THREE.DirectionalLight('#00f0ff', 2.0);
    rimLight.position.set(0, 2.8, -2.8);
    scene.add(rimLight);

    // Warm green turf reflection
    const turfBounce = new THREE.DirectionalLight('#10b981', 0.4);
    turfBounce.position.set(0, -1.0, 0);
    scene.add(turfBounce);

    // 6. Circular Golf Simulator Stage (Pearl White Studio Floor)
    const stageRadius = 2.0;
    const stageGeo = new THREE.CylinderGeometry(stageRadius, stageRadius, 0.04, 64);
    const stageMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#f8fafc'), // Pearl white studio surface
      metalness: 0.12,
      roughness: 0.75
    });
    const stage = new THREE.Mesh(stageGeo, stageMat);
    stage.position.y = -0.02;
    stage.receiveShadow = true;
    scene.add(stage);

    // Outer turf ring
    const ringGeo = new THREE.RingGeometry(stageRadius - 0.05, stageRadius + 0.05, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: '#10b981', side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.001;
    scene.add(ring);

    // Subtle alignment grid on stage (clean light slate/gray)
    const grid = new THREE.GridHelper(stageRadius * 1.8, 18, '#06b6d4', '#e2e8f0');
    grid.position.y = 0.002;
    scene.add(grid);

    // 7. Golf Club 3D Object
    const clubGroup = new THREE.Group();
    clubGroupRef.current = clubGroup;

    // Shaft (Sleek graphite with metallic sheen)
    const shaftGeo = new THREE.CylinderGeometry(0.007, 0.004, 0.92, 16);
    const shaftMat = new THREE.MeshStandardMaterial({
      color: '#38bdf8',
      metalness: 0.9,
      roughness: 0.15,
      emissive: '#0284c7',
      emissiveIntensity: 0.25
    });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.position.y = -0.46;
    shaft.castShadow = true;
    clubGroup.add(shaft);

    // Grip
    const gripGeo = new THREE.CylinderGeometry(0.012, 0.009, 0.26, 16);
    const gripMat = new THREE.MeshStandardMaterial({ color: '#090d16', roughness: 0.9 });
    const grip = new THREE.Mesh(gripGeo, gripMat);
    grip.position.y = -0.13;
    clubGroup.add(grip);

    // Clubhead (Titanium driver / iron head)
    const headGeo = new THREE.BoxGeometry(0.09, 0.05, 0.06);
    const headMat = new THREE.MeshStandardMaterial({
      color: '#f8fafc',
      metalness: 0.95,
      roughness: 0.1
    });
    const clubHead = new THREE.Mesh(headGeo, headMat);
    clubHead.position.set(0.02, -0.92, 0.01);
    clubHead.castShadow = true;
    clubGroup.add(clubHead);
    scene.add(clubGroup);

    // Glowing Ping at clubhead
    const pingGeo = new THREE.SphereGeometry(0.025, 16, 16);
    const pingMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      emissive: '#00f0ff',
      emissiveIntensity: 3.0
    });
    const ping = new THREE.Mesh(pingGeo, pingMat);
    clubheadPingRef.current = ping;
    scene.add(ping);

    // 8. Load 3D Golfer Model with Finger Rig
    const loader = new GLTFLoader();
    loader.load(
      '/models/avatar/neon_sentinel.glb',
      (gltf) => {
        const model = gltf.scene;
        modelRef.current = model;
        animationsRef.current = gltf.animations;

        // Glowing Cyan LED Joint Material
        const ledMat = new THREE.MeshStandardMaterial({
          color: '#00f0ff',
          emissive: '#00f0ff',
          emissiveIntensity: 2.2,
          roughness: 0.1,
          metalness: 0.1
        });

        const bonesMap: Record<string, THREE.Bone> = {};
        const initialQuats: Record<string, THREE.Quaternion> = {};
        const initialPos: Record<string, THREE.Vector3> = {};

        // Preserve normal maps and textures, apply clean athletic pearlescent finish
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child instanceof THREE.SkinnedMesh) {
              skinnedMeshRef.current = child;
              if (child.material) {
                const m = child.material as THREE.MeshStandardMaterial;
                // High-visibility athletic titanium pearl finish
                m.color.set('#f1f5f9');
                m.roughness = 0.42;
                m.metalness = 0.18;
                m.needsUpdate = true;
              }
            }
          }
          if (child instanceof THREE.Bone) {
            const cleanName = child.name.replace(/^mixamorig:?/i, '');
            bonesMap[child.name] = child;
            bonesMap[cleanName] = child;
            initialQuats[child.name] = child.quaternion.clone();
            initialQuats[cleanName] = child.quaternion.clone();
            initialPos[child.name] = child.position.clone();
            initialPos[cleanName] = child.position.clone();

            // Add glowing cyan sphere to joints
            const isJoint = [
              'LeftShoulder', 'RightShoulder',
              'LeftArm', 'RightArm',
              'LeftForeArm', 'RightForeArm',
              'LeftHand', 'RightHand',
              'LeftUpLeg', 'RightUpLeg',
              'LeftLeg', 'RightLeg',
              'LeftFoot', 'RightFoot',
              'Spine', 'Neck', 'neck', 'Head'
            ].includes(cleanName);

            if (isJoint) {
              const sphereGeo = new THREE.SphereGeometry(0.022, 12, 12);
              const sphere = new THREE.Mesh(sphereGeo, ledMat);
              child.add(sphere);
            }
          }
        });

        bonesMapRef.current = bonesMap;
        initialQuatsRef.current = initialQuats;
        initialPosRef.current = initialPos;

        // Create animation mixer and apply default golf grip (only affects fingers)
        const mixer = new THREE.AnimationMixer(model);
        mixerRef.current = mixer;
        const gripClip = gltf.animations.find(a => a.name === 'FingersOnly_GolfGrip');
        if (gripClip) {
          const action = mixer.clipAction(gripClip);
          action.clampWhenFinished = true;
          action.setLoop(THREE.LoopOnce, 1);
          action.play();
          currentActionRef.current = action;
        }

        // Position model centered on stage
        model.position.set(0, 0, 0);
        scene.add(model);
        setIsLoading(false);
        setModelReady(true);
      },
      undefined,
      (err) => {
        console.error('Error loading neon_sentinel.glb:', err);
        setLoadError('Kunde inte läsa in 3D-modellen: /models/avatar/neon_sentinel.glb');
        setIsLoading(false);
      }
    );

    // Resize handling
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Animation Render Loop with Pose Update
    const clock = new THREE.Clock();
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      if (mixerRef.current) {
        mixerRef.current.update(delta);
      }
      // Apply frame kinematics after mixer update so body pose is never overwritten
      updatePoseBones();
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Kinematic Pose Articulation Function
  const updatePoseBones = useCallback(() => {
    const frame = currentFrameRef.current;
    const met = metricsRef.current;
    const bones = bonesMapRef.current;
    const initialPos = initialPosRef.current;
    const skinnedMesh = skinnedMeshRef.current;
    if (!frame || !bones || Object.keys(bones).length === 0) return;

    const shouldFlip = (!isRightHandedRef.current) !== isMirroredViewRef.current;
    const to3D = (lm: Landmark | undefined): THREE.Vector3 => {
      if (!lm) return new THREE.Vector3(0, 0, 0);
      const rawX = shouldFlip ? 1 - lm.x : lm.x;
      return new THREE.Vector3(
        (rawX - 0.5) * 1.55,
        (0.92 - lm.y) * 1.75,
        -(lm.z ?? 0) * 1.55
      );
    };

    // Key landmarks
    const lHip = to3D(getLandmark(frame, LandmarkId.LEFT_HIP));
    const rHip = to3D(getLandmark(frame, LandmarkId.RIGHT_HIP));
    const lKnee = to3D(getLandmark(frame, LandmarkId.LEFT_KNEE));
    const rKnee = to3D(getLandmark(frame, LandmarkId.RIGHT_KNEE));
    const lAnkle = to3D(getLandmark(frame, LandmarkId.LEFT_ANKLE));
    const rAnkle = to3D(getLandmark(frame, LandmarkId.RIGHT_ANKLE));

    const lShoulder = to3D(getLandmark(frame, LandmarkId.LEFT_SHOULDER));
    const rShoulder = to3D(getLandmark(frame, LandmarkId.RIGHT_SHOULDER));
    const lElbow = to3D(getLandmark(frame, LandmarkId.LEFT_ELBOW));
    const rElbow = to3D(getLandmark(frame, LandmarkId.RIGHT_ELBOW));
    const lWrist = to3D(getLandmark(frame, LandmarkId.LEFT_WRIST));
    const rWrist = to3D(getLandmark(frame, LandmarkId.RIGHT_WRIST));
    const nose = to3D(getLandmark(frame, LandmarkId.NOSE));

    const rotateBoneTowards = (boneName: string, start: THREE.Vector3, target: THREE.Vector3) => {
      const bone = bones[boneName];
      if (!bone) return;

      const worldDir = new THREE.Vector3().subVectors(target, start).normalize();
      if (worldDir.lengthSq() < 0.001) return;

      const localDir = worldDir.clone();
      if (bone.parent) {
        bone.parent.updateMatrixWorld(true);
        const parentWorldQuat = new THREE.Quaternion();
        bone.parent.getWorldQuaternion(parentWorldQuat);
        localDir.applyQuaternion(parentWorldQuat.invert());
      }

      const defaultDir = new THREE.Vector3(0, 1, 0);
      const q = new THREE.Quaternion().setFromUnitVectors(defaultDir, localDir);
      bone.quaternion.copy(q);
      bone.updateMatrixWorld(true);
    };

    // 1. Root & Pelvis (Hips)
    const hips = bones['Hips'];
    if (hips && initialPos['Hips']) {
      const midHip = new THREE.Vector3().addVectors(lHip, rHip).multiplyScalar(0.5);
      hips.position.set(midHip.x, Math.max(0.82, midHip.y + 0.12), midHip.z);

      const hipAngleDeg = met?.pelvisTurn ?? 0;
      const hipRot = (hipAngleDeg * Math.PI) / 180;
      hips.rotation.y = shouldFlip ? -hipRot : hipRot;
      hips.updateMatrixWorld(true);
    }

    // 2. Spine & Torso Turn
    const spine = bones['Spine'] || bones['Spine02'];
    if (spine) {
      const shoulderAngleDeg = met?.shoulderTurn ?? 0;
      const shoulderRot = (shoulderAngleDeg * Math.PI) / 180;
      spine.rotation.y = shouldFlip ? -shoulderRot * 0.75 : shoulderRot * 0.75;
      spine.rotation.z = (lShoulder.y - rShoulder.y) * 0.4;
      spine.updateMatrixWorld(true);
    }

    // 3. Legs
    rotateBoneTowards('LeftUpLeg', lHip, lKnee);
    rotateBoneTowards('LeftLeg', lKnee, lAnkle);
    rotateBoneTowards('RightUpLeg', rHip, rKnee);
    rotateBoneTowards('RightLeg', rKnee, rAnkle);

    // 4. Arms
    rotateBoneTowards('LeftArm', lShoulder, lElbow);
    rotateBoneTowards('LeftForeArm', lElbow, lWrist);
    rotateBoneTowards('RightArm', rShoulder, rElbow);
    rotateBoneTowards('RightForeArm', rElbow, rWrist);

    // 5. Head
    const head = bones['Head'];
    if (head && nose) {
      const midShoulder = new THREE.Vector3().addVectors(lShoulder, rShoulder).multiplyScalar(0.5);
      rotateBoneTowards('Head', midShoulder, nose);
    }

    // 6. Club Group (Hidden by default, shown only when user enables showClub)
    const clubGroup = clubGroupRef.current;
    if (clubGroup) {
      clubGroup.visible = showClubRef.current;
      if (showClubRef.current && lWrist && rWrist) {
        const handsMid = new THREE.Vector3().addVectors(lWrist, rWrist).multiplyScalar(0.5);
        clubGroup.position.copy(handsMid);

        if (frame.club) {
          const cHead = to3D(frame.club.clubHead as Landmark);
          const shaftDir = new THREE.Vector3().subVectors(cHead, handsMid).normalize();
          const defaultShaftDir = new THREE.Vector3(0, -1, 0);
          clubGroup.quaternion.setFromUnitVectors(defaultShaftDir, shaftDir);
          if (clubheadPingRef.current) {
            clubheadPingRef.current.position.copy(cHead);
            clubheadPingRef.current.visible = true;
          }
        } else {
          clubGroup.rotation.set(0, 0, 0);
          if (clubheadPingRef.current) {
            clubheadPingRef.current.visible = false;
          }
        }
      } else {
        if (clubheadPingRef.current) {
          clubheadPingRef.current.visible = false;
        }
      }
    }

    if (skinnedMesh) {
      skinnedMesh.skeleton.update();
    }
  }, []);

  const updatePoseBonesRef = useRef(updatePoseBones);
  updatePoseBonesRef.current = updatePoseBones;

  // Trigger pose update when frame or metrics change
  useEffect(() => {
    updatePoseBones();
  }, [currentFrame, metrics, isRightHanded, isMirroredView, modelReady, showClub, updatePoseBones]);

  // 3D Toptracer Arc
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !showClubheadPath || frames.length === 0) {
      if (trailLineRef.current && scene) {
        scene.remove(trailLineRef.current);
        trailLineRef.current = null;
      }
      return;
    }

    const shouldFlip = (!isRightHanded) !== isMirroredView;
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < frames.length; i += 3) {
      const f = frames[i];
      if (f?.club?.clubHead) {
        const ch = f.club.clubHead;
        const rx = shouldFlip ? 1 - ch.x : ch.x;
        points.push(new THREE.Vector3(
          (rx - 0.5) * 1.55,
          (0.92 - ch.y) * 1.75,
          -(ch.z ?? 0) * 1.55
        ));
      }
    }

    if (points.length > 2) {
      if (trailLineRef.current) {
        scene.remove(trailLineRef.current);
      }
      const curve = new THREE.CatmullRomCurve3(points);
      const tubeGeo = new THREE.TubeGeometry(curve, 90, 0.007, 8, false);
      const tubeMat = new THREE.MeshStandardMaterial({
        color: '#00f0ff',
        emissive: '#00f0ff',
        emissiveIntensity: 1.8,
        roughness: 0.2
      });
      const trailMesh = new THREE.Mesh(tubeGeo, tubeMat);
      trailLineRef.current = trailMesh;
      scene.add(trailMesh);
    }
  }, [frames, showClubheadPath, isRightHanded, isMirroredView]);

  return (
    <div className={`relative w-full h-full min-h-[480px] select-none ${className}`}>
      {/* 3D WebGL Canvas Container */}
      <div ref={mountRef} className="w-full h-full rounded-2xl overflow-hidden shadow-2xl" />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-md rounded-2xl z-20">
          <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin mb-3" />
          <p className="text-emerald-300 font-bold text-sm tracking-wider">LADDAR 3D GOLF AVATAR...</p>
          <p className="text-slate-400 text-xs mt-1">Laddar PBR-material, normal-maps & 57-ledat skelett med fingrar</p>
        </div>
      )}

      {/* Error Overlay */}
      {loadError && (
        <div className="absolute top-4 left-4 right-4 p-3 bg-red-950/80 border border-red-500/50 rounded-xl text-red-200 text-xs z-20">
          ⚠️ {loadError}
        </div>
      )}

      {/* Top Floating View Controls */}
      <div className="absolute top-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none z-10">
        {/* Left: Badge */}
        <div className="bg-slate-900/95 border border-slate-700/80 rounded-xl px-3 py-1.5 backdrop-blur-md flex items-center gap-2 pointer-events-auto shadow-2xl">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-black tracking-wider text-slate-200">GOLF AVATAR 3D</span>
          <span className="text-[10px] bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-700/50 font-semibold">
            57 LEDER • FINGRAR
          </span>
        </div>

        {/* Right: Hand Controls & Camera Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Hand Pose Selector */}
          <div className="flex bg-slate-900/95 p-1 rounded-xl border border-slate-700/80 backdrop-blur-md gap-1 shadow-2xl">
            <button
              onClick={() => applyHandPose('grip')}
              className={`px-2 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                handPose === 'grip' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
              title="Golfgrepp (fingrarna sluter om klubban)"
            >
              <span>🏌️</span>
              <span>Grepp</span>
            </button>
            <button
              onClick={() => applyHandPose('fist')}
              className={`px-2 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                handPose === 'fist' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
              title="Knytnäve"
            >
              <span>✊</span>
              <span>Knytnäve</span>
            </button>
            <button
              onClick={() => applyHandPose('open')}
              className={`px-2 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                handPose === 'open' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
              title="Öppna händer"
            >
              <span>✋</span>
              <span>Öppen</span>
            </button>
          </div>

          {/* Club Visibility Toggle (Defaults to hidden as requested) */}
          <button
            onClick={() => setShowClub(v => !v)}
            className={`px-2.5 py-1 rounded-xl border text-xs font-bold transition flex items-center gap-1 shadow-2xl backdrop-blur-md ${
              showClub
                ? 'bg-amber-600 border-amber-400 text-white'
                : 'bg-slate-900/95 border-slate-700/80 text-slate-400 hover:text-slate-200'
            }`}
            title={showClub ? 'Klicka för att dölja klubban' : 'Klicka för att visa klubban'}
          >
            <span>🏌️</span>
            <span>{showClub ? 'Klubba: På' : 'Klubba: Dold'}</span>
          </button>

          {/* 3D Camera Angles */}
          <div className="flex bg-slate-900/95 p-1 rounded-xl border border-slate-700/80 backdrop-blur-md gap-1 shadow-2xl">
            <button
              onClick={() => setCameraPreset('FACE_ON')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                currentCameraPreset === 'FACE_ON' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
              title="Face-on vy (framifrån)"
            >
              <span>📺</span>
              <span>Face-On</span>
            </button>
            <button
              onClick={() => setCameraPreset('DTL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                currentCameraPreset === 'DTL' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
              title="Down-the-line vy (mållinje bakifrån)"
            >
              <span>🎯</span>
              <span>DTL</span>
            </button>
            <button
              onClick={() => setCameraPreset('HERO')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                currentCameraPreset === 'HERO' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
              title="45° Isometrisk Tour-vinkel"
            >
              <span>📐</span>
              <span>45° Tour</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Floating Hint */}
      <div className="absolute bottom-3 left-4 text-[11px] text-slate-200 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-700/80 backdrop-blur-md shadow-xl pointer-events-none">
        💡 Klicka & dra med musen för 360° fri rotation runt golfaren • Byt handpose med knapparna ovan
      </div>
    </div>
  );
}
