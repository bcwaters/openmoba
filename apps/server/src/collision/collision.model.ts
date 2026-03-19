export interface Obstacle {
  id: string;
  x: number;      // center X position
  z: number;      // center Z position
  width: number;  // width along X axis
  height: number; // height along Z axis
}

export interface CollisionResult {
  collides: boolean;
  obstacleId?: string;
  normalX?: number; // collision normal for slide/resolution
  normalZ?: number;
  penetrationDepth?: number;
}

export interface PlayerCollisionBounds {
  radius: number; // collision radius around player
}
