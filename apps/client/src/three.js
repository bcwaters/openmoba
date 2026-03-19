import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

let scene, camera, renderer, clock;
let ground, gridHelper;
let minimapCamera, minimapRenderer, minimapCanvas;
let playerMesh;
let obstaclesGroup;
let fogMesh;
let cameraFollowsPlayer = true;
let mixer;
const clockAnim = new THREE.Clock();

const MAP_SIZE = 200;
const MAP_HALF = MAP_SIZE / 2;

const loader = new GLTFLoader();
const objLoader = new OBJLoader();
const loadedModels = new Map();
const modelMixers = new Map();

function cloneGltfSceneWithSkins(sourceScene) {
    // GLTF scenes that contain skinned meshes / bones do not clone correctly
    // with a plain scene.clone() in many real-world cases.
    //
    // The symptom is usually: "the model loaded" but appears broken, invisible,
    // or animations do not affect the visible mesh. To avoid that, we perform a
    // deep clone that remaps skeleton bones to the cloned hierarchy.
    const clone = sourceScene.clone(true);

    const sourceSkinnedMeshes = {};
    const cloneBones = {};
    const cloneSkinnedMeshes = {};

    sourceScene.traverse((node) => {
        if (node.isSkinnedMesh) {
            sourceSkinnedMeshes[node.name] = node;
        }
    });

    clone.traverse((node) => {
        if (node.isBone) {
            cloneBones[node.name] = node;
        }

        if (node.isSkinnedMesh) {
            cloneSkinnedMeshes[node.name] = node;
        }
    });

    Object.keys(sourceSkinnedMeshes).forEach((name) => {
        const sourceSkinnedMesh = sourceSkinnedMeshes[name];
        const clonedSkinnedMesh = cloneSkinnedMeshes[name];

        if (!sourceSkinnedMesh || !clonedSkinnedMesh || !sourceSkinnedMesh.skeleton) {
            return;
        }

        const orderedCloneBones = sourceSkinnedMesh.skeleton.bones.map((bone) => cloneBones[bone.name]);
        clonedSkinnedMesh.bind(
            new THREE.Skeleton(orderedCloneBones, sourceSkinnedMesh.skeleton.boneInverses),
            clonedSkinnedMesh.matrixWorld
        );
    });

    return clone;
}

export async function loadModel(url) {
    if (loadedModels.has(url)) {
        return cloneGltfSceneWithSkins(loadedModels.get(url));
    }
    
    return new Promise((resolve, reject) => {
        loader.load(url, (gltf) => {
            loadedModels.set(url, gltf.scene);
            resolve(cloneGltfSceneWithSkins(gltf.scene));
        }, undefined, reject);
    });
}

export async function loadObjModel(url) {
    return new Promise((resolve, reject) => {
        objLoader.load(url, (object) => {
            // OBJ files are simpler than GLB assets: they are just hierarchy + mesh data,
            // so a standard clone is sufficient here.
            resolve(object.clone(true));
        }, undefined, reject);
    });
}

export async function loadAnimatedModel(url, animationName = 'Walking') {
    return new Promise((resolve, reject) => {
        loader.load(url, (gltf) => {
            // Important: animated GLB files often include skinned meshes.
            // We must use a skeleton-safe clone or the model may not render / animate
            // correctly once attached to the player entity.
            const model = cloneGltfSceneWithSkins(gltf.scene);
            setupAnimations(model, animationName, gltf.animations);
            resolve(model);
        }, undefined, reject);
    });
}

function prepareModelForWorld(model) {
    // Many imported GLB files are authored facing +Z or -Z and with their feet
    // centered around the origin. Our gameplay root sits on the ground plane, so
    // we normalize the imported scene so its base stands on y=0.
    //
    // This makes the model much easier to attach both for the local player and
    // for remote players that are placed directly from server coordinates.
    const bounds = new THREE.Box3().setFromObject(model);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());

    // Keep the imported character centered on the gameplay root horizontally.
    model.position.x -= center.x;
    model.position.z -= center.z;

    // Put the character's feet at the player root origin instead of lifting it.
    // The previous version moved the model upward, which made it effectively too
    // small and hard to see from the RTS-style camera once scaled down.
    model.position.y = -bounds.min.y;

    // Ensure the model faces the camera/game board in a predictable way.
    // Many sample soldier GLBs face the opposite direction from the world logic.
    model.rotation.y = Math.PI;

    return {
        bounds,
        center,
        size
    };
}

