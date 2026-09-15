import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import './style.css';
import { buildScene } from './scene.js';
import { createTrafficLights, updateTrafficLightColors } from './trafficLights.js';
import {
  createCar,
  stepSimulation,
  carWorldPosition,
  DIRECTION_INFO,
  CAR_LENGTH,
  CAR_WIDTH,
} from './simulation.js';

const DIRECTIONS = ['N', 'S', 'E', 'W'];
const CAR_COLORS = { N: 0x3498db, S: 0xf1c40f, E: 0x9b59b6, W: 0x1abc9c };
const CAR_MODELS = {
  N: '/assets/models/cars/sedan.glb',
  S: '/assets/models/cars/taxi.glb',
  E: '/assets/models/cars/hatchback-sports.glb',
  W: '/assets/models/cars/police.glb',
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 500);
const cameraBasePos = new THREE.Vector3(0, 28, 24);
camera.position.copy(cameraBasePos);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const sun = new THREE.DirectionalLight(0xffffff, 0.8);
sun.position.set(10, 20, 10);
scene.add(sun);

buildScene(scene);

const { group: lightGroup, meshes: lightMeshes } = createTrafficLights();
scene.add(lightGroup);

let lightState = 'NS';
updateTrafficLightColors(lightMeshes, lightState);

const cars = [];
const carMeshes = new Map();
const carMeshKinds = new Map();
const particleBursts = [];
const scorePopups = [];
const carTemplates = new Map();
const gltfLoader = new GLTFLoader();

let score = 0;
let gameOver = false;
let spawnTimer = 0;
let nextSpawnIn = 1.5;
let cameraShake = 0;
let slowMoTimer = 0;

const scoreEl = document.getElementById('score');
const gameOverEl = document.getElementById('gameOver');
const restartBtn = document.getElementById('restartBtn');

function createBoxCar(direction) {
  const geometry = new THREE.BoxGeometry(CAR_WIDTH, 1, CAR_LENGTH);
  const material = new THREE.MeshStandardMaterial({ color: CAR_COLORS[direction] });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.asset = false;
  return mesh;
}

function prepareCarTemplate(sceneRoot) {
  const template = sceneRoot.clone(true);
  const bounds = new THREE.Box3().setFromObject(template);
  const size = bounds.getSize(new THREE.Vector3());
  const scale = Math.min(CAR_WIDTH / size.x, CAR_LENGTH / size.z);
  template.scale.setScalar(scale);

  const scaledBounds = new THREE.Box3().setFromObject(template);
  const center = scaledBounds.getCenter(new THREE.Vector3());
  template.position.x -= center.x;
  template.position.z -= center.z;
  template.position.y -= scaledBounds.min.y;
  template.userData.asset = true;
  return template;
}

function replaceCarMesh(id, nextMesh) {
  const currentMesh = carMeshes.get(id);
  if (!currentMesh) return;

  nextMesh.position.copy(currentMesh.position);
  nextMesh.rotation.copy(currentMesh.rotation);
  nextMesh.userData.asset = true;
  scene.remove(currentMesh);
  if (!currentMesh.userData.asset) {
    currentMesh.geometry.dispose();
    currentMesh.material.dispose();
  }
  scene.add(nextMesh);
  carMeshes.set(id, nextMesh);
}

function loadCarTemplates() {
  return Promise.all(
    Object.entries(CAR_MODELS).map(
      ([direction, path]) =>
        new Promise((resolve, reject) => {
          gltfLoader.load(
            path,
            (gltf) => {
              carTemplates.set(direction, prepareCarTemplate(gltf.scene));
              resolve();
            },
            undefined,
            (error) => reject(new Error(`Failed to load ${path}: ${error.message}`))
          );
        })
    )
  ).then(() => {
    for (const car of cars) {
      const template = carTemplates.get(car.direction);
      if (template && carMeshKinds.get(car.id) === 'box') {
        replaceCarMesh(car.id, template.clone(true));
        carMeshKinds.set(car.id, 'asset');
      }
    }
  });
}

loadCarTemplates().catch((error) => {
  console.error('Kenney car models could not be loaded; using fallback cars.', error);
});

function spawnRandomCar() {
  const direction = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
  const car = createCar(direction);
  cars.push(car);

  const mesh = carTemplates.get(direction)?.clone(true) ?? createBoxCar(direction);
  mesh.position.y = 0;
  const info = DIRECTION_INFO[direction];
  mesh.rotation.y = info.axis === 'z' ? (info.sign < 0 ? Math.PI : 0) : info.sign > 0 ? Math.PI / 2 : -Math.PI / 2;
  scene.add(mesh);
  carMeshes.set(car.id, mesh);
  carMeshKinds.set(car.id, mesh.userData.asset ? 'asset' : 'box');
}

function removeCar(id) {
  const mesh = carMeshes.get(id);
  if (mesh) {
    scene.remove(mesh);
    if (carMeshKinds.get(id) === 'box') {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    carMeshes.delete(id);
    carMeshKinds.delete(id);
  }
  const idx = cars.findIndex((c) => c.id === id);
  if (idx !== -1) cars.splice(idx, 1);
}

function spawnBurst(position, color) {
  for (let i = 0; i < 10; i += 1) {
    const material = new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity: 1,
    });
    const particle = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), material);
    particle.position.copy(position);
    particle.position.y = 0.8;
    scene.add(particle);

    particleBursts.push({
      mesh: particle,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 2.6,
        Math.random() * 1.6 + 0.4,
        (Math.random() - 0.5) * 2.6
      ),
      life: 0.7,
      maxLife: 0.7,
    });
  }
}

