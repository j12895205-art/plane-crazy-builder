import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { supabase } from "../supabase";
import { BLOCKS } from "../blockRegistry";

type BlockData = {
  x: number;
  y: number;
  z: number;
  color: string;
  rx: number;
  ry: number;
  rz: number;
};

export function renderEditor() {
  document.body.innerHTML = "";
  document.body.style.margin = "0";
  document.body.style.overflow = "hidden";
  document.body.style.background = "#2b2b2b";

  // ─────────────────────────────
  // THREE SETUP
  // ─────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2b2b2b);

  const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);
  camera.position.set(8, 8, 8);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  document.body.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  scene.add(new THREE.AmbientLight(0xffffff, 1));
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(5, 10, 5);
  scene.add(light);

  scene.add(new THREE.GridHelper(50, 50));

  // ─────────────────────────────
  // INPUT
  // ─────────────────────────────
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // ─────────────────────────────
  // STATE
  // ─────────────────────────────
  let tool: "place" | "delete" | "paint" = "place";
  let selected = BLOCKS[0];

  const placed: THREE.Object3D[] = [];
  const grid = new Set<string>();

  const key = (x: number, y: number, z: number) => `${x},${y},${z}`;

  const loader = new GLTFLoader();

  let ghost: THREE.Group | null = null;

  let rotX = 0;
  let rotY = 0;
  let rotZ = 0;

  // ─────────────────────────────
  // ROTATION CONTROLS (R T Y)
  // ─────────────────────────────
  window.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "r") {
      rotY += Math.PI / 2;
    }
    if (e.key.toLowerCase() === "t") {
      rotX += Math.PI / 2;
    }
    if (e.key.toLowerCase() === "y") {
      rotZ += Math.PI / 2;
    }

    if (ghost) {
      ghost.rotation.set(rotX, rotY, rotZ);
    }
  });

  // ─────────────────────────────
  // UI
  // ─────────────────────────────
  const ui = document.createElement("div");
  ui.style.position = "absolute";
  ui.style.top = "10px";
  ui.style.left = "10px";
  ui.style.background = "#111";
  ui.style.color = "#fff";
  ui.style.padding = "10px";
  ui.style.zIndex = "10";
  document.body.appendChild(ui);

  function btn(text: string, fn: () => void) {
    const b = document.createElement("button");
    b.innerText = text;
    b.onclick = fn;
    ui.appendChild(b);
  }

  btn("Place", () => (tool = "place"));
  btn("Delete", () => (tool = "delete"));
  btn("Paint", () => (tool = "paint"));
  btn("Save", save);

  // ─────────────────────────────
  // GHOST (UNCHANGED)
  // ─────────────────────────────
  function createGhost() {
    if (ghost) scene.remove(ghost);

    loader.load(selected.model, (gltf: any) => {
      ghost = gltf.scene;

      ghost.traverse((c: any) => {
        if (c.isMesh) {
          c.material = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            wireframe: true,
            transparent: true,
            opacity: 0.5
          });
        }
      });

      ghost.rotation.set(rotX, rotY, rotZ);
      scene.add(ghost);
    });
  }
  createGhost();

  // ─────────────────────────────
  // MOUSE
  // ─────────────────────────────
  window.addEventListener("pointermove", (e) => {
    mouse.x = (e.clientX / innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / innerHeight) * 2 + 1;
  });

  function updateRay() {
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects([ground, ...placed], true);

    if (!hits.length || !ghost) return;

    const hit = hits[0];
    const p = hit.point;
    const n = hit.face?.normal || new THREE.Vector3(0, 1, 0);

    const x = Math.round(p.x + n.x * 0.5);
    const y = Math.round(p.y + n.y * 0.5);
    const z = Math.round(p.z + n.z * 0.5);

    const ok = !grid.has(key(x, y, z));

    ghost.visible = ok;
    ghost.position.set(x, y, z);
  }

  // ─────────────────────────────
  // PLACE
  // ─────────────────────────────
  function place(x: number, y: number, z: number) {
    if (grid.has(key(x, y, z))) return;

    loader.load(selected.model, (gltf: any) => {
      const obj = gltf.scene;

      obj.position.set(x, y, z);
      obj.rotation.set(rotX, rotY, rotZ);

      scene.add(obj);
      placed.push(obj as any);

      grid.add(key(x, y, z));
    });
  }

  // ─────────────────────────────
  // CLICK
  // ─────────────────────────────
  window.addEventListener("pointerdown", () => {
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects([ground, ...placed], true);
    if (!hits.length) return;

    const p = hits[0].point;
    const n = hits[0].face?.normal || new THREE.Vector3(0, 1, 0);

    const x = Math.round(p.x + n.x * 0.5);
    const y = Math.round(p.y + n.y * 0.5);
    const z = Math.round(p.z + n.z * 0.5);

    if (tool === "place") place(x, y, z);

    if (tool === "delete") {
      const obj = hits[0].object.parent;
      if (!obj) return;
      scene.remove(obj);
    }

    if (tool === "paint") {
      const obj = hits[0].object as any;
      if (obj?.material) obj.material.color = new THREE.Color("#ff0000");
    }
  });

  // ─────────────────────────────
  // SAVE
  // ─────────────────────────────
  async function save() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;

    const blueprint: BlockData[] = placed.map((p: any) => ({
      x: p.position.x,
      y: p.position.y,
      z: p.position.z,
      color: "#fff",
      rx: p.rotation.x,
      ry: p.rotation.y,
      rz: p.rotation.z
    }));

    const name = prompt("Blueprint name?");
    if (!name) return;

    await supabase.from("blueprints").insert({
      user_id: data.user.id,
      name,
      data: blueprint
    });

    alert("Saved!");
  }

  // ─────────────────────────────
  // LOOP
  // ─────────────────────────────
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    updateRay();
    renderer.render(scene, camera);
  }

  animate();
}
