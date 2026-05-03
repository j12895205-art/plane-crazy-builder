import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { supabase } from "../supabase";
import { BLOCKS } from "../blockRegistry";

type BlockData = {
  x: number;
  y: number;
  z: number;
  id?: string;
  rotX?: number;
  rotY?: number;
  rotZ?: number;
  color?: string;
};

export function renderEditor() {
  // ─────────────────────────────
  // RESET UI
  // ─────────────────────────────
  document.body.innerHTML = "";
  document.body.style.margin = "0";
  document.body.style.overflow = "hidden";
  document.body.style.background = "#2b2b2b";

  // ─────────────────────────────
  // SCENE SETUP
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
  // INPUT SYSTEM
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

  const loader = new GLTFLoader();

  let ghost: THREE.Group | null = null;
  const ghostTarget = new THREE.Vector3();

  const key = (x:number,y:number,z:number)=>`${x},${y},${z}`;

  // ─────────────────────────────
  // ROTATION SYSTEM (R T Y)
  // ─────────────────────────────
  let rotX = 0;
  let rotY = 0;
  let rotZ = 0;

  window.addEventListener("keydown", (e) => {
    const step = Math.PI / 2;

    if (e.key === "r") rotY += step;
    if (e.key === "t") rotX += step;
    if (e.key === "y") rotZ += step;

    if (ghost) ghost.rotation.set(rotX, rotY, rotZ);
  });

  // ─────────────────────────────
  // SAFE MODEL
  // ─────────────────────────────
  function safeModel(b: any) {
    return b?.model || BLOCKS[0].model;
  }

  // ─────────────────────────────
  // LOAD BLUEPRINT (FROM GALLERY)
  // ─────────────────────────────
  const loaded = JSON.parse(localStorage.getItem("loaded_blueprint") || "null");

  // ─────────────────────────────
  // UI
  // ─────────────────────────────
  const ui = document.createElement("div");
  ui.style.position = "absolute";
  ui.style.top = "10px";
  ui.style.left = "10px";
  ui.style.zIndex = "10";
  ui.style.background = "#111";
  ui.style.color = "#fff";
  ui.style.padding = "10px";
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

  ui.appendChild(document.createElement("hr"));

  BLOCKS.forEach(b => {
    const bbtn = document.createElement("button");
    bbtn.innerText = b.name;

    bbtn.onclick = () => {
      selected = BLOCKS.find(x => x.id === b.id) || BLOCKS[0];
      createGhost();
    };

    ui.appendChild(bbtn);
  });

  // ─────────────────────────────
  // GHOST SYSTEM
  // ─────────────────────────────
  function createGhost() {
    if (ghost) scene.remove(ghost);

    loader.load(
      safeModel(selected),
      gltf => {
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

        ghost.position.copy(ghostTarget);
        ghost.rotation.set(rotX, rotY, rotZ);

        scene.add(ghost);
      },
      undefined,
      () => {
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(1,1,1),
          new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true })
        );

        ghost = new THREE.Group();
        ghost.add(box);

        scene.add(ghost);
      }
    );
  }

  createGhost();

  // ─────────────────────────────
  // REBUILD LOADED BLUEPRINT
  // ─────────────────────────────
  if (loaded) {
    loaded.forEach((b: any) => {
      loader.load(safeModel({ model: "/blocks/block.glb" }), gltf => {
        const obj = gltf.scene;

        obj.position.set(b.x, b.y, b.z);
        obj.rotation.set(b.rotX || 0, b.rotY || 0, b.rotZ || 0);

        scene.add(obj);
        placed.push(obj);
        grid.add(key(b.x, b.y, b.z));
      });
    });
  }

  // ─────────────────────────────
  // MOUSE MOVE (GROUND ONLY)
  // ─────────────────────────────
  window.addEventListener("pointermove", (e) => {
    mouse.x = (e.clientX / innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const hits = raycaster.intersectObject(ground);
    if (!hits.length) return;

    const p = hits[0].point;

    ghostTarget.set(
      Math.round(p.x),
      Math.round(p.y),
      Math.round(p.z)
    );

    if (ghost) {
      ghost.position.copy(ghostTarget);
      ghost.rotation.set(rotX, rotY, rotZ);
    }
  });

  // ─────────────────────────────
  // FIND REAL OBJECT
  // ─────────────────────────────
  function findPlaced(obj: THREE.Object3D) {
    while (obj && !placed.includes(obj)) {
      obj = obj.parent!;
    }
    return placed.find(p => p === obj);
  }

  // ─────────────────────────────
  // PLACE FUNCTION
  // ─────────────────────────────
  function place(x:number,y:number,z:number) {
    const k = key(x,y,z);
    if (grid.has(k)) return;

    loader.load(safeModel(selected), gltf => {
      const obj = gltf.scene;

      (obj as any).userData.id = selected.id;

      obj.position.set(x,y,z);
      obj.rotation.set(rotX, rotY, rotZ);

      scene.add(obj);
      placed.push(obj);
      grid.add(k);
    });
  }

  // ─────────────────────────────
  // PAINT SYSTEM (FIXED)
  // ─────────────────────────────
  function paintObject(obj: THREE.Object3D, color: string) {
    obj.traverse((c: any) => {
      if (c.isMesh) {
        c.material = c.material.clone();
        c.material.color = new THREE.Color(color);
      }
    });
  }

  // ─────────────────────────────
  // CLICK SYSTEM (PLACE / DELETE / PAINT)
  // ─────────────────────────────
  window.addEventListener("pointerdown", () => {
    raycaster.setFromCamera(mouse, camera);

    const objectHits = raycaster.intersectObjects(placed, true);
    const groundHits = raycaster.intersectObject(ground);

    let x:number, y:number, z:number;

    // ─ STACKING ─
    if (objectHits.length && tool === "place") {
      const hit = objectHits[0];

      const obj = findPlaced(hit.object);
      if (!obj) return;

      const normal = hit.face?.normal?.clone() || new THREE.Vector3(0,1,0);

      const world = obj.position.clone();

      x = Math.round(world.x + normal.x);
      y = Math.round(world.y + normal.y);
      z = Math.round(world.z + normal.z);

      place(x,y,z);
      return;
    }

    // ─ GROUND PLACE ─
    if (groundHits.length && tool === "place") {
      const p = groundHits[0].point;

      x = Math.round(p.x);
      y = Math.round(p.y);
      z = Math.round(p.z);

      place(x,y,z);
      return;
    }

    // ─ DELETE ─
    if (tool === "delete" && objectHits.length) {
      const target = findPlaced(objectHits[0].object);
      if (!target) return;

      scene.remove(target);
      placed.splice(placed.indexOf(target), 1);
    }

    // ─ PAINT ─
    if (tool === "paint" && objectHits.length) {
      const target = findPlaced(objectHits[0].object);
      if (!target) return;

      paintObject(target, "#ff0000");
    }
  });

  // ─────────────────────────────
  // SAVE
  // ─────────────────────────────
  async function save() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;

    const blueprint = placed.map(p => ({
      x: p.position.x,
      y: p.position.y,
      z: p.position.z,
      rotX: p.rotation.x,
      rotY: p.rotation.y,
      rotZ: p.rotation.z,
      id: (p as any).userData?.id || "block",
      color: "#ffffff"
    }));

    const name = prompt("Blueprint name?");
    if (!name) return;

    await supabase.from("blueprints").insert({
      user_id: data.user.id,
      name,
      data: blueprint,
      public: true
    });

    alert("Saved!");
  }

  // ─────────────────────────────
  // LOOP
  // ─────────────────────────────
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }

  animate();
}
