import * as THREE from 'three';
import { Client as ColyseusClient } from "colyseus.js";
import { loadObjModel } from "./three.js";

let client;
let room;
let connected = false;
let playerId = null;
let localPlayerType = null;
let localPlayerModelSet = false;
let remotePlayers = new Map();
let bullets = new Map();
let getLocalPlayerMesh = null;
let setObstaclesFn = null;
let setLocalPlayerModelFn = null;
let currentScene = null;
let localHealthBar = null;
let localAmmoBar = null;
let localPlayerHealth = 100;
let localProjectileSize = 3;
let localClipSize = 15;
let localCurrentAmmo = 15;
let localIsReloading = false;
// TODO: visibleRadius should be authoritative from server - refactor to remove hardcoded value
let visibleRadius = 50.0;

const INTENT_THROTTLE_MS = 100;

function createHealthBar(health, parentScale = 1) {
    const group = new THREE.Group();
    group.userData.parentScale = parentScale;
    const segments = Math.max(1, Math.floor(health / 10));
    const squareSize = 1 / parentScale;
    const spacing = 0.2 / parentScale;
    
    for (let i = 0; i < 10; i++) {
        const geometry = new THREE.BoxGeometry(squareSize, squareSize, squareSize);
        const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
        const square = new THREE.Mesh(geometry, material);
        square.position.x = i * (squareSize + spacing) - (10 * (squareSize + spacing)) / 2 + squareSize / 2;
        square.position.y = 24 / parentScale;
        square.visible = i < segments;
        group.add(square);
    }
    
    return group;
}

function updateHealthBar(healthBar, health) {
    if (!healthBar) return;
    
    const parentScale = healthBar.userData.parentScale || 1;
    const segments = Math.max(1, Math.floor(health / 10));
    const squareSize = 1 / parentScale;
    const spacing = 0.2 / parentScale;
    
    healthBar.children.forEach((child, i) => {
        child.visible = i < segments;
        if (child.visible) {
            child.position.x = i * (squareSize + spacing) - (10 * (squareSize + spacing)) / 2 + squareSize / 2;
        }
    });
}

function createAmmoBar(clipSize, parentScale = 1) {
    const group = new THREE.Group();
    group.userData.parentScale = parentScale;
    group.userData.clipSize = clipSize;
    const squareSize = 1 / parentScale;
    const spacing = 0.2 / parentScale;
    
    for (let i = 0; i < clipSize; i++) {
        const geometry = new THREE.BoxGeometry(squareSize, squareSize, squareSize);
        const material = new THREE.MeshStandardMaterial({ color: 0xffff00 });
        const square = new THREE.Mesh(geometry, material);
        square.position.x = i * (squareSize + spacing) - (clipSize * (squareSize + spacing)) / 2 + squareSize / 2;
        square.position.y = 26 / parentScale;
        square.visible = true;
        group.add(square);
    }
    
    return group;
}

function updateAmmoBar(ammoBar, currentAmmo, clipSize, isReloading) {
    if (!ammoBar) return;
    
    const parentScale = ammoBar.userData.parentScale || 1;
    const squareSize = 1 / parentScale;
    const spacing = 0.2 / parentScale;
    
    ammoBar.children.forEach((child, i) => {
        child.visible = i < clipSize;
        child.material.color.setHex(isReloading ? 0x666666 : (i < currentAmmo ? 0xffff00 : 0x333333));
    });
}
let lastIntentTime = 0;
let pendingIntent = null;

