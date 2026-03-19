export const MAP_BOUNDS = {
  minX: -100,
  maxX: 100,
  minY: 0,   // assuming Y is height, but for top-down we might not use Y for movement? 
  maxY: 20,  // Actually, let's assume 2D top-down: X and Z, with Y as height (0 for ground)
  minZ: -100,
  maxZ: 100
};

// For simplicity, we'll use X and Z for position, and Y for height (always 0 on ground)
// We can adjust later if we need vertical movement.


export const OBSTACLES = [
  // Outer boundary walls
  { id: "wall-north", x: 0, z: 100, width: 200, height: 10 }, // North wall
  { id: "wall-south", x: 0, z: -100, width: 200, height: 10 }, // South wall
  { id: "wall-east", x: 100, z: 0, width: 10, height: 200 }, // East wall
  { id: "wall-west", x: -100, z: 0, width: 10, height: 200 }, // West wall
  
  // Some internal obstacles for testing
  { id: "obstacle-1", x: -20, z: 0, width: 15, height: 15 },
  { id: "obstacle-2", x: 20, z: -30, width: 20, height: 20 },
  { id: "obstacle-3", x: 40, z: 40, width: 10, height: 30 },
  { id: "obstacle-4", x: -60, z: 20, width: 25, height: 10 },
];

// Helper type for obstacle data
export interface Obstacle {
  id: string;
  x: number;      // center X position
  z: number;      // center Z position
  width: number;  // width along X axis
  height: number; // height along Z axis
}


export const SPAWN_POSITIONS = [
  { x: -80, y: 0, z: -80 },
  { x: 80, y: 0, z: -80 },
  { x: -80, y: 0, z: 80 },
  { x: 80, y: 0, z: 80 },
  { x: 0, y: 0, z: 0 },
  { x: -40, y: 0, z: 40 },
  { x: 40, y: 0, z: -40 },
  { x: -60, y: 0, z: 60 },
  { x: 60, y: 0, z: -60 },
  { x: 20, y: 0, z: 20 }
];
