import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Link } from '@tanstack/react-router'
import { Suspense, use, useMemo, useRef, useState, type ReactNode } from 'react'
import { card, CARDS, DEBUG_CARD, OUT_OF_MEMORY, type Unit } from 'shared'
import * as THREE from 'three'
import { cardArt, iconArt } from '../game/art.ts'
import { BACK_Z, diskGeometry, diskMaterials, FACE_Z, poseAt, sheetGeometries } from '../game/table/Disk.tsx'
import { backTexture, faceContent, faceLights, faceTexture, loadCardAssets } from '../game/table/faces.ts'
import { kindOf } from '../game/table/kind.ts'
import { NotFound } from './NotFound.tsx'

/** Every piece of a disk that can be shown or hidden on its own. */
type Part = 'plastic' | 'dark' | 'metal' | 'base' | 'content' | 'lights' | 'back'

const PARTS: { id: Part; name: string; about: string }[] = [
  { id: 'plastic', name: 'Plastic body', about: 'The disk itself, built from outlines extruded into 3D.' },
  { id: 'dark', name: 'Dark recesses', about: 'Black floors under holes, so they read as dents.' },
  { id: 'metal', name: 'Metal', about: 'The shutter, its rails and the hub on the back.' },
  { id: 'base', name: 'Base sticker', about: 'The plastic colors and empty panels, shared by every card of a rarity.' },
  { id: 'content', name: 'Content sticker', about: "The art, name and numbers; it's what fades when a disk closes." },
  { id: 'lights', name: 'Lights', about: 'The content on black: it tells the renderer which parts glow.' },
  { id: 'back', name: 'Back sticker', about: 'The label on the disk’s back, the same for every card.' },
]

/** How far each piece moves toward the camera at full explosion, so the layers come apart in order. */
const SPREAD: Record<Part, number> = {
  plastic: 0,
  dark: 0.08,
  metal: 0.16,
  base: 0.28,
  content: 0.4,
  lights: 0.52,
  back: -0.28,
}

// The three sections in colors of their own, so the squash shows which one gives.
const SECTION_TINTS = ['#e86a5f', '#e8c95f', '#5fb6e8'] as const

type View = {
  unit: Unit
  shown: Record<Part, boolean>
  open: number
  explode: number
  wire: boolean
  sections: boolean
  spin: boolean
}