function setupAnimations(model, animationName, animations) {
    if (!animations || animations.length === 0) return;
    
    const mixer = new THREE.AnimationMixer(model);
    modelMixers.set(model, mixer);
    
    const clip = animations.find(a => a.name.toLowerCase().includes(animationName.toLowerCase())) 
                 || animations[0];
    
    if (clip) {
        const action = mixer.clipAction(clip);
        action.play();
    }
}

export function updateAnimations(delta) {
    modelMixers.forEach(mixer => {
        mixer.update(delta);
    });
}

export function initThree() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    
    const aspect = window.innerWidth / window.innerHeight;
    const viewSize = 100;
    camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    camera.position.set(0, 150, 100);
    camera.lookAt(0, 0, 0);
    
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);
    
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('wheel', onMouseWheel, { passive: false });
    
    clock = new THREE.Clock();
    
    setupLighting();
    createGround();
    createGrid();
    createMapBounds();
    createMinimap();
    createFogOfWar();
    
    const playerRoot = new THREE.Group();
    playerRoot.position.set(0, 0.5, 0);
    playerRoot.userData = { id: 'local-player' };

    const playerGeometry = new THREE.SphereGeometry(1.5, 16, 16);
    const playerMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff88 });
    const placeholder = new THREE.Mesh(playerGeometry, playerMaterial);
    placeholder.castShadow = true;
    placeholder.name = 'player-placeholder';

    playerRoot.add(placeholder);

    playerMesh = playerRoot;
    scene.add(playerMesh);
    
    const targetGeometry = new THREE.RingGeometry(1.5, 2.0, 16);
    const targetMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00, side: THREE.DoubleSide });
    const targetMesh = new THREE.Mesh(targetGeometry, targetMaterial);
    targetMesh.rotation.x = -Math.PI / 2;
    targetMesh.position.set(0, 0.02, 0);
    targetMesh.visible = false;
    targetMesh.userData = { id: 'target-indicator' };
    scene.add(targetMesh);
    
    return {
        scene,
        camera,
        renderer,
        getPlayerMesh: () => playerMesh,
        getTargetMesh: () => targetMesh,
        setObstacles: (obstacles) => createObstacles(obstacles),
        updateFogOfWar: (playerX, playerZ, visibleRadius) => updateFogOfWar(playerX, playerZ, visibleRadius),
        getCameraFollowsPlayer: () => cameraFollowsPlayer,
        setCameraFollowsPlayer: (value) => { cameraFollowsPlayer = value; },
        loadModel: loadModel,
        loadObjModel: loadObjModel,
        loadAnimatedModel: loadAnimatedModel,
        setPlayerMesh: (mesh) => { playerMesh = mesh; },
        setPlayerVisual: (model) => setPlayerVisual(model),
        update: (deltaTime) => {
            clock.getDelta();
            updateAnimations(clockAnim.getDelta());
            updateMinimap();
        },
        render: () => {
            renderer.render(scene, camera);
            minimapRenderer.render(scene, minimapCamera);
        }
    };
}

function updateFogOfWar(playerX, playerZ, visibleRadius) {
    if (fogMesh) {
        fogMesh.position.x = playerX;
        fogMesh.position.z = playerZ;
        if (fogMesh.material.uniforms) {
            fogMesh.material.uniforms.playerX.value = playerX;
            fogMesh.material.uniforms.playerZ.value = playerZ;
            fogMesh.material.uniforms.visibleRadius.value = visibleRadius;
        }
    }
}

