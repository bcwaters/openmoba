# PRD 2: Authoritative Simulation and State Sync

Status: Approved
Priority: P0
Scope: Backend
Depends on: PRD 1

## Purpose

Define the authoritative backend gameplay loop for OpenMOBA so the server, not the client, owns player state and movement. This PRD establishes the minimum simulation model required to support one controllable unit per player in a competitive top-down environment.

## Problem Statement

A competitive MOBA cannot trust the client as the source of truth for movement or gameplay state. If the client controls its own authoritative position, cheating, desync, and invalid fog-of-war interactions become much more likely.

The backend therefore needs a fixed simulation model that accepts player intent, updates state on the server, and replicates only the necessary state to connected clients.

## Goals

1. Represent one server-owned player unit per connected player.
2. Accept movement intent from clients instead of raw position authority.
3. Simulate movement on the server at a fixed tick rate.
4. Replicate authoritative state to clients consistently.
5. Support up to 10 concurrent players in a room.
6. Keep v1 movement simple enough to validate networking before adding full MOBA complexity.

## Non-Goals

This PRD does not include:

- combat
- abilities
- projectiles
- minions
- towers
- items
- navmesh-based pathfinding
- persistence of match state after shutdown

## Current Design Assumptions

These are current assumptions and can be revised later:

- one controllable unit per player
- top-down map
- competitive multiplayer
- no combat in the first playable backend slice
- simple movement across a bounded prototype map
- direct server simulation is more important than perfect movement feel in the first version
- client interpolation is allowed, but client authority is not

## Functional Requirements

### 1. Player Entity Model
The backend must represent a player entity with at least:

- player/session identifier
- current position
- movement target or current intent
- movement speed
- connection or activity status
- team or faction placeholder field, even if not used yet

### 2. Spawn Rules
- A player joining the room must receive a valid spawn position.
- Spawn logic must avoid invalid or overlapping initial placement where practical.
- Spawn rules may be simple for v1 but must be deterministic.

### 3. Movement Intent Handling
- The client must send movement intent, not authoritative position updates.
- The backend must validate incoming movement commands.
- Invalid movement input must be ignored or sanitized.
- The backend should support one primary movement pattern first.

Current recommended assumption for planning:
- click-to-move with a target world position

If this changes later, the server intent interface should still remain small and explicit.

### 4. Fixed-Tick Simulation
- The backend must update room simulation on a fixed tick.
- Movement must be advanced on the server according to tick delta and movement speed.
- The simulation loop must be deterministic enough for consistent local testing.

### 5. World Boundaries
- The backend must enforce map bounds.
- Units must not move outside valid world limits.
- Boundary enforcement is handled via position clamping.

### 6. Collision Detection
The backend must detect and respond to collisions to prevent players from overlapping and passing through obstacles.

#### 6.1 Player-Player Collision
- The backend must prevent two player units from occupying the same space.
- Player units have a collision radius defined in their entity.
- When two players attempt to move into the same position, the server must resolve the collision.
- Initial collision resolution: stop/slide approach where colliding players cannot pass through each other.

#### 6.2 Obstacle Collision
- The backend must define obstacle/wall data structures in the map.
- Obstacles are defined with position, dimensions (width, height/depth), and type.
- Player movement intents must be validated against obstacle positions.
- Movement that would result in collision with an obstacle must be rejected or resolved.

#### 6.3 Collision Data Structures
Obstacle definition must include:
- id: unique identifier
- x, z: position
- width, depth: dimensions
- type: wall, rock, building, etc.

### 7. State Replication
- Authoritative state must be synchronized to clients through Colyseus room state and/or messages.
- The data contract must be structured so clients can render:
  - current known player positions
  - local player identity
  - movement outcomes from the server
- Replication should be minimal and predictable.

### 7. Leave / Disconnect Handling
- When a player disconnects or leaves, their entity must be removed or marked inactive cleanly.
- The simulation loop must remain valid after disconnects.
- Ghost entities must not remain active in the room state.

## Non-Functional Requirements

### Fairness
- The server must be the source of truth for movement.
- Clients must never be allowed to self-authorize location changes.

### Simplicity
- The first simulation slice should prefer clarity over feature completeness.
- Pathfinding and advanced terrain interaction should be deferred.

### Extensibility
- The simulation structure should support later addition of:
  - teams
  - combat
  - abilities
  - minions
  - lane logic
  - more complex state schemas

### Performance
- The simulation should support 10 players in a room without heavy CPU cost.
- The initial model should avoid expensive full-world computations each tick beyond what is needed.

## Suggested V1 State Model

At minimum, the backend should later define:

- room state
- players collection
- player entity state
- match metadata
- optional simulation config block

Recommended future fields for player state:

- id
- x
- y
- z
- speed
- targetX
- targetY
- facing
- teamId
- connected

Exact schema shape can be decided later, but the server contract should remain small and explicit.

## Open Questions

1. Should the first movement prototype be click-to-move or keyboard intent?
2. Will the top-down camera use orthographic or angled perspective projection? This affects input mapping but not core server authority.
3. Should v1 be free-for-all for easier testing, or structured as 5v5 immediately?
4. How much simulation detail should be in Colyseus schema versus transient messages?
5. Should the backend expose debug state for local development?

## Success Metrics

- Multiple clients can join the same room and see consistent movement results.
- A player's movement is determined by the server rather than client self-reporting.
- Disconnecting players are cleaned from active simulation state.
- The system remains understandable enough to extend in later PRDs.

## Acceptance Criteria

1. A backend room state exists for active players.
2. A connected player receives a server-owned entity.
3. The backend accepts movement intent messages.
4. The backend advances unit movement on a fixed simulation tick.
5. The backend enforces map bounds.
6. Connected clients receive consistent authoritative state.
7. Leaving or disconnected players are removed or deactivated correctly.
8. The simulation design stays simple enough to support later fog-of-war integration.
9. Player-player collision is detected and resolved on the server.
10. Obstacle collision is detected and prevents movement through walls.
11. Collision data is available to clients for rendering.

## Decomposition Candidates

This PRD can later be split into smaller PRDs such as:

- player state schema
- spawn system
- movement command protocol
- simulation tick architecture
- map bounds and collision rules
- reconnect and resume behavior
