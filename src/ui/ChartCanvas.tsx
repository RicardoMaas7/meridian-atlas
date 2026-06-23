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
  crystal: 0xb6e1ff,
  rose: 0xff7d6b,
  paper: 0xefe7d3,
}

interface Scene3D {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  group: THREE.Group
  nodeMeshes: Map<number, THREE.Mesh>
  nodeRings: Map<number, THREE.Mesh>
  edgeLines: THREE.LineSegments
  particleField: THREE.Points
  halos: Map<number, THREE.Mesh>
  labels: Map<number, THREE.Sprite>
  raycaster: THREE.Raycaster
  pointer: THREE.Vector2
}

export function ChartCanvas({ chart, selectedId, newIds, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<Scene3D | null>(null)
  const hoverRef = useRef<ChartNode | null>(null)
  const selectedRef = useRef<number | null>(selectedId)
  const newIdsRef = useRef<Set<number>>(newIds)
  const cameraTargetRef = useRef(new THREE.Vector3(0, 0, 0))
  const cameraPosRef = useRef(new THREE.Vector3(0, 0, 800))
  const isUserInteractingRef = useRef(false)
  const idleTimeRef = useRef(0)

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

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setClearColor(PALETTE.void, 1)
    container.appendChild(renderer.domElement)
    renderer.domElement.style.cursor = 'grab'

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(PALETTE.void, 0.0008)

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      1,
      5000
    )
    camera.position.set(0, 0, 800)
    camera.lookAt(0, 0, 0)

    // Lighting
    const ambient = new THREE.AmbientLight(PALETTE.ink, 0.4)
    scene.add(ambient)

    const key = new THREE.DirectionalLight(PALETTE.gold, 0.9)
    key.position.set(200, 300, 400)
    scene.add(key)

    const fill = new THREE.DirectionalLight(PALETTE.azure, 0.4)
    fill.position.set(-300, -100, 200)
    scene.add(fill)

    const rim = new THREE.PointLight(PALETTE.copper, 0.6, 1500)
    rim.position.set(0, 0, -200)
    scene.add(rim)

    // Compute layout
    const { positions } = computeLayout(chart)

    // Build edges as line segments
    const edgeGeometry = new THREE.BufferGeometry()
    const edgePositions = new Float32Array(chart.edges.length * 6) // 2 vertices × 3
    const edgeColors = new Float32Array(chart.edges.length * 6)
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
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const edgeLines = new THREE.LineSegments(edgeGeometry, edgeMaterial)
    scene.add(edgeLines)

    // Build nodes
    const group = new THREE.Group()
    const nodeMeshes = new Map<number, THREE.Mesh>()
    const nodeRings = new Map<number, THREE.Mesh>()
    const halos = new Map<number, THREE.Mesh>()
    const labels = new Map<number, THREE.Sprite>()

    for (const node of chart.nodes) {
      const p = positions.get(node.id)
      if (!p) continue

      const importance = Math.min(1, Math.sqrt(node.inbound + node.outbound) / 6)
      const r = 4 + importance * 14

      // Core sphere
      const geometry = new THREE.SphereGeometry(r, 24, 24)
      const isNew = newIds.has(node.id)
      const baseColor = isNew ? PALETTE.goldBright : PALETTE.ink
      const material = new THREE.MeshStandardMaterial({
        color: baseColor,
        metalness: 0.4,
        roughness: 0.3,
        emissive: isNew ? PALETTE.gold : PALETTE.ink,
        emissiveIntensity: isNew ? 0.6 : 0.15,
      })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(p.x, p.y, p.z)
      mesh.userData = { id: node.id, name: node.name, kind: node.kind, radius: r }
      nodeMeshes.set(node.id, mesh)
      group.add(mesh)

      // Outer ring
      const ringGeo = new THREE.TorusGeometry(r * 2.2, 0.4, 8, 48)
      const ringMat = new THREE.MeshBasicMaterial({
        color: PALETTE.gold,
        transparent: true,
        opacity: isNew ? 0.8 : 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const ring = new THREE.Mesh(ringGeo, ringMat)
      ring.position.copy(mesh.position)
      ring.lookAt(camera.position)
      nodeRings.set(node.id, ring)
      group.add(ring)

      // Halo for important nodes
      if (importance > 0.5) {
        const haloGeo = new THREE.SphereGeometry(r * 3, 16, 16)
        const haloMat = new THREE.MeshBasicMaterial({
          color: PALETTE.gold,
          transparent: true,
          opacity: 0.08,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
        const halo = new THREE.Mesh(haloGeo, haloMat)
        halo.position.copy(mesh.position)
        halos.set(node.id, halo)
        group.add(halo)
      }

      // Label sprite for prominent or new nodes
      if (importance > 0.4 || isNew) {
        const sprite = makeLabel(node.name)
        sprite.position.set(p.x, p.y - r * 2.5, p.z)
        labels.set(node.id, sprite)
        group.add(sprite)
      }
    }
    scene.add(group)

    // Particle field background
    const particleCount = 1200
    const particleGeo = new THREE.BufferGeometry()
    const particlePositions = new Float32Array(particleCount * 3)
    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 2000
      particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 2000
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 2000
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3))
    const particleMat = new THREE.PointsMaterial({
      color: PALETTE.inkDim,
      size: 1.5,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const particleField = new THREE.Points(particleGeo, particleMat)
    scene.add(particleField)

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()

    const sceneData: Scene3D = {
      renderer, scene, camera, group,
      nodeMeshes, nodeRings, edgeLines, particleField,
      halos, labels, raycaster, pointer,
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

    // Camera orbit (idle drift)
    let cameraAngle = 0
    const clock = new THREE.Clock()

    // Mouse / touch interaction
    let dragging = false
    let moved = false
    let lastX = 0
    let lastY = 0

    const hitTest = (clientX: number, clientY: number): ChartNode | null => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObjects([...nodeMeshes.values()], false)
      if (hits.length === 0) return null
      const hit = hits[0]
      const id = hit.object.userData.id as number
      return chart.nodes.find((n) => n.id === id) ?? null
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
        cameraTargetRef.current.x -= dx * 1.4
        cameraTargetRef.current.y += dy * 1.4
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
      const newDist = Math.max(200, Math.min(2500, cameraPosRef.current.length() * factor))
      cameraPosRef.current.setLength(newDist)
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('pointerup', onPointerUp)
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false })

    // Auto-orbit when idle
    let frameId = 0
    const animate3D = () => {
      frameId = requestAnimationFrame(animate3D)
      const delta = clock.getDelta()

      if (!isUserInteractingRef.current) {
        idleTimeRef.current += delta
        // Start gentle orbit after 2s of idle
        if (idleTimeRef.current > 2) {
          cameraAngle += delta * 0.05
          const radius = cameraPosRef.current.length()
          const targetX = Math.cos(cameraAngle) * radius
          const targetZ = Math.sin(cameraAngle) * radius
          cameraPosRef.current.x += (targetX - cameraPosRef.current.x) * 0.02
          cameraPosRef.current.z += (targetZ - cameraPosRef.current.z) * 0.02
        }
      } else {
        idleTimeRef.current = 0
      }

      // Smooth camera follow
      camera.position.lerp(cameraPosRef.current, 0.08)
      camera.lookAt(cameraTargetRef.current)

      // Animate particles
      const pAttr = particleField.geometry.attributes.position as THREE.BufferAttribute
      const arr = pAttr.array as Float32Array
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] += delta * 4
        if (arr[i + 1] > 1000) arr[i + 1] = -1000
      }
      pAttr.needsUpdate = true
      particleField.rotation.y += delta * 0.01

      // Animate rings (rotate to face camera roughly)
      for (const ring of nodeRings.values()) {
        ring.lookAt(camera.position)
        ring.rotation.z += delta * 0.2
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
  // Use d3-force layout for graph positioning, then map to 3D
  const { simulation } = startLayout(chart)
  const positions = new Map<number, THREE.Vector3>()

  // Run simulation synchronously to a settled state
  for (let i = 0; i < 300; i++) {
    simulation.tick()
  }

  // Map module "seas" to z-depth so multiple modules form a 3D constellation
  const modules = [...new Set(chart.nodes.map((n) => n.module))]
  const moduleDepth = new Map<string, number>()
  modules.forEach((m, i) => {
    if (modules.length === 1) {
      moduleDepth.set(m, 0)
    } else {
      moduleDepth.set(m, (i - modules.length / 2) * 220)
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
  const dpr = 2
  const fontSize = 32
  canvas.width = 512
  canvas.height = 64
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  ctx.font = `500 ${fontSize}px 'IBM Plex Mono', monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // Halo
  ctx.fillStyle = 'rgba(5, 6, 10, 0.85)'
  ctx.fillText(text, 128, 32)
  // Text
  ctx.fillStyle = '#d4a857'
  ctx.fillText(text, 128, 32)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    blending: THREE.NormalBlending,
  })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(80, 16, 1)
  return sprite
}

function animateEntrance(scene: Scene3D, newIds: Set<number>) {
  const meshes = [...scene.nodeMeshes.values()]
  const rings = [...scene.nodeRings.values()]

  // Stagger fade-in by node id for a wave effect
  meshes.sort((a, b) => (a.userData.id as number) - (b.userData.id as number))
  const tl = createTimeline({ defaults: { ease: 'outExpo', duration: 1400 } })
  meshes.forEach((mesh, i) => {
    const start = (i / meshes.length) * 1.2
    mesh.scale.setScalar(0.001)
    tl.add(mesh.scale, {
      to: 1,
      duration: 1100,
      delay: start * 1000,
      ease: 'outElastic(1, .8)',
    }, 0)
  })

  // Edge lines fade in
  const edgeMat = scene.edgeLines.material as THREE.LineBasicMaterial
  edgeMat.opacity = 0
  animate(edgeMat, { opacity: 0.5, delay: 800, duration: 1800, ease: 'outQuart' })

  // Rings pulse on entrance
  rings.forEach((ring, i) => {
    const baseScale = 1
    const s = ring.scale.x
    ring.scale.setScalar(s * 0.4)
    animate(ring.scale, {
      to: baseScale,
      delay: 1200 + i * 8,
      duration: 1400,
      ease: 'outBack(1.5)',
    })
  })

  // New nodes get a special entrance flash
  for (const [id, mesh] of scene.nodeMeshes) {
    if (newIds.has(id)) {
      const mat = mesh.material as THREE.MeshStandardMaterial
      animate(mat, {
        emissiveIntensity: [0, 2, 0.6],
        delay: 1800,
        duration: 1600,
        ease: 'inOutQuad',
      })
    }
  }
}

function applyHover(scene: Scene3D, node: ChartNode | null, selectedId: number | null) {
  // Animate ring opacity/scale based on hover/selection state
  for (const [id, ring] of scene.nodeRings) {
    const isHovered = node?.id === id
    const isSelected = selectedId === id
    const mat = ring.material as THREE.MeshBasicMaterial
    animate(mat, {
      opacity: isHovered ? 1 : isSelected ? 0.8 : 0.3,
      duration: 320,
      ease: 'outQuad',
    })
    animate(ring.scale, {
      to: isHovered ? 1.5 : 1,
      duration: 380,
      ease: 'outElastic(1, .6)',
    })
  }

  // Dim edges when hovering (a selection cue)
  const dim = node != null
  const edgeMat = scene.edgeLines.material as THREE.LineBasicMaterial
  animate(edgeMat, {
    opacity: dim ? 0.18 : 0.5,
    duration: 400,
    ease: 'outQuad',
  })
}

function highlightSelection(scene: Scene3D, selectedId: number | null) {
  // Animate emissive of every node: gold for selected, dim ink for others
  for (const [id, mesh] of scene.nodeMeshes) {
    const mat = mesh.material as THREE.MeshStandardMaterial
    const isSelected = id === selectedId
    const targetHex = isSelected ? '#' + PALETTE.goldBright.toString(16).padStart(6, '0') : '#' + PALETTE.ink.toString(16).padStart(6, '0')
    const currentHex = '#' + mat.emissive.getHex().toString(16).padStart(6, '0')
    animate(mat, {
      emissive: { from: currentHex, to: targetHex },
      emissiveIntensity: isSelected ? 1.2 : 0.15,
      duration: 600,
      ease: 'outQuart',
    })
  }
}