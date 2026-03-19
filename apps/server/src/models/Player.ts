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
}