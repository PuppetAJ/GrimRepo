# Art sources

Files made in art tools, which the game loads in an exported form.

## The floppy disk (`disk.blend`)

Every card on the 3D table is this disk. It is exported to `client/public/models/disk.glb`, which the game loads in `client/src/game/table/diskGeometry.ts`.

- **Parts:** one object for each section and material: `top_plastic`, `top_dark` and `top_metal`, the same for `middle` and `bottom`, and `rail_metal`. The game finds them by these names and draws each in its own material, so the materials in the file are only for looking at it in Blender.
- **Sections:** a closing disk squashes only the middle, so keep the top, middle and bottom as separate objects. Each part's origin is its section's anchor edge: the top's upper edge, the middle's upper edge, the bottom's lower edge. The objects are placed so the disk looks assembled; the game uses only each part's own shape.
- **Size:** the faces are drawn to the disk's measurements in `client/src/game/table/layout.ts`. If you change the disk's width or the middle's height, change those too. `client/src/game/table/disk.test.ts` checks that they agree.
- **UVs:** the worn plastic and metal textures are mapped straight off the face. Blender's glTF exporter flips V, so V is stored flipped in this file; keep it that way, and the test catches it if it isn't.

**To export:** select the objects in the `Disk` collection, then File → Export → glTF 2.0, with:

- Format: glTF Binary (`.glb`)
- Include: Selected Objects
- Transform: +Y Up
- Data: UVs and Normals on, Materials off; no cameras, lights or animation

Save it over `client/public/models/disk.glb`.
