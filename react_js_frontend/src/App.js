import React, { useRef, useState, useEffect, Suspense, useCallback, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import * as THREE from "three";
import { createNoise2D } from "simplex-noise";

// ======================
// Utility: Simplex Noise
// ======================
const simplex = createNoise2D();

// ========================
// Plane Controls, Physics
// ========================
const PLANE_INITIAL = {
  position: [0, 3, 0],
  velocity: [0, 0, 0],
  // Yaw, pitch, roll in radians
  rotation: [0, 0, 0],
  engineOn: false,
  speed: 0,
};

const AIRPLANE_SIZE = [1, 0.35, 1.4]; // width, height, length
const MAX_SPEED = 0.45;
const MIN_SPEED = 0.08;
const ENGINE_ACCEL = 0.0035;
const DRAG = 0.998;
const LIFT_FACTOR = 0.022;
const PITCH_SPD = 0.019;
const YAW_SPD = 0.017;
const ROLL_SPD = 0.027;

// ===================================
// Minecraft-Style Procedural Terrain
// ===================================
function terrainHeight(x, z) {
  // Simple 2D simplex-based terrain. Adjust frequency/ampl.
  return (
    simplex(x * 0.08, z * 0.08) * 3 +
    simplex(x * 0.22, z * 0.22) * 1 +
    0 // base
  );
}

// ==========
// Airplane
// ==========
function Airplane({ position, rotation, engineOn }) {
  const group = useRef();

  // Wing and tail accent colors
  const bodyColor = "#2196f3";
  const accentColor = "#ffeb3b";
  const secondaryColor = "#4caf50";

  useFrame(() => {
    if (!group.current) return;
    group.current.position.set(...position);
    group.current.rotation.set(...rotation);
  });

  return (
    <group ref={group}>
      {/* Fuselage */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[AIRPLANE_SIZE[0], AIRPLANE_SIZE[1], AIRPLANE_SIZE[2]]} />
        <meshStandardMaterial color={bodyColor} metalness={0.2} roughness={0.45} />
      </mesh>
      {/* Wings */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[1.9, 0.09, 0.42]} />
        <meshStandardMaterial color={accentColor} />
      </mesh>
      {/* Tail */}
      <mesh position={[0, 0.13, -0.63]}>
        <boxGeometry args={[0.33, 0.20, 0.22]} />
        <meshStandardMaterial color={secondaryColor} />
      </mesh>
      {/* Propeller */}
      <mesh position={[0, 0, 0.68]}>
        <boxGeometry args={[0.06, 0.6, 0.05]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      {/* "Engine" Glow */}
      {engineOn && (
        <mesh position={[0, 0, 0.79]}>
          <sphereGeometry args={[0.05, 8, 7]} />
          <meshBasicMaterial color="#ffeb3b" emissive="#ffeb3b" />
        </mesh>
      )}
    </group>
  );
}

// ===========
// Clouds
// ===========
function Cloud({ position, scale = 1.0 }) {
  // Blocky cloud, made of boxes
  return (
    <group position={position} scale={[scale, scale, scale]}>
      {[0, 0.5, -0.6].map((dz, i) => (
        <mesh key={i} position={[0.1 * i, 0, dz]}>
          <boxGeometry args={[0.8 + 0.2 * (i % 2 ? 1 : 0), 0.26, 0.6]} />
          <meshStandardMaterial color="#fff" roughness={0.89} metalness={0.1} opacity={0.7} transparent />
        </mesh>
      ))}
    </group>
  );
}

// =======
// Trees
// =======
function Tree({ position }) {
  return (
    <group position={position}>
      <mesh>
        <cylinderGeometry args={[0.07, 0.09, 0.7, 6]} />
        <meshStandardMaterial color="#795548" />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <sphereGeometry args={[0.27, 7, 7]} />
        <meshStandardMaterial color="#388e3c" />
      </mesh>
    </group>
  );
}

// ==========
// Buildings
// ==========
function Building({ position, size }) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color="#bdbdbd" />
    </mesh>
  );
}

