import * as THREE from 'three';
import { Client as ColyseusClient } from 'colyseus.js';
import { createPlayerModelRoot, loadAnimatedModel } from './three.js';

let client;
let room;
let connected = false;
let playerId = null;
let remotePlayers = new Map();
let getLocalPlayerMesh = null;
let setObstaclesFn = null;
let currentScene = null;
// TODO: visibleRadius should be authoritative from server - refactor to remove hardcoded value
let visibleRadius = 100.0;

const PLAYER_MODEL_URL = '/models/Soldier.glb';

let localModelLoaded = false;
let remoteModelLoaded = false;
let cachedRemoteModel = null;

async function getRemotePlayerModel() {
    if (cachedRemoteModel) {
        const model = cachedRemoteModel.clone();
        return createPlayerModelRoot(model);
    }
    
    try {
        const { loadAnimatedModel } = await import('./three.js');
        cachedRemoteModel = await loadAnimatedModel(PLAYER_MODEL_URL, 'Walk');
        // Match the local player's visual scale so remote players render as the
        // same type of world-space character instead of an oversized imported asset.
        cachedRemoteModel.scale.set(0.1, 0.1, 0.1);
        return createPlayerModelRoot(cachedRemoteModel.clone());
    } catch (e) {
        return null;
    }
}

const INTENT_THROTTLE_MS = 100;
let lastIntentTime = 0;
let pendingIntent = null;

export function initNetworking(getLocalPlayerMeshArg, setObstaclesFnArg) {
    getLocalPlayerMesh = getLocalPlayerMeshArg;
    setObstaclesFn = setObstaclesFnArg;
    
    client = new ColyseusClient('ws://localhost:2567');
    
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
                    return;
                }
                
                if (!remotePlayers.has(playerData.sessionId)) {
                    let mesh = await getRemotePlayerModel();
                    
                    if (!mesh) {
                        const geometry = new THREE.SphereGeometry(2.0, 12, 12);
                        const material = new THREE.MeshStandardMaterial({ 
                            color: 0xff0000,
                            transparent: true,
                            opacity: 1.0
                        });
                        mesh = new THREE.Mesh(geometry, material);
                    }
                    // The remote player object may be either a fallback primitive mesh
                    // or a Group containing the imported GLB. Only primitive meshes have
                    // a direct castShadow property, so guard access here.
                    if ('castShadow' in mesh) {
                        mesh.castShadow = true;
                    }

                    mesh.position.set(playerData.x, playerData.y, playerData.z);
                    
                    remotePlayers.set(playerData.sessionId, {
                        id: playerData.sessionId,
                        x: playerData.x,
                        y: playerData.y,
                        z: playerData.z,
                        mesh
                    });
                    
                    console.log(`Created remote player: ${playerData.sessionId}`);
                    
                    if (currentScene) {
                        currentScene.add(mesh);
                    }
                } else {
                    const remotePlayer = remotePlayers.get(playerData.sessionId);
                    remotePlayer.x = playerData.x;
                    remotePlayer.y = playerData.y;
                    remotePlayer.z = playerData.z;
                    if (remotePlayer.mesh) {
                        remotePlayer.mesh.position.set(playerData.x, playerData.y, playerData.z);
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
