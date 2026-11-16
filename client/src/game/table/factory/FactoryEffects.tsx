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

const NO_LIGHT = new THREE.AmbientLight('#000000', 0)
const RETINA_DPR = 1.5
const NO_CARD_BLOOM = 1
const SMALL_BLOOM = 2
const NO_EFFECTS = 3

export function FactoryEffects({ quality = 0 }: { quality?: number }) {
  const retina = useThree((state) => state.viewport.dpr) >= RETINA_DPR
  const bloom = useRef<BloomEffect>(null)
  // Set on the live effect, since a changed prop would rebuild the whole chain mid-game.
  useEffect(() => {
    if (bloom.current) bloom.current.resolution.scale = quality >= SMALL_BLOOM ? 0.25 : 0.5
  }, [quality])
  if (quality >= NO_EFFECTS) return null
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
      {MOOD.cardBloom > 0 && quality < NO_CARD_BLOOM ? (
        <SelectiveBloom
          lights={[NO_LIGHT]}
          mipmapBlur
          luminanceThreshold={0.25}
          resolutionScale={retina ? 0.25 : 0.5}
          levels={4}
          intensity={MOOD.cardBloom}
          radius={0.55}
        />
      ) : null}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      {retina ? null : <SMAA />}
    </EffectComposer>
  )
}