// ==========
// Runway
// ==========
function Runway({ xStart = -12, xEnd = 28, width = 3 }) {
  const length = xEnd - xStart;
  return (
    <mesh position={[(xStart + xEnd) / 2, 0.032, 0]}>
      <boxGeometry args={[length, 0.06, width]} />
      <meshStandardMaterial color="#323232" />
    </mesh>
  );
}

// =====================
// Procedural Terrain (InstancedMesh version)
// =====================
const TERRAIN_SIZE = 66;
const TERRAIN_RES = 1.33;
const TERRAIN_CHUNKS = 2;

const MemoizedTerrainChunk = React.memo(TerrainChunk);

function ProceduralTerrain({ position = [0, 0, 0] }) {
  // Only recalc visible chunks when position crosses into a new terrain area
  const roundedPosition = useMemo(
    () => [
      Math.round(position[0] / TERRAIN_SIZE) * TERRAIN_SIZE,
      0,
      Math.round(position[2] / TERRAIN_SIZE) * TERRAIN_SIZE,
    ],
    [position[0], position[2]]
  );
  const meshes = [];
  for (let cx = -TERRAIN_CHUNKS; cx <= TERRAIN_CHUNKS; cx++) {
    for (let cz = -TERRAIN_CHUNKS; cz <= TERRAIN_CHUNKS; cz++) {
      meshes.push(
        <MemoizedTerrainChunk
          key={cx + ";" + cz}
          chunkX={cx}
          chunkZ={cz}
          base={roundedPosition}
        />
      );
    }
  }
  return <>{meshes}</>;
}

function TerrainChunk({ chunkX, chunkZ, base }) {
  const n = TERRAIN_SIZE / 2;
  const baseX = base[0] + chunkX * TERRAIN_SIZE;
  const baseZ = base[2] + chunkZ * TERRAIN_SIZE;

  // Compute instance transforms and colors (one color per chunk for performance)
  const terrainData = useMemo(() => {
    const transforms = [];
    for (let x = -n; x < n; x += TERRAIN_RES) {
      for (let z = -n; z < n; z += TERRAIN_RES) {
        const worldX = baseX + x;
        const worldZ = baseZ + z;
        const h = terrainHeight(worldX, worldZ);
        transforms.push({
          pos: [worldX, h / 2, worldZ],
          scaleY: h || 0.6,
        });
      }
    }
    return transforms;
  }, [baseX, baseZ]);

  // InstancedMesh
  // One color per chunk: choose color dynamically based on avg height
  const avgHeight =
    terrainData.reduce((sum, t) => sum + t.scaleY, 0) / terrainData.length;
  let color = "#4caf50";
  if (avgHeight > 3.8) color = "#f5f5f5";
  else if (avgHeight > 2.2) color = "#fffde7";
  else if (avgHeight > 1.2) color = "#8bc34a";

  const meshRef = useRef();

  useEffect(() => {
    if (!meshRef.current) return;
    for (let i = 0; i < terrainData.length; i++) {
      const { pos, scaleY } = terrainData[i];
      const m = new THREE.Matrix4();
      m.compose(
        new THREE.Vector3(...pos),
        new THREE.Quaternion(),
        new THREE.Vector3(1, scaleY, 1)
      );
      meshRef.current.setMatrixAt(i, m);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [terrainData]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, terrainData.length]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[TERRAIN_RES, 1, TERRAIN_RES]} />
      <meshStandardMaterial color={color} />
    </instancedMesh>
  );
}

