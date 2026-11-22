// Finds a face in the camera picture, for the ISL letter I (an index finger pointing to the
// face, just under the eye). Uses MediaPipe's small face detector from the same CDN as the
// hand tracker; it is only loaded when the ISL alphabet is in use.
import { BUNDLE_URL, WASM_URL, forceCpu } from './mediapipe.js';

const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

export class FaceTracker {
  constructor() {
    this.detector = null;
    this.loading = null;
    this.lastTs = 0;
    this.last = null; // { t, eyes: [{x, y}, {x, y}] } in raw picture coordinates
  }

  init() {
    if (!this.loading) {
      this.loading = (async () => {
        const vision = await import(/* webpackIgnore: true */ BUNDLE_URL);
        const files = await vision.FilesetResolver.forVisionTasks(WASM_URL);
        const make = (delegate) => vision.FaceDetector.createFromOptions(files, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate },
          runningMode: 'VIDEO',
          minDetectionConfidence: 0.6,
        });
        try {
          this.detector = await make(forceCpu() ? 'CPU' : 'GPU');
        } catch (err) {
          this.detector = await make('CPU');
        }
        return this;
      })();
      this.loading.catch(() => { this.loading = null; });
    }
    return this.loading;
  }

  /** Look for a face; returns the latest face seen in the last half second, or null. */
  detect(source, t) {
    if (this.detector) {
      let ts = performance.now();
      if (ts <= this.lastTs) ts = this.lastTs + 1;
      this.lastTs = ts;
      const res = this.detector.detectForVideo(source, ts);
      const d = res && res.detections && res.detections[0];
      // Key points: right eye, left eye, nose tip, mouth, right ear, left ear
      if (d && d.keypoints && d.keypoints.length >= 2) this.last = { t, eyes: d.keypoints.slice(0, 2).map((k) => ({ x: k.x, y: k.y })) };
    }
    return this.last && t - this.last.t < 0.5 ? this.last : null;
  }
}
