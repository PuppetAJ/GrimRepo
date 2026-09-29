import { useThree } from '@react-three/fiber'
import {
  Bloom,
  BrightnessContrast,
  ChromaticAberration,
  EffectComposer,
  HueSaturation,
  Noise,
  Scanline,
  SelectiveBloom,
  SMAA,
  ToneMapping,
  Vignette,
} from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { MOOD } from '../mood.ts'

// The cards' glow comes from what their faces give off, not from lamps, so its pass is lit by nothing.
const SELECTED_LIGHT = new THREE.AmbientLight('#000000', 0)

/** Glow on the screens and lamps, a little grain and scanline, and dark corners; less of it on a struggling machine. */
export function FactoryEffects({ quality = 0 }: { quality?: number }) {
  // A Retina screen's pixels are fine enough to need no smoothing; MSAA there cost two thirds of the frame.
  const sharp = useThree((state) => state.viewport.dpr) >= 1.5
  if (quality >= 2) return null
  return (
    <EffectComposer multisampling={0}>
      <Bloom mipmapBlur luminanceThreshold={MOOD.bloomThreshold} intensity={MOOD.bloom} radius={MOOD.bloomRadius} />
      <ChromaticAberration offset={[0.0006, 0.0006]} />
      <Scanline density={1.4} opacity={MOOD.scanline} />
      <Noise opacity={MOOD.noise} />
      <Vignette offset={0.28} darkness={MOOD.vignette} />
      {/* The face-up cards' own soft glow, from the tagged faces alone, so no lamp can add to it. */}
      {MOOD.cardBloom > 0 && quality < 1 ? (
        <SelectiveBloom
          lights={[SELECTED_LIGHT]}
          mipmapBlur
          luminanceThreshold={0.25}
          // A soft halo needs no detail, so it is worked out at half size, and a quarter on fine screens.
          resolutionScale={sharp ? 0.25 : 0.5}
          levels={4}
          intensity={MOOD.cardBloom}
          radius={0.55}
        />
      ) : null}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <HueSaturation hue={MOOD.hue * Math.PI} saturation={MOOD.saturation} />
      <BrightnessContrast brightness={MOOD.brightness} contrast={MOOD.contrast} />
      {/* Below that, a cheap edge smoothing pass instead. */}
      {sharp ? null : <SMAA />}
    </EffectComposer>
  )
}
