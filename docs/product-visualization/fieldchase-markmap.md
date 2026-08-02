# Field Chase

## Player experience

### Start
- Open the browser game
- Tap to begin
- Pickup enters the cornfield automatically

### Core play
- Move forward continuously
- Steer left or right
- Keep aligned with the airborne drone
- Leave crushed-corn trails and dust

### World progression
- Green cornfield
- Dry golden field
- Shoreline
- Water boundary

### Finish challenge
- Wait for the brake window
- Brake before time expires
- Stop inside the brake zone
- Remain aligned with the drone

### Outcomes
- Win
- Fail
- Restart

## Current systems

### Platform
- Static browser game
- Mobile-first portrait layout
- Keyboard fallback

### Rendering
- HTML canvas
- Pixel-art visual style
- Terrain and vehicle effects

### Input
- Touch left
- Touch right
- Touch brake
- Keyboard steering
- Keyboard brake

### Audio
- Background music
- Green-field ambience
- Dry-field ambience
- Braking sound

## Product questions

### Comprehension
- Is the objective obvious?
- Do players recognise the drone-alignment requirement?
- Is the brake window clearly communicated?

### Difficulty
- Is steering predictable?
- Is the brake timing fair?
- Is failure understandable?

### Performance
- Does it load quickly on mobile networks?
- Does canvas rendering remain smooth?
- Does audio initialise reliably after user interaction?

### Retention
- Do players restart after a failure?
- Is a single successful run satisfying?
- Would a score create meaningful replay value?

## Possible opportunities

### Core-loop improvements
- Tutorial cues
- Better feedback for alignment
- Clearer brake-zone indicators
- Faster restart

### Progression
- Multiple levels
- Difficulty tiers
- Unlockable vehicles
- New environments

### Replay systems
- Score
- Personal best
- Daily challenge
- Leaderboard

### Distribution
- Installable PWA
- Shareable result cards
- Lightweight analytics

## Planning

### Now
- Validate controls
- Document game-state rules
- Measure the completion funnel

### Next
- Improve onboarding
- Balance steering and braking
- Add score and personal best

### Later
- Add levels
- Add challenge modes
- Add social or sharing features
