export interface Bullet {
  id: string;
  x: number;
  y: number;
  z: number;
  dirX: number; // normalized direction
  dirZ: number;
  speed: number;
  ownerId: string; // player who fired
  createdAt: number;
}
