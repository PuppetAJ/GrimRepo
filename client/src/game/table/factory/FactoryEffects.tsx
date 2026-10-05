import { useThree } from '@react-three/fiber'
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Noise,
  Scanline,
  SelectiveBloom,
  SMAA,
  ToneMapping,
  Vignette,
} from '@react-three/postprocessing'
import { ToneMappingMode, type BloomEffect } from 'postprocessing'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { MOOD } from '../mood.ts'

// Card glow comes from the faces' own emission, so its pass is lit by nothing.
const SELECTED_LIGHT = new THREE.AmbientLight('#000000', 0)

export function FactoryEffects({ quality = 0 }: { quality?: number }) {
  // Retina pixels need no smoothing, and MSAA there cost two thirds of the frame.
  const sharp = useThree((state) => state.viewport.dpr) >= 1.5
  // Low settings keep every effect but draw the bloom smaller, so the look holds as quality drops.
  const bloom = useRef<BloomEffect>(null)
  // Set on the live effect, since a changed prop would rebuild the whole chain mid-game.
  useEffect(() => {
    if (bloom.current) bloom.current.resolution.scale = quality >= 2 ? 0.25 : 0.5
  }, [quality])
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        ref={bloom}
        mipmapBlur
        luminanceThreshold={MOOD.bloomThreshold}
        intensity={MOOD.bloom}
        radius={MOOD.bloomRadius}
      />
      <ChromaticAberration offset={[0.0006, 0.0006]} />
      <Scanline density={1.4} opacity={MOOD.scanline} />
      <Noise opacity={MOOD.noise} />
      <Vignette offset={0.28} darkness={MOOD.vignette} />
      {/* Only the tagged faces feed this bloom, so no lamp can add to it. */}
      {MOOD.cardBloom > 0 && quality < 1 ? (
        <SelectiveBloom
          lights={[SELECTED_LIGHT]}
          mipmapBlur
          luminanceThreshold={0.25}
          // A soft halo needs no detail, so it runs at half size, a quarter on fine screens.
          resolutionScale={sharp ? 0.25 : 0.5}
          levels={4}
          intensity={MOOD.cardBloom}
          radius={0.55}
        />
      ) : null}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      {/* A cheap stand-in for MSAA below 1.5 dpr. */}
      {sharp ? null : <SMAA />}
    </EffectComposer>
  )
}
