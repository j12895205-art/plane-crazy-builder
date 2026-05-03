import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

type BlockData = {
  x: number;
  y: number;
  z: number;
  color: string;
};

export function renderTutorialViewer(data: BlockData[]) {
  document.body.innerHTML = "";
  document.body.style.margin = "0";
  document.body.style.background = "#222";

  // ─────────────────────────────
  // THREE SETUP
  // ─────────────────────────────
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    75,
    innerWidth / innerHeight,
    0.1,
    1000
  );
  camera.position.set(10, 10, 10);

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
  // BLOCKS
  // ─────────────────────────────
  const blocks: THREE.Mesh[] = [];

  const geo = new THREE.BoxGeometry(1, 1, 1);

  data.forEach(b => {
    const mat = new THREE.MeshStandardMaterial({
      color: b.color || "#ffffff"
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(b.x, b.y, b.z);

    scene.add(mesh);
    blocks.push(mesh);
  });

  // ─────────────────────────────
  // HEIGHT SCRUBBER
  // ─────────────────────────────
  const maxY = Math.max(...data.map(b => b.y));

  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = "0";
  slider.max = maxY.toString();
  slider.value = maxY.toString();

  slider.style.position = "absolute";
  slider.style.bottom = "20px";
  slider.style.left = "50%";
  slider.style.transform = "translateX(-50%)";
  slider.style.width = "300px";

  document.body.appendChild(slider);

  slider.oninput = () => {
    const level = Number(slider.value);

    blocks.forEach(b => {
      b.visible = b.position.y <= level;
    });
  };

  // ─────────────────────────────
  // PLAY BUTTON (AUTO BUILD)
  // ─────────────────────────────
  const play = document.createElement("button");
  play.innerText = "Play Tutorial";

  play.style.position = "absolute";
  play.style.bottom = "60px";
  play.style.left = "50%";
  play.style.transform = "translateX(-50%)";

  document.body.appendChild(play);

  play.onclick = async () => {
    // hide all first
    blocks.forEach(b => (b.visible = false));

    // sort bottom to top
    const sorted = [...blocks].sort(
      (a, b) => a.position.y - b.position.y
    );

    for (const b of sorted) {
      b.visible = true;
      await new Promise(r => setTimeout(r, 150));
    }
  };

  // ─────────────────────────────
  // BACK BUTTON
  // ─────────────────────────────
  const back = document.createElement("button");
  back.innerText = "Back";

  back.style.position = "absolute";
  back.style.top = "10px";
  back.style.left = "10px";

  back.onclick = async () => {
    const m = await import("./gallery");
    m.renderGallery();
  };

  document.body.appendChild(back);

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
