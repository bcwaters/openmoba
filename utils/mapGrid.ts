import { MAP_BOUNDS, OBSTACLES, Obstacle } from "../apps/server/src/constants/map";

export interface GridConfig {
  cellSize: number;
  width: number;
  height: number;
  originX: number;
  originZ: number;
}

export interface GridCell {
  x: number;
  z: number;
  blocked: boolean;
}

export function createDefaultGridConfig(cellSize: number = 1): GridConfig {
  return {
    cellSize,
    width: Math.ceil((MAP_BOUNDS.maxX - MAP_BOUNDS.minX) / cellSize),
    height: Math.ceil((MAP_BOUNDS.maxZ - MAP_BOUNDS.minZ) / cellSize),
    originX: MAP_BOUNDS.minX,
    originZ: MAP_BOUNDS.minZ,
  };
}

export function worldToGrid(worldX: number, worldZ: number, config: GridConfig): { col: number; row: number } {
  const col = Math.floor((worldX - config.originX) / config.cellSize);
  const row = Math.floor((worldZ - config.originZ) / config.cellSize);
  return { col, row };
}

export function gridToWorld(col: number, row: number, config: GridConfig): { x: number; z: number } {
  const x = config.originX + col * config.cellSize + config.cellSize / 2;
  const z = config.originZ + row * config.cellSize + config.cellSize / 2;
  return { x, z };
}

export function createOccupancyGrid(config: GridConfig = createDefaultGridConfig(1)): boolean[][] {
  const grid: boolean[][] = [];

  for (let row = 0; row < config.height; row++) {
    grid[row] = [];
    for (let col = 0; col < config.width; col++) {
      const { x, z } = gridToWorld(col, row, config);
      const blocked = isPointBlocked(x, z, OBSTACLES);
      grid[row][col] = blocked;
    }
  }

  return grid;
}

export function isPointBlocked(x: number, z: number, obstacles: Obstacle[]): boolean {
  for (const obs of obstacles) {
    const halfW = obs.width / 2;
    const halfH = obs.height / 2;
    if (
      x >= obs.x - halfW && x <= obs.x + halfW &&
      z >= obs.z - halfH && z <= obs.z + halfH
    ) {
      return true;
    }
  }
  return false;
}

export function obstaclesFromGrid(
  grid: boolean[][],
  config: GridConfig,
  mergeAdjacent: boolean = true
): Obstacle[] {
  const obstacles: Obstacle[] = [];
  const visited: boolean[][] = grid.map(row => row.map(() => false));

  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      if (grid[row][col] && !visited[row][col]) {
        const region = floodFill(grid, visited, col, row);
        const bounds = getRegionBounds(region, config);
        obstacles.push({
          id: `generated-${obstacles.length}`,
          x: bounds.centerX,
          z: bounds.centerZ,
          width: bounds.width,
          height: bounds.height,
        });
      }
    }
  }

  return mergeAdjacent ? mergeObstacles(obstacles) : obstacles;
}

function floodFill(
  grid: boolean[][],
  visited: boolean[][],
  startCol: number,
  startRow: number
): { col: number; row: number }[] {
  const region: { col: number; row: number }[] = [];
  const stack: { col: number; row: number }[] = [{ col: startCol, row: startRow }];

  while (stack.length > 0) {
    const { col, row } = stack.pop()!;

    if (
      col < 0 || col >= grid[0].length ||
      row < 0 || row >= grid.length ||
      visited[row][col] ||
      !grid[row][col]
    ) {
      continue;
    }

    visited[row][col] = true;
    region.push({ col, row });

    stack.push({ col: col + 1, row });
    stack.push({ col: col - 1, row });
    stack.push({ col, row: row + 1 });
    stack.push({ col, row: row - 1 });
  }

  return region;
}

