# PRD 2: Authoritative Simulation and State Sync

## Decomposed Iterative Tasks

- [x] Define player entity model
   - [x] Create Player interface/class with required fields
   - [x] Include: id, position, movement intent, speed, status, team placeholder

- [x] Implement spawn system
   - [x] Define spawn position logic
   - [x] Ensure non-overlapping initial placement
   - [x] Make spawn rules deterministic

- [x] Create movement intent handling
   - [x] Design client-to-server movement message format
   - [x] Implement input validation/sanitization
   - [x] Support click-to-move as primary movement pattern

- [x] Build fixed-tick simulation loop
   - [x] Implement server-side simulation update
   - [x] Advance movement based on tick delta and speed
   - [x] Ensure deterministic behavior for testing

- [x] Enforce world boundaries
   - [x] Define map bounds for prototype
   - [x] Implement position clamping/boundary checking
   - [x] Prevent units from moving outside valid limits

- [x] Implement state replication
   - [x] Design room state structure for player entities
   - [x] Synchronize authoritative state to clients
   - [x] Include local player identity and movement outcomes
   - [x] Keep replication minimal and predictable

- [x] Handle disconnect/leave events
   - [x] Remove or deactivate disconnected player entities
   - [x] Ensure simulation loop remains valid after disconnects
   - [x] Prevent ghost entities in room state

- [x] Establish extensibility foundation
   - [x] Structure code to support teams, combat, abilities later
   - [x] Keep simulation logic separate from gameplay specifics
   - [x] Design for future schema expansion

- [x] Performance baseline
   - [ ] Test with 10 concurrent simulated players
   - [ ] Monitor CPU usage during simulation ticks
   - [x] Avoid expensive full-world computations

- [x] Validation and testing
   - [ ] Verify multiple clients see consistent movement
   - [ ] Confirm server is source of truth for movement
   - [x] Test disconnect cleanup behavior
   - [x] Ensure simplicity for fog-of-war integration

- [x] Implement server-side collision detection
   - [x] Define obstacle/wall data structure
      - [x] Create obstacle interface with id, position, dimensions, type
      - [x] Add initial obstacle definitions to map constants
   - [x] Create collision service
      - [x] Implement point/circle vs AABB obstacle collision check
      - [x] Implement player-to-player collision detection
      - [ ] Implement collision resolution (stop/slide)
   - [x] Integrate collision into movement validation
      - [x] Update validatePosition() to check obstacle collisions
      - [ ] Update updateSimulation() to check player-player collisions
      - [x] Reject movement intents that would cause collision
   - [ ] Broadcast collision data to clients
      - [ ] Send obstacle data to clients on room join
      - [ ] Include obstacle updates in state sync if dynamic

- [x] Collision testing and validation
   - [ ] Test player-player collision resolution
   - [x] Test obstacle collision prevents wall clipping
   - [ ] Verify collision works with fog of war
   - [ ] Performance test with 10 players
