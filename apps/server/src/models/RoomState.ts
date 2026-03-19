import { Player } from "./Player";

export interface OpenMobaRoomState {
  players: Map<string, Player>;
  // Vision data for each player
  visionData: Map<string, any>;
  // Match metadata could go here
  matchId?: string;
  mapName?: string;
}