// ==========
// WorldObjects (optimized, deterministic)
// ==========
function WorldObjects({ planePos }) {
  // Deterministic but scattered distribution
  const worldSeed = 42;
  function seededRandom(seed, i) {
    let x = Math.sin(seed + i * 4391.643) * 10000;
    return x - Math.floor(x);
  }

  const clouds = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 18; i++) {
      const rx = seededRandom(worldSeed, i);
      const rz = seededRandom(worldSeed + 1000, i);
      const ry = seededRandom(worldSeed + 2000, i);
      const scaleRnd = seededRandom(worldSeed + 3000, i);
      const x = planePos[0] + (rx - 0.5) * 40 + (i * 7) % 33;
      const z = planePos[2] + (rz - 0.5) * 40 + (i * 17) % 22;
      const y = 8 + ry * 6;
      arr.push(
        <Cloud position={[x, y, z]} key={"cloud-" + i} scale={scaleRnd * 0.85 + 0.8} />
      );
    }
    return arr;
    // eslint-disable-next-line
  }, [Math.floor(planePos[0] / 33), Math.floor(planePos[2] / 22)]);

  const trees = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 32; i++) {
      const rx = seededRandom(worldSeed + 5000, i);
      const rz = seededRandom(worldSeed + 6000, i);
      const x = planePos[0] + (rx - 0.5) * 64 + (i * 13) % 37;
      const z = planePos[2] + (rz - 0.5) * 64 + (i * 7) % 31;
      const h = terrainHeight(x, z);
      if (Math.abs(x) < 6 && Math.abs(z) < 4.5) continue;
      if ((i % 9) !== 0) arr.push(<Tree position={[x, h + 0.35, z]} key={"tree-" + i} />);
    }
    return arr;
    // eslint-disable-next-line
  }, [Math.floor(planePos[0] / 37), Math.floor(planePos[2] / 31)]);

  const buildings = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 32; i++) {
      const rx = seededRandom(worldSeed + 7000, i);
      const rz = seededRandom(worldSeed + 8000, i);
      if ((i % 9) === 0) {
        const x = planePos[0] + (rx - 0.5) * 64 + (i * 13) % 37;
        const z = planePos[2] + (rz - 0.5) * 64 + (i * 7) % 31;
        const h = terrainHeight(x, z);
        arr.push(
          <Building
            position={[x, h + 0.52, z]}
            size={[1.1, 1.07 + seededRandom(worldSeed + 9000, i) * 2, 1.1]}
            key={"building-" + i}
          />
        );
      }
    }
    return arr;
    // eslint-disable-next-line
  }, [Math.floor(planePos[0] / 37), Math.floor(planePos[2] / 31)]);

  return (
    <>
      <Runway />
      {clouds}
      {trees}
      {buildings}
    </>
  );
}

// ==========
// CAMERA (Optimized no extra rerenders)
// ==========
function ThirdPersonCamera({ planePosition, planeRotation }) {
  const { camera } = useThree();

  useFrame(() => {
    const cameraDistance = 7.8;
    const cameraHeight = 2.89;
    const yaw = planeRotation[1];
    const behindX = Math.sin(yaw) * -cameraDistance;
    const behindZ = Math.cos(yaw) * -cameraDistance;
    const target = new THREE.Vector3(
      planePosition[0] + behindX,
      planePosition[1] + cameraHeight,
      planePosition[2] + behindZ
    );
    camera.position.lerp(target, 0.25);
    camera.lookAt(
      planePosition[0],
      planePosition[1] + 0.4,
      planePosition[2]
    );
  });
  return null;
}

// ===============
// FLIGHT CONTROLS
// ===============
function usePlaneControls(engineOn, setEngineOn, setDesiredControls) {
  // Control state
  const held = useRef({});
  // Keybinding overlay
  useEffect(() => {
    const handleDown = (e) => {
      e.preventDefault();
      if (e.code === "Space") {
        setEngineOn((on) => !on);
      }
      held.current[e.code] = true;
      updateWanted();
    };
    const handleUp = (e) => {
      held.current[e.code] = false;
      updateWanted();
    };
    function updateWanted() {
      // NEW mapping:
      // ArrowUp/ArrowDown -> pitch (Up: nose up, Down: nose down)
      // ArrowLeft/ArrowRight -> yaw (Left: turn/rotate left, Right: turn/rotate right)
      const controls = {
        pitchUp: held.current["ArrowUp"] || held.current["KeyW"] || false,
        pitchDown: held.current["ArrowDown"] || held.current["KeyS"] || false,
        turnLeft: held.current["ArrowLeft"] || held.current["KeyA"] || false,
        turnRight: held.current["ArrowRight"] || held.current["KeyD"] || false,
        rollLeft: held.current["KeyQ"] || false,
        rollRight: held.current["KeyE"] || false,
      };
      setDesiredControls(controls);
    }
    window.addEventListener("keydown", handleDown);
    window.addEventListener("keyup", handleUp);
    return () => {
      window.removeEventListener("keydown", handleDown);
      window.removeEventListener("keyup", handleUp);
    };
  }, [setEngineOn, setDesiredControls]);
}

