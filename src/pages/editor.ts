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
};

export function renderEditor() {
  // ─────────────────────────────
  // RESET
  // ─────────────────────────────
  document.body.innerHTML = "";
  document.body.style.margin = "0";
  document.body.style.overflow = "hidden";
  document.body.style.background = "#2b2b2b";

  // ─────────────────────────────
  // THREE SETUP
  // ─────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2b2b2b);

  const camera = new THREE.PerspectiveCamera(
    75,
    innerWidth / innerHeight,
    0.1,
    1000
  );
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
// CATEGORY + BLOCK UI (DO NOT MODIFY CORE LOGIC)
// ─────────────────────────────

const uiPanel = document.createElement("div");
uiPanel.style.position = "absolute";
uiPanel.style.left = "10px";
uiPanel.style.top = "50%";
uiPanel.style.transform = "translateY(-50%)";
uiPanel.style.display = "flex";
uiPanel.style.gap = "10px";
uiPanel.style.background = "#111";
uiPanel.style.padding = "10px";
uiPanel.style.borderRadius = "8px";
uiPanel.style.zIndex = "10";
document.body.appendChild(uiPanel);

// LEFT: categories
const catRow = document.createElement("div");
catRow.style.display = "flex";
catRow.style.flexDirection = "column";
catRow.style.gap = "5px";
uiPanel.appendChild(catRow);

// RIGHT: blocks
const blockPanel = document.createElement("div");
blockPanel.style.display = "flex";
blockPanel.style.flexDirection = "column";
blockPanel.style.gap = "5px";
blockPanel.style.borderLeft = "1px solid #333";
blockPanel.style.paddingLeft = "10px";
uiPanel.appendChild(blockPanel);

// categories from registry
const categories = [...new Set(BLOCKS.map(b => b.category))];

let currentCategory = categories[0];

function renderUI() {
  catRow.innerHTML = "";
  blockPanel.innerHTML = "";

  // ───────── categories
  categories.forEach(cat => {
    const btnEl = document.createElement("button");
    btnEl.innerText = cat;

    btnEl.style.width = "120px";
    btnEl.style.padding = "6px";
    btnEl.style.cursor = "pointer";

    btnEl.onclick = () => {
      currentCategory = cat;
      renderUI();
    };

    if (cat === currentCategory) {
      btnEl.style.background = "#444";
      btnEl.style.color = "#fff";
    }

    catRow.appendChild(btnEl);
  });

  // ───────── blocks for selected category
  BLOCKS.filter(b => b.category === currentCategory).forEach(block => {
    const btnEl = document.createElement("button");
    btnEl.innerText = block.name;

    btnEl.style.width = "160px";
    btnEl.style.padding = "6px";
    btnEl.style.cursor = "pointer";

    btnEl.onclick = () => {
      selected = block;
      createGhost(); // IMPORTANT: keeps your original ghost system untouched
    };

    blockPanel.appendChild(btnEl);
  });
}

renderUI();

  
  // ─────────────────────────────
  // INPUT SYSTEM (UNCHANGED)
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

  const placed: THREE.Mesh[] = [];
  const grid = new Set<string>();
  const key = (x: number, y: number, z: number) => `${x},${y},${z}`;

  const loader = new GLTFLoader();
  let ghost: THREE.Group | null = null;

  let paintColor = "#ffffff";

  // ─────────────────────────────
  // ROTATION STATE (NEW)
  // ─────────────────────────────
  const rotation = new THREE.Euler(0, 0, 0);

  window.addEventListener("keydown", (e) => {
    if (e.key === "r") rotation.x += Math.PI / 2;
    if (e.key === "t") rotation.y += Math.PI / 2;
    if (e.key === "y") rotation.z += Math.PI / 2;
  });

  // ─────────────────────────────
  // UI TOP BAR
  // ─────────────────────────────
  const ui = document.createElement("div");
  ui.style.position = "absolute";
  ui.style.top = "10px";
  ui.style.left = "50%";
  ui.style.transform = "translateX(-50%)";
  ui.style.background = "#111";
  ui.style.padding = "10px";
  ui.style.zIndex = "10";
  document.body.appendChild(ui);

  function btn(t: string, f: () => void) {
    const b = document.createElement("button");
    b.innerText = t;
    b.onclick = f;
    ui.appendChild(b);
  }

  btn("Place", () => (tool = "place"));
  btn("Delete", () => (tool = "delete"));
  btn("Paint", () => (tool = "paint"));
  btn("Save", save);

  const color = document.createElement("input");
  color.type = "color";
  color.value = paintColor;
  color.oninput = () => (paintColor = color.value);
  ui.appendChild(color);

  btn("Gallery", async () => {
    const m = await import("./gallery");
    m.renderGallery();
  });

  // ─────────────────────────────
  // BLOCK UI (RESTORED FULL)
  // ─────────────────────────────
  const uiPanel = document.createElement("div");
  uiPanel.style.position = "absolute";
  uiPanel.style.left = "10px";
  uiPanel.style.top = "50%";
  uiPanel.style.transform = "translateY(-50%)";
  uiPanel.style.background = "#111";
  uiPanel.style.padding = "10px";
  uiPanel.style.display = "flex";
  uiPanel.style.gap = "10px";
  document.body.appendChild(uiPanel);

  const categories = [...new Set(BLOCKS.map((b) => b.category))];
  let currentCategory = categories[0];

  const catRow = document.createElement("div");
  catRow.style.display = "flex";
  catRow.style.flexDirection = "column";
  catRow.style.gap = "5px";

  const blockRow = document.createElement("div");
  blockRow.style.display = "flex";
  blockRow.style.flexDirection = "column";
  blockRow.style.gap = "5px";

  uiPanel.appendChild(catRow);
  uiPanel.appendChild(blockRow);

  function renderUI() {
    catRow.innerHTML = "";
    blockRow.innerHTML = "";

    categories.forEach((cat) => {
      const b = document.createElement("button");
      b.innerText = cat;
      b.onclick = () => {
        currentCategory = cat;
        renderUI();
      };
      catRow.appendChild(b);
    });

    BLOCKS.filter((b) => b.category === currentCategory).forEach((b) => {
      const btn = document.createElement("button");
      btn.innerText = b.name;
      btn.onclick = () => {
        selected = b;
        createGhost();
      };
      blockRow.appendChild(btn);
    });
  }

  renderUI();

  // ─────────────────────────────
  // GHOST (UNCHANGED — DO NOT TOUCH LOGIC)
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
            opacity: 0.5,
          });
        }
      });

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

  // ─────────────────────────────
  // RAY UPDATE (UNCHANGED CORE BEHAVIOUR)
  // ─────────────────────────────
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
    ghost.rotation.copy(rotation);

    (ghost.children[0] as any)?.material?.color?.set(
      ok ? 0x00ff00 : 0xff0000
    );
  }

  // ─────────────────────────────
  // PLACE LOGIC
  // ─────────────────────────────
  function place(x: number, y: number, z: number) {
    if (grid.has(key(x, y, z))) return;

    loader.load(selected.model, (gltf: any) => {
      const obj = gltf.scene;

      obj.position.set(x, y, z);
      obj.rotation.copy(rotation);

      scene.add(obj);
      placed.push(obj as any);
      grid.add(key(x, y, z));
    });
  }

  // ─────────────────────────────
  // CLICK (UNCHANGED CORE)
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
      if (obj?.material) {
        obj.material.color = new THREE.Color(paintColor);
      }
    }
  });

  // ─────────────────────────────
  // SAVE
  // ─────────────────────────────
  async function save() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;

    const blueprint: BlockData[] = placed.map((p) => ({
      x: p.position.x,
      y: p.position.y,
      z: p.position.z,
      color: "#fff",
    }));

    const name = prompt("Blueprint name?");
    if (!name) return;

    await supabase.from("blueprints").insert({
      user_id: data.user.id,
      name,
      data: blueprint,
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
