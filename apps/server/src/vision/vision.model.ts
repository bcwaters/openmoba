export interface VisionModel {
  /** Radius of vision around a player (in world units) */
  radius: number;
  
  /** Whether vision is individual or team-based */
  isTeamBased: boolean;
  
  /** Position of the vision owner */
  ownerPosition: { x: number; y: number; z: number };
  
  /** Timestamp of last vision update */
  lastUpdated: number;
  
  /** Calculated visible area (could be a set of grid cells or a polygon) */
  visibleArea: Array<{ x: number; z: number }>;
}