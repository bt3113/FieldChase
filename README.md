# Field Chase

A vertical mobile pixel-art chase game inspired by a cornfield pursuit.

## Current build

Field Chase is a static browser game. It runs from `index.html` and uses a single canvas renderer in `src/game.js`.

## Game loop

1. Tap to start.
2. The pickup enters the cornfield automatically at constant speed.
3. After the entry sequence, steer left or right to align with the airborne drone.
4. The truck leaves persistent crushed-corn trail marks and dust wherever it drives.
5. The world progresses from cornfield to dry golden field to plain shoreline and water.
6. When the brake window starts near the shoreline, brake before the timer expires.
7. Win by stopping in the brake zone while aligned with the drone.

## Controls

Mobile:
- Left half: steer left
- Right half: steer right
- Bottom center: brake

Keyboard:
- A / Left Arrow: steer left
- D / Right Arrow: steer right
- Space / S / Down Arrow: brake

## Files

- `index.html` - mobile canvas shell
- `styles.css` - fullscreen portrait layout
- `src/game.js` - renderer, terrain, vehicle physics, drone alignment, brake timer, win/fail states
