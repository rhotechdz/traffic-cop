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
  return { id: nextId++, direction, s: SPAWN_S, v: 0 };
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
      let targetSpeed = CAR_SPEED;

      if (!isGreen && car.s <= STOP_S) {
        const distanceToStop = STOP_S - car.s;
        targetSpeed = distanceToStop > 0 ? Math.min(targetSpeed, Math.max(0, distanceToStop * 1.8)) : 0;
      }

      if (leader) {
        const gap = leader.s - car.s - (CAR_LENGTH + CAR_GAP);
        targetSpeed = Math.min(targetSpeed, Math.max(0, gap * 2.4));
      }

      const acceleration = targetSpeed > car.v ? 10 : 18;
      const deceleration = targetSpeed < car.v ? 16 : 10;

      if (targetSpeed > car.v) {
        car.v = Math.min(targetSpeed, car.v + acceleration * delta);
      } else {
        car.v = Math.max(targetSpeed, car.v - deceleration * delta);
      }

      car.s += car.v * delta;
    }
  }

  let collided = false;
  let nearMiss = false;
  const active = cars.filter((c) => c.s > SPAWN_S && c.s < DESPAWN_S);
  for (let i = 0; i < active.length && !collided; i++) {
    for (let j = i + 1; j < active.length; j++) {
      if (active[i].direction === active[j].direction) continue;

      const pa = carWorldPosition(active[i]);
      const pb = carWorldPosition(active[j]);
      const ha = halfExtents(active[i].direction);
      const hb = halfExtents(active[j].direction);
      const nearThreshold = {
        x: ha.x + hb.x + 0.7,
        z: ha.z + hb.z + 0.7,
      };

      const isNearMiss =
        Math.abs(pa.x - pb.x) < nearThreshold.x && Math.abs(pa.z - pb.z) < nearThreshold.z;
      if (isNearMiss && !boxesOverlap(active[i], active[j])) {
        nearMiss = true;
      }

      if (boxesOverlap(active[i], active[j])) {
        collided = true;
        break;
      }
    }
  }

  const removedIds = cars.filter((c) => c.s >= DESPAWN_S).map((c) => c.id);
  return { removedIds, collided, nearMiss };
}