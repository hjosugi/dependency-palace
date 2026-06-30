import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { WebGPURenderer } from "three/webgpu";
import type { DisplayLink, DisplayNode } from "./types";

export interface GraphSceneHandle {
  frameGraph: () => void;
}

interface GraphSceneProps {
  nodes: DisplayNode[];
  links: DisplayLink[];
  autoRotate: boolean;
  onHover: (node: DisplayNode | null, point: { x: number; y: number } | null) => void;
  onSelect: (nodeId: string | null) => void;
}

const background = new THREE.Color("#11100e");

type PalaceRenderer = THREE.WebGLRenderer | WebGPURenderer;

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) {
      for (const item of material) item.dispose();
    } else {
      material?.dispose();
    }
  });
}

function fadedColor(hex: string, opacity: number) {
  return new THREE.Color(hex).lerp(background, Math.max(0, Math.min(1, 1 - opacity)));
}

async function createRenderer(): Promise<{ renderer: PalaceRenderer; backend: "webgpu" | "webgl" }> {
  const preferWebGPU = typeof navigator !== "undefined" && "gpu" in navigator;
  if (preferWebGPU) {
    try {
      const { WebGPURenderer } = await import("three/webgpu");
      const renderer = new WebGPURenderer({
        antialias: true,
        powerPreference: "high-performance"
      });
      renderer.setClearColor(background);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      await renderer.init();
      return { renderer, backend: "webgpu" };
    } catch (error) {
      console.warn("Dependency Palace: WebGPU renderer unavailable, falling back to WebGL.", error);
    }
  }

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance"
  });
  renderer.setClearColor(background);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return { renderer, backend: "webgl" };
}

function geometryForKind(kind: DisplayNode["visualKind"]) {
  if (kind === "package") return new THREE.BoxGeometry(1, 1, 1);
  if (kind === "interface") return new THREE.BoxGeometry(1, 1, 1);
  if (kind === "typeclass") return new THREE.BoxGeometry(1, 1, 1);
  if (kind === "datatype") return new THREE.BoxGeometry(1, 1, 1);
  if (kind === "function") return new THREE.CylinderGeometry(1, 1, 0.45, 20, 1);
  if (kind === "field" || kind === "property") return new THREE.SphereGeometry(1, 10, 8);
  if (kind === "method" || kind === "constructor") return new THREE.CylinderGeometry(1, 1, 0.45, 18, 1);
  if (kind === "enum") return new THREE.ConeGeometry(1, 1.7, 5);
  if (kind === "external") return new THREE.DodecahedronGeometry(1, 0);
  return new THREE.BoxGeometry(1, 1, 1);
}

function materialForKind(kind: DisplayNode["visualKind"]) {
  const transparent = kind === "package" || kind === "interface" || kind === "typeclass";
  return new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent,
    opacity: kind === "package" ? 0.48 : kind === "interface" || kind === "typeclass" ? 0.82 : 1
  });
}

function linkCurveHeight(type: DisplayLink["type"]) {
  if (type === "implements") return 48;
  if (type === "instance" || type === "constrains") return 58;
  if (type === "inherits") return -34;
  if (type === "contains") return -22;
  if (type === "composes") return 30;
  if (type === "derives") return 42;
  if (type === "calls") return 22;
  if (type === "creates") return -18;
  return 10;
}

function pushCurvedLine(
  segments: number[],
  colors: number[],
  source: THREE.Vector3,
  target: THREE.Vector3,
  link: DisplayLink,
  steps: number
) {
  const color = fadedColor(link.color, link.opacity);
  const mid = new THREE.Vector3().addVectors(source, target).multiplyScalar(0.5);
  const distance = source.distanceTo(target);
  mid.y += linkCurveHeight(link.type) + Math.min(58, distance * 0.08);
  mid.z += link.type === "calls" ? 18 : link.type === "uses" ? -10 : 0;

  let previous = source.clone();
  for (let index = 1; index <= steps; index += 1) {
    const t = index / steps;
    const oneMinusT = 1 - t;
    const current = new THREE.Vector3(
      oneMinusT * oneMinusT * source.x + 2 * oneMinusT * t * mid.x + t * t * target.x,
      oneMinusT * oneMinusT * source.y + 2 * oneMinusT * t * mid.y + t * t * target.y,
      oneMinusT * oneMinusT * source.z + 2 * oneMinusT * t * mid.z + t * t * target.z
    );
    segments.push(previous.x, previous.y, previous.z, current.x, current.y, current.z);
    colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
    previous = current;
  }
}

