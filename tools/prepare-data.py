"""Turns the landmark CSVs from Ponnala and Kaleem's ASL fingerspelling repository
(https://github.com/rameshponnala-blip/Hand-Landmark, data/landmarks/*.csv.gz) into
tools/data/samples.json, which the other tools read.

    python3 tools/prepare-data.py path/to/Hand-Landmark/data/landmarks

Needs pandas and numpy. Keeps all Surrey and ASL Alphabet Test rows and 400 random
ASL Alphabet rows per letter (that collection is one signer, so more adds little).
"""
import json, os, sys
import numpy as np
import pandas as pd

src = sys.argv[1] if len(sys.argv) > 1 else 'Hand-Landmark/data/landmarks'
out = os.path.join(os.path.dirname(__file__), 'data', 'samples.json')
os.makedirs(os.path.dirname(out), exist_ok=True)
cols = [f'{a}{i}' for i in range(21) for a in 'xyz']
frames = []
for name in ['landmarks_surrey', 'landmarks_test', 'landmarks_alphabet']:
    df = pd.read_csv(os.path.join(src, f'{name}.csv.gz'))
    df = df[df['label'].str.len() == 1]
    df = df[~df['method'].isin(['none', 'unreadable'])].dropna(subset=cols)
    if name == 'landmarks_alphabet':
        df = df.groupby('label').sample(n=400, random_state=1)
    frames.append(df[['label', 'signer', 'method', 'handedness'] + cols])
    print(name, len(df))
all_ = pd.concat(frames)
meta = all_[['label', 'signer', 'method', 'handedness']].astype(str).values.tolist()
vals = np.round(all_[cols].to_numpy(dtype=float), 5).tolist()
json.dump([m + v for m, v in zip(meta, vals)], open(out, 'w'))
print('wrote', out)
