const crankHandle = document.querySelector("#crankHandle");
const crankPivot = document.querySelector("#crankPivot");
const musicBox = document.querySelector(".music-box");
const musicBoxCard = document.querySelector(".music-box-card");
const holdButton = document.querySelector("#holdButton");
const resetButton = document.querySelector("#resetButton");
const soundToggle = document.querySelector("#soundToggle");
const soundLabel = document.querySelector("#soundLabel");
const soundIcon = document.querySelector("#soundIcon");
const instruction = document.querySelector("#instruction");
const reverseHint = document.querySelector("#reverseHint");
const stateLabel = document.querySelector("#stateLabel");
const transitionLabel = document.querySelector("#transitionLabel");
const currentStateCard = document.querySelector(".current-state-card");
const currentStateTitle = document.querySelector("#currentStateTitle");
const currentStateDescription = document.querySelector("#currentStateDescription");
const rotationReadout = document.querySelector("#rotationReadout");
const melodyReadout = document.querySelector("#melodyReadout");
const stateNodes = [...document.querySelectorAll(".state-node")];
const signalSteps = [...document.querySelectorAll(".signal-step")];
const mechanismParts = [...document.querySelectorAll(".map-part")];
const comb = document.querySelector("#comb");

const audio = new Audio("assets/brahms-lullaby-music-box.mp3");
audio.preload = "auto";
audio.volume = 0.78;
audio.loop = true;

const STARTING_ANGLE = -25;
const SECONDS_PER_TURN = 5;
const MUSIC_STEP_DEGREES = 2;
const MOVEMENT_STOP_DELAY = 320;
const MAX_POINTER_DELTA = 55;

let currentState = "idle";
let totalRotation = 0;
let melodyDuration = 0;
let isDragging = false;
let isAutoTurning = false;
let soundEnabled = true;
let lastPointerAngle = 0;
let lastMoveTime = 0;
let autoFrame = null;
let lastAutoTime = 0;
let movementTimer = null;
let reverseTimer = null;
let fadeFrame = null;
let lastPluckBucket = -1;
let pendingSoundDegrees = 0;
let pendingSoundElapsed = 0;

audio.addEventListener("loadedmetadata", () => {
  melodyDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
  updateReadouts();
});

audio.addEventListener("error", () => {
  soundLabel.textContent = "Audio unavailable";
  soundToggle.disabled = true;
});

function normalizeDelta(delta) {
  let normalized = delta;
  while (normalized > 180) normalized -= 360;
  while (normalized < -180) normalized += 360;
  return normalized;
}

function pointerAngle(event) {
  const rect = crankPivot.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  return (Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180) / Math.PI;
}

function setState(nextState, message) {
  if (currentState === nextState && !message) return;

  currentState = nextState;
  const labels = {
    idle: "Idle",
    grabbed: "Handle grabbed",
    cranking: "Playing",
  };
  const transitions = {
    idle: "Waiting for input",
    grabbed: "Handle pressed",
    cranking: "Clockwise motion crossed 2°",
  };
  const descriptions = {
    idle: "The crank is still. The cylinder and melody are paused.",
    grabbed: "The handle is held. Turn clockwise at least 2° to advance the system.",
    cranking: "The worm gear turns the pinned cylinder, the comb is plucked, and the melody flows.",
  };

  stateLabel.textContent = labels[nextState];
  transitionLabel.textContent = message || transitions[nextState];
  currentStateTitle.textContent = labels[nextState];
  currentStateDescription.textContent = descriptions[nextState];
  currentStateCard.dataset.state = nextState;
  musicBoxCard.classList.toggle("is-cranking", nextState === "cranking");
  musicBox.classList.toggle("is-grabbed", nextState !== "idle");

  stateNodes.forEach((node) => {
    node.classList.toggle("is-active", node.dataset.state === nextState);
  });

  const activeStepCount = nextState === "cranking" ? 4 : nextState === "grabbed" ? 1 : 0;
  signalSteps.forEach((step, index) => {
    step.classList.toggle("is-active", index < activeStepCount);
  });

  mechanismParts.forEach((part) => {
    const partNumber = Number(part.dataset.part);
    const isActive = nextState === "cranking" || (nextState === "grabbed" && partNumber === 1);
    part.classList.toggle("is-active", isActive);
  });
}

