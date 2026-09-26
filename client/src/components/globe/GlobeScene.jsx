import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { Color, Quaternion, Vector3 } from "three";
import landDots from "../../data/globe-land.json";
import { createArc, latLngToVector3, orientationForLocation } from "./geometry";
import GlobeFallback from "./GlobeFallback";

const ignoreRaycast = () => null;
const dotVertex = `
  varying float facing;
  uniform float pixelRatio;
  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    facing = max(0.0, dot(normalize(normalMatrix * normalize(position)), normalize(-viewPosition.xyz)));
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = clamp(6.0 / -viewPosition.z, 1.1, 2.6) * pixelRatio;
  }
`;
const dotFragment = `
  varying float facing;
  uniform vec3 dotColor;
  void main() {
    float radius = length(gl_PointCoord - vec2(0.5));
    if (radius > 0.5) discard;
    gl_FragColor = vec4(dotColor * (0.46 + 0.54 * facing), 1.0 - smoothstep(0.32, 0.5, radius));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function Surface({ compact }) {
  const ratio = useThree((state) => state.viewport.dpr);
  const positions = useMemo(() => {
    const samples = compact
      ? landDots.filter((_, index) => index % 2 === 0)
      : landDots;
    return new Float32Array(
      samples.flatMap(([lat, lng]) =>
        latLngToVector3(lat, lng, 1.005).toArray(),
      ),
    );
  }, [compact]);
  const uniforms = useMemo(
    () => ({
      dotColor: { value: new Color("#b9d1de") },
      pixelRatio: { value: ratio },
    }),
    [ratio],
  );
  return (
    <>
      <mesh onPointerOver={(event) => event.stopPropagation()}>
        <sphereGeometry args={[1, compact ? 40 : 64, compact ? 32 : 48]} />
        <meshBasicMaterial color="#09192a" />
      </mesh>
      <points raycast={ignoreRaycast}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <shaderMaterial
          vertexShader={dotVertex}
          fragmentShader={dotFragment}
          uniforms={uniforms}
          transparent
          depthWrite={false}
        />
      </points>
    </>
  );
}

function Arc({ connection, start, end, animate, index }) {
  const particle = useRef(null);
  const progress = useRef(index * 0.19);
  const curve = useMemo(
    () => createArc(start.lat, start.lng, end.lat, end.lng, connection.height),
    [start.lat, start.lng, end.lat, end.lng, connection.height],
  );
  useFrame((_, delta) => {
    if (!animate || !particle.current) return;
    progress.current =
      (progress.current + Math.min(delta, 0.05) / (4.5 + index * 0.4)) % 1;
    curve.getPoint(progress.current, particle.current.position);
  });
  return (
    <group>
      <mesh raycast={ignoreRaycast}>
        <tubeGeometry args={[curve, 48, 0.0018, 4, false]} />
        <meshBasicMaterial
          color={connection.color}
          transparent
          opacity={0.65}
        />
      </mesh>
      <mesh
        ref={particle}
        visible={animate}
        raycast={ignoreRaycast}
        position={curve.getPoint(progress.current)}
      >
        <sphereGeometry args={[0.008, 8, 6]} />
        <meshBasicMaterial color={connection.color} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Marker({ location, selected, onSelect, animate, index }) {
  const ring = useRef(null);
  const pulseTime = useRef(index * 0.8);
  const [hovered, setHovered] = useState(false);
  const position = useMemo(
    () => latLngToVector3(location.lat, location.lng, 1.018),
    [location.lat, location.lng],
  );
  const orientation = useMemo(
    () =>
      new Quaternion().setFromUnitVectors(
        new Vector3(0, 0, 1),
        position.clone().normalize(),
      ),
    [position],
  );
  useFrame((_, delta) => {
    if (!ring.current) return;
    if (animate) pulseTime.current += Math.min(delta, 0.05);
    const phase = animate ? (pulseTime.current % 3) / 3 : 0.25;
    ring.current.scale.setScalar(1 + phase * 0.7);
    ring.current.material.opacity = animate ? 0.35 * (1 - phase) : 0.2;
  });
  return (
    <group position={position} quaternion={orientation}>
      <mesh
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(selected ? null : location.id);
        }}
      >
        <sphereGeometry args={[0.025, 12, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh raycast={ignoreRaycast}>
        <sphereGeometry args={[0.009, 12, 8]} />
        <meshBasicMaterial color={location.color} toneMapped={false} />
      </mesh>
      <mesh ref={ring} raycast={ignoreRaycast}>
        <ringGeometry args={[0.016, 0.019, 24]} />
        <meshBasicMaterial
          color={location.color}
          transparent
          opacity={0.2}
          depthWrite={false}
        />
      </mesh>
      {(hovered || selected) && (
        <Html
          center
          position={[0, 0.065, 0.01]}
          occlude
          zIndexRange={[30, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div className="network-globe-tooltip">
            <strong>{location.name}</strong>
            <span>{location.description}</span>
          </div>
        </Html>
      )}
    </group>
  );
}

function Scene({
  locations,
  connections,
  initialView,
  rotationSpeed,
  interactive,
  animate,
  compact,
  selected,
  onSelect,
  resetKey,
  onFailure,
}) {
  const orbit = useRef(null);
  const globe = useRef(null);
  const dragging = useRef(false);
  const resumeDelay = useRef(0);
  const { camera, gl, invalidate } = useThree();
  const orientation = useMemo(
    () => orientationForLocation(initialView.lat, initialView.lng),
    [initialView.lat, initialView.lng],
  );
  const arcs = useMemo(
    () =>
      connections
        .map((connection) => ({
          connection,
          start: locations.find((location) => location.id === connection.from),
          end: locations.find((location) => location.id === connection.to),
        }))
        .filter((arc) => arc.start && arc.end)
        .slice(0, compact ? 3 : 8),
    [locations, connections, compact],
  );

  useEffect(() => {
    if (globe.current) globe.current.rotation.set(0, 0, 0);
    camera.position.set(0, 0, compact ? 4.4 : 3.9);
    camera.lookAt(0, 0, 0);
    orbit.current?.update();
    invalidate();
  }, [resetKey, camera, compact, initialView.lat, initialView.lng, invalidate]);
  useEffect(() => {
    const canvas = gl.domElement;
    const onLost = (event) => {
      event.preventDefault();
      onFailure();
    };
    canvas.addEventListener("webglcontextlost", onLost);
    return () => canvas.removeEventListener("webglcontextlost", onLost);
  }, [gl, onFailure]);
  useFrame((_, delta) => {
    if (!animate || dragging.current || !globe.current) return;
    const dt = Math.min(delta, 0.05);
    if (resumeDelay.current > 0) {
      resumeDelay.current -= dt;
      return;
    }
    globe.current.rotation.y += dt * rotationSpeed * (compact ? 0.6 : 1);
  });

  return (
    <>
      <group ref={globe}>
        <group quaternion={orientation}>
          <Surface compact={compact} />
          {arcs.map(({ connection, start, end }, index) => (
            <Arc
              key={`${connection.from}-${connection.to}`}
              connection={connection}
              start={start}
              end={end}
              animate={animate}
              index={index}
            />
          ))}
          {locations.map((location, index) => (
            <Marker
              key={location.id}
              location={location}
              selected={selected === location.id}
              onSelect={onSelect}
              animate={animate}
              index={index}
            />
          ))}
        </group>
      </group>
      <OrbitControls
        ref={orbit}
        enabled={interactive}
        enablePan={false}
        enableZoom={false}
        enableDamping
        dampingFactor={0.05}
        minDistance={3.2}
        maxDistance={5}
        minPolarAngle={Math.PI * 0.22}
        maxPolarAngle={Math.PI * 0.78}
        onStart={() => {
          dragging.current = true;
        }}
        onEnd={() => {
          dragging.current = false;
          resumeDelay.current = 3;
        }}
      />
    </>
  );
}

export default function GlobeScene(props) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop={props.animate ? "always" : "demand"}
      camera={{
        position: [0, 0, props.compact ? 4.4 : 3.9],
        fov: 38,
        near: 0.1,
        far: 30,
      }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      fallback={<GlobeFallback />}
      onPointerMissed={() => props.onSelect(null)}
      aria-hidden="true"
    >
      <Scene {...props} />
    </Canvas>
  );
}
