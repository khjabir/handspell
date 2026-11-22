"""Runs MediaPipe's hand landmarker (up to two hands) over an ISL alphabet image folder
laid out as <root>/<LETTER>/*.jpg, and writes one JSON line per image:

    {"letter": "A", "file": "A/1.jpg", "w": 640, "h": 480,
     "hands": [{"label": "Left", "score": 0.99, "lm": [[x, y, z] x 21]}]}

    pip install mediapipe
    python3 tools/isl-extract.py <root> tools/data/isl/realsign-train.jsonl --model hand_landmarker.task
    python3 tools/isl-extract.py <root> tools/data/isl/mendeley.jsonl --model hand_landmarker.task

--mirror flips every picture left to right, for a collection photographed the other way round
from the others. (The app tries every camera picture both ways round anyway.)

Download the hand model from
https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task
"""
import argparse, glob, json, os
import numpy as np
import mediapipe as mp
from PIL import Image
from mediapipe.tasks import python as mpt
from mediapipe.tasks.python import vision

ap = argparse.ArgumentParser()
ap.add_argument('root')
ap.add_argument('out')
ap.add_argument('--model', default='hand_landmarker.task')
ap.add_argument('--mirror', action='store_true', help='flip left and right (see above)')
ap.add_argument('--upscale', type=int, default=0, help='enlarge pictures smaller than this many pixels across first (helps tiny photos)')
args = ap.parse_args()

det = vision.HandLandmarker.create_from_options(vision.HandLandmarkerOptions(
    base_options=mpt.BaseOptions(model_asset_path=args.model),
    running_mode=vision.RunningMode.IMAGE, num_hands=2,
    min_hand_detection_confidence=0.4, min_hand_presence_confidence=0.4))

os.makedirs(os.path.dirname(args.out) or '.', exist_ok=True)
with open(args.out, 'w') as fo:
    for letter in sorted(os.listdir(args.root)):
        files = sorted(glob.glob(os.path.join(args.root, letter, '*.*')))
        for f in files:
            pil = Image.open(f).convert('RGB')
            if args.upscale and max(pil.size) < args.upscale:
                k = args.upscale / max(pil.size)
                pil = pil.resize((round(pil.width * k), round(pil.height * k)), Image.BICUBIC)
            img = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.asarray(pil))
            r = det.detect(img)
            hands = []
            for lm, hd in zip(r.hand_landmarks, r.handedness):
                label = hd[0].category_name
                pts = [[round(p.x, 5), round(p.y, 5), round(p.z, 5)] for p in lm]
                if args.mirror:
                    label = 'Right' if label == 'Left' else 'Left'
                    pts = [[round(1 - x, 5), y, z] for x, y, z in pts]
                hands.append({'label': label, 'score': round(hd[0].score, 3), 'lm': pts})
            row = {'letter': letter, 'file': os.path.relpath(f, args.root), 'w': img.width, 'h': img.height, 'hands': hands}
            fo.write(json.dumps(row) + '\n')
        print(letter, len(files), flush=True)