function renderMechanism() {
  const displayAngle = STARTING_ANGLE + totalRotation;
  document.documentElement.style.setProperty("--crank-angle", `${displayAngle}deg`);
  document.documentElement.style.setProperty("--cylinder-shift", `${totalRotation * 0.24}px`);
  document.documentElement.style.setProperty("--gear-angle", `${totalRotation * 1.6}deg`);
  rotationReadout.textContent = Math.round(totalRotation).toLocaleString();
  updateReadouts();
}

function updateReadouts() {
  if (!melodyDuration) {
    melodyReadout.textContent = "0";
    return;
  }
  const targetTime = ((totalRotation / 360) * SECONDS_PER_TURN) % melodyDuration;
  melodyReadout.textContent = Math.round((targetTime / melodyDuration) * 100);
}

function getTargetTime() {
  if (!melodyDuration) return 0;
  return ((totalRotation / 360) * SECONDS_PER_TURN) % melodyDuration;
}

function cancelFade() {
  if (fadeFrame) cancelAnimationFrame(fadeFrame);
  fadeFrame = null;
  audio.volume = soundEnabled ? 0.78 : 0;
}

function playFromRotation(degrees, elapsedMs) {
  if (!soundEnabled || !melodyDuration) return;

  cancelFade();
  const targetTime = getTargetTime();
  const duration = Math.max(elapsedMs / 1000, 0.016);
  const angularVelocity = degrees / duration;
  const desiredRate = (angularVelocity * SECONDS_PER_TURN) / 360;
  audio.playbackRate = Math.min(1.8, Math.max(0.5, desiredRate));

  // Seek only when beginning a new playback window. Seeking on every pointer
  // event chopped the recording into isolated clicks instead of a melody.
  if (audio.paused) {
    audio.currentTime = targetTime;
  }

  const playPromise = audio.play();
  if (playPromise) playPromise.catch(() => {});
}

function fadeAndPause() {
  if (audio.paused) return;
  if (fadeFrame) cancelAnimationFrame(fadeFrame);

  const startVolume = audio.volume;
  const startTime = performance.now();
  const fadeDuration = 240;

  function fade(now) {
    const progress = Math.min(1, (now - startTime) / fadeDuration);
    audio.volume = startVolume * (1 - progress);
    if (progress < 1) {
      fadeFrame = requestAnimationFrame(fade);
    } else {
      audio.pause();
      if (melodyDuration) audio.currentTime = getTargetTime();
      audio.volume = soundEnabled ? 0.78 : 0;
      fadeFrame = null;
    }
  }

  fadeFrame = requestAnimationFrame(fade);
}

function animatePluck() {
  const bucket = Math.floor(totalRotation / MUSIC_STEP_DEGREES);
  if (bucket === lastPluckBucket) return;
  lastPluckBucket = bucket;
  comb.classList.remove("is-plucked");
  void comb.offsetWidth;
  comb.classList.add("is-plucked");
}

function scheduleMovementStop() {
  window.clearTimeout(movementTimer);
  movementTimer = window.setTimeout(() => {
    if (isDragging) {
      setState("grabbed", "Motion paused");
    } else if (!isAutoTurning) {
      setState("idle");
    }
    fadeAndPause();
  }, MOVEMENT_STOP_DELAY);
}

function advanceByDegrees(degrees, elapsedMs = 16) {
  if (degrees <= 0) return;
  totalRotation += degrees;
  pendingSoundDegrees += degrees;
  pendingSoundElapsed += elapsedMs;
  setState("cranking");
  instruction.classList.add("is-hidden");
  renderMechanism();

  if (pendingSoundDegrees >= MUSIC_STEP_DEGREES) {
    animatePluck();
    playFromRotation(pendingSoundDegrees, pendingSoundElapsed);
    pendingSoundDegrees %= MUSIC_STEP_DEGREES;
    pendingSoundElapsed = 0;
  }

  scheduleMovementStop();
}

function showReverseHint() {
  reverseHint.classList.add("is-visible");
  window.clearTimeout(reverseTimer);
  reverseTimer = window.setTimeout(() => {
    reverseHint.classList.remove("is-visible");
  }, 1200);
}

