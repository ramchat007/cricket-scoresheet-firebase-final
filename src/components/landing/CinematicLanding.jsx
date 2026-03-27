import React, { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  useScroll,
  PerspectiveCamera,
  ScrollControls,
  Float,
  Environment,
  ContactShadows,
  Sparkles, // ✨ Added for stadium dust/atmosphere
} from "@react-three/drei";
import * as THREE from "three";

const CricketBall = React.forwardRef(({ lightMode }, ref) => {
  return (
    <group ref={ref}>
      <mesh castShadow>
        <sphereGeometry args={[0.6, 64, 64]} />
        <meshPhysicalMaterial
          color="#8B0000"
          roughness={0.15}
          clearcoat={1}
          reflectivity={0.5}
          metalness={0.1}
          envMapIntensity={lightMode ? 1.5 : 1}
        />
      </mesh>
      <group rotation={[0, 0, Math.PI / 2]}>
        <mesh>
          <torusGeometry args={[0.605, 0.015, 16, 100]} />
          <meshStandardMaterial
            color={lightMode ? "#ffffff" : "#eeeeee"}
            roughness={0.8}
          />
        </mesh>
        <mesh position={[0, 0, 0.04]}>
          <torusGeometry args={[0.601, 0.005, 16, 100]} />
          <meshStandardMaterial color="#dddddd" />
        </mesh>
        <mesh position={[0, 0, -0.04]}>
          <torusGeometry args={[0.601, 0.005, 16, 100]} />
          <meshStandardMaterial color="#dddddd" />
        </mesh>
      </group>
    </group>
  );
});

const SceneContent = ({ lightMode }) => {
  const ballRef = useRef();
  const scroll = useScroll();
  const lastOffset = useRef(0);

  const curve = useMemo(() => {
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(-12, -2, 10), // 1. Hero
      new THREE.Vector3(-6, 2, 5), // 2. Scoring (Left)
      new THREE.Vector3(6, 0, 0), // 3. Broadcast (Right)
      new THREE.Vector3(-4, -2, -5), // 4. Auction (Left)
      new THREE.Vector3(8, 2, -8), // 5. Brackets (Right) <--- NEW POINT
      new THREE.Vector3(12, 6, -12), // 6. Match Center / Dashboard
    ]);
  }, []);

  useFrame((state, delta) => {
    const currentOffset = scroll.offset;
    const velocity = Math.abs(currentOffset - lastOffset.current) / delta;
    lastOffset.current = currentOffset;

    if (ballRef.current) {
      ballRef.current.rotation.x += delta * (1 + velocity * 15);
      ballRef.current.rotation.y += delta * (0.5 + velocity * 5);

      const position = curve.getPointAt(currentOffset);
      ballRef.current.position.copy(position);
    }

    const targetFov = 35 + velocity * 15;
    state.camera.fov = THREE.MathUtils.lerp(state.camera.fov, targetFov, 0.1);
    state.camera.updateProjectionMatrix();

    if (ballRef.current) {
      state.camera.lookAt(ballRef.current.position);
    }
  });

  return (
    <>
      <Environment preset={lightMode ? "city" : "night"} />
      <spotLight
        position={[10, 10, 10]}
        angle={0.15}
        penumbra={1}
        intensity={lightMode ? 3 : 2}
        castShadow
      />

      {/* ✨ STADIUM ATMOSPHERE: Floating dust particles catching the light */}
      <Sparkles
        count={600}
        scale={25}
        size={lightMode ? 1.5 : 2.5}
        speed={0.4}
        opacity={lightMode ? 0.1 : 0.2}
        color={lightMode ? "#000000" : "#ffffff"}
      />

      <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
        <CricketBall ref={ballRef} lightMode={lightMode} />
      </Float>

      <ContactShadows
        position={[0, -4, 0]}
        opacity={lightMode ? 0.2 : 0.4}
        scale={20}
        blur={2.4}
        far={4.5}
        color={lightMode ? "#000000" : "#ffffff"}
      />
    </>
  );
};

// 1. UPDATED PAGES: Now set to 5 to match the new features
const CinematicLanding = ({ lightMode }) => {
  return (
    <div className="w-full h-full bg-transparent">
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[0, 2, 15]} fov={35} />
        <ScrollControls pages={6} damping={0.2}>
          <SceneContent lightMode={lightMode} />
        </ScrollControls>
      </Canvas>
    </div>
  );
};

export default CinematicLanding;
