# The Wooden Lullaby

The Wooden Lullaby is an interactive hand-cranked music box built with HTML, CSS, and JavaScript. It explores how a physical interaction can be described as a system of clear states, transitions, inputs, processes, and outputs.

## Interaction

- Drag the crank clockwise with a mouse or touchscreen.
- Hold the **Hold to turn** control for an accessible alternative.
- Hold the **Right Arrow** key anywhere on the page to operate the mechanism by keyboard.
- Counterclockwise movement is ignored.
- Every 2° of clockwise rotation advances the musical sequence.

## State model

| State | Condition | System behavior |
| --- | --- | --- |
| **Idle** | No input | Crank, cylinder, and melody are paused. |
| **Grabbed** | Handle is pressed | The system waits for clockwise movement. |
| **Playing** | Clockwise movement reaches 2° | The mechanism advances and the melody plays. |

Releasing the crank or accessible control returns the system to **Idle**.

## Mechanical sequence

The bird's-eye mechanism map connects four visible steps:

1. The hand turns the crank.
2. The worm gear transfers the rotation.
3. The pinned cylinder advances.
4. The pins pluck the metal comb and produce music.

## Project files

```text
music-box/
├── index.html
├── styles.css
├── script.js
└── assets/
    └── brahms-lullaby-music-box.mp3
```

## Run locally

From the project directory, start a local web server:

```bash
python3 -m http.server 4173
```

Then open [http://localhost:4173](http://localhost:4173) in a browser.

## Built with

- Semantic HTML
- Responsive CSS
- Vanilla JavaScript
- Native browser audio

## Audio

The project uses a supplied music-box recording of *Brahms' Lullaby*. Confirm the recording's redistribution terms before reusing it outside this project.