export function initNetworking(getLocalPlayerMeshArg, setObstaclesFnArg, setLocalPlayerModelFnArg) {
    getLocalPlayerMesh = getLocalPlayerMeshArg;
    setObstaclesFn = setObstaclesFnArg;
    setLocalPlayerModelFn = setLocalPlayerModelFnArg;
    
    const serverHost = import.meta.env.VITE_SERVER_HOST || window.location.host;
    const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    client = new ColyseusClient(`${protocol}${serverHost}`);
    
    client.joinOrCreate("openmoba", {}).then((joinedRoom) => {
        room = joinedRoom;
        connected = true;
        playerId = room.sessionId;
        
        const infoEl = document.getElementById('info');
        if (infoEl) infoEl.textContent = `Connected as ${playerId.substring(0, 5)}`;
        
        room.onLeave((code) => {
            connected = false;
            const infoEl = document.getElementById('info');
            if (infoEl) infoEl.textContent = 'Disconnected';
            
            remotePlayers.forEach((data) => {
                if (data.mesh && data.mesh.parent) {
                    data.mesh.parent.remove(data.mesh);
                }
            });
            remotePlayers.clear();
        });
        
        room.onMessage('player-positions', (data) => {
            const playersData = data.players;
            visibleRadius = data.visibleRadius || 5.0;
            
            if (data.obstacles && setObstaclesFn) {
                setObstaclesFn(data.obstacles);
                setObstaclesFn = null;
            }
            
            const currentPlayerIds = new Set();
            
            playersData.forEach(async (playerData) => {
                currentPlayerIds.add(playerData.sessionId);
                
                if (playerData.sessionId === playerId) {
                    const mesh = getLocalPlayerMesh ? getLocalPlayerMesh() : null;
                    if (mesh) {
                        mesh.position.set(playerData.x, playerData.y, playerData.z);
                    }
                    if (playerData.playerType && playerData.playerType !== localPlayerType) {
                        localPlayerType = playerData.playerType;
                        if (!localPlayerModelSet && setLocalPlayerModelFn) {
                            localPlayerModelSet = true;
                            setLocalPlayerModelFn(playerData.playerType, (healthBar, ammoBar, clipSize) => {
                                localHealthBar = healthBar;
                                localAmmoBar = ammoBar;
                                localClipSize = clipSize;
                                localCurrentAmmo = clipSize;
                            });
                        }
                    }
                    if (playerData.health !== undefined) {
                        localPlayerHealth = playerData.health;
                    }
                    if (playerData.projectileSize !== undefined) {
                        localProjectileSize = playerData.projectileSize;
                    }
                    if (playerData.currentAmmo !== undefined) {
                        localCurrentAmmo = Math.max(0, playerData.currentAmmo);
                    }
                    if (playerData.isReloading !== undefined) {
                        localIsReloading = playerData.isReloading;
                    }
                    if (playerData.health !== undefined && localHealthBar) {
                        updateHealthBar(localHealthBar, playerData.health);
                    }
                    if (localAmmoBar) {
                        updateAmmoBar(localAmmoBar, localCurrentAmmo, localClipSize, localIsReloading);
                    }
                    return;
                }
                
                if (!remotePlayers.has(playerData.sessionId)) {
                    try {
                        const modelUrl = playerData.playerType === 'wizard' ? '/models/Wizard.obj' : '/models/Robot.obj';
                        const model = await loadObjModel(modelUrl);
                        model.rotation.y = Math.PI;
                        
                        if (playerData.playerType === 'wizard') {
                            model.scale.set(5.46, 5.46, 5.46);
                        } else {
                            model.scale.set(3, 3, 3);
                        }
                        
                        model.traverse((child) => {
                            if (child.isMesh) {
                                child.castShadow = true;
                                child.receiveShadow = true;
                            }
                        });
                        
                        remotePlayers.set(playerData.sessionId, {
                            id: playerData.sessionId,
                            x: playerData.x,
                            y: playerData.y,
                            z: playerData.z,
                            mesh: model,
                            playerType: playerData.playerType,
                            health: playerData.health ?? 100,
                            healthBar: null,
                            ammoBar: null,
                            projectileSize: playerData.projectileSize ?? 3,
                            currentAmmo: playerData.currentAmmo ?? 15,
                            clipSize: playerData.playerType === 'wizard' ? 5 : 15,
                            isReloading: playerData.isReloading ?? false
                        });
                        
                        console.log(`Created remote ${playerData.playerType} player: ${playerData.sessionId}`);
                        
                        if (currentScene) {
                            const parentScale = playerData.playerType === 'wizard' ? 5.46 : 3;
                            const healthBar = createHealthBar(playerData.health ?? 100, parentScale);
                            model.add(healthBar);
                            remotePlayers.get(playerData.sessionId).healthBar = healthBar;
                            
                            const clipSize = playerData.playerType === 'wizard' ? 5 : 15;
                            const ammoBar = createAmmoBar(clipSize, parentScale);
                            model.add(ammoBar);
                            remotePlayers.get(playerData.sessionId).ammoBar = ammoBar;
                            remotePlayers.get(playerData.sessionId).parentScale = parentScale;
                            
                            model.position.set(playerData.x, playerData.y, playerData.z);
                            currentScene.add(model);
                        }
                    } catch (e) {
                        console.error('Failed to load remote player model:', e);
                    }
                    return;
                } else {
                    const remotePlayer = remotePlayers.get(playerData.sessionId);
                    remotePlayer.x = playerData.x;
                    remotePlayer.y = playerData.y;
                    remotePlayer.z = playerData.z;
                    if (remotePlayer.mesh) {
                        remotePlayer.mesh.position.set(playerData.x, playerData.y, playerData.z);
                        if (playerData.dirX !== undefined && playerData.dirZ !== undefined) {
                            const angle = Math.atan2(playerData.dirZ, playerData.dirX);
                            remotePlayer.mesh.rotation.y = -angle - Math.PI / 2;
                        }
                    }
                    if (playerData.health !== undefined && playerData.health !== remotePlayer.health) {
                        remotePlayer.health = playerData.health;
                        updateHealthBar(remotePlayer.healthBar, playerData.health);
                    }
                    if (playerData.currentAmmo !== undefined || playerData.isReloading !== undefined) {
                        remotePlayer.currentAmmo = Math.max(0, playerData.currentAmmo ?? remotePlayer.currentAmmo);
                        remotePlayer.isReloading = playerData.isReloading ?? remotePlayer.isReloading;
                        updateAmmoBar(remotePlayer.ammoBar, remotePlayer.currentAmmo, remotePlayer.clipSize, remotePlayer.isReloading);
                    }
                }
            });
            
            for (const [sessionId, data] of remotePlayers) {
                if (!currentPlayerIds.has(sessionId) && data.mesh && data.mesh.parent) {
                    data.mesh.parent.remove(data.mesh);
                    remotePlayers.delete(sessionId);
                }
            }
        });
        
        // Handle bullet updates from server
        room.onMessage('bullets', (data) => {
            const bulletMeshes = [];
            
            data.bullets.forEach((bulletData) => {
                let bulletEntry = bullets.get(bulletData.id);
                
                if (!bulletEntry) {
                    // Determine projectile size based on owner
                    let projectileSize = 3;
                    if (bulletData.ownerId === playerId) {
                        projectileSize = localProjectileSize;
                    } else {
                        const owner = remotePlayers.get(bulletData.ownerId);
                        if (owner) {
                            projectileSize = owner.projectileSize ?? 3;
                        }
                    }
                    
                    // Create new bullet mesh
                    const geometry = new THREE.SphereGeometry(projectileSize * 0.3, 8, 8);
                    const material = new THREE.MeshStandardMaterial({ 
                        color: 0xffff00,
                        emissive: 0xff8800,
                        emissiveIntensity: 0.5
                    });
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.position.set(bulletData.x, bulletData.y, bulletData.z);
                    mesh.castShadow = true;
                    
                    bulletEntry = {
                        id: bulletData.id,
                        mesh,
                        x: bulletData.x,
                        y: bulletData.y,
                        z: bulletData.z,
                        dirX: bulletData.dirX,
                        dirZ: bulletData.dirZ
                    };
                    
                    bullets.set(bulletData.id, bulletEntry);
                    
                    if (currentScene) {
                        currentScene.add(mesh);
                    }
                }
                
                // Update bullet position
                bulletEntry.x = bulletData.x;
                bulletEntry.y = bulletData.y;
                bulletEntry.z = bulletData.z;
                bulletEntry.dirX = bulletData.dirX;
                bulletEntry.dirZ = bulletData.dirZ;
                
                if (bulletEntry.mesh) {
                    bulletEntry.mesh.position.set(bulletData.x, bulletData.y, bulletData.z);
                    // Rotate bullet to face direction
                    const angle = Math.atan2(bulletData.dirZ, bulletData.dirX);
                    bulletEntry.mesh.rotation.y = -angle;
                }
                
                bulletMeshes.push(bulletData.id);
            });
            
            // Remove bullets that are no longer in the update
            for (const [bulletId, bulletEntry] of bullets) {
                if (!bulletMeshes.includes(bulletId) && bulletEntry.mesh && bulletEntry.mesh.parent) {
                    bulletEntry.mesh.parent.remove(bulletEntry.mesh);
                    bullets.delete(bulletId);
                }
            }
        });
        
    }).catch((err) => {
        console.error('Failed to join room:', err);
        const infoEl = document.getElementById('info');
        if (infoEl) infoEl.textContent = `Connection failed: ${err.message}`;
    });

    return {
        room,
        sendMovementIntent: (targetX, targetY, targetZ) => {
            if (!connected || !room) return;
            
            const now = Date.now();
            if (now - lastIntentTime < INTENT_THROTTLE_MS) {
                pendingIntent = { targetX, targetY, targetZ };
                return;
            }
            
            lastIntentTime = now;
            pendingIntent = null;
            
            room.send('movement-intent', {
                playerId: playerId,
                targetX,
                targetY: 0,
                targetZ,
                timestamp: now
            });
        },
        update: (deltaTime, scene) => {
            currentScene = scene;
            if (!connected || !room) return;
            
            if (pendingIntent && (Date.now() - lastIntentTime >= INTENT_THROTTLE_MS)) {
                const { targetX, targetY, targetZ } = pendingIntent;
                pendingIntent = null;
                lastIntentTime = Date.now();
                
                room.send('movement-intent', {
                    playerId: playerId,
                    targetX,
                    targetY: 0,
                    targetZ,
                    timestamp: Date.now()
                });
            }
            
            remotePlayers.forEach((remotePlayer) => {
                if (remotePlayer.mesh && scene) {
                    if (!remotePlayer.mesh.parent && scene) {
                        scene.add(remotePlayer.mesh);
                    }
                    remotePlayer.mesh.position.set(remotePlayer.x, remotePlayer.y, remotePlayer.z);
                    
                    const localMesh = getLocalPlayerMesh ? getLocalPlayerMesh() : null;
                    const dx = remotePlayer.x - (localMesh?.position.x || 0);
                    const dz = remotePlayer.z - (localMesh?.position.z || 0);
                    const distance = Math.sqrt(dx * dx + dz * dz);
                    
                    remotePlayer.mesh.visible = distance <= visibleRadius;
                }
            });
        },
        getPlayerId: () => playerId,
        isConnected: () => connected,
        getVisibleRadius: () => visibleRadius,
        fireBullet: (dirX, dirZ) => {
            if (!connected || !room) return;
            room.send('fire-bullet', { dirX, dirZ });
        },
        loadRemotePlayerModel: async (modelUrl) => {
            try {
                const { loadAnimatedModel } = await import('./three.js');
                return await loadAnimatedModel(modelUrl, 'Walk');
            } catch (e) {
                console.error('Failed to load remote model:', e);
                return null;
            }
        }
    };
}

export { createHealthBar, updateHealthBar, createAmmoBar, updateAmmoBar };
