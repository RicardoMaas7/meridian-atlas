import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { animate, createTimeline } from 'animejs'
import type { CodeChart, ChartNode } from '../types'
import { startLayout } from '../graph/layout'

interface Props {
  chart: CodeChart
  selectedId: number | null
  newIds: Set<number>
  onSelect: (id: number | null) => void
}

const PALETTE = {
  void: 0x05060a,
  ink: 0xefe7d3,
  inkDim: 0x8a8275,
  gold: 0xd4a857,
  goldBright: 0xf2cf80,
  copper: 0xc87856,
  azure: 0x4a8fc5,
}

interface Scene3D {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  nodeMeshes: Map<number, THREE.Mesh>
  nodeRings: Map<number, THREE.Mesh>
  edgeLines: THREE.LineSegments
  particleField: THREE.Points
  halos: Map<number, THREE.Mesh>
  labels: Map<number, THREE.Sprite>
  raycaster: THREE.Raycaster
  pointer: THREE.Vector2
  cameraTarget: THREE.Vector3
  cameraPos: THREE.Vector3
}

const MAX_PARTICLES = 250
const TARGET_FPS = 30
const FRAME_INTERVAL = 1000 / TARGET_FPS
const FORCE_TICKS = 150 // Reduced from 300

export function ChartCanvas({ chart, selectedId, newIds, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<Scene3D | null>(null)
  const hoverRef = useRef<ChartNode | null>(null)
  const selectedRef = useRef<number | null>(selectedId)
  const newIdsRef = useRef<Set<number>>(newIds)
  const isUserInteractingRef = useRef(false)
  const idleTimeRef = useRef(0)
  const isVisibleRef = useRef(true)

  useEffect(() => {
    selectedRef.current = selectedId
    newIdsRef.current = newIds
    if (sceneRef.current) {
      highlightSelection(sceneRef.current, selectedId)
    }
  }, [selectedId, newIds])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Bail out if WebGL is unavailable
    const testCanvas = document.createElement('canvas')
    const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl')
    if (!gl) {
      container.innerHTML = '<div class="webgl-error">WebGL is not available in this browser</div>'
      return
    }

    const renderer = new THREE.WebGLRenderer({
      antialias: false, // disabled for perf
      alpha: true,
      powerPreference: 'low-power',
    })
    renderer.setPixelRatio(1) // Cap at 1x for perf
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setClearColor(PALETTE.void, 1)
    container.appendChild(renderer.domElement)
    renderer.domElement.style.cursor = 'grab'

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(PALETTE.void, 0.0012)

    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      1,
      5000
    )
    camera.position.set(0, 0, 800)
    camera.lookAt(0, 0, 0)

    // Lighting (cheaper: just ambient + one directional)
    const ambient = new THREE.AmbientLight(PALETTE.ink, 0.6)
    scene.add(ambient)
    const key = new THREE.DirectionalLight(PALETTE.gold, 0.8)
    key.position.set(200, 300, 400)
    scene.add(key)

    // Compute layout
    const { positions } = computeLayout(chart)

    // Build edges as a single line segments mesh
    const edgeGeometry = new THREE.BufferGeometry()
    const edgeCount = chart.edges.length
    const edgePositions = new Float32Array(edgeCount * 6)
    const edgeColors = new Float32Array(edgeCount * 6)
    let ei = 0
    for (const e of chart.edges) {
      const a = positions.get(e.source)
      const b = positions.get(e.target)
      if (!a || !b) continue
      edgePositions[ei * 6] = a.x
      edgePositions[ei * 6 + 1] = a.y
      edgePositions[ei * 6 + 2] = a.z
      edgePositions[ei * 6 + 3] = b.x
      edgePositions[ei * 6 + 4] = b.y
      edgePositions[ei * 6 + 5] = b.z
      const col = e.charted
        ? new THREE.Color(PALETTE.gold)
        : new THREE.Color(PALETTE.inkDim)
      edgeColors[ei * 6] = col.r
      edgeColors[ei * 6 + 1] = col.g
      edgeColors[ei * 6 + 2] = col.b
      edgeColors[ei * 6 + 3] = col.r
      edgeColors[ei * 6 + 4] = col.g
      edgeColors[ei * 6 + 5] = col.b
      ei++
    }
    edgeGeometry.setAttribute('position', new THREE.BufferAttribute(edgePositions, 3))
    edgeGeometry.setAttribute('color', new THREE.BufferAttribute(edgeColors, 3))
    const edgeMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const edgeLines = new THREE.LineSegments(edgeGeometry, edgeMaterial)
    scene.add(edgeLines)

    // Build nodes (limit count, simplify)
    const nodeMeshes = new Map<number, THREE.Mesh>()
    const nodeRings = new Map<number, THREE.Mesh>()
    const halos = new Map<number, THREE.Mesh>()
    const labels = new Map<number, THREE.Sprite>()

    // Cap node visual complexity based on count
    const totalNodes = chart.nodes.length
    const showLabels = totalNodes <= 80
    const showHalos = totalNodes <= 60
    const ringDetail = totalNodes > 100 ? 16 : 32 // lower ring segments for big graphs

    for (const node of chart.nodes) {
      const p = positions.get(node.id)
      if (!p) continue

      const importance = Math.min(1, Math.sqrt(node.inbound + node.outbound) / 6)
      const r = 4 + importance * 10

      // Core sphere (lower poly for perf)
      const geometry = new THREE.SphereGeometry(r, 12, 12)
      const isNew = newIds.has(node.id)
      const baseColor = isNew ? PALETTE.goldBright : PALETTE.ink
      const material = new THREE.MeshStandardMaterial({
        color: baseColor,
        metalness: 0.3,
        roughness: 0.4,
        emissive: isNew ? PALETTE.gold : PALETTE.ink,
        emissiveIntensity: isNew ? 0.6 : 0.12,
      })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(p.x, p.y, p.z)
      mesh.userData = { id: node.id, name: node.name, kind: node.kind, radius: r }
      nodeMeshes.set(node.id, mesh)
      scene.add(mesh)

      // Outer ring (always present, important for constellation look)
      const ringGeo = new THREE.TorusGeometry(r * 2, 0.3, 6, ringDetail)
      const ringMat = new THREE.MeshBasicMaterial({
        color: PALETTE.gold,
        transparent: true,
        opacity: isNew ? 0.7 : 0.25,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const ring = new THREE.Mesh(ringGeo, ringMat)
      ring.position.copy(mesh.position)
      // Face the camera roughly (just rotate around Z for billboarding)
      ring.rotation.x = Math.PI / 2
      nodeRings.set(node.id, ring)
      scene.add(ring)

      // Halo only for important nodes (saves draw calls)
      if (showHalos && importance > 0.6) {
        const haloGeo = new THREE.SphereGeometry(r * 2.5, 10, 10)
        const haloMat = new THREE.MeshBasicMaterial({
          color: PALETTE.gold,
          transparent: true,
          opacity: 0.06,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
        const halo = new THREE.Mesh(haloGeo, haloMat)
        halo.position.copy(mesh.position)
        halos.set(node.id, halo)
        scene.add(halo)
      }

      // Labels only for small graphs (sprites are expensive)
      if (showLabels && (importance > 0.5 || isNew)) {
        const sprite = makeLabel(node.name)
        sprite.position.set(p.x, p.y - r * 2.5, p.z)
        labels.set(node.id, sprite)
        scene.add(sprite)
      }
    }

    // Particle field (much smaller, drift only on Y, cheap)
    const particleCount = MAX_PARTICLES
    const particleGeo = new THREE.BufferGeometry()
    const particlePositions = new Float32Array(particleCount * 3)
    const particleSpeeds = new Float32Array(particleCount)
    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 1500
      particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 1500
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 1500
      particleSpeeds[i] = 0.5 + Math.random() * 1.5
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3))
    const particleMat = new THREE.PointsMaterial({
      color: PALETTE.inkDim,
      size: 1.2,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const particleField = new THREE.Points(particleGeo, particleMat)
    scene.add(particleField)

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const cameraTarget = new THREE.Vector3(0, 0, 0)
    const cameraPos = new THREE.Vector3(0, 0, 800)

    const sceneData: Scene3D = {
      renderer, scene, camera,
      nodeMeshes, nodeRings, edgeLines, particleField,
      halos, labels, raycaster, pointer,
      cameraTarget, cameraPos,
    }
    sceneRef.current = sceneData

    // Entrance animation
    animateEntrance(sceneData, newIds)

    // Resize handler
    const onResize = () => {
      if (!container) return
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
    }
    const ro = new ResizeObserver(onResize)
    ro.observe(container)

    // Visibility API - pause when tab is hidden
    const onVisibilityChange = () => {
      isVisibleRef.current = !document.hidden
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    // Camera orbit (idle drift)
    let cameraAngle = 0
    let lastFrameTime = performance.now()

    // Mouse / touch interaction
    let dragging = false
    let moved = false
    let lastX = 0
    let lastY = 0

    const nodeMeshArray = [...nodeMeshes.values()]
    const nodeByMesh = new Map<THREE.Mesh, ChartNode>()
    for (const n of chart.nodes) {
      const mesh = nodeMeshes.get(n.id)
      if (mesh) nodeByMesh.set(mesh, n)
    }

    const hitTest = (clientX: number, clientY: number): ChartNode | null => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObjects(nodeMeshArray, false)
      if (hits.length === 0) return null
      const hit = hits[0]
      return nodeByMesh.get(hit.object as THREE.Mesh) ?? null
    }

    const onPointerDown = (e: PointerEvent) => {
      dragging = true
      moved = false
      lastX = e.clientX
      lastY = e.clientY
      isUserInteractingRef.current = true
      renderer.domElement.style.cursor = 'grabbing'
    }
    const onPointerMove = (e: PointerEvent) => {
      if (dragging) {
        const dx = e.clientX - lastX
        const dy = e.clientY - lastY
        if (Math.abs(dx) + Math.abs(dy) > 2) moved = true
        cameraTarget.x -= dx * 1.4
        cameraTarget.y += dy * 1.4
        lastX = e.clientX
        lastY = e.clientY
      } else {
        const hit = hitTest(e.clientX, e.clientY)
        if (hit !== hoverRef.current) {
          hoverRef.current = hit
          renderer.domElement.style.cursor = hit ? 'pointer' : 'grab'
          applyHover(sceneData, hit, selectedRef.current)
        }
      }
    }
    const onPointerUp = (e: PointerEvent) => {
      dragging = false
      isUserInteractingRef.current = false
      idleTimeRef.current = 0
      renderer.domElement.style.cursor = hoverRef.current ? 'pointer' : 'grab'
      if (!moved) {
        const hit = hitTest(e.clientX, e.clientY)
        onSelect(hit ? hit.id : null)
      }
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      isUserInteractingRef.current = true
      idleTimeRef.current = 0
      const factor = Math.exp(-e.deltaY * 0.0008)
      const newDist = Math.max(200, Math.min(2500, cameraPos.length() * factor))
      cameraPos.setLength(newDist)
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('pointerup', onPointerUp)
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false })

    // FPS-throttled animation loop
    let frameId = 0
    const animate3D = () => {
      frameId = requestAnimationFrame(animate3D)

      // Skip frame if tab is hidden
      if (!isVisibleRef.current) return

      // Throttle to TARGET_FPS
      const now = performance.now()
      const elapsed = now - lastFrameTime
      if (elapsed < FRAME_INTERVAL) return
      lastFrameTime = now - (elapsed % FRAME_INTERVAL)
      const delta = Math.min(elapsed / 1000, 0.1) // cap delta

      // Camera orbit when idle
      if (!isUserInteractingRef.current) {
        idleTimeRef.current += delta
        if (idleTimeRef.current > 3) {
          cameraAngle += delta * 0.04
          const radius = cameraPos.length()
          const targetX = Math.cos(cameraAngle) * radius
          const targetZ = Math.sin(cameraAngle) * radius
          cameraPos.x += (targetX - cameraPos.x) * 0.04
          cameraPos.z += (targetZ - cameraPos.z) * 0.04
        }
      } else {
        idleTimeRef.current = 0
      }

      // Smooth camera follow
      camera.position.lerp(cameraPos, 0.1)
      camera.lookAt(cameraTarget)

      // Animate particles (Y drift only, every other frame would be even cheaper)
      const pAttr = particleField.geometry.attributes.position as THREE.BufferAttribute
      const arr = pAttr.array as Float32Array
      for (let i = 0; i < arr.length; i += 3) {
        const speed = particleSpeeds[i / 3]
        arr[i + 1] += delta * speed * 4
        if (arr[i + 1] > 1000) arr[i + 1] = -1000
      }
      pAttr.needsUpdate = true

      // Subtle ring spin (cheap: just z rotation, no lookAt)
      for (const ring of nodeRings.values()) {
        ring.rotation.z += delta * 0.15
      }

      renderer.render(scene, camera)
    }
    animate3D()

    // E2E/debug hook
    ;(window as unknown as { __meridian3d?: object }).__meridian3d = {
      nodeCount: chart.nodes.length,
      edgeCount: chart.edges.length,
      positions: Object.fromEntries(positions),
    }

    return () => {
      cancelAnimationFrame(frameId)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      renderer.domElement.removeEventListener('wheel', onWheel)
      // Dispose
      scene.traverse((obj: THREE.Object3D) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Sprite) {
          obj.geometry?.dispose()
          const mat = obj.material
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
          else mat?.dispose()
        }
      })
      edgeGeometry.dispose()
      edgeMaterial.dispose()
      particleGeo.dispose()
      particleMat.dispose()
      renderer.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
      sceneRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart, onSelect])

  return <div ref={containerRef} className="chart-canvas-3d" />
}

