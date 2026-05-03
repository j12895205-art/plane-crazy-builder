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

export async function renderEditor() {

  // 🔐 AUTH CHECK
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    alert("You must be logged in to use the editor.");
    const m = await import("./auth");
    m.createAuthUI(); // ✅ FIXED
    return;
  }

  // RESET
  document.body.innerHTML = "";
  document.body.style.margin = "0";
  document.body.style.overflow = "hidden";
  document.body.style.background = "#2b2b2b";

  // THREE
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2b2b2b);

  const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);
  camera.position.set(8, 8, 8);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  document.body.appendChild(renderer.domElement);

  renderer.domElement.tabIndex = 0;
  renderer.domElement.focus();

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  scene.add(new THREE.AmbientLight(0xffffff, 1));
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(5, 10, 5);
  scene.add(light);

  scene.add(new THREE.GridHelper(50, 50));

  // INPUT
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // STATE
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

  let paintColor = "#ffffff";

  // ROTATION
  window.addEventListener("keydown", (e) => {
    const target = e.target as HTMLElement;
    if (["INPUT", "TEXTAREA", "BUTTON"].includes(target.tagName)) return;

    const k = e.key.toLowerCase();

    if (k === "r") rotY += Math.PI / 2;
    if (k === "t") rotX += Math.PI / 2;
    if (k === "y") rotZ += Math.PI / 2;

    if (ghost) ghost.rotation.set(rotX, rotY, rotZ);
  });

  // TOP UI
  const ui = document.createElement("div");
  ui.style.position = "absolute";
  ui.style.top = "10px";
  ui.style.left = "50%";
  ui.style.transform = "translateX(-50%)";
  ui.style.background = "#111";
  ui.style.padding = "10px";
  ui.style.zIndex = "10";
  document.body.appendChild(ui);

  function btn(text: string, fn: () => void) {
    const b = document.createElement("button");
    b.innerText = text;
    b.onclick = fn;
    ui.appendChild(b);
  }

  btn("Place", () => tool = "place");
  btn("Delete", () => tool = "delete");
  btn("Paint", () => tool = "paint");
  btn("Save", save);

  btn("Gallery", async () => {
    const m = await import("./gallery");
    m.renderGallery();
  });

  btn("Tutorial", async () => {
    const m = await import("./tutorial");
    m.renderTutorial();
  });

  btn("Logout", async () => {
    await supabase.auth.signOut();
    location.reload();
  });

  const colorPicker = document.createElement("input");
  colorPicker.type = "color";
  colorPicker.value = paintColor;
  colorPicker.oninput = () => paintColor = colorPicker.value;
  ui.appendChild(colorPicker);

  // CATEGORY UI
  const panel = document.createElement("div");
  panel.style.position = "absolute";
  panel.style.left = "10px";
  panel.style.top = "50%";
  panel.style.transform = "translateY(-50%)";
  panel.style.display = "flex";
  panel.style.gap = "10px";
  panel.style.background = "#111";
  panel.style.padding = "10px";
  document.body.appendChild(panel);

  const catCol = document.createElement("div");
  const blockCol = document.createElement("div");

  catCol.style.display = "flex";
  catCol.style.flexDirection = "column";
  catCol.style.gap = "5px";

  blockCol.style.display = "flex";
  blockCol.style.flexDirection = "column";
  blockCol.style.gap = "5px";
  blockCol.style.borderLeft = "1px solid #333";
  blockCol.style.paddingLeft = "10px";

  panel.appendChild(catCol);
  panel.appendChild(blockCol);

  const categories = [...new Set(BLOCKS.map(b => b.category))];
  let currentCategory = categories[0];

  function renderUI() {
    catCol.innerHTML = "";
    blockCol.innerHTML = "";

    categories.forEach(cat => {
      const b = document.createElement("button");
      b.innerText = cat;
      b.onclick = () => {
        currentCategory = cat;
        renderUI();
      };
      if (cat === currentCategory) b.style.background = "#444";
      catCol.appendChild(b);
    });

    BLOCKS
      .filter(b => b.category === currentCategory)
      .forEach(block => {
        const b = document.createElement("button");
        b.innerText = block.name;
        b.onclick = () => {
          selected = block;
          createGhost();
        };
        blockCol.appendChild(b);
      });
  }

  renderUI();

  // GHOST
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

  // MOUSE
  window.addEventListener("pointermove", (e) => {
    mouse.x = (e.clientX / innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / innerHeight) * 2 + 1;
  });

  function updateRay() {
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects([ground, ...placed], true);

    if (!hits.length || !ghost) return;

    const p = hits[0].point;
    const n = hits[0].face?.normal || new THREE.Vector3(0, 1, 0);

    const x = Math.round(p.x + n.x * 0.5);
    const y = Math.round(p.y + n.y * 0.5);
    const z = Math.round(p.z + n.z * 0.5);

    ghost.visible = !grid.has(key(x, y, z));
    ghost.position.set(x, y, z);
  }

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
      if (obj) scene.remove(obj);
    }

    if (tool === "paint") {
      const obj = hits[0].object as any;
      if (obj?.material) {
        obj.material.color = new THREE.Color(paintColor);
      }
    }
  });

  async function save() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;

    const blueprint: BlockData[] = placed.map((p: any) => ({
      x: p.position.x,
      y: p.position.y,
      z: p.position.z,
      color: "#ffffff"
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

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    updateRay();
    renderer.render(scene, camera);
  }

  animate();
}
