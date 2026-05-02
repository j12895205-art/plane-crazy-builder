import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export function renderTutorial() {
  // ─────────────────────────────
  // RESET PAGE
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
  camera.position.set(6, 6, 6);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  document.body.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  // lighting
  scene.add(new THREE.AmbientLight(0xffffff, 1));
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.position.set(5, 10, 5);
  scene.add(sun);

  scene.add(new THREE.GridHelper(50, 50));

  // ─────────────────────────────
  // FAILSAFE BLUEPRINT PARSER
  // ─────────────────────────────
  function parseBlueprint(input: any): any[] {
    if (!input) return [];

    // already valid array
    if (Array.isArray(input)) return input;

    // Supabase wrapper case: { data: [...] }
    if (input.data) return parseBlueprint(input.data);

    // stringified JSON case
    if (typeof input === "string") {
      try {
        return parseBlueprint(JSON.parse(input));
      } catch {
        return [];
      }
    }

    return [];
  }

  const raw = (window as any).selectedBlueprint;
  const blueprint = parseBlueprint(raw);

  console.log("RAW blueprint:", raw);
  console.log("PARSED blueprint:", blueprint);

  // ─────────────────────────────
  // ERROR UI IF EMPTY
  // ─────────────────────────────
  if (!blueprint || blueprint.length === 0) {
    const msg = document.createElement("div");
    msg.innerText =
      "⚠ No blueprint data found\nCheck gallery → Supabase → save format";
    msg.style.position = "absolute";
    msg.style.top = "50%";
    msg.style.left = "50%";
    msg.style.transform = "translate(-50%, -50%)";
    msg.style.color = "red";
    msg.style.fontSize = "20px";
    msg.style.textAlign = "center";
    document.body.appendChild(msg);

    throw new Error("Blueprint is empty or invalid");
  }

  // ─────────────────────────────
  // STATE
  // ─────────────────────────────
  const placed: THREE.Mesh[] = [];

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

  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = "0";
  slider.max = "100";
  slider.value = "0";
  slider.style.width = "220px";
  ui.appendChild(slider);

  const label = document.createElement("div");
  label.innerText = "Scrub to replay build";
  ui.appendChild(label);

  // ─────────────────────────────
  // CLEAR SCENE
  // ─────────────────────────────
  function clear() {
    placed.forEach(p => scene.remove(p));
    placed.length = 0;
  }

  // ─────────────────────────────
  // ADD BLOCK (SAFE)
  // ─────────────────────────────
  function add(b: any) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({
        color: b.color || 0xffffff
      })
    );

    mesh.position.set(
      Number(b.x ?? 0),
      Number(b.y ?? 0),
      Number(b.z ?? 0)
    );

    scene.add(mesh);
    placed.push(mesh);
  }

  // ─────────────────────────────
  // REBUILD FROM SCRUBBER
  // ─────────────────────────────
  function rebuild(progress: number) {
    clear();

    const count = Math.floor(
      (progress / 100) * blueprint.length
    );

    for (let i = 0; i < count; i++) {
      const b = blueprint[i];
      if (!b) continue;

      add(b);
    }
  }

  slider.addEventListener("input", () => {
    rebuild(Number(slider.value));
  });

  // initial render
  rebuild(0);

  // ─────────────────────────────
  // RENDER LOOP
  // ─────────────────────────────
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }

  animate();
}