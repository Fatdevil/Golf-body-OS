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

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [modelReady, setModelReady] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentCameraPreset, setCurrentCameraPreset] = useState<'FACE_ON' | 'DTL' | 'HERO' | 'FREE'>('FACE_ON');

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

    // 8. Load Neon Sentinel 3D Model
    const loader = new GLTFLoader();
    loader.load(
      '/models/avatar/neon_sentinel.glb',
      (gltf) => {
        const model = gltf.scene;
        modelRef.current = model;

        // Apply authentic sci-fi cyber carbon material
        const cyberMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color('#141d2f'), // dark titanium carbon
          metalness: 0.88,
          roughness: 0.22,
          wireframe: false
        });

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

        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            child.material = cyberMat;
            if (child instanceof THREE.SkinnedMesh) {
              skinnedMeshRef.current = child;
            }
          }
          if (child instanceof THREE.Bone) {
            bonesMap[child.name] = child;
            initialQuats[child.name] = child.quaternion.clone();
            initialPos[child.name] = child.position.clone();

            // Add glowing cyan sphere to joints
            const isJoint = [
              'LeftShoulder', 'RightShoulder',
              'LeftArm', 'RightArm',
              'LeftForeArm', 'RightForeArm',
              'LeftHand', 'RightHand',
              'LeftUpLeg', 'RightUpLeg',
              'LeftLeg', 'RightLeg',
              'LeftFoot', 'RightFoot',
              'Spine', 'neck', 'Head'
            ].includes(child.name);

            if (isJoint) {
              const sphereGeo = new THREE.SphereGeometry(0.024, 12, 12);
              const sphere = new THREE.Mesh(sphereGeo, ledMat);
              child.add(sphere);
            }
          }
        });

        bonesMapRef.current = bonesMap;
        initialQuatsRef.current = initialQuats;
        initialPosRef.current = initialPos;

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

    // Animation Render Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
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

  // Update Pose & Articulate Bones on Frame Change
  useEffect(() => {
    const bones = bonesMapRef.current;
    const initialQuats = initialQuatsRef.current;
    const initialPos = initialPosRef.current;
    const skinnedMesh = skinnedMeshRef.current;
    if (!currentFrame || !bones || Object.keys(bones).length === 0) return;

    // Coordinate conversion: MediaPipe (x, y, z) -> Three.js 3D world vectors
    const shouldFlip = (!isRightHanded) !== isMirroredView;
    const to3D = (lm: Landmark | undefined): THREE.Vector3 => {
      if (!lm) return new THREE.Vector3(0, 0, 0);
      const rawX = shouldFlip ? 1 - lm.x : lm.x;
      // Centered at stage (0, 0, 0). Normal height = 1.75m.
      return new THREE.Vector3(
        (rawX - 0.5) * 1.55,
        (0.92 - lm.y) * 1.75,
        -(lm.z ?? 0) * 1.55
      );
    };

    // Key landmarks
    const lHip = to3D(getLandmark(currentFrame, LandmarkId.LEFT_HIP));
    const rHip = to3D(getLandmark(currentFrame, LandmarkId.RIGHT_HIP));
    const lKnee = to3D(getLandmark(currentFrame, LandmarkId.LEFT_KNEE));
    const rKnee = to3D(getLandmark(currentFrame, LandmarkId.RIGHT_KNEE));
    const lAnkle = to3D(getLandmark(currentFrame, LandmarkId.LEFT_ANKLE));
    const rAnkle = to3D(getLandmark(currentFrame, LandmarkId.RIGHT_ANKLE));

    const lShoulder = to3D(getLandmark(currentFrame, LandmarkId.LEFT_SHOULDER));
    const rShoulder = to3D(getLandmark(currentFrame, LandmarkId.RIGHT_SHOULDER));
    const lElbow = to3D(getLandmark(currentFrame, LandmarkId.LEFT_ELBOW));
    const rElbow = to3D(getLandmark(currentFrame, LandmarkId.RIGHT_ELBOW));
    const lWrist = to3D(getLandmark(currentFrame, LandmarkId.LEFT_WRIST));
    const rWrist = to3D(getLandmark(currentFrame, LandmarkId.RIGHT_WRIST));

    const nose = to3D(getLandmark(currentFrame, LandmarkId.NOSE));

    // Helper: align bone local +Y to target vector
    const rotateBoneTowards = (boneName: string, start: THREE.Vector3, target: THREE.Vector3) => {
      const bone = bones[boneName];
      const baseQuat = initialQuats[boneName];
      if (!bone || !baseQuat) return;

      const worldDir = new THREE.Vector3().subVectors(target, start).normalize();
      if (worldDir.lengthSq() < 0.001) return;

      // Transform target direction into parent bone coordinate frame
      const localDir = worldDir.clone();
      if (bone.parent) {
        const parentWorldQuat = new THREE.Quaternion();
        bone.parent.getWorldQuaternion(parentWorldQuat);
        localDir.applyQuaternion(parentWorldQuat.invert());
      }

      // Bone local default points along +Y (0, 1, 0)
      const defaultDir = new THREE.Vector3(0, 1, 0);
      const q = new THREE.Quaternion().setFromUnitVectors(defaultDir, localDir);
      bone.quaternion.copy(q);
    };

    // 1. Root & Pelvis (Hips)
    const hips = bones['Hips'];
    if (hips && initialPos['Hips']) {
      const midHip = new THREE.Vector3().addVectors(lHip, rHip).multiplyScalar(0.5);
      hips.position.set(midHip.x, Math.max(0.70, midHip.y + 0.05), midHip.z);

      const hipAngleDeg = metrics?.pelvisTurn ?? 0;
      const hipRot = (hipAngleDeg * Math.PI) / 180;
      hips.rotation.y = shouldFlip ? -hipRot : hipRot;
    }

    // 2. Spine & Torso Turn
    const spine = bones['Spine'] || bones['Spine02'];
    if (spine) {
      const shoulderAngleDeg = metrics?.shoulderTurn ?? 0;
      const shoulderRot = (shoulderAngleDeg * Math.PI) / 180;
      spine.rotation.y = shouldFlip ? -shoulderRot * 0.75 : shoulderRot * 0.75;
      spine.rotation.z = (lShoulder.y - rShoulder.y) * 0.4; // Lateral crunch / tilt
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

    // 6. Update Golf Club Position & Alignment
    const clubGroup = clubGroupRef.current;
    if (clubGroup && lWrist && rWrist) {
      const handsMid = new THREE.Vector3().addVectors(lWrist, rWrist).multiplyScalar(0.5);
      clubGroup.position.copy(handsMid);

      // Club orientation
      if (currentFrame.club) {
        const cHead = to3D(currentFrame.club.clubHead as Landmark);
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
    }

    if (skinnedMesh) {
      skinnedMesh.skeleton.update();
    }
  }, [currentFrame, metrics, isRightHanded, isMirroredView, modelReady]);

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
          <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mb-3" />
          <p className="text-cyan-300 font-bold text-sm tracking-wider">LADDAR 3D NEON SENTINEL...</p>
          <p className="text-slate-400 text-xs mt-1">Laddar PBR-material, texturer & 28-ledat skelett</p>
        </div>
      )}

      {/* Error Overlay */}
      {loadError && (
        <div className="absolute top-4 left-4 right-4 p-3 bg-red-950/80 border border-red-500/50 rounded-xl text-red-200 text-xs z-20">
          ⚠️ {loadError}
        </div>
      )}

      {/* Top Floating View Controls */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
        {/* Badge */}
        <div className="bg-slate-900/95 border border-slate-700/80 rounded-xl px-3 py-1.5 backdrop-blur-md flex items-center gap-2 pointer-events-auto shadow-2xl">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-xs font-black tracking-wider text-cyan-300">NEON SENTINEL 3D</span>
          <span className="text-[10px] bg-cyan-950 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-700/50">
            28 LEDER
          </span>
        </div>

        {/* 3D Camera Angles */}
        <div className="flex bg-slate-900/95 p-1 rounded-xl border border-slate-700/80 backdrop-blur-md gap-1 pointer-events-auto shadow-2xl">
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

      {/* Bottom Floating Hint */}
      <div className="absolute bottom-3 left-4 text-[11px] text-slate-200 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-700/80 backdrop-blur-md shadow-xl pointer-events-none">
        💡 Klicka & dra med musen för 360° fri rotation runt golfaren • Scrolla för zoom
      </div>
    </div>
  );
}
