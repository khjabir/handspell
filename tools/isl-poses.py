"""Builds the ISL reference poses in src/hand3d/isl-poses.js.

For each letter, one clear photo from the collections (chosen by eye from the most typical
ones, see PICK) has an anatomical hand model fitted to each hand's MediaPipe landmarks. The
model has fixed bone lengths, joints that only bend the way fingers bend, and a palm of a
fixed shape, so the drawing comes out clean even where the landmarks were noisy or a finger
was hidden. Where a fingertip almost touches the other hand, the hands are nudged so it does.

    pip install numpy scipy
    python3 tools/isl-poses.py

Reads tools/data/isl/*.jsonl (see isl-extract.py).
"""
import json, os
import numpy as np
from scipy.optimize import least_squares
from scipy.spatial.transform import Rotation as Rot

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = {'realsign': ['realsign-train.jsonl', 'realsign-test.jsonl'], 'mendeley': ['mendeley.jsonl']}
# letter -> (collection, photo)
PICK = {
    'A': ('realsign', 'A/1.jpg'), 'B': ('mendeley', 'B/7.jpg'), 'C': ('realsign', 'C/969.jpg'), 'D': ('realsign', 'D/101.jpg'),
    'E': ('realsign', 'E/111.jpg'), 'F': ('realsign', 'F/198.jpg'), 'G': ('mendeley', 'G/9.jpg'), 'H': ('realsign', 'H/191.jpg'),
    'I': ('realsign', 'I/367.jpg'), 'J': ('mendeley', 'J/1.jpg'), 'K': ('mendeley', 'K/20.jpg'), 'L': ('realsign', 'L/891.jpg'),
    'M': ('realsign', 'M/545.jpg'), 'N': ('realsign', 'N/723.jpg'), 'O': ('realsign', 'O/22.jpg'), 'P': ('realsign', 'P/53.jpg'),
    'Q': ('realsign', 'Q/Q_aap_71.jpg'), 'R': ('mendeley', 'R/18.jpg'), 'S': ('realsign', 'S/706.jpg'), 'T': ('mendeley', 'T/5.jpg'),
    'U': ('realsign', 'U/220.jpg'), 'V': ('realsign', 'V/V_ash_50.jpg'), 'W': ('mendeley', 'W/12.jpg'), 'X': ('mendeley', 'X/12.jpg'),
    'Y': ('realsign', 'Y/164.jpg'), 'Z': ('mendeley', 'Z/2.jpg'),
}

# Letters built on an index finger held up as a post: the picture is turned so the post stands
# straight up, as on the ISLRTC chart.
UPRIGHT = set('DKPQT')

# ---------- the hand model ----------
# Right hand, in its own frame: x towards the index side, y from the wrist to the middle knuckle
# (length 1), z out of the palm. Palm layout and bone lengths are medians from the Mendeley photos.
BASE = {0: (0, 0, 0), 1: (0.258, 0.281, 0.234), 5: (0.214, 1.028, 0.06), 9: (0, 1, 0), 13: (-0.227, 0.894, 0.008), 17: (-0.443, 0.764, 0.06)}
LEN = {'thumb': (0.395, 0.333, 0.263), 'index': (0.499, 0.303, 0.238), 'middle': (0.609, 0.298, 0.213), 'ring': (0.578, 0.274, 0.213), 'pinky': (0.456, 0.202, 0.182)}
FING = [('index', 5, 0.10), ('middle', 9, 0.0), ('ring', 13, -0.10), ('pinky', 17, -0.22)]
THUMB_REST = np.array([0.62, 0.62, 0.48]) / np.linalg.norm([0.62, 0.62, 0.48])
NP = 28  # 4 fingers x (knuckle bend, sideways, middle joint, end joint); thumb (3 rotation, 2 bends); 3 rotation, 3 position, 1 log size

def rx(t):
    c, s = np.cos(t), np.sin(t)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])

def rz(t):
    c, s = np.cos(t), np.sin(t)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])