function onMouseWheel(event) {
    event.preventDefault();
    const zoomSpeed = 0.1;
    const direction = event.deltaY > 0 ? 1 : -1;
    
    const newY = camera.position.y + direction * camera.position.y * zoomSpeed;
    const newZ = camera.position.z + direction * camera.position.z * zoomSpeed;
    
    camera.position.y = Math.max(20, Math.min(300, newY));
    camera.position.z = Math.max(20, Math.min(200, newZ));
    camera.lookAt(0, 0, 0);
}

function createMinimap() {
    const minimapSize = 225;
    
    minimapCamera = new THREE.OrthographicCamera(
        -MAP_HALF, MAP_HALF,
        MAP_HALF, -MAP_HALF,
        0.1, 500
    );
    minimapCamera.position.set(0, 200, 0);
    minimapCamera.lookAt(0, 0, 0);
    
    minimapCanvas = document.createElement('canvas');
    minimapCanvas.id = 'minimap';
    minimapCanvas.width = minimapSize;
    minimapCanvas.height = minimapSize;
    minimapCanvas.style.cssText = 'position: absolute; bottom: 10px; right: 10px; border: 2px solid #444; border-radius: 4px; cursor: pointer;';
    document.body.appendChild(minimapCanvas);
    
    minimapRenderer = new THREE.WebGLRenderer({ canvas: minimapCanvas, antialias: true, alpha: true });
    minimapRenderer.setSize(minimapSize, minimapSize);
    minimapRenderer.setClearColor(0x000000, 0.5);
    
    minimapCanvas.addEventListener('click', (event) => {
        const rect = minimapCanvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const worldX = ((x / minimapSize) * 2 - 1) * MAP_HALF;
        const worldZ = ((y / minimapSize) * 2 - 1) * MAP_HALF;
        
        cameraFollowsPlayer = false;
        
        camera.position.x = worldX;
        camera.position.z = worldZ + 100;
        camera.lookAt(worldX, 0, worldZ);
        
        if (fogMesh) {
            fogMesh.position.x = worldX;
            fogMesh.position.z = worldZ;
        }
    });
    
    const border = document.createElement('div');
    border.style.cssText = 'position: absolute; bottom: 8px; right: 8px; width: 229px; height: 229px; border: 2px solid #666; border-radius: 4px; pointer-events: none;';
    document.body.appendChild(border);
}

function updateMinimap() {
    if (playerMesh) {
        minimapCamera.position.x = playerMesh.position.x;
        minimapCamera.position.z = playerMesh.position.z;
    }
}

function setupLighting() {
    const ambientLight = new THREE.AmbientLight(0x404060, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.left = -120;
    directionalLight.shadow.camera.right = 120;
    directionalLight.shadow.camera.top = 120;
    directionalLight.shadow.camera.bottom = -120;
    scene.add(directionalLight);
}

function createGround() {
    const groundGeometry = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x2d2d44,
        roughness: 0.8,
        metalness: 0.2
    });
    ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.userData = { id: 'ground' };
    scene.add(ground);
}

function createGrid() {
    gridHelper = new THREE.GridHelper(MAP_SIZE, 200, 0x444466, 0x333355);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);
}

function createMapBounds() {
    const boundsMaterial = new THREE.LineBasicMaterial({ color: 0xff4444 });
    const boundsGeometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
        -MAP_HALF, 0.1, -MAP_HALF,
        MAP_HALF, 0.1, -MAP_HALF,
        MAP_HALF, 0.1, -MAP_HALF,
        MAP_HALF, 0.1, MAP_HALF,
        MAP_HALF, 0.1, MAP_HALF,
        -MAP_HALF, 0.1, MAP_HALF,
        -MAP_HALF, 0.1, MAP_HALF,
        -MAP_HALF, 0.1, -MAP_HALF
    ]);
    boundsGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    const bounds = new THREE.LineSegments(boundsGeometry, boundsMaterial);
    scene.add(bounds);
    
    const cornerPositions = [
        [-MAP_HALF, 0, -MAP_HALF],
        [MAP_HALF, 0, -MAP_HALF],
        [MAP_HALF, 0, MAP_HALF],
        [-MAP_HALF, 0, MAP_HALF]
    ];
    
    cornerPositions.forEach(pos => {
        const markerGeometry = new THREE.ConeGeometry(0.2, 0.5, 4);
        const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff4444 });
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.position.set(pos[0], 0.25, pos[2]);
        scene.add(marker);
    });
}