function addScorePopup(position) {
  const popup = document.createElement('div');
  popup.className = 'score-popup';
  popup.textContent = '+1';
  popup.style.position = 'fixed';
  popup.style.left = '0';
  popup.style.top = '0';
  popup.style.pointerEvents = 'none';
  popup.style.userSelect = 'none';
  popup.style.fontWeight = '700';
  popup.style.color = '#ffffff';
  popup.style.textShadow = '0 2px 8px rgba(0, 0, 0, 0.6)';
  popup.style.opacity = '1';
  document.body.appendChild(popup);

  scorePopups.push({
    popup,
    position: position.clone().add(new THREE.Vector3(0, 0.9, 0)),
    life: 0.9,
    maxLife: 0.9,
  });
}

function updateParticles(delta) {
  for (let i = particleBursts.length - 1; i >= 0; i -= 1) {
    const particle = particleBursts[i];
    particle.life -= delta;
    particle.velocity.y -= 4.5 * delta;
    particle.mesh.position.addScaledVector(particle.velocity, delta);
    particle.mesh.material.opacity = Math.max(0, particle.life / particle.maxLife);

    if (particle.life <= 0) {
      scene.remove(particle.mesh);
      particle.mesh.geometry.dispose();
      particle.mesh.material.dispose();
      particleBursts.splice(i, 1);
    }
  }
}

function updateScorePopups(delta) {
  for (let i = scorePopups.length - 1; i >= 0; i -= 1) {
    const popup = scorePopups[i];
    popup.life -= delta;
    popup.position.y += delta * 1.2;

    const projected = popup.position.clone().project(camera);
    const x = (projected.x * 0.5 + 0.5) * innerWidth;
    const y = (-projected.y * 0.5 + 0.5) * innerHeight - (1 - popup.life / popup.maxLife) * 40;

    popup.popup.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    popup.popup.style.opacity = String(Math.max(0, popup.life / popup.maxLife));

    if (popup.life <= 0) {
      popup.popup.remove();
      scorePopups.splice(i, 1);
    }
  }
}

function syncMeshes() {
  for (const car of cars) {
    const mesh = carMeshes.get(car.id);
    const pos = carWorldPosition(car);
    mesh.position.x = pos.x;
    mesh.position.z = pos.z;
  }
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function handlePick(clientX, clientY) {
  if (gameOver) return;
  pointer.x = (clientX / innerWidth) * 2 - 1;
  pointer.y = -(clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(lightMeshes);
  if (hits.length > 0) {
    const nextState = hits[0].object.userData.pair;
    if (nextState !== lightState) {
      lightState = nextState;
      updateTrafficLightColors(lightMeshes, lightState);
      for (const light of lightMeshes) {
        if (light.userData.pair === lightState) {
          light.userData.flash = 1;
        }
      }
    }
  }
}

renderer.domElement.addEventListener('click', (e) => handlePick(e.clientX, e.clientY));
renderer.domElement.addEventListener(
  'touchstart',
  (e) => {
    const t = e.touches[0];
    handlePick(t.clientX, t.clientY);
  },
  { passive: true }
);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

restartBtn.addEventListener('click', () => location.reload());

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const rawDelta = Math.min(clock.getDelta(), 0.1);
  const elapsed = clock.elapsedTime;
  const gameplayDelta = slowMoTimer > 0 ? rawDelta * 0.35 : rawDelta;

  if (!gameOver) {
    spawnTimer += gameplayDelta;
    if (spawnTimer >= nextSpawnIn) {
      spawnTimer = 0;
      nextSpawnIn = 1 + Math.random() * 1.5;
      spawnRandomCar();
    }

    const { removedIds, collided, nearMiss } = stepSimulation(cars, lightState, gameplayDelta);
    syncMeshes();

    if (nearMiss) {
      cameraShake = Math.max(cameraShake, 0.25);
    }

    if (collided) {
      gameOver = true;
      cameraShake = Math.max(cameraShake, 1.6);
      slowMoTimer = 0.3;
      document.getElementById('finalScore').textContent = `Final score: ${score}`;
      gameOverEl.style.display = 'flex';
    } else {
      for (const id of removedIds) {
        const car = cars.find((candidate) => candidate.id === id);
        if (car) {
          const worldPos = carWorldPosition(car);
          const worldVector = new THREE.Vector3(worldPos.x, 0.75, worldPos.z);
          spawnBurst(worldVector, CAR_COLORS[car.direction]);
          addScorePopup(worldVector);
        }
        removeCar(id);
        score += 1;
      }
      scoreEl.textContent = `Score: ${score}`;
    }
  }

  for (const light of lightMeshes) {
    const isActive = light.userData.pair === lightState;
    const flash = Math.max(0, (light.userData.flash ?? 0) - gameplayDelta * 3.5);
    light.userData.flash = flash;
    light.material.emissiveIntensity = isActive ? 0.8 + flash * 3.2 : 0.15 + flash * 1.2;
    light.scale.setScalar(isActive ? 1.1 + flash * 0.4 : 1 + flash * 0.2);
  }

  lightGroup.position.y = Math.sin(elapsed * 1.5) * 0.08;
  lightGroup.rotation.y = Math.sin(elapsed * 0.7) * 0.05;

  updateParticles(gameplayDelta);
  updateScorePopups(gameplayDelta);

  camera.position.copy(cameraBasePos);
  camera.position.x += (Math.random() - 0.5) * cameraShake;
  camera.position.y += (Math.random() - 0.5) * cameraShake * 0.8;
  camera.position.z += (Math.random() - 0.5) * cameraShake;
  camera.lookAt(0, 0, 0);
  cameraShake *= 0.84;
  slowMoTimer = Math.max(0, slowMoTimer - rawDelta);

  renderer.render(scene, camera);
}

animate();