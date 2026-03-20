# Player Models

Place your 3D character models here.

## Requirements
- Format: GLB (GLTF binary)
- Must include a walking animation named "Walk", "Walking", or similar
- Should be rigged with a humanoid skeleton

## How to get free models
1. Go to https://www.mixamo.com
2. Create a free account
3. Browse/select a character (many free ones available)
4. Click "Download" and choose "FBX with Skin" or "GLB"
5. For animation: Search "Walk" → Download

## Expected filename
The code expects: `Soldier.glb`

You can rename your downloaded file to `Soldier.glb` or update the `PLAYER_MODEL_URL` constant in `main.js`.

## Placeholder
Currently the code falls back to sphere meshes if no model is found.