function createFogOfWar() {
    const fogGeometry = new THREE.PlaneGeometry(MAP_SIZE * 4, MAP_SIZE * 4);
    
    const fogMaterial = new THREE.ShaderMaterial({
        uniforms: {
            playerX: { value: 0 },
            playerZ: { value: 0 },
            visibleRadius: { value: 100 },
            fogColor: { value: new THREE.Color(0x000000) },
            fogOpacity: { value: 0.85 }
        },
        vertexShader: `
            varying vec2 vUv;
            varying vec3 vWorldPosition;
            void main() {
                vUv = uv;
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * viewMatrix * worldPosition;
            }
        `,
        fragmentShader: `
            uniform float playerX;
            uniform float playerZ;
            uniform float visibleRadius;
            uniform vec3 fogColor;
            uniform float fogOpacity;
            varying vec2 vUv;
            varying vec3 vWorldPosition;
            
            void main() {
                float dx = vWorldPosition.x - playerX;
                float dz = vWorldPosition.z - playerZ;
                float dist = sqrt(dx * dx + dz * dz);
                
                float fogFactor = smoothstep(visibleRadius * 0.7, visibleRadius, dist);
                
                gl_FragColor = vec4(fogColor, fogOpacity * fogFactor);
            }
        `,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    
    fogMesh = new THREE.Mesh(fogGeometry, fogMaterial);
    fogMesh.rotation.x = -Math.PI / 2;
    fogMesh.position.y = 5;
    scene.add(fogMesh);
}

export function setPlayerVisual(model) {
    if (!playerMesh) return;

    const oldVisual = playerMesh.getObjectByName('player-visual');
    if (oldVisual) {
        playerMesh.remove(oldVisual);
    }

    const placeholder = playerMesh.getObjectByName('player-placeholder');
    if (placeholder) {
        // Remove the temporary sphere once the real GLB model is ready.
        // Keeping both in place can make it look like the wrong mesh is still
        // being used as the player representation.
        playerMesh.remove(placeholder);
    }

    model.name = 'player-visual';
    // Because the model is parented under playerMesh, its transform should be
    // local to the player root. The networking / movement systems update the
    // player root position, and the visual follows automatically.
    prepareModelForWorld(model);
    model.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            child.frustumCulled = false;
        }

        if (child.material) {
            // Force visible front faces while debugging imported assets.
            // Some GLB exports can appear invisible if their winding/material
            // setup does not match the current camera-facing direction.
            child.material.side = THREE.DoubleSide;
        }
    });
    playerMesh.add(model);
}

export function createPlayerModelRoot(model) {
    // Remote players should use the same scene structure as the local player:
    // a root group that receives authoritative/network world coordinates, with
    // the imported GLB attached underneath as the visible character mesh.
    //
    // Using a wrapper/root group keeps movement, selection, visibility, and
    // future hitbox logic separate from the rendered mesh data itself.
    const playerRoot = new THREE.Group();
    playerRoot.userData = { id: 'remote-player-root' };

    model.name = 'player-visual';
    prepareModelForWorld(model);
    model.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            child.frustumCulled = false;
        }
    });

    playerRoot.add(model);
    return playerRoot;
}

function createObstacles(obstacles) {
    if (obstaclesGroup) {
        scene.remove(obstaclesGroup);
    }
    
    obstaclesGroup = new THREE.Group();
    obstaclesGroup.userData = { id: 'obstacles' };
    
    const obstacleMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x885533,
        roughness: 0.9,
        metalness: 0.1
    });
    
    obstacles.forEach(obstacle => {
        const geometry = new THREE.BoxGeometry(obstacle.width, 3, obstacle.height);
        const mesh = new THREE.Mesh(geometry, obstacleMaterial);
        mesh.position.set(obstacle.x, 1.5, obstacle.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { id: obstacle.id };
        obstaclesGroup.add(mesh);
    });
    
    scene.add(obstaclesGroup);
}

function onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
