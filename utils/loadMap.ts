import * as fs from 'fs';
import * as path from 'path';
import { Obstacle } from '../apps/server/src/constants/map';

export interface MapConfig {
  obstacles: Obstacle[];
  spawnPositions?: { x: number; y: number; z: number }[];
}

export function loadMapFromJson(filePath: string): MapConfig {
  const absolutePath = path.resolve(process.cwd(), filePath);
  
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Map file not found: ${absolutePath}`);
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  const data = JSON.parse(content);

  if (!Array.isArray(data)) {
    throw new Error('Map JSON must be an array of obstacles');
  }

  const obstacles: Obstacle[] = data.map((item: any, index: number) => {
    if (typeof item.x !== 'number' || typeof item.z !== 'number' ||
        typeof item.width !== 'number' || typeof item.height !== 'number') {
      throw new Error(`Invalid obstacle at index ${index}`);
    }
    return {
      id: item.id || `obstacle-${index}`,
      x: item.x,
      z: item.z,
      width: item.width,
      height: item.height,
    };
  });

  return { obstacles };
}

export function loadMapFromEnv(): MapConfig | null {
  const mapFile = process.env.MAP_FILE;
  if (mapFile) {
    console.log(`Loading map from: ${mapFile}`);
    return loadMapFromJson(mapFile);
  }
  return null;
}
