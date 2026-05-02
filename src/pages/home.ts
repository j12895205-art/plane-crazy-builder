import * as THREE from "three";

export function renderHome() {
  const blueprints = [
    { id: 1, name: "Fighter Jet", color: 0x00ff00 },
    { id: 2, name: "Drone", color: 0x0000ff },
    { id: 3, name: "Rocket", color: 0xff0000 }
  ];

  const container = document.createElement("div");

  container.style.display = "grid";
  container.style.gridTemplateColumns = "repeat(auto-fill, 220px)";
  container.style.gap = "20px";
  container.style.padding = "20px";

  document.body.appendChild(container);

  // create button
  const createBtn = document.createElement("button");
  createBtn.innerText = "Create Blueprint";
  createBtn.style.position = "fixed";
  createBtn.style.top = "10px";
  createBtn.style.right = "10px";

  createBtn.onclick = () => {
    window.location.href = "?page=editor";
  };

  document.body.appendChild(createBtn);

  blueprints.forEach((bp) => {
    const card = document.createElement("div");

    card.style.background = "#111";
    card.style.border = "1px solid #333";
    card.style.borderRadius = "12px";
    card.style.overflow = "hidden";
    card.style.cursor = "pointer";

    const canvas = document.createElement("canvas");
    canvas.width = 220;
    canvas.height = 160;

    const label = document.createElement("div");
    label.innerText = bp.name;
    label.style.color = "white";
    label.style.padding = "10px";

    card.appendChild(canvas);
    card.appendChild(label);
    container.appendChild(card);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 220 / 160, 0.1, 1000);
    camera.position.z = 3;

    const renderer = new THREE.WebGLRenderer({ canvas });
    renderer.setSize(220, 160);

    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.MeshBasicMaterial({ color: bp.color })
    );

    scene.add(cube);

    function animate() {
      requestAnimationFrame(animate);
      cube.rotation.y += 0.01;
      renderer.render(scene, camera);
    }

    animate();

    card.onclick = () => {
      window.location.href = `?page=tutorial&id=${bp.id}`;
    };
  });
}