// ======================
// Game HUD Overlay
// ======================
function Overlay({ show, engineOn, controls, status, onToggleHelp, showHelp }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 0, left: 0, width: "100vw", height: "100vh",
        pointerEvents: "none",
        zIndex: 12,
        fontFamily: "Inter, Segoe UI, Arial, sans-serif",
        color: "#282c34",
      }}
    >
      <div style={{
        position: "absolute",
        top: 18, left: 32,
        background: "rgba(255,255,255,0.94)",
        padding: "18px 30px 16px 22px",
        borderRadius: "16px",
        minWidth: 236,
        boxShadow: "0 4px 28px 4px rgba(25,50,80,0.07)",
        pointerEvents: "auto",
        fontSize: "18px",
        fontWeight: "500",
        letterSpacing: "0.01em"
      }}>
        <span>
          <span
            style={{
              color: engineOn ? "#4caf50" : "#ffeb3b",
              fontWeight: 700
            }}
          >{engineOn ? "Engaged" : "Stopped"}</span>&nbsp;Engine
          &nbsp; <span style={{ color: "#2196f3", fontSize: 13, fontWeight: 500 }}>Speed:</span>
          <span style={{ fontWeight: 700 }}> {status.speedKph} km/h</span>
        </span><br />
        <span style={{ fontSize: 13 }}>
          <span style={{ color: "#4caf50" }}>▲&nbsp;Alt:</span> {status.altitudeM} m
          &nbsp;&nbsp;
          <span style={{ color: "#2196f3" }}>⟲ Yaw:</span> {status.yawDeg}°
        </span>
      </div>
      {!showHelp && (
        <div style={{
          position: "absolute", bottom: 38, left: "50%", transform: "translateX(-50%)",
          background: "rgba(255,255,255,0.92)", color: "#222", padding: "13px 28px",
          borderRadius: 16, pointerEvents: "auto", fontSize: 17, fontWeight: 400
        }}>
          <span>
            Controls:&nbsp;
            <kbd style={kStyle}>Space</kbd> (Engine) &nbsp;
            <kbd style={kStyle}>↑/↓</kbd> <kbd style={kStyle}>←/→</kbd> (Fly)
            &nbsp;&nbsp;
            <button
              onClick={() => onToggleHelp(true)}
              style={{
                marginLeft: 14, background: "#4caf50", color: "#fff", border: "none", borderRadius: 7, padding: "4px 13px", fontSize: 15, pointerEvents: "auto", cursor: "pointer"
              }}
            >Instructions</button>
          </span>
        </div>
      )}
      {showHelp && (
        <div style={{
          position: "absolute", top: "19%", left: "50%", transform: "translateX(-50%)",
          background: "rgba(255,255,255,0.99)", color: "#222", padding: "32px 38px 34px 38px",
          borderRadius: 16, pointerEvents: "auto", fontSize: 17, minWidth: 370,
          fontWeight: 400, boxShadow: "0 8px 30px rgba(68,116,172,0.09)"
        }}>
          <h2 style={{fontWeight:800, marginTop:0, marginBottom:16, color:"#2196f3"}}>Skycraft Explorer</h2>
          <ul style={{ listStyle: "none", paddingLeft: 0, lineHeight: 1.86, fontWeight: 500, fontSize: 16, marginBottom:8 }}>
            <li><kbd style={kStyle}>Space</kbd> - Start/Stop Engine</li>
            <li><kbd style={kStyle}>↑</kbd>/<kbd style={kStyle}>↓</kbd> - Pitch Up/Down (Ascend/Descend)</li>
            <li><kbd style={kStyle}>←</kbd>/<kbd style={kStyle}>→</kbd> - Turn Left/Right (Yaw)</li>
            <li style={{ opacity: 0.72 }}>Pro tip: fly low for detail, high for vistas!</li>
            <li style={{ opacity: 0.62 }}>Stay above the terrain or you'll crash. You respawn at start.</li>
          </ul>
          <button
            onClick={() => onToggleHelp(false)}
            style={{
              background: "#2196f3", color: "#fff", border: "none", borderRadius: 8, padding: "7px 18px", fontSize: 16, marginTop:5, cursor: "pointer"
            }}
          >Close</button>
        </div>
      )}
    </div>
  );
}
const kStyle = {
  display: "inline-block",
  fontFamily: "monospace",
  background: "#ececec",
  borderRadius: "7px",
  padding: "1px 9px",
  fontWeight: 700,
  fontSize: 15,
  border: "1.5px solid #bdbdbd",
  margin: "0 2px"
};

