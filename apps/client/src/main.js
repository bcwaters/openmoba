import './styles.css';
import { initThree, loadObjModel } from './three.js';
import { initNetworking, createHealthBar, createAmmoBar } from './networking.js';
import { initInput } from './input.js';
import * as THREE from 'three';

// Initialize systems
const three = initThree();

async function setLocalPlayerModel(playerType, onHealthBarCreated) {
    try {
        const modelUrl = playerType === 'wizard' ? '/models/Wizard.obj' : '/models/Robot.obj';
        const playerModel = await loadObjModel(modelUrl);
        
        playerModel.position.set(0, 0, 0);
        playerModel.rotation.y = Math.PI;
        
        const parentScale = playerType === 'wizard' ? 5.46 : 3;
        if (playerType === 'wizard') {
            playerModel.scale.set(5.46, 5.46, 5.46);
        } else {
            playerModel.scale.set(3, 3, 3);
        }
        
        console.log(`Loaded ${playerType} model for local player`);
        
        playerModel.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
        const healthBar = createHealthBar(100, parentScale);
        playerModel.add(healthBar);
        
        const clipSize = playerType === 'wizard' ? 5 : 15;
        const ammoBar = createAmmoBar(clipSize, parentScale);
        playerModel.add(ammoBar);
        
        if (onHealthBarCreated) {
            onHealthBarCreated(healthBar, ammoBar, clipSize);
        }
        
        three.setPlayerVisual(playerModel);
    } catch (error) {
        console.error('Failed to load player model:', error);
    }
}

const networking = initNetworking(three.getPlayerMesh, three.setObstacles, setLocalPlayerModel);
const input = initInput(
    three.getPlayerMesh, 
    () => three.camera, 
    three.getTargetMesh,
    () => {
        const mesh = three.getPlayerMesh();
        if (mesh) {
            const cursorPos = input.getCursorWorldPos();
            const dirX = cursorPos.x - mesh.position.x;
            const dirZ = cursorPos.z - mesh.position.z;
            const length = Math.sqrt(dirX * dirX + dirZ * dirZ);
            if (length > 0) {
                networking.fireBullet(dirX / length, dirZ / length);
            }
        }
    }
);

const DEBUG_LOG_INTERVAL_MS = 10000;

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