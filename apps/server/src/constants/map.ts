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
  { id: "wall-north", x: 0, z: 100, width: 200, height: 10 },
  { id: "wall-south", x: 0, z: -100, width: 200, height: 10 },
  { id: "wall-east", x: 100, z: 0, width: 10, height: 200 },
  { id: "wall-west", x: -100, z: 0, width: 10, height: 200 },
  
  // Maze walls - horizontal sections
  { id: "wall-h1", x: -50, z: -20, width: 60, height: 8 },
  { id: "wall-h2", x: 30, z: -20, width: 40, height: 8 },
  { id: "wall-h3", x: -70, z: 20, width: 40, height: 8 },
  { id: "wall-h4", x: 0, z: 30, width: 50, height: 8 },
  { id: "wall-h5", x: 60, z: 40, width: 50, height: 8 },
  { id: "wall-h6", x: -40, z: 60, width: 60, height: 8 },
  { id: "wall-h7", x: 20, z: 70, width: 40, height: 8 },
  { id: "wall-h8", x: -80, z: -50, width: 30, height: 8 },
  { id: "wall-h9", x: 70, z: -60, width: 40, height: 8 },
  
  // Maze walls - vertical sections
  { id: "wall-v1", x: -20, z: 0, width: 8, height: 40 },
  { id: "wall-v2", x: 40, z: -40, width: 8, height: 50 },
  { id: "wall-v3", x: -60, z: -40, width: 8, height: 30 },
  { id: "wall-v4", x: 70, z: 0, width: 8, height: 40 },
  { id: "wall-v5", x: -80, z: 50, width: 8, height: 40 },
  { id: "wall-v6", x: -30, z: -70, width: 8, height: 40 },
  { id: "wall-v7", x: 50, z: 60, width: 8, height: 30 },
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