// ===============
// Main App
// ===============
function App() {
  // PLANE STATE
  const [plane, setPlane] = useState({
    ...PLANE_INITIAL,
    position: [0, 2.8, -7],
    speed: 0.0,
    engineOn: false,
  });
  // Controls: what the player is indicating
  const [desiredControls, setDesiredControls] = useState({
    pitchUp: false, pitchDown: false, turnLeft: false, turnRight: false, rollLeft: false, rollRight: false,
  });

  // For overlays
  const [showHelp, setShowHelp] = useState(false);

  // Control hook
  usePlaneControls(plane.engineOn, (eng) =>
    setPlane(p => ({ ...p, engineOn: eng })), setDesiredControls);

  // MAIN GAME LOOP
  useFrameImplementation(setPlane, plane, desiredControls);

  // For overlays (km/h, etc)
  const status = {
    speedKph: Math.round(plane.speed * 112),
    altitudeM: Math.max(0, Number(plane.position[1].toFixed(1))),
    yawDeg: Math.round(THREE.MathUtils.radToDeg(plane.rotation[1])) % 360,
  };

  // Reset on "crash" (below terrain)
  useEffect(() => {
    const groundY = terrainHeight(plane.position[0], plane.position[2]);
    if (plane.position[1] < groundY - 0.25) {
      setPlane({
        ...PLANE_INITIAL,
        position: [0, 2.8, -7],
        speed: 0.0,
        engineOn: false,
      });
    }
  }, [plane.position]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#f8f9fa" }}>
      {/* 3D Render */}
      <Canvas
        style={{ position: "absolute", inset: 0 }}
        shadows
        camera={{ fov: 69, near: 0.1, far: 250, position: [0, 10, 18] }}
        gl={{ antialias: true }}
        dpr={Math.min(window.devicePixelRatio, 1.5)}
      >
        <Suspense fallback={null}>
          <color attach="background" args={["#eef7ff"]} />
          {/* Sunlight */}
          <directionalLight
            position={[20, 19, 0]}
            intensity={1.37}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-bias={-0.00022}
          />
          {/* Ambient light */}
          <ambientLight intensity={0.68} />
          {/* 3D Sky */}
          <Sky
            distance={428}
            sunPosition={[45, 42, -110]}
            turbidity={17}
            rayleigh={1.9}
            mieCoefficient={0.017}
            mieDirectionalG={0.93}
            inclination={0.39}
            azimuth={0.25}
          />
          {/* Camera Logic */}
          <ThirdPersonCamera planePosition={plane.position} planeRotation={plane.rotation} />
          {/* Procedural Terrain */}
          <ProceduralTerrain position={plane.position} />
          {/* World Objects */}
          <WorldObjects planePos={plane.position} />
          {/* Your Airplane */}
          <Airplane position={plane.position} rotation={plane.rotation} engineOn={plane.engineOn} />
        </Suspense>
      </Canvas>
      {/* Overlays */}
      <Overlay
        show
        engineOn={plane.engineOn}
        controls={desiredControls}
        status={status}
        onToggleHelp={setShowHelp}
        showHelp={showHelp}
      />
    </div>
  );
}

