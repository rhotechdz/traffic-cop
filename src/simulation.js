// Pure game-state logic — no Three.js, no DOM. Testable with plain node.

export const LANE_OFFSET = 1.5;
export const INTERSECTION_HALF = 3;
export const CAR_LENGTH = 3;
export const CAR_WIDTH = 1.6;
export const CAR_GAP = 1.5;
export const CAR_SPEED = 6; // units/sec
export const SPAWN_S = -30;
export const DESPAWN_S = 30;
export const STOP_S = -(INTERSECTION_HALF + CAR_LENGTH / 2 + 0.3);

export const DIRECTION_INFO = {
  N: { axis: 'z', sign: -1, lane: -LANE_OFFSET, pair: 'NS' },
  S: { axis: 'z', sign: 1, lane: LANE_OFFSET, pair: 'NS' },
  E: { axis: 'x', sign: 1, lane: -LANE_OFFSET, pair: 'EW' },
  W: { axis: 'x', sign: -1, lane: LANE_OFFSET, pair: 'EW' },
};

let nextId = 1;
export function resetIdCounter() {
  nextId = 1;
}

export function createCar(direction) {
  return { id: nextId++, direction, s: SPAWN_S };
}

export function carWorldPosition(car) {
  const info = DIRECTION_INFO[car.direction];
  const travel = info.sign * car.s;
  return info.axis === 'z' ? { x: info.lane, z: travel } : { x: travel, z: info.lane };
}

function halfExtents(direction) {
  const info = DIRECTION_INFO[direction];
  return info.axis === 'z'
    ? { x: CAR_WIDTH / 2, z: CAR_LENGTH / 2 }
    : { x: CAR_LENGTH / 2, z: CAR_WIDTH / 2 };
}

function boxesOverlap(a, b) {
  const pa = carWorldPosition(a);
  const pb = carWorldPosition(b);
  const ha = halfExtents(a.direction);
  const hb = halfExtents(b.direction);
  return Math.abs(pa.x - pb.x) < ha.x + hb.x && Math.abs(pa.z - pb.z) < ha.z + hb.z;
}

export function stepSimulation(cars, lightState, delta) {
  const byDirection = { N: [], S: [], E: [], W: [] };
  for (const car of cars) byDirection[car.direction].push(car);
  for (const dir of Object.keys(byDirection)) {
    byDirection[dir].sort((a, b) => b.s - a.s); // leader (largest s) first
  }

  for (const dir of Object.keys(byDirection)) {
    const lane = byDirection[dir];
    const info = DIRECTION_INFO[dir];
    const otherPair = info.pair === 'NS' ? 'EW' : 'NS';

    // All-red clearance: if a car from the other pair is still inside/
    // transiting the box, treat this direction as red even on its nominal green.
    const intersectionBusy = cars.some(
      (c) => DIRECTION_INFO[c.direction].pair === otherPair && c.s > STOP_S && c.s < -STOP_S
    );
    const isGreen = lightState === info.pair && !intersectionBusy;

    for (let i = 0; i < lane.length; i++) {
      const car = lane[i];
      const leader = lane[i - 1];
      let desired = car.s + CAR_SPEED * delta;

      if (!isGreen && car.s <= STOP_S) {
        desired = Math.min(desired, STOP_S);
      }
      if (leader) {
        desired = Math.min(desired, leader.s - (CAR_LENGTH + CAR_GAP));
      }
      car.s = Math.max(car.s, desired);
    }
  }

  let collided = false;
  const active = cars.filter((c) => c.s > SPAWN_S && c.s < DESPAWN_S);
  for (let i = 0; i < active.length && !collided; i++) {
    for (let j = i + 1; j < active.length; j++) {
      if (active[i].direction === active[j].direction) continue;
      if (boxesOverlap(active[i], active[j])) {
        collided = true;
        break;
      }
    }
  }

  const removedIds = cars.filter((c) => c.s >= DESPAWN_S).map((c) => c.id);
  return { removedIds, collided };
}