def local_points(q):
    P = np.zeros((21, 3))
    for i, v in BASE.items(): P[i] = v
    for f, (name, base, splay) in enumerate(FING):
        m, a, p, d = q[4 * f: 4 * f + 4]
        l1, l2, l3 = LEN[name]
        R1 = rz(splay + a) @ rx(m); R2 = R1 @ rx(p); R3 = R2 @ rx(d)
        P[base + 1] = P[base] + R1 @ [0, l1, 0]
        P[base + 2] = P[base + 1] + R2 @ [0, l2, 0]
        P[base + 3] = P[base + 2] + R3 @ [0, l3, 0]
    y0 = THUMB_REST; x0 = np.cross(y0, [0, 0, 1.0]); x0 /= np.linalg.norm(x0); z0 = np.cross(x0, y0)
    R1 = Rot.from_rotvec(q[16:19]).as_matrix() @ np.stack([x0, y0, z0], 1)
    R2 = R1 @ rx(q[19]); R3 = R2 @ rx(q[20])
    l1, l2, l3 = LEN['thumb']
    P[2] = P[1] + R1 @ [0, l1, 0]; P[3] = P[2] + R2 @ [0, l2, 0]; P[4] = P[3] + R3 @ [0, l3, 0]
    return P

def world(q, chir):
    P = local_points(q)
    if chir < 0: P = P * [-1, 1, 1]
    return (P @ Rot.from_rotvec(q[21:24]).as_matrix().T) * np.exp(q[27]) + q[24:27]

LO = np.array([-0.35, -0.35, -0.3, -0.25] * 4 + [-1.6, -1.6, -1.6, -0.6, -0.5] + [-np.inf] * 6 + [-3])
HI = np.array([1.75, 0.35, 1.9, 1.6] * 4 + [1.6, 1.6, 1.6, 1.3, 1.3] + [np.inf] * 6 + [3])

def start(T, chir, curl):
    q = np.zeros(NP)
    q[:16] = [curl, 0, curl, curl * 0.6] * 4
    q[19:21] = curl * 0.5
    L = np.array([BASE[i] for i in [0, 1, 5, 9, 13, 17]], float) * ([-1, 1, 1] if chir < 0 else 1)
    X = T[[0, 1, 5, 9, 13, 17]]
    Lc, Xc = L - L.mean(0), X - X.mean(0)
    U, S, Vt = np.linalg.svd(Lc.T @ Xc)
    R = Vt.T @ np.diag([1, 1, np.sign(np.linalg.det(Vt.T @ U.T))]) @ U.T
    s = np.linalg.norm(X[3] - X[0])
    q[21:24] = Rot.from_matrix(R).as_rotvec(); q[27] = np.log(s)
    q[24:27] = X.mean(0) - (L.mean(0) @ R.T) * s
    return np.clip(q, LO + 1e-6, HI - 1e-6)

def fit(T):
    """Best fit of a right or left hand model to 21 target points; returns (points, is_left, error)."""
    s0 = np.linalg.norm(T[9] - T[0]); w = np.array([1, 1, 0.35])
    best = None
    for chir in (1, -1):
        def res(q):
            r = ((world(q, chir) - T) * w / s0).ravel()
            return np.concatenate([r, 0.05 * q[1:16:4], 0.05 * (q[3:16:4] - 0.7 * q[2:16:4])])
        for curl in (0.2, 1.3):
            out = least_squares(res, start(T, chir, curl), bounds=(LO, HI), max_nfev=500)
            P = world(out.x, chir)
            err = np.sqrt(np.mean(np.sum(((P - T) * w)[:, :2] ** 2, 1))) / s0
            if best is None or err < best[2]: best = (P, chir < 0, err)
    return best

# ---------- poses ----------

def load(name):
    rows = {}
    for f in DATA[name]:
        p = os.path.join(HERE, 'data', 'isl', f)
        for line in open(p):
            r = json.loads(line)
            rows.setdefault(r['file'], r)
    return rows

def picture_points(h, r):
    # picture coordinates -> x right, y up, z towards the viewer
    P = np.array(h['lm'], float); a = r['w'] / r['h']
    P[:, 0] *= a; P[:, 2] *= -a; P[:, 1] *= -1
    return P

