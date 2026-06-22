#!/usr/bin/env node
/**
 * merge-animations.js
 *
 * Merges animation clips from multiple FBX or GLB files into a single agent.glb.
 * FBX files are converted to GLB first via Blender CLI, then merged with
 * gltf-transform. Designed for Mixamo rigs where all files share the same skeleton.
 *
 * Usage:
 *   node merge-animations.js [options] <base> <anim1> [anim2 ...]
 *
 * Arguments:
 *   base          The character model file (e.g. "Y Bot.fbx")
 *   anim1+        Animation clip files (e.g. "Breathing Idle.fbx")
 *
 * Options:
 *   -o <file>     Output path  (default: agent.glb)
 *   --blender <p> Path to Blender (default: tries common install paths)
 *   --keep-tmp    Keep intermediate GLB files after merging
 *
 * Example:
 *   node merge-animations.js \
 *     "../frontend/public/Y Bot.fbx" \
 *     "../frontend/public/Breathing Idle.fbx" \
 *     "../frontend/public/Happy Idle.fbx" \
 *     "../frontend/public/Sad Idle.fbx" \
 *     "../frontend/public/Thinking.fbx" \
 *     -o "../frontend/public/agent.glb"
 */

import { NodeIO } from '@gltf-transform/core'
import { prune, dedup } from '@gltf-transform/functions'
import { spawnSync } from 'child_process'
import { existsSync, mkdirSync, unlinkSync } from 'fs'
import path from 'path'
import os from 'os'

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2)
if (args.length < 2 || args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: node merge-animations.js [options] <base.fbx|glb> <anim1.fbx|glb> ...

  -o <file>       Output file (default: agent.glb)
  --blender <p>   Path to Blender executable
  --keep-tmp      Keep intermediate GLB files

Example:
  node merge-animations.js \\
    "../frontend/public/Y Bot.fbx" \\
    "../frontend/public/Breathing Idle.fbx" \\
    "../frontend/public/Happy Idle.fbx" \\
    "../frontend/public/Sad Idle.fbx" \\
    "../frontend/public/Thinking.fbx" \\
    -o "../frontend/public/agent.glb"
`)
  process.exit(0)
}

let outputFile = 'agent.glb'
let blenderPath = null
let keepTmp = false
const inputFiles = []

for (let i = 0; i < args.length; i++) {
  if (args[i] === '-o' && args[i + 1]) { outputFile = args[++i]; continue }
  if (args[i] === '--blender' && args[i + 1]) { blenderPath = args[++i]; continue }
  if (args[i] === '--keep-tmp') { keepTmp = true; continue }
  inputFiles.push(args[i])
}

if (inputFiles.length < 2) {
  console.error('Error: need at least a base file and one animation file.')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Blender detection (macOS + Linux common paths)
// ---------------------------------------------------------------------------

const BLENDER_CANDIDATES = [
  '/Applications/Blender.app/Contents/MacOS/Blender',
  '/Applications/Blender.app/Contents/MacOS/blender',
  '/usr/bin/blender',
  '/usr/local/bin/blender',
  'blender',  // if on PATH
]

function findBlender() {
  if (blenderPath) {
    if (!existsSync(blenderPath)) {
      console.error(`Error: Blender not found at ${blenderPath}`)
      process.exit(1)
    }
    return blenderPath
  }
  for (const candidate of BLENDER_CANDIDATES) {
    const result = spawnSync('which', [candidate], { encoding: 'utf8' })
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim()
    if (existsSync(candidate)) return candidate
  }
  return null
}

// ---------------------------------------------------------------------------
// FBX → GLB conversion via Blender
// ---------------------------------------------------------------------------

function fbxToGlb(fbxPath, glbPath, blender) {
  // Inline Python that Blender runs in headless mode.
  // Clears the default scene, imports the FBX, exports as GLB.
  const pyScript = `
import bpy, sys
fbx_path = r"""${path.resolve(fbxPath)}"""
glb_path = r"""${path.resolve(glbPath)}"""
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
bpy.ops.import_scene.fbx(filepath=fbx_path, use_anim=True, anim_offset=0)
bpy.ops.export_scene.gltf(
  filepath=glb_path,
  export_format='GLB',
  export_animations=True,
  export_def_bones=True,
  export_optimize_animation_size=False,
  export_anim_single_armature=True,
)
print("BLENDER_EXPORT_OK:" + glb_path)
`.trim()

  console.log(`  Converting ${path.basename(fbxPath)} → ${path.basename(glbPath)} ...`)
  const result = spawnSync(
    blender,
    ['--background', '--python-expr', pyScript],
    { encoding: 'utf8', timeout: 120_000 }
  )

  const ok = (result.stdout || '').includes('BLENDER_EXPORT_OK')
  if (!ok) {
    console.error(`  Blender conversion failed for ${fbxPath}`)
    if (result.stderr) console.error(result.stderr.slice(-800))
    return false
  }
  return true
}

// ---------------------------------------------------------------------------
// gltf-transform: copy animations from sourceDoc into targetDoc
//
// Mixamo rigs share identical bone names across files, so we match channels
// by node name. Samplers (time + value arrays) are deep-copied as new
// Accessors so each document owns its own data.
// ---------------------------------------------------------------------------

function mergeAnimationsInto(targetDoc, sourceDoc, label) {
  const targetRoot = targetDoc.getRoot()
  const sourceRoot = sourceDoc.getRoot()

  // Build name → node map for the TARGET skeleton
  const boneMap = new Map()
  targetRoot.listNodes().forEach((n) => boneMap.set(n.getName(), n))

  const animations = sourceRoot.listAnimations()
  if (animations.length === 0) {
    console.warn(`  Warning: no animations found in ${label}`)
    return 0
  }

  let copied = 0
  for (const srcAnim of animations) {
    const animName = srcAnim.getName() || path.basename(label, path.extname(label))
    const dstAnim = targetDoc.createAnimation(animName)

    // Copy samplers — each needs its own Accessor copies in the target doc
    const samplerMap = new Map()
    for (const srcSampler of srcAnim.listSamplers()) {
      const srcInput  = srcSampler.getInput()
      const srcOutput = srcSampler.getOutput()

      const dstInput = targetDoc.createAccessor()
        .setType(srcInput.getType())
        .setArray(srcInput.getArray().slice())
        .setNormalized(srcInput.getNormalized())

      const dstOutput = targetDoc.createAccessor()
        .setType(srcOutput.getType())
        .setArray(srcOutput.getArray().slice())
        .setNormalized(srcOutput.getNormalized())

      const dstSampler = targetDoc.createAnimationSampler()
        .setInput(dstInput)
        .setOutput(dstOutput)
        .setInterpolation(srcSampler.getInterpolation())

      dstAnim.addSampler(dstSampler)
      samplerMap.set(srcSampler, dstSampler)
    }

    // Copy channels — remap target nodes by matching name
    let channelsCopied = 0
    for (const srcChannel of srcAnim.listChannels()) {
      const srcNode = srcChannel.getTargetNode()
      if (!srcNode) continue

      const dstNode = boneMap.get(srcNode.getName())
      if (!dstNode) continue  // bone not in base rig — skip silently

      const dstChannel = targetDoc.createAnimationChannel()
        .setTargetNode(dstNode)
        .setTargetPath(srcChannel.getTargetPath())
        .setSampler(samplerMap.get(srcChannel.getSampler()))

      dstAnim.addChannel(dstChannel)
      channelsCopied++
    }

    console.log(`  ✓ "${animName}" — ${channelsCopied} channels`)
    copied++
  }
  return copied
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const tmpDir = path.join(os.tmpdir(), 'alter-merge-' + Date.now())
  mkdirSync(tmpDir, { recursive: true })
  const tmpFiles = []

  // Step 1 — resolve all inputs to GLB paths
  const hasFbx = inputFiles.some((f) => f.toLowerCase().endsWith('.fbx'))
  let blender = null
  if (hasFbx) {
    blender = findBlender()
    if (!blender) {
      console.error(`
Error: FBX files detected but Blender was not found.

Install Blender from https://www.blender.org/download/ then retry, or pass:
  --blender "/path/to/Blender.app/Contents/MacOS/Blender"

Alternatively, pre-convert FBX → GLB with:
  blender --background --python-expr "
    import bpy
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    bpy.ops.import_scene.fbx(filepath='Y Bot.fbx')
    bpy.ops.export_scene.gltf(filepath='Y Bot.glb', export_format='GLB')
  "
`)
      process.exit(1)
    }
    console.log(`Blender: ${blender}\n`)
  }

  const glbPaths = []
  for (const inputFile of inputFiles) {
    if (!existsSync(inputFile)) {
      console.error(`Error: file not found — ${inputFile}`)
      process.exit(1)
    }
    if (inputFile.toLowerCase().endsWith('.fbx')) {
      const base = path.basename(inputFile, '.fbx').replace(/\s+/g, '_')
      const glbPath = path.join(tmpDir, base + '.glb')
      const ok = fbxToGlb(inputFile, glbPath, blender)
      if (!ok) process.exit(1)
      glbPaths.push(glbPath)
      tmpFiles.push(glbPath)
    } else {
      glbPaths.push(inputFile)
    }
  }

  // Step 2 — load base document with gltf-transform
  console.log(`\nLoading base: ${path.basename(glbPaths[0])}`)
  const io = new NodeIO()
  const baseDoc = await io.read(glbPaths[0])
  const baseAnims = baseDoc.getRoot().listAnimations().length
  console.log(`  Existing animations in base: ${baseAnims}`)

  // Step 3 — merge animations from each remaining GLB
  let totalAdded = 0
  for (let i = 1; i < glbPaths.length; i++) {
    const label = path.basename(inputFiles[i])
    console.log(`\nMerging: ${label}`)
    const animDoc = await io.read(glbPaths[i])
    const added = mergeAnimationsInto(baseDoc, animDoc, label)
    totalAdded += added
  }

  // Step 4 — deduplicate accessors and prune unused nodes
  console.log('\nOptimizing...')
  await baseDoc.transform(dedup(), prune())

  // Step 5 — write output
  await io.write(outputFile, baseDoc)
  const finalAnims = baseDoc.getRoot().listAnimations().length
  console.log(`\n✓ Written: ${outputFile}`)
  console.log(`  Animations: ${baseAnims} (original) + ${totalAdded} (merged) = ${finalAnims} total`)

  // Cleanup
  if (!keepTmp) {
    tmpFiles.forEach((f) => { try { unlinkSync(f) } catch {} })
    try { unlinkSync(tmpDir) } catch {}
  } else {
    console.log(`  Temp GLBs kept in: ${tmpDir}`)
  }
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
