# Field Chase gameplay workflow

## Player journey

```mermaid
flowchart TD
    A[Open Field Chase] --> B[Tap to start]
    B --> C[Pickup enters the cornfield]
    C --> D[Forward movement continues automatically]
    D --> E[Player steers left or right]
    E --> F[Align pickup with airborne drone]
    F --> G[Progress through green cornfield]
    G --> H[Enter dry golden field]
    H --> I[Approach shoreline]
    I --> J{Brake window active?}
    J -->|No| E
    J -->|Yes| K[Player brakes]
    K --> L{Stopped in brake zone?}
    L -->|No| N[Fail state]
    L -->|Yes| M{Aligned with drone?}
    M -->|No| N
    M -->|Yes| O[Win state]
    N --> P[Restart]
    O --> P
    P --> B
```

## Game-state model

```mermaid
stateDiagram-v2
    [*] --> Ready
    Ready --> Intro: tap to start
    Intro --> Playing: entry sequence completes
    Playing --> BrakeWindow: shoreline threshold reached
    BrakeWindow --> Won: stopped in zone and aligned
    BrakeWindow --> Failed: timer expires or finish conditions fail
    Playing --> Failed: terminal failure condition
    Won --> Ready: restart
    Failed --> Ready: restart
```

## Product instrumentation candidates

These are proposed analytics events, not current implementation requirements.

```mermaid
flowchart LR
    S[session_started] --> T[first_steer]
    T --> D[dry_field_reached]
    D --> B[brake_window_started]
    B --> R[brake_pressed]
    R --> X{Result}
    X -->|Win| W[session_won]
    X -->|Fail| F[session_failed]
    W --> A[restart_or_exit]
    F --> A
```

Useful event properties could include session duration, steering corrections, alignment error, brake timing, device type, viewport size, and retry count.