function getRegionBounds(
  region: { col: number; row: number }[],
  config: GridConfig
): { minCol: number; maxCol: number; minRow: number; maxRow: number; centerX: number; centerZ: number; width: number; height: number } {
  let minCol = Infinity, maxCol = -Infinity;
  let minRow = Infinity, maxRow = -Infinity;

  for (const cell of region) {
    minCol = Math.min(minCol, cell.col);
    maxCol = Math.max(maxCol, cell.col);
    minRow = Math.min(minRow, cell.row);
    maxRow = Math.max(maxRow, cell.row);
  }

  const widthCells = maxCol - minCol + 1;
  const heightCells = maxRow - minRow + 1;
  const centerCol = minCol + widthCells / 2;
  const centerRow = minRow + heightCells / 2;
  const { x, z } = gridToWorld(centerCol, centerRow, config);

  return {
    minCol,
    maxCol,
    minRow,
    maxRow,
    centerX: x,
    centerZ: z,
    width: widthCells * config.cellSize,
    height: heightCells * config.cellSize,
  };
}

function mergeObstacles(obstacles: Obstacle[]): Obstacle[] {
  if (obstacles.length <= 1) return obstacles;

  let merged = true;
  let result = [...obstacles];

  while (merged) {
    merged = false;
    const newResult: Obstacle[] = [];

    for (const obs of result) {
      if (!obs) continue;

      for (let i = 0; i < newResult.length; i++) {
        if (!newResult[i]) continue;

        const mergedObs = tryMergePair(obs, newResult[i]);
        if (mergedObs) {
          newResult[i] = mergedObs;
          obs.id = ""; // mark for removal
          merged = true;
          break;
        }
      }

      if (obs.id) {
        newResult.push(obs);
      }
    }

    result = newResult;
  }

  return result.map((obs, i) => ({ ...obs, id: `obstacle-${i}` }));
}

function tryMergePair(a: Obstacle, b: Obstacle): Obstacle | null {
  const threshold = 0.1;

  if (Math.abs(a.z - b.z) < threshold && Math.abs(a.height - b.height) < threshold) {
    const minX = Math.min(a.x - a.width / 2, b.x - b.width / 2);
    const maxX = Math.max(a.x + a.width / 2, b.x + b.width / 2);
    const sameRow = Math.abs((a.x + b.x) / 2 - (minX + maxX) / 2) < threshold;

    if (sameRow) {
      return {
        id: a.id,
        x: (minX + maxX) / 2,
        z: a.z,
        width: maxX - minX,
        height: a.height,
      };
    }
  }

  if (Math.abs(a.x - b.x) < threshold && Math.abs(a.width - b.width) < threshold) {
    const minZ = Math.min(a.z - a.height / 2, b.z - b.height / 2);
    const maxZ = Math.max(a.z + a.height / 2, b.z + b.height / 2);
    const sameCol = Math.abs((a.z + b.z) / 2 - (minZ + maxZ) / 2) < threshold;

    if (sameCol) {
      return {
        id: a.id,
        x: a.x,
        z: (minZ + maxZ) / 2,
        width: a.width,
        height: maxZ - minZ,
      };
    }
  }

  return null;
}

export function printGrid(grid: boolean[][], config: GridConfig): string {
  let output = `Grid (${config.width}x${config.height}, cellSize=${config.cellSize})\n`;
  output += "┌" + "─".repeat(config.width) + "┐\n";

  for (const row of grid) {
    output += "│" + row.map(cell => cell ? "█" : "·").join("") + "│\n";
  }

  output += "└" + "─".repeat(config.width) + "┘";
  return output;
}

if (require.main === module) {
  const config = createDefaultGridConfig(1);
  const grid = createOccupancyGrid(config);
  
  console.log(printGrid(grid, config));
  console.log(`\nGrid dimensions: ${grid[0].length}x${grid.length}`);
  console.log(`Total cells: ${grid[0].length * grid.length}`);
  console.log(`Blocked cells: ${grid.flat().filter(c => c).length}`);
}