function useFrameImplementation(setPlane, plane, controls) {
  // Custom useFrame: physics, control, flight math
  useEffect(() => {
    let anim;
    function step() {
      setPlane((prev) => {
        let { position, rotation, speed, engineOn } = prev;
        // Deconstruct to: [pitch, yaw, roll], as standard airplane axes.
        let [pitch, yaw, roll] = rotation;

        // Flight physics: engine/throttle
        if (engineOn) {
          // Accelerate on ground, then flight
          speed = Math.min(MAX_SPEED, speed + ENGINE_ACCEL * (1.0 - speed / MAX_SPEED));
        } else {
          speed = Math.max(MIN_SPEED, speed * DRAG - 0.003);
        }
        // Control conventions:
        // Pitch (X axis, nose up/down): ArrowUp = pitch up (decrease pitch), ArrowDown = pitch down (increase pitch)
        // Yaw (Y axis, left/right): ArrowLeft = yaw left (increase yaw), ArrowRight = yaw right (decrease yaw)

        if (controls.pitchUp) pitch += PITCH_SPD; // ArrowUp (pitch up = nose up, increases X)
        if (controls.pitchDown) pitch -= PITCH_SPD; // ArrowDown (pitch down = nose down, decreases X)
        if (controls.turnLeft) yaw += YAW_SPD * (speed > MIN_SPEED ? 1 : 0.52); // ArrowLeft (turn left = positive yaw)
        if (controls.turnRight) yaw -= YAW_SPD * (speed > MIN_SPEED ? 1 : 0.52); // ArrowRight (turn right = negative yaw)
        roll *= 0.93;
        // Clamp pitch to prevent flipping over (e.g. ~-90deg to +90deg)
        const maxPitch = Math.PI / 2 - 0.07;
        if (pitch > maxPitch) pitch = maxPitch;
        if (pitch < -maxPitch) pitch = -maxPitch;
        // Wrap yaw
        if (yaw > Math.PI) yaw -= 2 * Math.PI;
        if (yaw < -Math.PI) yaw += 2 * Math.PI;

        // Position update: X axis is right/left, Y is up, Z is forward (plane-forward).
        // Forward direction:
        //  Plane's heading in world: yaw = rotation around Y (vertical), pitch = rotation around X (side-to-side)
        //  Three.js airplane orientation convention: match axes.
        let dx = Math.sin(yaw) * Math.cos(pitch) * speed;
        let dz = Math.cos(yaw) * Math.cos(pitch) * speed;
        let dy = Math.sin(pitch) * speed;

        // Simple stall if too slow
        if (speed < 0.11 && position[1] > 3) dy -= 0.044;
        // Gravity
        if (position[1] > terrainHeight(position[0], position[2]) + 0.2) {
          dy -= 0.0091;
        }
        // Elevator stop at ground
        if (position[1] + dy < terrainHeight(position[0] + dx, position[2] + dz) + 0.24) {
          dy = terrainHeight(position[0] + dx, position[2] + dz) + 0.24 - position[1];
        }
        // Move
        const newPos = [
          position[0] + dx,
          position[1] + dy,
          position[2] + dz,
        ];
        // Clamp to max height
        newPos[1] = Math.max(newPos[1], terrainHeight(newPos[0], newPos[2]) + 0.22);
        return {
          ...prev,
          position: newPos,
          speed,
          rotation: [pitch, yaw, roll],
        };
      });
      anim = requestAnimationFrame(step);
    }
    anim = requestAnimationFrame(step);
    return () => cancelAnimationFrame(anim);
    // eslint-disable-next-line
  }, [setPlane, controls, plane.engineOn]);
}

export default App;
