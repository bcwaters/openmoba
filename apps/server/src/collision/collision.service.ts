import { Obstacle } from "../constants/map";
import { Player } from "../models/Player";
import { CollisionResult, PlayerCollisionBounds } from "./collision.model";

export class CollisionService {
  private static PLAYER_COLLISION_RADIUS = 4.5; // units (tripled from 1.5)
  
  private static obstacles: Obstacle[] = [];
  private static players: Map<string, Player> = new Map();

  public static initializeObstacles(obstacles: Obstacle[]) {
    this.obstacles = obstacles;
  }

  public static setPlayers(players: Map<string, Player>) {
    this.players = players;
  }

  public static checkPlayerPosition(player: Player, skipPlayerId?: string): CollisionResult {
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
    
    // Check player-to-player collision (skip self or specified player)
    for (const [otherId, otherPlayer] of this.players) {
      if (otherId === player.id || otherId === skipPlayerId) continue;
      
      const result = this.checkCircleVsCircle(
        { x: player.x, z: player.z },
        playerBounds.radius,
        { x: otherPlayer.x, z: otherPlayer.z },
        playerBounds.radius
      );
      
      if (result.collides) {
        return {
          ...result,
          obstacleId: `player-${otherId}`
        };
      }
    }
    
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
        console.log(`[COLLISION] ${player.id} blocked by obstacle ${obstacle.id} at (${targetX.toFixed(1)}, ${targetZ.toFixed(1)})`);
        return {
          ...result,
          obstacleId: obstacle.id
        };
      }
    }
    
    // Check player-to-player collision at target position (skip self)
    for (const [otherId, otherPlayer] of this.players) {
      if (otherId === player.id) continue;
      
      const result = this.checkCircleVsCircle(
        { x: targetX, z: targetZ },
        playerBounds.radius,
        { x: otherPlayer.x, z: otherPlayer.z },
        playerBounds.radius
      );
      
      if (result.collides) {
        console.log(`[COLLISION] ${player.id} blocked by player ${otherId} at (${targetX.toFixed(1)}, ${targetZ.toFixed(1)})`);
        return {
          ...result,
          obstacleId: `player-${otherId}`
        };
      }
    }
    
    return { collides: false };
  }
  
  public static checkBulletPosition(bullet: { x: number; z: number }, ownerId?: string): CollisionResult {
    const bulletRadius = 0.9; // tripled from 0.3
    
    // Check against all obstacles
    for (const obstacle of this.obstacles) {
      const result = this.checkCircleVsAABB(
        { x: bullet.x, z: bullet.z },
        bulletRadius,
        obstacle
      );
      
      if (result.collides) {
        return {
          ...result,
          obstacleId: obstacle.id
        };
      }
    }
    
    // Check against all players (skip owner)
    for (const [playerId, player] of this.players) {
      if (playerId === ownerId) continue;
      
      const result = this.checkCircleVsCircle(
        { x: bullet.x, z: bullet.z },
        bulletRadius,
        { x: player.x, z: player.z },
        this.PLAYER_COLLISION_RADIUS
      );
      
      if (result.collides) {
        return {
          ...result,
          obstacleId: `player-${playerId}`
        };
      }
    }
    
    return { collides: false };
  }
  
  private static checkCircleVsCircle(
    circle1: { x: number; z: number },
    radius1: number,
    circle2: { x: number; z: number },
    radius2: number
  ): CollisionResult {
    const dx = circle2.x - circle1.x;
    const dz = circle2.z - circle1.z;
    const distanceSquared = dx * dx + dz * dz;
    const combinedRadius = radius1 + radius2;
    
    if (distanceSquared < combinedRadius * combinedRadius) {
      const distance = Math.sqrt(distanceSquared);
      let normalX = 0;
      let normalZ = 0;
      
      if (distance > 0) {
        normalX = dx / distance;
        normalZ = dz / distance;
      } else {
        // Players are at exact same position - push in any direction
        normalX = 1;
        normalZ = 0;
      }
      
      return {
        collides: true,
        normalX,
        normalZ,
        penetrationDepth: combinedRadius - distance
      };
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
