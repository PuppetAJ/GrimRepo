// Renders each 2022 card model face-on in a headless browser and saves its art, so the game can draw cards from data.
// Usage: pnpm --filter client render:cards [--full]  (--full saves whole faces to a temp folder, for checking)
import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const client = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const full = process.argv.includes('--full')
const out = full ? path.join(tmpdir(), 'grimrepo-card-faces') : path.join(client, 'public/cards')

// The model file for each card id; the names are the 2022 ones.
const MODELS = {
  OffCenterDiv: 'OffCenterDiv',
  HelloWorld: 'Hello World',
  SyntaxErr: 'Syntax Err',
  Loop: 'Loop',
  IfLosing: 'if(losing)',
  RobloxDevOps: 'RobloxDevOps',
  GoogleFu: 'GoogleFu',
  GitSome: 'GitSome',
  GrimRepo: 'GrimRepo',
  GitBasher: 'Gitbasher',
  Firewall: 'Firewall',
  SQLSyntaxErr: 'SQLSyntaxErr',
  NullPointer: 'NullPointer',
  Bug: 'Bug',
  BrokenCode: 'BrokenCode',
  Cookie: 'Cookie',
  Iterator: 'Iterator',
  BootStrapped: 'BootStrapped',
  DestroyEnemyYou: 'destroyEnemy(you)',
  DeathNode: 'DeathNode',
  JSONFoorhees: 'JSONFoorhees',
  Documentation: 'Documentation',
  FourOhFour: 'FourOhFour',
  RubberDuck: 'RubberDuck',
  JACK: 'JACK',
  Y2K: 'Y2K',
}

const PAGE = `<!doctype html><script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
const loader = new GLTFLoader()
const ART = { top: 0.14, bottom: 0.7, left: 0.03, right: 0.97 }
// Clears every shape reaching past a line, so a name's descenders go with it and art that stops short stays.
function clearTouching({ data, width, height }, line, side) {
  const stack = []
  for (let y = side === 'above' ? 0 : line; side === 'above' ? y < line : y < height; y++)
    for (let x = 0; x < width; x++) stack.push(y * width + x)
  while (stack.length) {
    const i = stack.pop()
    if (data[i * 4 + 3] < 8) continue
    data[i * 4 + 3] = 0
    const x = i % width
    if (x > 0) stack.push(i - 1)
    if (x < width - 1) stack.push(i + 1)
    if (i >= width) stack.push(i - width)
    if (i < width * (height - 1)) stack.push(i + width)
  }
}
window.render = async (file, { full, width }) => {
  const gltf = await loader.loadAsync('/models/Card_models/' + encodeURIComponent(file) + '.glb')
  const scene = new THREE.Scene()
  const card = gltf.scene.children.find((child) => child.name !== 'Card_Hitbox')
  scene.add(card)
  card.traverse((mesh) => {
    if (!mesh.isMesh) return
    for (const material of [mesh.material].flat()) {
      // The blank card and its baked text are redrawn from data; only the art is kept.
      if (!full && material.map?.name?.startsWith('card_empty')) material.visible = false
      // The red cost digit sits inside the art's corner.
      const { r, g } = material.color
      if (!full && !material.map && r > 0.5 && g < 0.2) material.visible = false
      material.side = THREE.DoubleSide
    }
  })
  const box = new THREE.Box3().setFromObject(card)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const camera = new THREE.OrthographicCamera(-size.x / 2, size.x / 2, size.z / 2, -size.z / 2, 0.01, 1000)
  camera.position.set(center.x, box.max.y + 10, center.z)
  camera.up.set(0, 0, 1)
  camera.lookAt(center)
  scene.add(new THREE.AmbientLight(0xffffff, 3))
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
  renderer.setSize(width, Math.round((width * size.z) / size.x))
  renderer.setClearColor(0x000000, 0)
  renderer.render(scene, camera)
  let canvas = renderer.domElement
  if (!full) {
    const { width: w, height: h } = canvas
    const face = document.createElement('canvas')
    face.width = w
    face.height = h
    const context = face.getContext('2d')
    context.drawImage(canvas, 0, 0)
    const image = context.getImageData(0, 0, w, h)
    clearTouching(image, Math.round(h * ART.top) - 4, 'above')
    clearTouching(image, Math.round(h * ART.bottom) + 4, 'below')
    context.putImageData(image, 0, 0)
    // The band between the name and the stats, where every card's art sits.
    const crop = document.createElement('canvas')
    crop.width = Math.round(w * (ART.right - ART.left))
    crop.height = Math.round(h * (ART.bottom - ART.top))
    crop.getContext('2d').drawImage(face, -w * ART.left, -h * ART.top)
    canvas = crop
  }
  const url = canvas.toDataURL('image/png')
  renderer.dispose()
  return url
}
// The blank card, the rare card and the card back, as the models carry them.
window.texture = async (file, name) => {
  const gltf = await loader.loadAsync('/models/' + encodeURIComponent(file) + '.glb')
  let image
  gltf.scene.traverse((mesh) => {
    for (const material of [mesh.material ?? []].flat()) if (material.map?.name === name) image = material.map.image
  })
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  canvas.getContext('2d').drawImage(image, 0, 0)
  return canvas.toDataURL('image/png')
}
window.ready = true
</script>`

const TYPES = { '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.html': 'text/html' }
const server = createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  try {
    if (url === '/') return res.end(PAGE)
    const file = url.startsWith('/three/')
      ? path.join(client, 'node_modules', url)
      : path.join(client, 'public', url.replace(/^\/models\//, 'models/'))
    res.setHeader('content-type', TYPES[path.extname(file)] ?? 'application/octet-stream')
    res.end(await readFile(file))
  } catch {
    res.statusCode = 404
    res.end()
  }
}).listen(0)
const port = server.address().port

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] })
const page = await browser.newPage()
page.on('pageerror', (error) => console.error(error))
await page.goto(`http://localhost:${port}/`)
await page.waitForFunction(() => window.ready)
await mkdir(out, { recursive: true })
for (const [id, file] of Object.entries(MODELS)) {
  const url = await page.evaluate(([file, full]) => window.render(file, { full, width: 512 }), [file, full])
  await writeFile(path.join(out, `${id}.png`), Buffer.from(url.split(',')[1], 'base64'))
  console.log(id)
}
for (const [file, name, as] of [
  ['card_merge', 'card_empty', 'frame'],
  ['Card_models/Y2K', 'card_empty_rare_colored', 'frame-rare'],
  ['deck', 'card_back', 'back'],
]) {
  const url = await page.evaluate(([file, name]) => window.texture(file, name), [file, name])
  await writeFile(path.join(out, `${as}.png`), Buffer.from(url.split(',')[1], 'base64'))
  console.log(as)
}
await browser.close()
server.close()