function beginDrag(event) {
  if (event.button !== undefined && event.button !== 0) return;
  isDragging = true;
  lastPointerAngle = pointerAngle(event);
  lastMoveTime = performance.now();
  setState("grabbed");
  crankHandle.setPointerCapture?.(event.pointerId);
  event.preventDefault();
}

function continueDrag(event) {
  if (!isDragging) return;

  const nextAngle = pointerAngle(event);
  const delta = normalizeDelta(nextAngle - lastPointerAngle);
  const now = performance.now();
  const elapsed = now - lastMoveTime;
  lastPointerAngle = nextAngle;
  lastMoveTime = now;

  if (delta > 0 && delta < MAX_POINTER_DELTA) {
    advanceByDegrees(delta, elapsed);
  } else if (delta < -1 && Math.abs(delta) < MAX_POINTER_DELTA) {
    setState("grabbed", "Reverse motion ignored");
    showReverseHint();
    scheduleMovementStop();
  }
}

function endDrag(event) {
  if (!isDragging) return;
  isDragging = false;
  crankHandle.releasePointerCapture?.(event.pointerId);
  window.clearTimeout(movementTimer);
  setState("idle", "Handle released");
  fadeAndPause();
}

function startAutoTurn(event) {
  if (isAutoTurning) return;
  event?.preventDefault();
  isAutoTurning = true;
  holdButton.classList.add("is-active");
  setState("cranking", "Accessible control held");
  lastAutoTime = performance.now();

  function turn(now) {
    if (!isAutoTurning) return;
    const elapsed = Math.min(50, now - lastAutoTime);
    lastAutoTime = now;
    advanceByDegrees((elapsed / 1000) * 72, elapsed);
    autoFrame = requestAnimationFrame(turn);
  }

  autoFrame = requestAnimationFrame(turn);
}

function stopAutoTurn() {
  if (!isAutoTurning) return;
  isAutoTurning = false;
  holdButton.classList.remove("is-active");
  if (autoFrame) cancelAnimationFrame(autoFrame);
  autoFrame = null;
  window.clearTimeout(movementTimer);
  setState("idle", "Control released");
  fadeAndPause();
}

crankHandle.addEventListener("pointerdown", beginDrag);
crankHandle.addEventListener("pointermove", continueDrag);
crankHandle.addEventListener("pointerup", endDrag);
crankHandle.addEventListener("pointercancel", endDrag);

holdButton.addEventListener("pointerdown", startAutoTurn);
holdButton.addEventListener("pointerup", stopAutoTurn);
holdButton.addEventListener("pointercancel", stopAutoTurn);

holdButton.addEventListener("keydown", (event) => {
  if ((event.key === " " || event.key === "Enter") && !event.repeat) startAutoTurn(event);
});

holdButton.addEventListener("keyup", (event) => {
  if (event.key === " " || event.key === "Enter") stopAutoTurn();
});

holdButton.addEventListener("blur", stopAutoTurn);

function isEditableTarget(target) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

window.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowRight" || isEditableTarget(event.target)) return;
  event.preventDefault();
  if (!event.repeat) startAutoTurn(event);
});

window.addEventListener("keyup", (event) => {
  if (event.key !== "ArrowRight" || isEditableTarget(event.target)) return;
  event.preventDefault();
  stopAutoTurn();
});

window.addEventListener("blur", stopAutoTurn);

soundToggle.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  soundToggle.setAttribute("aria-pressed", String(soundEnabled));
  soundLabel.textContent = soundEnabled ? "Sound on" : "Sound off";
  soundIcon.textContent = soundEnabled ? "◖))" : "◖×";
  audio.volume = soundEnabled ? 0.78 : 0;
  if (!soundEnabled) {
    audio.pause();
  }
});

resetButton.addEventListener("click", () => {
  stopAutoTurn();
  isDragging = false;
  totalRotation = 0;
  lastPluckBucket = -1;
  pendingSoundDegrees = 0;
  pendingSoundElapsed = 0;
  audio.pause();
  audio.currentTime = 0;
  audio.volume = soundEnabled ? 0.78 : 0;
  setState("idle", "System reset");
  renderMechanism();
});

window.addEventListener("pointerup", () => {
  if (isAutoTurning) stopAutoTurn();
});

renderMechanism();
setState("idle");
