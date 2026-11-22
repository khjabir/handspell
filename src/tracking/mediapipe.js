// Loads Google's MediaPipe hand landmarker from public CDNs the first time it is needed;
// the browser caches it after that. Everything runs on this device.

export const TASKS_VERSION = '1.2.3';
export const BUNDLE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VERSION}/vision_bundle.mjs`;
export const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VERSION}/wasm`;
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

/** Add ?cpu to the address to keep MediaPipe off the GPU (some graphics drivers misbehave). */
export const forceCpu = () => new URLSearchParams(location.search).has('cpu');

/** Detection thresholds. Two hands that touch are harder to find, so ISL looks harder. */
const SENSITIVITY = {
  normal: { minHandDetectionConfidence: 0.6, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5 },
  twoHands: { minHandDetectionConfidence: 0.45, minHandPresenceConfidence: 0.4, minTrackingConfidence: 0.4 },
};

export class HandTracker {
  constructor() {
    this.landmarker = null;
    this.loading = null;
    this.delegate = null;
    this.lastTs = 0;
    this.sensitivity = 'normal';
  }

  /** 'normal' or 'twoHands' */
  setSensitivity(kind) {
    this.sensitivity = SENSITIVITY[kind] ? kind : 'normal';
    if (this.landmarker) this.landmarker.setOptions(SENSITIVITY[this.sensitivity]).catch?.(() => {});
  }

  init() {
    if (!this.loading) {
      this.loading = (async () => {
        const vision = await import(/* webpackIgnore: true */ BUNDLE_URL);
        const files = await vision.FilesetResolver.forVisionTasks(WASM_URL);
        const make = (delegate) => vision.HandLandmarker.createFromOptions(files, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate },
          runningMode: 'VIDEO',
          numHands: 2,
          ...SENSITIVITY[this.sensitivity],
        });
        if (!forceCpu()) {
          try {
            this.landmarker = await make('GPU');
            this.delegate = 'GPU';
            return this;
          } catch (err) {
            console.warn('Hand tracking: GPU unavailable, using the CPU', err);
          }
        }
        this.landmarker = await make('CPU');
        this.delegate = 'CPU';
        return this;
      })();
      this.loading.catch(() => { this.loading = null; });
    }
    return this.loading;
  }

  detect(source) {
    if (!this.landmarker) return null;
    let ts = performance.now();
    if (ts <= this.lastTs) ts = this.lastTs + 1;
    this.lastTs = ts;
    return this.landmarker.detectForVideo(source, ts);
  }
}
