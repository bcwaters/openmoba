export type PlayerType = 'wizard' | 'dude';
export type Team = 'red' | 'blue';

export const PLAYER_TYPE_CONFIG: Record<PlayerType, { health: number; projectileSize: number; fireRate: number; projectileDamage: number; projectileSpeed: number; moveSpeed: number; visibilityRadius: number; clipSize: number; reloadTime: number }> = {
  wizard: { health: 70, projectileSize: 5, fireRate: 1, projectileDamage: 20, projectileSpeed: 30, moveSpeed: 18, visibilityRadius: 100, clipSize: 5, reloadTime: 1 },
  dude: { health: 100, projectileSize: 3, fireRate: 2, projectileDamage: 10, projectileSpeed: 45, moveSpeed: 15, visibilityRadius: 80, clipSize: 15, reloadTime: 3 }
};

export interface Player {
  id: string; // player/session identifier
  x: number; // current position
  y: number;
  z: number; // assuming 3D but could be 2D for top-down
  targetX?: number; // movement target/intent
  targetY?: number;
  targetZ?: number;
  speed: number; // movement speed
  connected: boolean; // connection or activity status
  teamId?: string; // team or faction placeholder
  dirX?: number; // movement direction X (-1 to 1)
  dirZ?: number; // movement direction Z (-1 to 1)
  fireRate: number; // projectiles per second
  lastFiredAt?: number; // timestamp of last shot
  playerType: PlayerType;
  team: Team;
  health: number;
  projectileSize: number;
  projectileDamage: number;
  projectileSpeed: number;
  moveSpeed: number;
  visibilityRadius: number;
  clipSize: number;
  reloadTime: number;
  currentAmmo: number;
  isReloading: boolean;
  spawnX: number;
  spawnY: number;
  spawnZ: number;
}