import * as THREE from "three";
import { supabase } from "../supabase";

type BlueprintRow = {
  id: string;
  name: string;
  data: any;
  user_id: string;
  created_at?: string;
  creator_email?: string;
};

const ADMIN_EMAIL = "j12895205@gmail.com";

export function renderGallery() {
  document.body.innerHTML = "";
  document.body.style.margin = "0";
  document.body.style.fontFamily = "sans-serif";
  document.body.style.background = "#1e1e1e";
  document.body.style.color = "#fff";

  // ─────────────────────────────
  // HEADER
  // ─────────────────────────────
  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.padding = "15px";

  const title = document.createElement("h1");
  title.innerText = "Blueprint Gallery";
  header.appendChild(title);

  const back = document.createElement("button");
  back.innerText = "Back to Editor";
  back.onclick = async () => {
    const m = await import("./editor");
    m.renderEditor();
  };

  header.appendChild(back);
  document.body.appendChild(header);

  // ─────────────────────────────
  // GRID
  // ─────────────────────────────
  const grid = document.createElement("div");
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(260px, 1fr))";
  grid.style.gap = "15px";
  grid.style.padding = "15px";

  document.body.appendChild(grid);

  // ─────────────────────────────
  // PARSER
  // ─────────────────────────────
  function parseBlueprint(input: any) {
    if (!input) return [];
    if (Array.isArray(input)) return input;

    if (typeof input === "string") {
      try {
        return JSON.parse(input);
      } catch {
        return [];
      }
    }

    return [];
  }

  // ─────────────────────────────
  // THUMBNAIL (3D SPIN)
  // ─────────────────────────────
  function createThumbnail(data: any[]) {
    const container = document.createElement("div");
    container.style.width = "100%";
    container.style.height = "180px";
    container.style.borderRadius = "10px";
    container.style.overflow = "hidden";
    container.style.background = "#000";

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    camera.position.set(6, 6, 6);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(260, 180);
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 1));

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 10, 5);
    scene.add(light);

    const geo = new THREE.BoxGeometry(1, 1, 1);

    const group = new THREE.Group();
    scene.add(group);

    for (const b of data) {
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({
          color: b.color || "#ffffff"
        })
      );

      mesh.position.set(b.x || 0, b.y || 0, b.z || 0);
      group.add(mesh);
    }

    function animate() {
      requestAnimationFrame(animate);
      group.rotation.y += 0.01;
      renderer.render(scene, camera);
    }

    animate();

    return container;
  }

  // ─────────────────────────────
  // CARD
  // ─────────────────────────────
  function createCard(row: BlueprintRow) {
    const data = parseBlueprint(row.data);

    const card = document.createElement("div");
    card.style.background = "#111";
    card.style.borderRadius = "10px";
    card.style.padding = "10px";
    card.style.display = "flex";
    card.style.flexDirection = "column";
    card.style.gap = "8px";

    const thumb = createThumbnail(data);
    card.appendChild(thumb);

    const name = document.createElement("div");
    name.innerText = row.name || "Untitled";
    name.style.fontWeight = "bold";

    const creator = document.createElement("div");
    creator.innerText = `By: ${row.creator_email || "Unknown"}`;
    creator.style.fontSize = "12px";
    creator.style.opacity = "0.7";

    const date = document.createElement("div");
    date.innerText = row.created_at
      ? new Date(row.created_at).toLocaleDateString()
      : "Unknown date";

    date.style.fontSize = "12px";
    date.style.opacity = "0.6";

    card.appendChild(name);
    card.appendChild(creator);
    card.appendChild(date);

    const btnRow = document.createElement("div");
    btnRow.style.display = "flex";
    btnRow.style.gap = "5px";

    const loadBtn = document.createElement("button");
    loadBtn.innerText = "Load";
    loadBtn.onclick = async () => {
      (window as any).loadedBlueprint = {
        id: row.id,
        name: row.name,
        data
      };

      const m = await import("./editor");
      m.renderEditor();
    };

    btnRow.appendChild(loadBtn);

    // ─────────────────────────────
    // ADMIN DELETE CHECK
    // ─────────────────────────────
    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email;

      if (email === ADMIN_EMAIL) {
        const del = document.createElement("button");
        del.innerText = "Delete";

        del.onclick = async () => {
          await supabase.from("blueprints").delete().eq("id", row.id);
          renderGallery();
        };

        btnRow.appendChild(del);
      }
    });

    card.appendChild(btnRow);

    return card;
  }

  // ─────────────────────────────
  // LOAD DATA
  // ─────────────────────────────
  async function load() {
    const { data, error } = await supabase
      .from("blueprints")
      .select("*");

    if (error) {
      grid.innerHTML = "Failed to load gallery";
      return;
    }

    if (!data || data.length === 0) {
      grid.innerHTML = "No blueprints found";
      return;
    }

    grid.innerHTML = "";

    (data as BlueprintRow[]).forEach(row => {
      grid.appendChild(createCard(row));
    });
  }

  load();
}