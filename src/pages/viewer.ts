import * as THREE from "three";

export function renderViewer() {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );

  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  camera.position.z = 5;

  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(),
    new THREE.MeshBasicMaterial({ color: 0x00ff00 })
  );

  scene.add(cube);

  function animate() {
    requestAnimationFrame(animate);
    cube.rotation.y += 0.01;
    renderer.render(scene, camera);
  }

  animate();

  const btn = document.createElement("button");
  btn.innerText = "Start Tutorial";
  btn.onclick = () => {
    window.location.href = "?page=tutorial";
  };

  document.body.appendChild(btn);
}