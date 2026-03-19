import { VisionModel } from './vision.model';
import { Player } from '../models/Player';
import { OpenMobaRoomState } from '../models/RoomState';

export class VisionService {
  private static DEFAULT_VISION_RADIUS = 100.0;
  
  static calculatePlayerVision(player: Player, roomState: OpenMobaRoomState): VisionModel {
    const isTeamBased = !!player.teamId && player.teamId !== "unassigned";
    
    const vision: VisionModel = {
      radius: this.DEFAULT_VISION_RADIUS,
      isTeamBased: isTeamBased,
      ownerPosition: { x: player.x, y: player.y, z: player.z },
      lastUpdated: Date.now(),
      visibleArea: []
    };

    const visionPoints = this.generateCircleVision(player.x, player.z, vision.radius);
    vision.visibleArea = visionPoints;

    return vision;
  }
  
  private static generateCircleVision(cx: number, cz: number, radius: number, points: number = 16): Array<{ x: number; z: number }> {
    const visionPoints: Array<{ x: number; z: number }> = [];
    
    for (let i = 0; i < points; i++) {
      const angle = (i / points) * 2 * Math.PI;
      const x = cx + radius * Math.cos(angle);
      const z = cz + radius * Math.sin(angle);
      visionPoints.push({ x, z });
    }
    
    return visionPoints;
  }
  
  static getVisibleEntities(playerId: string, roomState: OpenMobaRoomState): string[] {
    const player = roomState.players.get(playerId);
    if (!player) return [];

    const vision = this.calculatePlayerVision(player, roomState);
    const visibleEntities: string[] = [];

    for (const [id, otherPlayer] of roomState.players.entries()) {
      if (id === playerId) {
        visibleEntities.push(id);
        continue;
      }

      const isVisible = this.isEntityVisible(player, otherPlayer, vision);
      if (isVisible) {
        visibleEntities.push(id);
      }
    }

    return visibleEntities;
  }

  private static isEntityVisible(viewer: Player, target: Player, vision: VisionModel): boolean {
    if (viewer.id === target.id) {
      return true;
    }

    const dx = target.x - viewer.x;
    const dz = target.z - viewer.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    if (distance > vision.radius) {
      return false;
    }

    if (!vision.isTeamBased) {
      return true;
    }

    return viewer.teamId === target.teamId;
  }
}
