import * as THREE from 'three';

const GREEN = 0x2ecc71;
const RED = 0xe74c3c;

export function createTrafficLights() {
  const group = new THREE.Group();

  const nsLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 16, 16),
    new THREE.MeshStandardMaterial({ color: GREEN })
  );
  nsLight.position.set(-5, 2.5, -5);
  nsLight.userData.pair = 'NS';

  const ewLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 16, 16),
    new THREE.MeshStandardMaterial({ color: RED })
  );
  ewLight.position.set(5, 2.5, -5);
  ewLight.userData.pair = 'EW';

  const poleMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
  for (const light of [nsLight, ewLight]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.5), poleMat);
    pole.position.set(light.position.x, 1.25, light.position.z);
    group.add(pole);
  }

  group.add(nsLight, ewLight);
  return { group, meshes: [nsLight, ewLight] };
}

export function updateTrafficLightColors(meshes, activePair) {
  for (const mesh of meshes) {
    const isGreen = mesh.userData.pair === activePair;
    mesh.material.color.set(isGreen ? GREEN : RED);
  }
}