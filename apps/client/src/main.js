import { initThree, loadObjModel } from './three.js';
import { initNetworking } from './networking.js';
import { initInput } from './input.js';
import * as THREE from 'three';

// Initialize systems
const three = initThree();
const networking = initNetworking(three.getPlayerMesh, three.setObstacles);
const input = initInput(
    three.getPlayerMesh, 
    () => three.camera, 
    three.getTargetMesh,
    () => {
        const mesh = three.getPlayerMesh();
        if (mesh) {
            const dirX = -Math.sin(mesh.rotation.y);
            const dirZ = -Math.cos(mesh.rotation.y);
            networking.fireBullet(dirX, dirZ);
        }
    }
);

const PLAYER_MODEL_URL = '/models/Robot.obj';
const DEBUG_LOG_INTERVAL_MS = 10000;

async function loadPlayerModel() {
    try {
        const playerModel = await loadObjModel(PLAYER_MODEL_URL);

        // OBJ assets are static meshes, so this removes the animation complexity
        // from the debugging path. We intentionally switch to a very explicit
        // renderable mesh format to confirm the player visual pipeline itself works.
        //
        // Per your request, keep the model at its authored scale.

        // The imported mesh is attached underneath the player root group. Its
        // local transform stays near origin while the root receives network/world
        // position updates.
        playerModel.position.set(0, 0, 0);

        // Rotate 180 degrees around the vertical axis so the model faces the
        // opposite horizontal/world direction on the ground plane.
        playerModel.rotation.y = Math.PI;

        console.log('Loaded player model:', playerModel);
        console.log('Model scale:', playerModel.scale);
        console.log('Model position:', playerModel.position);

        // Extra one-time diagnostics so we can verify whether the imported OBJ
        // actually contains renderable mesh content and what its initial bounds are.
        const debugBounds = new THREE.Box3().setFromObject(playerModel);
        const debugSize = debugBounds.getSize(new THREE.Vector3());
        let meshCount = 0;
        let skinnedMeshCount = 0;
        playerModel.traverse((child) => {
            if (child.isMesh) meshCount += 1;
            if (child.isSkinnedMesh) skinnedMeshCount += 1;
        });

        console.log('[debug][player-model-load]', {
            modelUrl: PLAYER_MODEL_URL,
            meshCount,
            skinnedMeshCount,
            boundsMin: {
                x: debugBounds.min.x,
                y: debugBounds.min.y,
                z: debugBounds.min.z
            },
            boundsMax: {
                x: debugBounds.max.x,
                y: debugBounds.max.y,
                z: debugBounds.max.z
            },
            boundsSize: {
                x: debugSize.x,
                y: debugSize.y,
                z: debugSize.z
            }
        });

        // Replace the placeholder sphere with the real GLB character.
        // setPlayerVisual() handles removing the temporary placeholder and
        // attaching this model beneath the player root object.
        playerModel.scale.set(3, 3, 3);
        three.setPlayerVisual(playerModel);
    } catch (error) {
        console.error('Failed to load player model:', error);
    }
}

loadPlayerModel();

// Main loop
let lastTime = performance.now();
let lastDebugBucket = -1;
let initialCameraLog = true;
function animate(time) {
    const deltaTime = (time - lastTime) / 1000;
    lastTime = time;

    // Update camera to follow player and fog of war
    const playerMesh = three.getPlayerMesh();
    if (playerMesh) {
        if (initialCameraLog) {
            console.log('Camera initial:', {
                x: three.camera.position.x,
                y: three.camera.position.y,
                z: three.camera.position.z
            });
            initialCameraLog = false;
        }
        // Debug logging is intentionally throttled with a modulo-style time bucket
        // so we can observe long-running state without flooding the console every frame.
        //
        // Example buckets for a 10 second interval:
        // 0-9999ms   => bucket 0
        // 10000-19999 => bucket 1
        // 20000-29999 => bucket 2
        // We only log once when the bucket changes.
        const debugBucket = Math.floor(time / DEBUG_LOG_INTERVAL_MS);
        if (debugBucket !== lastDebugBucket) {
            lastDebugBucket = debugBucket;

            const playerVisual = playerMesh.getObjectByName('player-visual');
            console.log('[debug][player-loop]', {
                elapsedMs: Math.floor(time),
                playerRootPosition: {
                    x: playerMesh.position.x,
                    y: playerMesh.position.y,
                    z: playerMesh.position.z
                },
                hasPlayerVisual: Boolean(playerVisual),
                playerVisualChildCount: playerVisual?.children?.length ?? 0,
                playerVisualPosition: playerVisual ? {
                    x: playerVisual.position.x,
                    y: playerVisual.position.y,
                    z: playerVisual.position.z
                } : null,
                playerVisualScale: playerVisual ? {
                    x: playerVisual.scale.x,
                    y: playerVisual.scale.y,
                    z: playerVisual.scale.z
                } : null,
                cameraPosition: {
                    x: three.camera.position.x,
                    y: three.camera.position.y,
                    z: three.camera.position.z
                }
            });
        }

        if (three.getCameraFollowsPlayer()) {
            three.camera.position.x = playerMesh.position.x;
            three.camera.position.z = playerMesh.position.z + 60;
            three.camera.lookAt(playerMesh.position.x, 0, playerMesh.position.z);
        }

        three.updateFogOfWar(playerMesh.position.x, playerMesh.position.z, networking.getVisibleRadius());
    }

    // Update systems
    input.update(deltaTime, (tx, ty, tz) => {
        networking.sendMovementIntent(tx, ty, tz);
    });
    three.update(deltaTime);
    networking.update(deltaTime, three.scene);

    // Render
    three.render();

    requestAnimationFrame(animate);
}

requestAnimationFrame(animate);