function computeLayout(chart: CodeChart): { positions: Map<number, THREE.Vector3> } {
  const { simulation } = startLayout(chart)
  const positions = new Map<number, THREE.Vector3>()

  for (let i = 0; i < FORCE_TICKS; i++) {
    simulation.tick()
  }

  const modules = [...new Set(chart.nodes.map((n) => n.module))]
  const moduleDepth = new Map<string, number>()
  modules.forEach((m, i) => {
    if (modules.length === 1) {
      moduleDepth.set(m, 0)
    } else {
      moduleDepth.set(m, (i - modules.length / 2) * 180)
    }
  })

  for (const n of chart.nodes) {
    positions.set(n.id, new THREE.Vector3(n.x, n.y, moduleDepth.get(n.module) ?? 0))
  }
  simulation.stop()
  return { positions }
}

function makeLabel(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas')
  const dpr = 1
  const fontSize = 28
  canvas.width = 256
  canvas.height = 32
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  ctx.font = `500 ${fontSize}px 'IBM Plex Mono', monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // Halo for readability
  ctx.fillStyle = 'rgba(5, 6, 10, 0.9)'
  ctx.fillText(text, 128, 16)
  ctx.fillStyle = '#d4a857'
  ctx.fillText(text, 128, 16)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(60, 12, 1)
  return sprite
}

function animateEntrance(scene: Scene3D, newIds: Set<number>) {
  const meshes = [...scene.nodeMeshes.values()]

  meshes.sort((a, b) => (a.userData.id as number) - (b.userData.id as number))
  const tl = createTimeline({ defaults: { ease: 'outExpo', duration: 1000 } })
  meshes.forEach((mesh, i) => {
    const start = (i / Math.max(meshes.length, 1)) * 0.8
    mesh.scale.setScalar(0.001)
    tl.add(mesh.scale, {
      to: 1,
      duration: 800,
      delay: start * 1000,
      ease: 'outBack(2)',
    }, 0)
  })

  const edgeMat = scene.edgeLines.material as THREE.LineBasicMaterial
  edgeMat.opacity = 0
  animate(edgeMat, { opacity: 0.4, delay: 500, duration: 1400, ease: 'outQuart' })

  for (const [id, mesh] of scene.nodeMeshes) {
    if (newIds.has(id)) {
      const mat = mesh.material as THREE.MeshStandardMaterial
      animate(mat, {
        emissiveIntensity: [0, 2, 0.6],
        delay: 1400,
        duration: 1400,
        ease: 'inOutQuad',
      })
    }
  }
}

function applyHover(scene: Scene3D, node: ChartNode | null, selectedId: number | null) {
  for (const [id, ring] of scene.nodeRings) {
    const isHovered = node?.id === id
    const isSelected = selectedId === id
    const mat = ring.material as THREE.MeshBasicMaterial
    animate(mat, {
      opacity: isHovered ? 0.9 : isSelected ? 0.7 : 0.25,
      duration: 280,
      ease: 'outQuad',
    })
    animate(ring.scale, {
      to: isHovered ? 1.4 : 1,
      duration: 320,
      ease: 'outElastic(1, .6)',
    })
  }

  const dim = node != null
  const edgeMat = scene.edgeLines.material as THREE.LineBasicMaterial
  animate(edgeMat, {
    opacity: dim ? 0.15 : 0.4,
    duration: 320,
    ease: 'outQuad',
  })
}

function highlightSelection(scene: Scene3D, selectedId: number | null) {
  for (const [id, mesh] of scene.nodeMeshes) {
    const mat = mesh.material as THREE.MeshStandardMaterial
    const isSelected = id === selectedId
    const targetHex = isSelected
      ? '#' + PALETTE.goldBright.toString(16).padStart(6, '0')
      : '#' + PALETTE.ink.toString(16).padStart(6, '0')
    const currentHex = '#' + mat.emissive.getHex().toString(16).padStart(6, '0')
    animate(mat, {
      emissive: { from: currentHex, to: targetHex },
      emissiveIntensity: isSelected ? 1.0 : 0.12,
      duration: 480,
      ease: 'outQuart',
    })
  }
}