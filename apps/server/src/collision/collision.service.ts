import { Obstacle } from "../constants/map";
import { Player } from "../models/Player";
import { CollisionResult, PlayerCollisionBounds } from "./collision.model";

export class CollisionService {
  private static PLAYER_COLLISION_RADIUS = 1.0; // units
  
  private static obstacles: Obstacle[] = [];

  public static initializeObstacles(obstacles: Obstacle[]) {
    this.obstacles = obstacles;
  }

  public static checkPlayerPosition(player: Player): CollisionResult {
    const playerBounds: PlayerCollisionBounds = {
      radius: this.PLAYER_COLLISION_RADIUS
    };
    
    // Check against all obstacles
    for (const obstacle of this.obstacles) {
      const result = this.checkCircleVsAABB(
        { x: player.x, z: player.z },
        playerBounds.radius,
        obstacle
      );
      
      if (result.collides) {
        return {
          ...result,
          obstacleId: obstacle.id
        };
      }
    }
    
    // Check player-to-player collision would be handled separately
    // in the movement validation logic
    
    return { collides: false };
  }

  public static checkMovementIntent(player: Player, targetX: number, targetZ: number): CollisionResult {
    // Check if the path from current position to target would collide
    // Simple approach: check the target position
    const playerBounds: PlayerCollisionBounds = {
      radius: this.PLAYER_COLLISION_RADIUS
    };
    
    // Check against all obstacles at target position
    for (const obstacle of this.obstacles) {
      const result = this.checkCircleVsAABB(
        { x: targetX, z: targetZ },
        playerBounds.radius,
        obstacle
      );
      
      if (result.collides) {
        return {
          ...result,
          obstacleId: obstacle.id
        };
      }
    }
    
    return { collides: false };
  }

  private static checkCircleVsAABB(
    circle: { x: number; z: number },
    radius: number,
    obstacle: Obstacle
  ): CollisionResult {
    // Find the closest point on the AABB to the circle center
    const closestX = Math.max(obstacle.x - obstacle.width / 2, 
                             Math.min(circle.x, obstacle.x + obstacle.width / 2));
    const closestZ = Math.max(obstacle.z - obstacle.height / 2, 
                             Math.min(circle.z, obstacle.z + obstacle.height / 2));
    
    // Calculate distance from circle center to closest point
    const distanceX = circle.x - closestX;
    const distanceZ = circle.z - closestZ;
    const distanceSquared = (distanceX * distanceX) + (distanceZ * distanceZ);
    
    // Check if collision occurred
    if (distanceSquared < radius * radius) {
      const distance = Math.sqrt(distanceSquared);
      
      // Calculate collision normal and penetration depth
      let normalX = 0;
      let normalZ = 0;
      let penetrationDepth = radius - distance;
      
      if (distance > 0) {
        normalX = distanceX / distance;
        normalZ = distanceZ / distance;
      } else {
        // Circle center is inside the AABB - push out in any direction
        // Find the closest edge
        const dx1 = circle.x - (obstacle.x - obstacle.width / 2);
        const dx2 = (obstacle.x + obstacle.width / 2) - circle.x;
        const dz1 = circle.z - (obstacle.z - obstacle.height / 2);
        const dz2 = (obstacle.z + obstacle.height / 2) - circle.z;
        
        const minDX = Math.min(dx1, dx2);
        const minDZ = Math.min(dz1, dz2);
        
        if (minDX < minDZ) {
          normalX = (dx1 < dx2) ? -1 : 1;
          normalZ = 0;
        } else {
          normalX = 0;
          normalZ = (dz1 < dz2) ? -1 : 1;
        }
        penetrationDepth = radius + Math.min(minDX, minDZ, 0.001);
      }
      
      return {
        collides: true,
        normalX,
        normalZ,
        penetrationDepth
      };
    }
    
    return { collides: false };
  }
}
