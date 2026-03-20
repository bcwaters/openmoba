import { Client, Room } from "colyseus";
import { MovementIntent } from "../messages/MovementIntent";
import { Player, Team, PLAYER_TYPE_CONFIG } from "../models/Player";
import { Bullet } from "../models/Bullet";
import { MAP_BOUNDS, SPAWN_POSITIONS, OBSTACLES } from "../constants/map";
import { VisionService } from "../vision/vision.service";
import { CollisionService } from "../collision/collision.service";

export class OpenMobaRoom extends Room {
  // Store player entities
  private players: Map<string, Player> = new Map();
  // Store vision data for each player
  private visionData: Map<string, any> = new Map();
  // Store bullets
  private bullets: Map<string, Bullet> = new Map();
  private bulletIdCounter = 0;

  // Simulation tick rate (20 times per second = 50ms per tick)
  private readonly TICK_RATE = 50; // milliseconds
  private tickInterval: NodeJS.Timeout | null = null;

      public onCreate(options: any): void {
     this.maxClients = 10;
     this.setMetadata({ 
       mode: "competitive", 
       map: "prototype",
       tickRate: this.TICK_RATE
     });

      // Initialize collision service with obstacles
      CollisionService.initializeObstacles(OBSTACLES);

      // Handle movement intent messages from clients
      this.onMessage("movement-intent", (client, message) => {
        this.handleMovementIntent(client, message);
      });
      
      // Handle bullet firing messages from clients
      this.onMessage("fire-bullet", (client, message) => {
        this.handleFireBullet(client, message);
      });

      // Start the simulation loop
      this.startSimulation();
  }

  public onJoin(client: Client): void {
    const playerIndex = this.players.size;
    const playerType: 'wizard' | 'dude' = playerIndex % 2 === 0 ? 'wizard' : 'dude';
    
    const spawnPos = this.findValidSpawnPosition(playerType);
    
    const team: Team = playerType === 'wizard' ? 'red' : 'blue';
    const config = PLAYER_TYPE_CONFIG[playerType];
    const player: Player = {
      id: client.sessionId,
      x: spawnPos.x,
      y: spawnPos.y,
      z: spawnPos.z,
      speed: config.moveSpeed,
      connected: true,
      teamId: "unassigned",
      fireRate: config.fireRate,
      playerType,
      team,
      health: config.health,
      projectileSize: config.projectileSize,
      projectileDamage: config.projectileDamage,
      projectileSpeed: config.projectileSpeed,
      moveSpeed: config.moveSpeed,
      visibilityRadius: config.visibilityRadius,
      clipSize: config.clipSize,
      reloadTime: config.reloadTime,
      currentAmmo: config.clipSize,
      isReloading: false,
      spawnX: spawnPos.x,
      spawnY: spawnPos.y,
      spawnZ: spawnPos.z,
      lastActivityAt: Date.now()
    };
    
    this.players.set(client.sessionId, player);
    CollisionService.setPlayers(this.players);
    console.log(`Player ${client.sessionId} (${playerType}) spawned at`, spawnPos, 'with', config);
  }