function AnatomyDisk({ view }: { view: View }) {
  const assets = use(loadCardAssets())
  const { unit, shown, open, explode, wire, sections, spin } = view
  const geometry = diskGeometry()
  const sheets = sheetGeometries()
  const kind = kindOf(unit)
  const spinner = useRef<THREE.Group>(null)
  // Copies of the table's materials, so wireframe here never reaches the game's disks.
  const solid = useMemo(() => {
    const base = diskMaterials(kind)
    const copy = (material: THREE.MeshStandardMaterial) => Object.assign(material.clone(), { wireframe: wire })
    return { plastic: copy(base.plastic), dark: copy(base.dark), metal: copy(base.metal) }
  }, [kind, wire])
  const tints = useMemo(
    () => SECTION_TINTS.map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, wireframe: wire })),
    [wire],
  )
  const stickers = useMemo(
    () => ({
      base: new THREE.MeshStandardMaterial({
        map: faceTexture(unit, assets),
        roughness: 0.85,
        transparent: true,
        alphaTest: 0.5,
      }),
      content: new THREE.MeshStandardMaterial({
        map: faceContent(unit, assets),
        roughness: 0.85,
        transparent: true,
        alphaTest: 0.5,
      }),
      // Its own layer here, added on top as light, where the table folds it into the content as its glow.
      lights: new THREE.MeshBasicMaterial({
        map: faceLights(unit, assets),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      back: new THREE.MeshStandardMaterial({ map: backTexture(), roughness: 0.85, transparent: true, alphaTest: 0.5 }),
    }),
    [unit, assets],
  )
  useFrame((_, delta) => {
    if (spinner.current && spin) spinner.current.rotation.y += delta * 0.5
  })
  const at = poseAt(open)
  const z = (part: Part) => SPREAD[part] * explode
  const section = (part: (typeof geometry)['top'], index: 0 | 1 | 2, y: number, scale = 1) => (
    <group position={[0, y, 0]} scale={[1, scale, 1]}>
      {(['plastic', 'dark', 'metal'] as const).map((name) => {
        const piece = part[name]
        if (!piece || !shown[name]) return null
        return (
          <mesh
            key={name}
            geometry={piece}
            material={sections ? tints[index] : solid[name]}
            position={[0, 0, z(name)]}
          />
        )
      })}
      {shown.base ? (
        <mesh geometry={sheets.front[index]} material={stickers.base} position={[0, 0, FACE_Z + z('base')]} />
      ) : null}
      {shown.content ? (
        <mesh
          geometry={sheets.front[index]}
          material={stickers.content}
          position={[0, 0, FACE_Z + 0.0005 + z('content')]}
        />
      ) : null}
      {shown.lights ? (
        <mesh
          geometry={sheets.front[index]}
          material={stickers.lights}
          position={[0, 0, FACE_Z + 0.001 + z('lights')]}
        />
      ) : null}
      {shown.back ? (
        <mesh geometry={sheets.back[index]} material={stickers.back} position={[0, 0, BACK_Z + z('back')]} />
      ) : null}
    </group>
  )
  return (
    <group ref={spinner}>
      {section(geometry.top, 0, at.top)}
      {section(geometry.middle, 1, at.middle, at.middleScale)}
      {section(geometry.bottom, 2, at.bottom)}
      {shown.metal ? (
        <group position={[0, at.rails, 0]} scale={[1, at.railsScale, 1]}>
          <mesh geometry={geometry.rail} material={sections ? tints[1] : solid.metal} position={[0, 0, z('metal')]} />
        </group>
      ) : null}
    </group>
  )
}

/** A canvas the game draws a sticker on, shown flat, on a checkerboard so its cut-out holes show. */
function Sheet({ texture, title, children }: { texture: THREE.Texture; title: string; children: ReactNode }) {
  const url = useMemo(() => (texture.image as HTMLCanvasElement).toDataURL(), [texture])
  return (
    <figure className="flex w-44 flex-col gap-2">
      <img
        src={url}
        alt={title}
        className="w-full rounded border border-border bg-[repeating-conic-gradient(#2a2f35_0_25%,#1a1e22_0_50%)] bg-[length:16px_16px]"
      />
      <figcaption className="text-sm">
        <strong className="block">{title}</strong>
        <span className="break-all text-muted-foreground">{children}</span>
      </figcaption>
    </figure>
  )
}

/** A file the stickers are drawn from, at its own pixels, scaled up without blurring. */
function Source({ src, title, children }: { src: string; title: string; children: ReactNode }) {
  return (
    <figure className="flex w-32 flex-col gap-2">
      <img
        src={src}
        alt={title}
        className="pixel-art aspect-square w-full rounded border border-border bg-[#9fd8b4] p-2"
      />
      <figcaption className="text-sm">
        <strong className="block">{title}</strong>
        <span className="break-all text-muted-foreground">{children}</span>
      </figcaption>
    </figure>
  )
}

function Stickers({ unit }: { unit: Unit }) {
  const assets = use(loadCardAssets())
  const def = card(unit.card)
  return (
    <>
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">1. The files it's drawn from</h2>
        <p className="text-muted-foreground">
          Pixel art made in the art editor, and the VT323 font. Nothing here knows about the card's current numbers.
        </p>
        <div className="flex flex-wrap gap-4">
          <Source src={cardArt(unit.card)} title="Card art">
            art/cards/{unit.card}.png, 24 × 24
          </Source>
          {def.type ? (
            <Source src={iconArt(`type-${def.type}`)} title="Type icon">
              art/icons/type-{def.type}.png
            </Source>
          ) : null}
          {unit.sigils.map((sigil) => (
            <Source key={sigil} src={iconArt(sigil)} title="Sigil icon">
              art/icons/{sigil}.png
            </Source>
          ))}
          <Source src={iconArt('attack')} title="Attack icon">
            art/icons/attack.png
          </Source>
          <Source src={iconArt('health')} title="Health icon">
            art/icons/health.png
          </Source>
          <figure className="flex w-32 flex-col gap-2">
            <span className="grid aspect-square w-full place-items-center rounded border border-border bg-[#9fd8b4] font-terminal text-4xl text-[#0b1f12]">
              {unit.attack}/{unit.health}
            </span>
            <figcaption className="text-sm">
              <strong className="block">VT323 font</strong>
              <span className="text-muted-foreground">for the name and numbers</span>
            </figcaption>
          </figure>
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">2. The stickers the game draws</h2>
        <p className="text-muted-foreground">
          Off-screen canvases, never on the page. The game puts the files above onto them once per look a card has, then
          hands each to the graphics card as a texture. Change the card or damage it, and the content and lights are
          drawn again; the base and back stay the same.
        </p>
        <div className="flex flex-wrap gap-4">
          <Sheet texture={faceTexture(unit, assets)} title="Base">
            Plastic, label plate, screens. Shared by every {kindOf(unit)} card.
          </Sheet>
          <Sheet texture={faceContent(unit, assets)} title="Content">
            Art, name, cost, type, sigils, attack and health; clear everywhere else.
          </Sheet>
          <Sheet texture={faceLights(unit, assets)} title="Lights">
            The content on black. Bright parts glow.
          </Sheet>
          <Sheet texture={backTexture()} title="Back">
            The same for every card, mirrored.
          </Sheet>
        </div>
      </section>
    </>
  )
}

const unitOf = (id: string, damaged: boolean): Unit => {
  const def = card(id)
  return {
    uid: 1,
    card: id,
    attack: def.attack,
    health: damaged ? Math.max(0, def.health - 1) : def.health,
    maxHealth: def.health,
    sigils: [...def.sigils],
  }
}

const CHOICES = Object.values(CARDS).filter((def) => def.id !== DEBUG_CARD && def.id !== OUT_OF_MEMORY)

/** A disk taken apart: each piece of its shape and each sticker on its own, then how they come together. Development only. */
export function DiskAnatomy() {
  const [id, setId] = useState('NullPointer')
  const [damaged, setDamaged] = useState(false)
  const [shown, setShown] = useState<Record<Part, boolean>>({
    plastic: true,
    dark: true,
    metal: true,
    base: true,
    content: true,
    lights: true,
    back: true,
  })
  const [open, setOpen] = useState(1)
  const [explode, setExplode] = useState(0)
  const [wire, setWire] = useState(false)
  const [sections, setSections] = useState(false)
  const [spin, setSpin] = useState(false)
  const unit = useMemo(() => unitOf(id, damaged), [id, damaged])
  if (!import.meta.env.DEV) return <NotFound />
  const box = 'size-4 accent-primary'
  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link to="/run/mockups" className="text-sm text-muted-foreground hover:underline">
          ← Mockups
        </Link>
        <h1 className="text-3xl font-semibold">Disk anatomy</h1>
        <p className="text-muted-foreground">
          How a card becomes a floppy disk on the 3D table: a shape built in code, wrapped in stickers the game draws
          from image files. Turn pieces off, pull them apart and squash the disk to see each one alone.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="flex flex-col gap-4 text-sm">
          <label className="flex flex-col gap-1">
            <span className="font-semibold">Card</span>
            <select
              value={id}
              onChange={(event) => setId(event.target.value)}
              className="rounded border border-border bg-background px-2 py-1"
            >
              {CHOICES.map((def) => (
                <option key={def.id} value={def.id}>
                  {def.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={damaged}
              onChange={(event) => setDamaged(event.target.checked)}
              className={box}
            />
            Damage it by 1, to redraw its health in red
          </label>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 font-semibold">Pieces</legend>
            {PARTS.map((part) => (
              <label key={part.id} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={shown[part.id]}
                  onChange={(event) => setShown((now) => ({ ...now, [part.id]: event.target.checked }))}
                  className={`${box} mt-0.5`}
                />
                <span>
                  <span className="block">{part.name}</span>
                  <span className="text-muted-foreground">{part.about}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <label className="flex flex-col gap-1">
            <span className="font-semibold">Explode: {Math.round(explode * 100)}%</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={explode}
              onChange={(event) => setExplode(Number(event.target.value))}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold">Open: {Math.round(open * 100)}%</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={open}
              onChange={(event) => setOpen(Number(event.target.value))}
            />
            <span className="text-muted-foreground">A closed disk squashes only its middle section.</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={sections}
              onChange={(event) => setSections(event.target.checked)}
              className={box}
            />
            Color the three sections
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={wire} onChange={(event) => setWire(event.target.checked)} className={box} />
            Wireframe
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={spin} onChange={(event) => setSpin(event.target.checked)} className={box} />
            Spin
          </label>
        </div>
        <div className="h-[34rem] overflow-hidden rounded-lg border border-border bg-[#02070c]">
          <Canvas
            camera={{ position: [0.6, 0.3, 2], fov: 45 }}
            dpr={[1, 2]}
            gl={{ toneMapping: THREE.ACESFilmicToneMapping }}
            role="img"
            aria-label={`${card(id).name}'s disk, taken apart`}
          >
            <color attach="background" args={['#02070c']} />
            <ambientLight intensity={0.6} />
            <hemisphereLight color="#bfe8ff" groundColor="#000000" intensity={0.9} />
            <spotLight position={[0, 4, 3]} angle={0.7} penumbra={0.6} intensity={60} decay={1.6} distance={20} />
            <pointLight position={[-2, 1, -2]} intensity={8} distance={8} />
            <Suspense fallback={null}>
              <AnatomyDisk view={{ unit, shown, open, explode, wire, sections, spin }} />
            </Suspense>
            <OrbitControls makeDefault enablePan={false} minDistance={1} maxDistance={5} />
          </Canvas>
        </div>
      </div>
      <Suspense fallback={<p className="text-muted-foreground">Loading the art…</p>}>
        <Stickers unit={unit} />
      </Suspense>
    </div>
  )
}
