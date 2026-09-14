import * as THREE from 'three';
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

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 500);
camera.position.set(0, 28, 24);
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
let score = 0;
let gameOver = false;
let spawnTimer = 0;
let nextSpawnIn = 1.5;

const scoreEl = document.getElementById('score');
const gameOverEl = document.getElementById('gameOver');
const restartBtn = document.getElementById('restartBtn');

function spawnRandomCar() {
  const direction = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
  const car = createCar(direction);
  cars.push(car);

  const geometry = new THREE.BoxGeometry(CAR_WIDTH, 1, CAR_LENGTH);
  const material = new THREE.MeshStandardMaterial({ color: CAR_COLORS[direction] });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = 0.5;
  if (DIRECTION_INFO[direction].axis === 'x') mesh.rotation.y = Math.PI / 2;
  scene.add(mesh);
  carMeshes.set(car.id, mesh);
}

function removeCar(id) {
  const mesh = carMeshes.get(id);
  if (mesh) {
    scene.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
    carMeshes.delete(id);
  }
  const idx = cars.findIndex((c) => c.id === id);
  if (idx !== -1) cars.splice(idx, 1);
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
    lightState = hits[0].object.userData.pair;
    updateTrafficLightColors(lightMeshes, lightState);
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
  const delta = Math.min(clock.getDelta(), 0.1);

  if (!gameOver) {
    spawnTimer += delta;
    if (spawnTimer >= nextSpawnIn) {
      spawnTimer = 0;
      nextSpawnIn = 1 + Math.random() * 1.5;
      spawnRandomCar();
    }

    const { removedIds, collided } = stepSimulation(cars, lightState, delta);
    syncMeshes();

    if (collided) {
      gameOver = true;
      document.getElementById('finalScore').textContent = `Final score: ${score}`;
      gameOverEl.style.display = 'flex';
    } else {
      for (const id of removedIds) {
        removeCar(id);
        score += 1;
      }
      scoreEl.textContent = `Score: ${score}`;
    }
  }

  renderer.render(scene, camera);
}
animate();