export const GraphScene = forwardRef<GraphSceneHandle, GraphSceneProps>(function GraphScene(
  { nodes, links, autoRotate, onHover, onSelect },
  ref
) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const worldRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<PalaceRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const pickablesRef = useRef<THREE.InstancedMesh[]>([]);
  const nodeByIdRef = useRef<Map<string, DisplayNode>>(new Map());
  const autoRotateRef = useRef(autoRotate);
  const hoverRef = useRef(onHover);
  const selectRef = useRef(onSelect);
  const boundsRef = useRef<THREE.Sphere>(new THREE.Sphere(new THREE.Vector3(), 420));

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    hoverRef.current = onHover;
  }, [onHover]);

  useEffect(() => {
    selectRef.current = onSelect;
  }, [onSelect]);

  const frameGraph = () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const sphere = boundsRef.current;
    const distance = Math.max(260, sphere.radius * 2.35);
    camera.position.set(sphere.center.x + distance * 0.28, sphere.center.y + distance * 0.22, sphere.center.z + distance);
    camera.near = Math.max(0.1, distance / 400);
    camera.far = Math.max(2200, distance * 7);
    camera.updateProjectionMatrix();
    controls.target.copy(sphere.center);
    controls.update();
  };

  useImperativeHandle(ref, () => ({ frameGraph }), []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let raf = 0;
    let pickFrame = 0;
    let cleanupRenderer: (() => void) | null = null;

    void (async () => {
      const scene = new THREE.Scene();
      scene.background = background;
      scene.fog = new THREE.Fog(background, 700, 1700);
      const world = new THREE.Group();
      scene.add(world);

      const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 4000);
      const { renderer, backend } = await createRenderer();
      if (disposed) {
        renderer.dispose();
        return;
      }
      renderer.domElement.className = "graph-canvas";
      renderer.domElement.dataset.backend = backend;
      mount.appendChild(renderer.domElement);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.enablePan = true;
      controls.autoRotateSpeed = 0.32;
      controls.minDistance = 60;
      controls.maxDistance = 2500;

      const grid = new THREE.GridHelper(880, 22, "#3a372f", "#25231f");
      grid.position.y = -205;
      world.add(grid);

      const ambient = new THREE.AmbientLight("#f4ead5", 1.35);
      scene.add(ambient);
      const key = new THREE.DirectionalLight("#ffffff", 1.8);
      key.position.set(160, 250, 140);
      scene.add(key);
      const rim = new THREE.DirectionalLight("#8bd3ff", 0.75);
      rim.position.set(-260, 90, -160);
      scene.add(rim);

      sceneRef.current = scene;
      worldRef.current = world;
      cameraRef.current = camera;
      rendererRef.current = renderer;
      controlsRef.current = controls;

      const resize = () => {
        const rect = mount.getBoundingClientRect();
        const width = Math.max(1, rect.width);
        const height = Math.max(1, rect.height);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();

      const pickNode = (event: PointerEvent) => {
        const cameraForPick = cameraRef.current;
        const rendererForPick = rendererRef.current;
        if (!cameraForPick || !rendererForPick || pickablesRef.current.length === 0) return null;
        const rect = rendererForPick.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, cameraForPick);
        const hit = raycaster.intersectObjects(pickablesRef.current, false)[0];
        const instanceId = hit?.instanceId;
        if (typeof instanceId !== "number") return null;
        const ids = hit.object.userData.nodeIds as string[] | undefined;
        const id = ids?.[instanceId];
        return id ? nodeByIdRef.current.get(id) ?? null : null;
      };

      let pendingPointer: PointerEvent | null = null;
      const onPointerMove = (event: PointerEvent) => {
        pendingPointer = event;
        if (pickFrame) return;
        pickFrame = window.requestAnimationFrame(() => {
          pickFrame = 0;
          if (!pendingPointer) return;
          const node = pickNode(pendingPointer);
          hoverRef.current(node, node ? { x: pendingPointer.clientX, y: pendingPointer.clientY } : null);
        });
      };

      const onPointerLeave = () => hoverRef.current(null, null);
      const onClick = (event: PointerEvent) => {
        const node = pickNode(event);
        selectRef.current(node?.ownerId ?? node?.id ?? null);
      };

      renderer.domElement.addEventListener("pointermove", onPointerMove);
      renderer.domElement.addEventListener("pointerleave", onPointerLeave);
      renderer.domElement.addEventListener("click", onClick);
      window.addEventListener("resize", resize);
      resize();

      const animate = () => {
        raf = window.requestAnimationFrame(animate);
        controls.autoRotate = autoRotateRef.current;
        controls.update();
        renderer.render(scene, camera);
      };
      animate();
      frameGraph();

      cleanupRenderer = () => {
        window.cancelAnimationFrame(raf);
        if (pickFrame) window.cancelAnimationFrame(pickFrame);
        window.removeEventListener("resize", resize);
        renderer.domElement.removeEventListener("pointermove", onPointerMove);
        renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
        renderer.domElement.removeEventListener("click", onClick);
        controls.dispose();
        disposeObject(scene);
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();

    return () => {
      disposed = true;
      cleanupRenderer?.();
    };
  }, []);

  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;

    for (const child of [...world.children]) {
      if (child.userData.dynamicGraph) {
        world.remove(child);
        disposeObject(child);
      }
    }

    nodeByIdRef.current = new Map(nodes.map((node) => [node.id, node]));
    pickablesRef.current = [];

    const positionById = new Map(nodes.map((node) => [node.id, new THREE.Vector3(node.x, node.y, node.z)]));

    const box = new THREE.Box3();
    for (const node of nodes) {
      box.expandByPoint(new THREE.Vector3(node.x, node.y, node.z));
    }
    if (!box.isEmpty()) {
      boundsRef.current = box.getBoundingSphere(new THREE.Sphere());
    }

    const groups = new Map<DisplayNode["visualKind"], DisplayNode[]>();
    for (const node of nodes) {
      if (!groups.has(node.visualKind)) groups.set(node.visualKind, []);
      groups.get(node.visualKind)?.push(node);
    }

    for (const [kind, groupNodes] of groups) {
      const geometry = geometryForKind(kind);
      const material = materialForKind(kind);
      const mesh = new THREE.InstancedMesh(geometry, material, groupNodes.length);
      mesh.userData.dynamicGraph = true;
      mesh.userData.nodeIds = groupNodes.map((node) => node.id);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

      const dummy = new THREE.Object3D();
      for (const [index, node] of groupNodes.entries()) {
        const dimensions = node.dimensions ?? { x: node.radius * 2, y: node.radius * 2, z: node.radius * 2 };
        dummy.position.set(node.x, node.y, node.z);
        dummy.rotation.set(0, 0, 0);
        if (kind === "method" || kind === "constructor" || kind === "function") dummy.rotation.z = Math.PI / 2;
        dummy.scale.set(dimensions.x, dimensions.y, dimensions.z);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
        mesh.setColorAt(index, new THREE.Color(node.color));
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      world.add(mesh);
      pickablesRef.current.push(mesh);
    }

    const segments: number[] = [];
    const colors: number[] = [];
    const curveSteps = links.length > 1800 ? 2 : links.length > 700 ? 3 : 6;
    for (const link of links) {
      const source = positionById.get(link.source);
      const target = positionById.get(link.target);
      if (!source || !target) continue;
      pushCurvedLine(segments, colors, source, target, link, curveSteps);
    }

    if (segments.length > 0) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(segments, 3));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      const material = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.58,
        depthWrite: false
      });
      const lines = new THREE.LineSegments(geometry, material);
      lines.userData.dynamicGraph = true;
      world.add(lines);
    }

    const selected = nodes.find((node) => node.isSelected);
    if (selected) {
      const dimensions = selected.dimensions ?? {
        x: selected.radius * 2,
        y: selected.radius * 2,
        z: selected.radius * 2
      };
      const coreGeometry = new THREE.BoxGeometry(1, 1, 1);
      const coreMaterial = new THREE.MeshBasicMaterial({
        color: selected.color,
        transparent: true,
        opacity: 0.34,
        depthWrite: false
      });
      const core = new THREE.Mesh(coreGeometry, coreMaterial);
      core.scale.set(dimensions.x * 1.04, dimensions.y * 1.04, dimensions.z * 1.04);
      core.position.set(selected.x, selected.y, selected.z);
      core.userData.dynamicGraph = true;
      world.add(core);

      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshBasicMaterial({
        color: "#fff7df",
        wireframe: true,
        transparent: true,
        opacity: 0.72
      });
      const halo = new THREE.Mesh(geometry, material);
      halo.scale.set(dimensions.x * 1.16, dimensions.y * 1.16, dimensions.z * 1.16);
      halo.position.set(selected.x, selected.y, selected.z);
      halo.userData.dynamicGraph = true;
      world.add(halo);
    }

    frameGraph();
  }, [nodes, links]);

  return <div ref={mountRef} className="graph-scene" />;
});