def main():
    data = {k: load(k) for k in DATA}
    out, extent = {}, [0, 0]
    for letter, (src, f) in PICK.items():
        r = data[src][f]
        hands = [fit(picture_points(h, r)) for h in r['hands'][:2]]
        # the hand further right in the picture is "a" and is drawn in front
        hands.sort(key=lambda h: -h[0][0][0])
        palm = np.mean([np.linalg.norm(h[0][9] - h[0][0]) for h in hands])
        if len(hands) == 2:
            # Close near-contacts: a fingertip within a quarter palm of the other hand
            A, B = hands[0][0], hands[1][0]
            gaps = []
            for P, Q, sign in ((A, B, 1), (B, A, -1)):
                for t in (4, 8, 12, 16, 20):
                    d = Q[:, :2] - P[t, :2]; n = np.linalg.norm(d, axis=1); j = int(np.argmin(n))
                    if 0.06 * palm < n[j] < 0.25 * palm: gaps.append(sign * d[j] * (1 - 0.06 * palm / n[j]))
            if gaps:
                shift = np.mean(gaps, 0)
                B = B.copy(); B[:, :2] -= shift * 0.8
                hands[1] = (B, hands[1][1], hands[1][2])
        if letter in UPRIGHT and len(hands) == 2:
            # the post is the straighter index finger of the two
            def straight(P):
                return np.linalg.norm(P[8] - P[5]) / (np.linalg.norm(P[6] - P[5]) + np.linalg.norm(P[7] - P[6]) + np.linalg.norm(P[8] - P[7]))
            post = max((h[0] for h in hands), key=straight)
            d = post[8] - post[5]
            ang = np.arctan2(d[0], d[1])  # angle from straight up, in the picture
            R = Rot.from_rotvec([0, 0, ang]).as_matrix()
            hands = [(h[0] @ R.T, h[1], h[2]) for h in hands]
        pts = np.vstack([h[0] for h in hands])
        # frame the hands and a short forearm beyond each wrist
        arms = [h[0][0] - (h[0][9] - h[0][0]) * 0.65 for h in hands]
        frame = np.vstack([pts, arms])
        c = (frame.min(0) + frame.max(0)) / 2; c[2] = 0
        norm = lambda P: np.round((P - c) / palm, 3).tolist()
        size = (frame.max(0) - frame.min(0)) / palm
        extent = [max(extent[0], size[0]), max(extent[1], size[1])]
        out[letter] = {'a': norm(hands[0][0]), 'b': norm(hands[1][0]) if len(hands) > 1 else None,
                       'al': bool(hands[0][1]), 'bl': bool(hands[1][1]) if len(hands) > 1 else False,
                       'w': round(float(size[0]), 2), 'h': round(float(size[1]), 2),
                       'err': [round(float(h[2]), 3) for h in hands], 'from': f'{src}:{f}'}
        print(letter, out[letter]['from'], 'fit error', out[letter]['err'])
    js = ['// Generated by tools/isl-poses.py. Do not edit by hand.',
          '// One pose per ISL letter: an anatomical hand model fitted to the MediaPipe landmarks of one',
          '// clear photo from the collections (see the README). Palm lengths, x right, y up, z towards the',
          '// viewer, as a mirror shows the signer. a = the hand drawn in front, b = the other (or null);',
          '// al/bl: the hand is a left hand; w/h: the size of the pose with a short forearm on each hand.',
          f'export const ISL_EXTENT = {{ w: {extent[0]:.2f}, h: {extent[1]:.2f} }};',
          'export const ISL_POSES = {']
    for letter, p in out.items():
        js.append(f"  {letter}: {{ a: {json.dumps(p['a'])}, b: {json.dumps(p['b'])}, al: {str(p['al']).lower()}, bl: {str(p['bl']).lower()}, w: {p['w']}, h: {p['h']} }}, // {p['from']}")
    js.append('};')
    open(os.path.join(HERE, '..', 'src', 'hand3d', 'isl-poses.js'), 'w').write('\n'.join(js) + '\n')
    print('extent', extent)

if __name__ == '__main__':
    main()