  private findValidSpawnPosition(playerType: 'wizard' | 'dude'): { x: number; y: number; z: number } {
    const preferredPositions = playerType === 'wizard'
      ? [{ x: -80, y: 0, z: -80 }, { x: -60, y: 0, z: -60 }, { x: -80, y: 0, z: -60 }]
      : [{ x: 80, y: 0, z: 80 }, { x: 60, y: 0, z: 60 }, { x: 80, y: 0, z: 60 }];

    const candidatePositions = [...preferredPositions, ...SPAWN_POSITIONS];

    for (const pos of candidatePositions) {
      const tempPlayer: Partial<Player> = { id: 'temp', x: pos.x, z: pos.z };
      const collision = CollisionService.checkPlayerPosition(tempPlayer as Player, 'temp');
      if (!collision.collides) {
        return pos;
      }
    }

    const maxAttempts = 100;
    for (let i = 0; i < maxAttempts; i++) {
      const x = MAP_BOUNDS.minX + 10 + Math.random() * (MAP_BOUNDS.maxX - MAP_BOUNDS.minX - 20);
      const z = MAP_BOUNDS.minZ + 10 + Math.random() * (MAP_BOUNDS.maxZ - MAP_BOUNDS.minZ - 20);
      const tempPlayer: Partial<Player> = { id: 'temp', x, z };
      const collision = CollisionService.checkPlayerPosition(tempPlayer as Player, 'temp');
      if (!collision.collides) {
        console.log(`[SPAWN] Found random valid position (${x.toFixed(1)}, ${z.toFixed(1)}) after ${i + 1} attempts`);
        return { x, y: 0, z };
      }
    }

    console.warn('[SPAWN] Could not find valid spawn position, using default');
    return playerType === 'wizard' ? { x: -80, y: 0, z: -80 } : { x: 80, y: 0, z: 80 };
  }

  public onLeave(client: Client): void {
    // Remove player from simulation
    this.players.delete(client.sessionId);
    console.log(`Player ${client.sessionId} left the game`);
  }

