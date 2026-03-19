README: Fixing Player Model Movement in OpenMOBA
Problem

The GLB player model loads correctly, but it does not move with the player position updates from the server.

This happens because the code is replacing the original player object with a new model object, while other systems still keep references to the old one.

Root Cause

The project currently creates an initial local player mesh in three.js:

playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);
playerMesh.position.set(0, 0.5, 0);
playerMesh.userData = { id: 'local-player' };
scene.add(playerMesh);

Later, when the GLB is loaded, this mesh is replaced:

three.setPlayerMesh(playerModel);
three.scene.add(playerModel);

That creates two problems:

1. Stale references

networking.js stores a local mesh reference early:

if (setLocalPlayerMeshFn) {
    localPlayerMesh = setLocalPlayerMeshFn();
}

At that moment, localPlayerMesh points to the original sphere.

After three.setPlayerMesh(playerModel), three.getPlayerMesh() returns the new GLB model, but localPlayerMesh in networking still points to the old mesh.

So some systems operate on the new object, while others still use the old one.

2. Replacing the logical player object

The original playerMesh is acting as the logical player object:

camera follows it

minimap tracks it

fog of war tracks it

networking updates it

Replacing that object with a different scene object is fragile.

A better pattern is:

keep one stable player root object

attach the GLB model as a child

move the root object only

Additional Bug in networking.js

There is also this line:

scene.add(mesh);

There is no scene variable in networking.js.

That should be removed and replaced with:

if (currentScene) {
    currentScene.add(mesh);
}
Recommended Fix
Best approach

Do not replace the player object.

Instead:

Create a stable THREE.Group() for the player

Use that group as the authoritative player object

Add the GLB model as a child of the group

Let all movement systems continue to move the group

This keeps all references valid.

Code Changes
1. Update three.js
Replace the initial local player mesh with a stable root group
Before
const playerGeometry = new THREE.SphereGeometry(2.5, 16, 16);
const playerMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff88 });
playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);
playerMesh.position.set(0, 0.5, 0);
playerMesh.castShadow = true;
playerMesh.userData = { id: 'local-player' };
scene.add(playerMesh);
After
const playerRoot = new THREE.Group();
playerRoot.position.set(0, 0.5, 0);
playerRoot.userData = { id: 'local-player' };

const playerGeometry = new THREE.SphereGeometry(2.5, 16, 16);
const playerMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff88 });
const placeholder = new THREE.Mesh(playerGeometry, playerMaterial);
placeholder.castShadow = true;
placeholder.name = 'player-placeholder';

playerRoot.add(placeholder);

playerMesh = playerRoot;
scene.add(playerMesh);

This makes playerMesh the stable root object.

2. Add a helper to attach a visual model to the player root

Add this function in three.js:

export function setPlayerVisual(model) {
    if (!playerMesh) return;

    const oldVisual = playerMesh.getObjectByName('player-visual');
    if (oldVisual) {
        playerMesh.remove(oldVisual);
    }

    const placeholder = playerMesh.getObjectByName('player-placeholder');
    if (placeholder) {
        playerMesh.remove(placeholder);
    }

    model.name = 'player-visual';
    model.position.set(0, 0, 0);
    playerMesh.add(model);
}

Then expose it from initThree():

setPlayerVisual: (model) => setPlayerVisual(model),
3. Update local model loading code
Before
async function loadPlayerModel() {
    const oldMesh = three.getPlayerMesh();
    if (oldMesh) {
        three.scene.remove(oldMesh);
    }
    
    try {
        const playerModel = await loadAnimatedModel(PLAYER_MODEL_URL, 'Walk');
        
        playerModel.scale.set(0.1, 0.1, 0.1);
        playerModel.position.y = 0;
        
        three.setPlayerMesh(playerModel);
        three.scene.add(playerModel);
        
    } catch (error) {
        console.error('Failed to load player model:', error);
    }
}
After
async function loadPlayerModel() {
    try {
        const playerModel = await loadAnimatedModel(PLAYER_MODEL_URL, 'Walk');

        playerModel.scale.set(0.1, 0.1, 0.1);
        playerModel.position.set(0, 0, 0);

        three.setPlayerVisual(playerModel);
    } catch (error) {
        console.error('Failed to load player model:', error);
    }
}

This keeps the player root in place and swaps only the visual child.

4. Fix networking.js to use a getter, not a stale cached mesh
Problematic current code
let localPlayerMesh = null;
let setLocalPlayerMeshFn = null;

and:

setLocalPlayerMeshFn = setLocalPlayerMeshFnArg;

if (setLocalPlayerMeshFn) {
    localPlayerMesh = setLocalPlayerMeshFn();
}

The argument is actually a getter function, not a setter.

Replace with
let getLocalPlayerMesh = null;

Then in initNetworking:

export function initNetworking(getLocalPlayerMeshArg, setObstaclesFnArg) {
    getLocalPlayerMesh = getLocalPlayerMeshArg;
    setObstaclesFn = setObstaclesFnArg;

Remove this completely:

if (setLocalPlayerMeshFn) {
    localPlayerMesh = setLocalPlayerMeshFn();
}
5. Update local player position using the getter each time
Before
const mesh = setLocalPlayerMeshFn ? setLocalPlayerMeshFn() : null;
if (mesh) {
    mesh.position.set(playerData.x, playerData.y, playerData.z);
}
After
const mesh = getLocalPlayerMesh ? getLocalPlayerMesh() : null;
if (mesh) {
    mesh.position.set(playerData.x, playerData.y, playerData.z);
}
6. Update remote visibility calculation to use the current local mesh
Before
const dx = remotePlayer.x - (localPlayerMesh?.position.x || 0);
const dz = remotePlayer.z - (localPlayerMesh?.position.z || 0);
After
const localMesh = getLocalPlayerMesh ? getLocalPlayerMesh() : null;
const dx = remotePlayer.x - (localMesh?.position.x || 0);
const dz = remotePlayer.z - (localMesh?.position.z || 0);
7. Remove the invalid scene.add(mesh) call
Before
scene.add(mesh);

console.log(`Created remote player: ${playerData.sessionId}`);

if (currentScene) {
    currentScene.add(mesh);
}
After
console.log(`Created remote player: ${playerData.sessionId}`);

if (currentScene) {
    currentScene.add(mesh);
}
Why this works

With this design:

playerMesh always refers to the same root object

networking updates the root position

camera follows the root

minimap follows the root

fog of war follows the root

the GLB model is just a child under the root

So when the root moves, the model moves with it automatically.

Optional Minimal Fix

If you do not want to refactor yet, the minimum patch is:

After loading the model, call:

networking.setLocalPlayerMesh(playerModel);

Preserve old position and metadata when replacing the mesh

Fix scene.add(mesh) in networking.js

That may get things working temporarily, but it is still a fragile design.

The root-group approach is the correct long-term fix.

Suggested Final Structure
three.js

owns scene, camera, and player root

exposes getPlayerMesh()

exposes setPlayerVisual(model)

networking.js

never stores a permanent player mesh reference

always calls getLocalPlayerMesh() when needed

only updates player positions

adds remote meshes to currentScene

main/app bootstrap

initializes systems

loads the GLB model

attaches it visually to the player root

Summary
Main issues

local player object was being replaced

networking cached an old mesh reference

networking.js used an undefined scene

Main fix

keep a stable player root

attach the GLB as a child

use a getter instead of cached local mesh references

remove invalid scene.add(mesh) call
