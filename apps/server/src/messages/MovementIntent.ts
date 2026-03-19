export interface MovementIntent {
  playerId: string; // ID of the player sending the intent
  targetX: number; // Target world position X
  targetY: number; // Target world position Y (for top-down, this might be Z)
  targetZ?: number; // Optional Z if using 3D coordinates
  timestamp: number; // Timestamp for interpolation/prediction
}