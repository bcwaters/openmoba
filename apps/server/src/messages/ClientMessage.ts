export type ClientMessage =
  | { type: 'movement-intent'; payload: MovementIntent }
// Add other message types as needed
  | { type: 'ping'; payload: { timestamp: number } };

export interface MovementIntent {
  playerId: string;
  targetX: number;
  targetY: number;
  targetZ?: number;
  timestamp: number;
}