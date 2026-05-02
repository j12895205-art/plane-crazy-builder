import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { supabase } from "../supabase";
import { BLOCKS } from "../blockRegistry";

// ─────────────────────────────
// LOGIN POPUP (UNCHANGED)
// ─────────────────────────────
function showLoginPopup(onSuccess: () => void) {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.background = "rgba(0,0,0,0.85)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = "9999";

  const box = document.createElement("div");
  box.style.background = "#111";
  box.style.padding = "20px";
  box.style.borderRadius = "10px";
  box.style.width = "260px";
  box.style.color = "white";

  const email = document.createElement("input");
  email.placeholder = "email";
  email.style.width = "100%";

  const password = document.createElement("input");
  password.type = "password";
  password.placeholder = "password";
  password.style.width = "100%";

  const login = document.createElement("button");
  login.innerText = "Login";
  login.style.width = "100%";

  const signup = document.createElement("button");
  signup.innerText = "Register";
  signup.style.width = "100%";

  const status = document.createElement("div");

  login.onclick = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value
    });

    if (!error) {
      overlay.remove();
      onSuccess();
    } else {
      status.innerText = error.message;
    }
  };

  signup.onclick = async () => {
    const { error } = await supabase.auth.signUp({
      email: email.value,
      password: password.value
    });

    if (!error) {
      overlay.remove();
      onSuccess();
    } else {
      status.innerText = error.message;
    }
  };

  box.append(email, password, login, signup, status);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

// ─────────────────────────────
// MAIN
// ─────────────────────────────
export async function renderEditor() {
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    showLoginPopup(() => renderEditor());
    return;
  }

  document.body.innerHTML = "";
  document.body.style.margin = "0";
  document.body.style.overflow = "hidden";

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

  const loader = new GLTFLoader();

  const placed: THREE.Object3D[] = [];
  const grid = new Set<string>();
  const key = (x:number,y:number,z:number)=>`${x},${y},${z}`;

  let ghost: THREE.Group | null = null;
  let paintColor = "#ffffff";

  // ─────────────────────────────
  // UI (TOP BAR)
  // ─────────────────────────────
  const ui = document.createElement("div");
  ui.style.position = "absolute";
  ui.style.top = "10px";
  ui.style.left = "50%";
  ui.style.transform = "translateX(-50%)";
  ui.style.background = "#111";
  ui.style.padding = "10px";
  document.body.appendChild(ui);

  function btn(t:string,f:()=>void){
    const b=document.createElement("button");
    b.innerText=t;
    b.onclick=f;
    ui.appendChild(b);
  }

  btn("Place",()=>tool="place");
  btn("Delete",()=>tool="delete");
  btn("Paint",()=>tool="paint");
  btn("Save",save);

  const color = document.createElement("input");
  color.type = "color";
  color.value = paintColor;
  color.oninput = ()=>paintColor=color.value;
  ui.appendChild(color);

  btn("Gallery", async () => {
    const m = await import("./gallery");
    m.renderGallery();
  });

  // ─────────────────────────────
  // CATEGORY UI (UNCHANGED)
  // ─────────────────────────────
  const panel = document.createElement("div");
  panel.style.position = "absolute";
  panel.style.left = "10px";
  panel.style.top = "50%";
  panel.style.transform = "translateY(-50%)";
  panel.style.background = "#111";
  panel.style.padding = "10px";
  document.body.appendChild(panel);

  const categories = [...new Set(BLOCKS.map(b => b.category))];
  let current = categories[0];

  const catBox = document.createElement("div");
  const blockBox = document.createElement("div");
  panel.append(catBox, blockBox);

  function renderUI() {
    catBox.innerHTML = "";
    blockBox.innerHTML = "";

    categories.forEach(c => {
      const b = document.createElement("button");
      b.innerText = c;
      b.onclick = () => { current = c; renderUI(); };
      catBox.appendChild(b);
    });

    BLOCKS.filter(b => b.category === current).forEach(bk => {
      const b = document.createElement("button");
      b.innerText = bk.name;
      b.onclick = () => {
        selected = bk;
        createGhost();
      };
      blockBox.appendChild(b);
    });
  }

  renderUI();

  // ─────────────────────────────
  // GHOST (RESTORED ORIGINAL)
  // ─────────────────────────────
  function createGhost() {
    if (ghost) scene.remove(ghost);

    loader.load(selected.model, gltf => {
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

      scene.add(ghost);
    });
  }

  createGhost();

  // ─────────────────────────────
  // MOUSE
  // ─────────────────────────────
  window.addEventListener("pointermove", e => {
    mouse.x = (e.clientX / innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / innerHeight) * 2 + 1;
  });

  // ─────────────────────────────
  // 🔥 ORIGINAL RAYCAST PLACEMENT (UNCHANGED)
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

    const ok = !grid.has(key(x,y,z));

    ghost.visible = ok;
    ghost.position.set(x,y,z);

    (ghost.children[0] as any)?.material?.color?.set(
      ok ? 0x00ff00 : 0xff0000
    );
  }

  function place(x:number,y:number,z:number){
    if (grid.has(key(x,y,z))) return;

    loader.load(selected.model, gltf => {
      const obj = gltf.scene;
      obj.position.set(x,y,z);

      scene.add(obj);
      placed.push(obj as any);
      grid.add(key(x,y,z));
    });
  }

  window.addEventListener("pointerdown", () => {
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects([ground, ...placed], true);
    if (!hits.length) return;

    const p = hits[0].point;
    const n = hits[0].face?.normal || new THREE.Vector3(0,1,0);

    const x = Math.round(p.x + n.x * 0.5);
    const y = Math.round(p.y + n.y * 0.5);
    const z = Math.round(p.z + n.z * 0.5);

    if (tool === "place") place(x,y,z);

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
  async function save(){
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;

    const blueprint = placed.map(p => ({
      x:p.position.x,
      y:p.position.y,
      z:p.position.z,
      color:"#fff"
    }));

    const name = prompt("Blueprint name?");
    if (!name) return;

    await supabase.from("blueprints").insert({
      user_id:data.user.id,
      name,
      data:blueprint
    });

    alert("Saved!");
  }

  // ─────────────────────────────
  // LOOP
  // ─────────────────────────────
  function animate(){
    requestAnimationFrame(animate);
    controls.update();
    updateRay();
    renderer.render(scene,camera);
  }

  animate();
}