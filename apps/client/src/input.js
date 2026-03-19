import * as THREE from 'three';

let keysPressed = {};
let mousePos = { x: 0, y: 0 };
let isMouseDown = false;
let playerSpeed = 5.0; // units per second
let playerMesh = null;
let camera = null;
let targetMesh = null;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();

export function initInput(getPlayerMeshFn, getCameraFn, getTargetMeshFn) {
    playerMesh = getPlayerMeshFn();
    camera = getCameraFn();
    targetMesh = getTargetMeshFn();
    
    // Keyboard input
    window.addEventListener('keydown', (e) => {
        keysPressed[e.code] = true;
    });
    
    window.addEventListener('keyup', (e) => {
        keysPressed[e.code] = false;
    });
    
    // Mouse input for click-to-move
    window.addEventListener('mousedown', (e) => {
        isMouseDown = true;
        // Convert mouse position to normalized device coordinates
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });
    
    window.addEventListener('mouseup', (e) => {
        isMouseDown = false;
    });
    
    window.addEventListener('mousemove', (e) => {
        mousePos.x = e.clientX;
        mousePos.y = e.clientY;
        // Update mouse position for raycasting
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });
    
    return {
        update: (deltaTime, sendMovementIntentFn) => {
            if (!playerMesh || !camera) return;
            
            // Handle click-to-move
            if (isMouseDown) {
                raycaster.setFromCamera(mouse, camera);
                
                const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
                const intersectPoint = new THREE.Vector3();
                raycaster.ray.intersectPlane(plane, intersectPoint);
                
                if (!isNaN(intersectPoint.x) && !isNaN(intersectPoint.z)) {
                    if (targetMesh) {
                        targetMesh.position.set(intersectPoint.x, 0.02, intersectPoint.z);
                        targetMesh.visible = true;
                    }
                    sendMovementIntentFn(intersectPoint.x, 0, intersectPoint.z);
                    return;
                }
            }
            
            // Process keyboard input for movement (fallback)
            const moveX = (keysPressed['KeyD'] || keysPressed['ArrowRight'] ? 1 : 0) -
                          (keysPressed['KeyA'] || keysPressed['ArrowLeft'] ? 1 : 0);
            const moveZ = (keysPressed['KeyS'] || keysPressed['ArrowDown'] ? 1 : 0) -
                          (keysPressed['KeyW'] || keysPressed['ArrowUp'] ? 1 : 0);
            
            if (moveX !== 0 || moveZ !== 0) {
                // Normalize diagonal movement
                const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
                const nx = moveX / length;
                const nz = moveZ / length;
                
                // Get current player position
                const pos = playerMesh.position;
                
                // Calculate target position based on current position + movement
                const targetX = pos.x + nx * playerSpeed * deltaTime * 10; // Scale for responsiveness
                const targetZ = pos.z + nz * playerSpeed * deltaTime * 10;
                
                // Send movement intent to server
                sendMovementIntentFn(targetX, pos.y, targetZ);
            }
        }
    };
}
