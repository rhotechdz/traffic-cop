import * as THREE from 'three';
import { INTERSECTION_HALF, LANE_OFFSET } from './simulation.js';

const ROAD_LENGTH = 80;
const ROAD_WIDTH = (LANE_OFFSET + 1) * 2;

export function buildScene(scene) {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshStandardMaterial({ color: 0x4c9a4c })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  scene.add(ground);

  const asphalt = new THREE.MeshStandardMaterial({ color: 0x333333 });

  const nsRoad = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_LENGTH), asphalt);
  nsRoad.rotation.x = -Math.PI / 2;
  nsRoad.position.y = -0.01;
  scene.add(nsRoad);

  const ewRoad = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_LENGTH, ROAD_WIDTH), asphalt);
  ewRoad.rotation.x = -Math.PI / 2;
  ewRoad.position.y = -0.01;
  scene.add(ewRoad);

  addStopLines(scene);
}

function addStopLines(scene) {
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const laneSpan = 2.6;
  const thickness = 0.15;
  const d = INTERSECTION_HALF + 0.1;

  const lines = [
    { x: -LANE_OFFSET, z: d, rotY: 0 },
    { x: LANE_OFFSET, z: -d, rotY: 0 },
    { x: -d, z: -LANE_OFFSET, rotY: Math.PI / 2 },
    { x: d, z: LANE_OFFSET, rotY: Math.PI / 2 },
  ];

  for (const line of lines) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(laneSpan, 0.02, thickness), lineMat);
    strip.position.set(line.x, 0.01, line.z);
    strip.rotation.y = line.rotY;
    scene.add(strip);
  }
}