/**
 * Serialize an SVG element to a standalone .svg string. The original
 * element's <defs> and computed styles are inlined so the resulting
 * file renders correctly when opened on its own.
 */
export function serializeSVG(svg: SVGSVGElement, background?: string): string {
  const clone = svg.cloneNode(true) as SVGSVGElement
  // Ensure xmlns is present so the file works as a standalone document.
  if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  if (!clone.getAttribute('xmlns:xlink')) clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')

  if (background) {
    // Inject a background rect as the first child so the export isn't
    // transparent on viewers that don't honor the page background.
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    rect.setAttribute('x', '0')
    rect.setAttribute('y', '0')
    rect.setAttribute('width', '100%')
    rect.setAttribute('height', '100%')
    rect.setAttribute('fill', background)
    clone.insertBefore(rect, clone.firstChild)
  }

  const serializer = new XMLSerializer()
  let xml = serializer.serializeToString(clone)
  if (!xml.match(/^<\?xml/)) xml = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' + xml
  return xml
}

/**
 * Rasterize an SVG to a PNG blob at the requested pixel scale. We
 * draw the SVG into an Image, then to a Canvas. No external libraries.
 */
export async function svgToPng(
  svg: SVGSVGElement,
  options: { scale?: number; background?: string; width?: number; height?: number } = {},
): Promise<Blob> {
  const scale = options.scale ?? 2
  const background = options.background ?? '#05060a'
  const xml = serializeSVG(svg, background)
  const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  const intrinsicW = options.width ?? (Number(svg.getAttribute('width')) || svg.clientWidth || 1600)
  const intrinsicH = options.height ?? (Number(svg.getAttribute('height')) || svg.clientHeight || 900)

  try {
    const img = new Image()
    img.decoding = 'async'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Failed to load SVG into Image'))
      img.src = url
    })

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(intrinsicW * scale)
    canvas.height = Math.round(intrinsicH * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not get 2D context')
    ctx.fillStyle = background
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error('canvas.toBlob returned null'))
      }, 'image/png')
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadText(text: string, filename: string, mime = 'text/plain'): void {
  const blob = new Blob([text], { type: mime })
  downloadBlob(blob, filename)
}
