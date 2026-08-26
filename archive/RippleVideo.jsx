import React, { useRef, useMemo, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useVideoTexture } from '@react-three/drei';
import * as THREE from 'three';

const fragmentShader = `
uniform sampler2D uTexture;
uniform float uTime;
uniform vec2 uClickPos;
uniform float uWaveIntensity;
uniform vec2 uResolution;
uniform vec2 uMediaRes;

varying vec2 vUv;

void main() {
  // Standard object-fit: cover math (centered)
  vec2 ratio = vec2(
    min((uResolution.x / uResolution.y) / (uMediaRes.x / uMediaRes.y), 1.0),
    min((uResolution.y / uResolution.x) / (uMediaRes.y / uMediaRes.x), 1.0)
  );
  
  vec2 uv = vec2(
    vUv.x * ratio.x + (1.0 - ratio.x) * 0.5,
    vUv.y * ratio.y + (1.0 - ratio.y) * 0.5
  );

  // Ripple logic based on normalized screen coordinates
  vec2 p = vUv; 
  p.x *= uResolution.x / uResolution.y;
  vec2 mouse = uClickPos;
  mouse.x *= uResolution.x / uResolution.y;
  
  float dist = distance(p, mouse);
  
  // A localized pulse without washback
  float phase = dist * 12.0 - uTime * 5.0;
  float wave = cos(phase) * exp(-phase * phase * 0.8);
  
  // Damping over distance
  float damping = exp(-dist * 1.5);
  
  vec2 dir = normalize(p - mouse);
  vec2 offset = dir * wave * damping * uWaveIntensity;
  
  vec2 finalUv = uv + offset;
  finalUv = clamp(finalUv, 0.0, 1.0);
  
  vec4 color = texture2D(uTexture, finalUv);
  gl_FragColor = color;
}
`;

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

function RipplePlane({ src }) {
  const meshRef = useRef();
  const materialRef = useRef();
  const { viewport } = useThree();
  
  // Load video texture
  const texture = useVideoTexture(src, { autoPlay: true, loop: true, muted: true });
  
  const uniforms = useMemo(
    () => ({
      uTexture: { value: null },
      uTime: { value: 0 },
      uClickPos: { value: new THREE.Vector2(-1, -1) },
      uWaveIntensity: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uMediaRes: { value: new THREE.Vector2(1920, 1080) } // Default resolution for the video
    }),
    []
  );

  // Force layout recalculation after initial mount to prevent aspect-ratio race condition
  useEffect(() => {
    const t1 = setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
    const t2 = setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  // Update resolution on viewport change
  useEffect(() => {
    if (uniforms.uResolution) {
      uniforms.uResolution.value.set(viewport.width, viewport.height);
    }
  }, [viewport.width, viewport.height, uniforms]);

  const handlePointerDown = (e) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uClickPos.value.set(e.uv.x, e.uv.y);
      materialRef.current.uniforms.uTime.value = 0;
      materialRef.current.uniforms.uWaveIntensity.value = 0.04; // strength of ripple
    }
  };

  const handlePointerMove = (e) => {
    if (e.buttons > 0) {
      if (materialRef.current) {
        materialRef.current.uniforms.uClickPos.value.set(e.uv.x, e.uv.y);
        materialRef.current.uniforms.uTime.value = 0;
        materialRef.current.uniforms.uWaveIntensity.value = 0.04;
      }
    }
  };

  useFrame((state, delta) => {
    if (materialRef.current) {
      if (texture) {
        materialRef.current.uniforms.uTexture.value = texture;
        if (texture.image && texture.image.videoWidth && texture.image.videoHeight) {
          materialRef.current.uniforms.uMediaRes.value.set(
            texture.image.videoWidth,
            texture.image.videoHeight
          );
        }
      }
      materialRef.current.uniforms.uResolution.value.set(state.viewport.width, state.viewport.height);
      if (materialRef.current.uniforms.uWaveIntensity.value > 0.001) {
        materialRef.current.uniforms.uTime.value += delta;
      }
    }
  });

  return (
    <mesh ref={meshRef} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}>
      <planeGeometry args={[viewport.width, viewport.height, 1, 1]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent={true}
      />
    </mesh>
  );
}

export default function RippleVideo({ src }) {
  return (
    <Canvas
      aria-hidden="true"
      dpr={[1, 1.5]}
      gl={{ 
        powerPreference: 'high-performance', 
        antialias: false, 
        stencil: false, 
        depth: false 
      }}
      className="absolute inset-0 h-full w-full transition-opacity duration-300 opacity-100"
      style={{
        position: 'absolute',
        inset: 0,
        height: '100%',
        width: '100%',
        opacity: 1,
        transition: 'opacity 300ms ease',
        zIndex: 0
      }}
    >
      <Suspense fallback={null}>
        <RipplePlane src={src} />
      </Suspense>
    </Canvas>
  );
}
