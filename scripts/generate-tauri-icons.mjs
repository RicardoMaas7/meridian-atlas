// Generates placeholder PNG/ICO icons for Tauri from the existing favicon.svg
// Run: node scripts/generate-tauri-icons.mjs
// Requires: sharp (install with: pnpm add -D sharp)
import { readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = dirname(__dirname)
const iconDir = join(root, 'src-tauri', 'icons')

const sizes = [
  { name: '32x32.png', size: 32 },
  { name: '128x128.png', size: 128 },
  { name: '128x128@2x.png', size: 256 },
  { name: 'icon.png', size: 512 },
]

async function main() {
  let sharp
  try {
    sharp = (await import('sharp')).default
  } catch {
    console.log('sharp not installed, creating minimal placeholder icons')
    // Create minimal 1x1 PNG files as placeholders
    const minimalPng = Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c636400010000000500010d0a2db40000000049454e44ae426082',
      'hex'
    )
    for (const s of sizes) {
      writeFileSync(join(iconDir, s.name), minimalPng)
      console.log(`Created ${s.name}`)
    }
    // Minimal ICO (16x16)
    const minimalIco = Buffer.from(
      '00000100010010101000010020006804000016000000280000001000000020000000010020000000000000040000000000000000000000000000000000000000',
      'hex'
    )
    writeFileSync(join(iconDir, 'icon.ico'), minimalIco)
    console.log('Created icon.ico')
    // Minimal ICNS
    const minimalIcns = Buffer.from('69636e73000000080000000000000000', 'hex')
    writeFileSync(join(iconDir, 'icon.icns'), minimalIcns)
    console.log('Created icon.icns')
    return
  }
  const svg = readFileSync(join(root, 'public', 'favicon.svg'))
  for (const s of sizes) {
    await sharp(svg).resize(s.size, s.size).png().toFile(join(iconDir, s.name))
    console.log(`Created ${s.name}`)
  }
  // ICO from 32x32 PNG
  const png32 = await sharp(svg).resize(32, 32).png().toBuffer()
  // Simple ICO container wrapping one 32x32 PNG
  const ico = Buffer.alloc(6 + 16)
  ico.writeUInt16LE(0, 0)
  ico.writeUInt16LE(1, 2)
  ico.writeUInt16LE(1, 4)
  ico.writeUInt8(32, 6)
  ico.writeUInt8(32, 7)
  ico.writeUInt8(0, 8)
  ico.writeUInt8(0, 9)
  ico.writeUInt16LE(1, 10)
  ico.writeUInt16LE(32, 12)
  ico.writeUInt32LE(png32.length, 14)
  ico.writeUInt32LE(22, 18)
  writeFileSync(join(iconDir, 'icon.ico'), Buffer.concat([ico, png32]))
  console.log('Created icon.ico')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})