  public onDispose(): void {
    // Clean up simulation loop
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  private handleMovementIntent(client: Client, message: MovementIntent): void {
    // Validate that the message is from the correct client
    if (message.playerId !== client.sessionId) {
      console.warn(`Movement intent from ${message.playerId} received from client ${client.sessionId}`);
      return; // Ignore - potential spoofing attempt
    }
    
    // Get the player entity
    const player = this.players.get(client.sessionId);
    if (!player) {
      console.warn(`Movement intent received for unknown player ${client.sessionId}`);
      return;
    }
    
    // Validate the target position is within bounds
    const validatedTarget = this.validatePosition({
      x: message.targetX,
      y: 0, // Assume ground level
      z: message.targetZ !== undefined ? message.targetZ : 0
    });
    
    // Set movement target
    player.targetX = validatedTarget.x;
    player.targetY = validatedTarget.y;
    player.targetZ = validatedTarget.z !== undefined ? validatedTarget.z : 0;
    player.lastActivityAt = Date.now();
    
    console.log(`Player ${client.sessionId} moving to`, validatedTarget);
  }
  
  private handleFireBullet(client: Client, message: any): void {
    const player = this.players.get(client.sessionId);
    if (!player) return;
    
    // Check fire rate cooldown
    const now = Date.now();
    const minFireInterval = 1000 / player.fireRate;
    if (player.lastFiredAt && now - player.lastFiredAt < minFireInterval) {
      return; // Still on cooldown or reloading
    }
    
    // Check if reloading
    if (player.currentAmmo < 0) {
      return; // Still reloading
    }
    
    // Check ammo
    if (player.currentAmmo <= 0) {
      return; // No ammo
    }
    
    // Fire bullet
    player.currentAmmo--;
    player.lastFiredAt = now;
    
    // Start reload if out of ammo
    if (player.currentAmmo <= 0) {
      player.currentAmmo = -1;
      player.lastFiredAt = now + (player.reloadTime * 1000);
      player.isReloading = true;
      console.log(`[RELOAD] Player ${client.sessionId} started reload.`);
    }
    
    // Use player's movement direction or default to facing right
    const dirX = message.dirX ?? player.dirX ?? 1;
    const dirZ = message.dirZ ?? player.dirZ ?? 0;
    
    // Normalize if needed
    const length = Math.sqrt(dirX * dirX + dirZ * dirZ);
    const nx = length > 0 ? dirX / length : 1;
    const nz = length > 0 ? dirZ / length : 0;
    
    const bulletId = `bullet-${this.bulletIdCounter++}`;
    const bullet: Bullet = {
      id: bulletId,
      x: player.x,
      y: 9,
      z: player.z,
      dirX: nx,
      dirZ: nz,
      speed: player.projectileSpeed,
      ownerId: client.sessionId,
      createdAt: Date.now(),
      team: player.team,
      projectileDamage: player.projectileDamage
    };
    
    this.bullets.set(bulletId, bullet);
    player.lastActivityAt = now;
    console.log(`Player ${client.sessionId} fired bullet ${bulletId} (damage: ${player.projectileDamage}) in direction (${nx.toFixed(2)}, ${nz.toFixed(2)})`);
  }

  private startSimulation(): void {
    // Fixed-tick simulation loop
    this.tickInterval = setInterval(() => {
      this.updateSimulation();
    }, this.TICK_RATE);
  }

  private updateSimulation(): void {
    const deltaTime = this.TICK_RATE / 1000; // Convert to seconds
    const now = Date.now();
    const IDLE_TIMEOUT_MS = 60000;
    
    // Check reload completion for all players
    for (const [, player] of this.players.entries()) {
      if (player.currentAmmo < 0 && player.lastFiredAt <= now) {
        player.currentAmmo = player.clipSize;
        player.isReloading = false;
        console.log(`[RELOAD] Player ${player.id} reload complete. Ammo: ${player.currentAmmo}`);
      }
    }
    
    // Check for idle players
    for (const [sessionId, player] of this.players.entries()) {
      if (now - player.lastActivityAt > IDLE_TIMEOUT_MS) {
        console.log(`[IDLE] Player ${sessionId} removed for inactivity (${((now - player.lastActivityAt) / 1000).toFixed(0)}s idle)`);
        this.players.delete(sessionId);
      }
    }
    
    // Update player list for collision detection
    CollisionService.setPlayers(this.players);
    
    // Update each player's position based on movement intent
    for (const [sessionId, player] of this.players.entries()) {
      // If player has a target, move towards it
      if (player.targetX !== undefined && player.targetY !== undefined && player.targetZ !== undefined) {
        // Calculate direction vector
        const dx = player.targetX - player.x;
        const dz = player.targetZ - player.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        // Store normalized direction for rendering (flipped for client orientation)
        if (distance > 0.1) {
          player.dirX = -dx / distance;
          player.dirZ = -dz / distance;
        }
        
        // If we're close enough to target, snap to target and clear it
        if (distance < 0.1) {
          player.x = player.targetX;
          player.z = player.targetZ;
          player.targetX = undefined;
          player.targetY = undefined;
          player.targetZ = undefined;
          player.dirX = undefined;
          player.dirZ = undefined;
        } else {
          // Move towards target at player's speed
          const moveDistance = player.speed * deltaTime;
          if (moveDistance >= distance) {
            // We can reach the target this tick - check for collision first
            const collisionResult = CollisionService.checkMovementIntent(player, player.targetX, player.targetZ);
            if (!collisionResult.collides) {
              player.x = player.targetX;
              player.z = player.targetZ;
              player.targetX = undefined;
              player.targetY = undefined;
              player.targetZ = undefined;
              player.dirX = undefined;
              player.dirZ = undefined;
              console.log(`[MOVE] ${player.id} reached target (${player.x.toFixed(1)}, ${player.z.toFixed(1)})`);
            }
            // If collision, don't move and keep trying (or could implement sliding)
          } else {
            // Move partway towards target - check for collision at the new position
            const moveX = (dx / distance) * moveDistance;
            const moveZ = (dz / distance) * moveDistance;
            
            const newX = player.x + moveX;
            const newZ = player.z + moveZ;
            
            // Check collision at new position
            const tempPlayer: Player = {
              id: "temp",
              x: newX,
              y: 0,
              z: newZ,
              speed: player.speed,
              connected: true
            };
            
            const collisionResult = CollisionService.checkPlayerPosition(tempPlayer, sessionId);
            if (!collisionResult.collides) {
              // Validate new position is within bounds and update if no collision
              const validatedPos = this.validatePosition({ x: newX, y: 0, z: newZ });
              player.x = validatedPos.x;
              player.z = validatedPos.z;
              // Only log occasionally to avoid spam
              if (Math.random() < 0.05) {
                console.log(`[MOVE] ${player.id} moving to (${player.x.toFixed(1)}, ${player.z.toFixed(1)})`);
              }
            } else {
              // Only log when blocked to avoid spam
              if (Math.random() < 0.1) {
                console.log(`[BLOCKED] ${player.id} at (${player.x.toFixed(1)}, ${player.z.toFixed(1)}) blocked by ${collisionResult.obstacleId}`);
              }
            }
            // If collision, don't move this tick (could implement sliding later)
          }
        }
      }
    }
    
    // Update bullet positions
    this.updateBullets(deltaTime);
    
    // Calculate vision for each player
    this.updateVisionData();
    
    // Broadcast updated state to clients (per-client filtering)
    this.broadcastPlayerPositions();
    this.broadcastBullets();
  }
  
  private updateBullets(deltaTime: number): void {
    const toRemove: string[] = [];
    const maxDistance = 500; // Remove bullets after traveling this far
    
    for (const [bulletId, bullet] of this.bullets.entries()) {
      // Move bullet
      bullet.x += bullet.dirX * bullet.speed * deltaTime;
      bullet.z += bullet.dirZ * bullet.speed * deltaTime;
      
      // Check if bullet is out of bounds or too old
      const age = Date.now() - bullet.createdAt;
      const distFromOrigin = Math.sqrt(
        Math.pow(bullet.x - (-80), 2) + Math.pow(bullet.z - (-80), 2)
      );
      
      if (bullet.x < MAP_BOUNDS.minX || bullet.x > MAP_BOUNDS.maxX ||
          bullet.z < MAP_BOUNDS.minZ || bullet.z > MAP_BOUNDS.maxZ ||
          age > 5000) { // 5 second max lifetime
        toRemove.push(bulletId);
        continue;
      }
      
      // Check bullet vs obstacles and players
      const collisionResult = CollisionService.checkBulletPosition(bullet, bullet.ownerId);
      if (collisionResult.collides) {
        const obstacleId = collisionResult.obstacleId;
        
        if (obstacleId?.startsWith('player-')) {
          const hitPlayerId = obstacleId.replace('player-', '');
          const hitPlayer = this.players.get(hitPlayerId);
          
          if (hitPlayer && hitPlayer.team !== bullet.team) {
            hitPlayer.health = Math.max(0, hitPlayer.health - bullet.projectileDamage);
            console.log(`[BULLET] ${bulletId} hit player ${hitPlayerId} (${hitPlayer.team}) for ${bullet.projectileDamage} damage. Health: ${hitPlayer.health}`);
            
            if (hitPlayer.health <= 0) {
              const config = PLAYER_TYPE_CONFIG[hitPlayer.playerType];
              const newSpawnPos = this.findValidSpawnPosition(hitPlayer.playerType);
              hitPlayer.x = newSpawnPos.x;
              hitPlayer.y = newSpawnPos.y;
              hitPlayer.z = newSpawnPos.z;
              hitPlayer.spawnX = newSpawnPos.x;
              hitPlayer.spawnY = newSpawnPos.y;
              hitPlayer.spawnZ = newSpawnPos.z;
              hitPlayer.health = config.health;
              hitPlayer.targetX = undefined;
              hitPlayer.targetY = undefined;
              hitPlayer.targetZ = undefined;
              console.log(`[RESPAWN] Player ${hitPlayerId} respawned at (${newSpawnPos.x}, ${newSpawnPos.z})`);
            }
          }
        } else {
          console.log(`[BULLET] ${bulletId} hit ${obstacleId}`);
        }
        
        toRemove.push(bulletId);
      }
    }
    
    // Remove expired/bad bullets
    for (const id of toRemove) {
      this.bullets.delete(id);
    }
  }
  
  private broadcastBullets(): void {
    const bulletsArray = Array.from(this.bullets.values()).map(b => ({
      id: b.id,
      x: b.x,
      y: b.y,
      z: b.z,
      dirX: b.dirX,
      dirZ: b.dirZ,
      ownerId: b.ownerId
    }));
    
    this.broadcast("bullets", { bullets: bulletsArray });
  }

  private updateVisionData(): void {
    const roomState = { players: this.players, visionData: this.visionData };
    for (const [sessionId, player] of this.players.entries()) {
      const vision = VisionService.calculatePlayerVision(player, roomState);
      this.visionData.set(sessionId, vision);
    }
  }

  private getVisibleEntityIdsForPlayer(playerId: string): string[] {
    const roomState = { players: this.players, visionData: this.visionData };
    return VisionService.getVisibleEntities(playerId, roomState);
  }

  private validatePosition(position: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
    // Clamp position to map bounds
    const clampedX = Math.max(MAP_BOUNDS.minX, Math.min(MAP_BOUNDS.maxX, position.x));
    const clampedZ = Math.max(MAP_BOUNDS.minZ, Math.min(MAP_BOUNDS.maxZ, position.z));
    
    // For top-down, Y is typically height (0 for ground)
    const clampedY = 0; // Keep on ground
    
    // Create temporary player for collision check
    const tempPlayer: Player = {
      id: "temp",
      x: clampedX,
      y: clampedY,
      z: clampedZ,
      speed: 0,
      connected: true
    };
    
    // Check for collisions with obstacles
    const collisionResult = CollisionService.checkPlayerPosition(tempPlayer);
    if (collisionResult.collides) {
      // If there's a collision, return the original position (movement will be rejected elsewhere)
      // In a more advanced implementation, we would slide along the obstacle normal
      return { x: position.x, y: position.y, z: position.z };
    }
    
    return { x: clampedX, y: clampedY, z: clampedZ };
  }

  private getPlayerStateForClient(sessionId: string): any {
    const player = this.players.get(sessionId);
    if (!player) return null;
    
    return {
      sessionId,
      x: player.x,
      y: player.y,
      z: player.z,
      connected: player.connected,
      targetX: player.targetX !== undefined ? player.targetX : player.x,
      targetY: player.targetY !== undefined ? player.targetY : player.y,
      targetZ: player.targetZ !== undefined ? player.targetZ : player.z,
      isLocal: true // This will be the client's own player
    };
  }

  private broadcastPlayerPositions(): void {
    if (!this.clients) return;
    
    this.clients.forEach((client) => {
      const sessionId = client.sessionId;
      const player = this.players.get(sessionId);
      if (!player) return;

      const visibleEntityIds = this.getVisibleEntityIdsForPlayer(sessionId);

      const filteredPlayersState = Array.from(this.players.entries()).map(([id, otherPlayer]) => {
        if (id === sessionId) {
          return {
            sessionId: id,
            x: otherPlayer.x,
            y: otherPlayer.y,
            z: otherPlayer.z,
            connected: otherPlayer.connected,
            playerType: otherPlayer.playerType,
            health: otherPlayer.health,
            projectileSize: otherPlayer.projectileSize,
            currentAmmo: otherPlayer.currentAmmo,
            isReloading: otherPlayer.isReloading
          };
        }

        if (visibleEntityIds.includes(id)) {
          return {
            sessionId: id,
            x: otherPlayer.x,
            y: otherPlayer.y,
            z: otherPlayer.z,
            connected: otherPlayer.connected,
            dirX: otherPlayer.dirX ?? 0,
            dirZ: otherPlayer.dirZ ?? 0,
            playerType: otherPlayer.playerType,
            health: otherPlayer.health,
            projectileSize: otherPlayer.projectileSize,
            currentAmmo: otherPlayer.currentAmmo,
            isReloading: otherPlayer.isReloading
          };
        }

        return null;
      }).filter((player): player is { sessionId: string; x: number; y: number; z: number; connected: boolean; dirX?: number; dirZ?: number; playerType: string; health: number; projectileSize: number; currentAmmo: number; isReloading: boolean } => 
                player !== null);

      client.send("player-positions", { 
        players: filteredPlayersState, 
        visibleRadius: player.visibilityRadius,
        obstacles: OBSTACLES
      });
    });
  }
}