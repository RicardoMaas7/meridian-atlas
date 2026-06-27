import { describe, it, expect } from 'vitest'
import { serializeSVG, downloadText, downloadBlob } from './chartExport'

function makeSvg(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('width', '200')
  svg.setAttribute('height', '100')
  const circle = document.createElementNS(ns, 'circle')
  circle.setAttribute('cx', '50')
  circle.setAttribute('cy', '50')
  circle.setAttribute('r', '40')
  circle.setAttribute('fill', 'red')
  svg.appendChild(circle)
  return svg
}

describe('serializeSVG', () => {
  it('produces a standalone XML document', () => {
    const xml = serializeSVG(makeSvg())
    expect(xml).toMatch(/^<\?xml/)
    expect(xml).toContain('xmlns="http://www.w3.org/2000/svg"')
    expect(xml).toContain('<circle')
  })

  it('injects a background rect when given a color', () => {
    const xml = serializeSVG(makeSvg(), '#05060a')
    expect(xml).toMatch(/<rect[^>]+fill="#05060a"/)
  })

  it('preserves the existing children after the background', () => {
    const xml = serializeSVG(makeSvg(), '#fff')
    const rectIdx = xml.indexOf('<rect')
    const circleIdx = xml.indexOf('<circle')
    expect(rectIdx).toBeLessThan(circleIdx)
  })
})

describe('downloadText', () => {
  it('does not throw when invoked', () => {
    // jsdom doesn't have a layout, so the click is a no-op — but the
    // function should not throw. We can't assert the download directly.
    expect(() => downloadText('hello', 'test.txt', 'text/plain')).not.toThrow()
  })
})

describe('downloadBlob', () => {
  it('does not throw when invoked', () => {
    const blob = new Blob(['x'], { type: 'text/plain' })
    expect(() => downloadBlob(blob, 'x.txt')).not.toThrow()
  })
})
