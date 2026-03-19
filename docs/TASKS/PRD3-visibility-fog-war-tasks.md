# PRD 3: Visibility, Fog of War, and Competitive Integrity

## Decomposed Iterative Tasks

- [x] Define vision model
   - [x] Establish circular vision radius around player units
   - [x] Set initial vision radius value
   - [x] Determine if vision is individual or team-based

- [x] Implement visibility computation
   - [x] Create system to calculate visible entities per player
   - [x] Run visibility checks on regular cadence
   - [x] Structure for future rule enhancements

- [x] Build information filtering
   - [x] Implement omission-based hiding of unauthorized enemy state
   - [x] Allow broader visibility for friendly/self entities
   - [x] Make filtering model explicit and testable

- [x] Design client contract
   - [x] Provide visible area information to clients
   - [x] Send currently visible allied/enemy entities
   - [x] Include local player identity and entity state
   - [x] Add optional debug visibility data (dev builds only)

- [x] Handle state transitions
   - [ ] Make units entering visibility available promptly
   - [ ] Remove units leaving visibility from authoritative state
   - [ ] Integrate disconnects/deaths with visibility rules

- [x] Ensure team compatibility
   - [x] Design visibility system for future 5v5 support
   - [x] Ensure team/ally rules don't require rewrites
   - [ ] Verify compatibility with free-for-all prototypes

- [x] Performance optimization
   - [x] Keep visibility computation affordable for 10 players
   - [x] Favor clear, predictable algorithms
   - [ ] Test performance impact with max players

- [x] Extensibility preparation
   - [x] Structure for explored-memory fog addition
   - [ ] Prepare for terrain occlusion integration
   - [ ] Design for vision-providing entities (wards)
   - [x] Plan for team-wide shared vision

- [x] Testing and validation
   - [ ] Verify clients only see server-allowed enemy entities
   - [ ] Test reliable reveal/hide when moving in/out of range
   - [ ] Ensure system is explainable and unambiguous
   - [ ] Validate compatibility with 5v5 team design
