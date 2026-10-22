"""
Knee hydraulic actuator - clevis placement study
================================================

The knee must swing through the full range used by the choreography
(-170 deg parked ... -58 deg standing). A single telescoping cylinder can only
cover that range if its pin-to-pin length obeys

    d_max <= 2 * d_min - clearance

(the rod must stay inside the barrel at full extension, and the barrel must not
hit the rod eye at full retraction). This script grid-searches the cylinder
clevis A (thigh frame) and the rod clevis B (shin frame, on a "heel" lever above
the knee) for the placement with the most stroke that still telescopes.

    python engineering/knee_actuator_sizing.py

The chosen values are hard-coded in blender/build_robot.py as KNEE_A / KNEE_B;
the build script then measures the real stroke over every baked frame and sizes
barrel and rod automatically.
"""
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "blender"))
from argo import motion as M  # noqa: E402


def knee_range():
    ks = []
    for c in M.timeline():
        for i in range(c["frames"]):
            ks += [v[2] for v in M.sample(c, i)["legs"].values()]
    return min(ks), max(ks)


def pin_distance(A, B, knee):
    """Distance A (thigh frame) -> B (shin frame) for a knee angle."""
    c, s = math.cos(knee), math.sin(knee)
    bx, bz = B
    px = c * bx + s * bz
    pz = -s * bx + c * bz - M.L_THIGH
    return math.hypot(px - A[0], pz - A[1])


def search(lo, hi, clearance=0.05, min_len=0.16, servo_clear=0.09):
    ks = [lo + (hi - lo) * i / 60 for i in range(61)]
    best = []
    for ax in [i * 0.01 for i in range(-12, 13)]:
        for az in [-i * 0.01 for i in range(0, 22)]:
            if math.hypot(ax, az) < servo_clear:       # stay clear of the hip servo
                continue
            for bx in [i * 0.01 for i in range(-8, 9)]:
                for bz in [i * 0.01 for i in range(-4, 13)]:
                    ds = [pin_distance((ax, az), (bx, bz), k) for k in ks]
                    dmin, dmax = min(ds), max(ds)
                    if dmin < min_len or dmax > 2 * dmin - clearance:
                        continue
                    best.append((dmax - dmin, (ax, az), (bx, bz), dmin, dmax))
    best.sort(reverse=True)
    return best


if __name__ == "__main__":
    lo, hi = knee_range()
    print(f"knee range used by the choreography: {math.degrees(lo):.1f} .. {math.degrees(hi):.1f} deg")
    res = search(lo, hi)
    print(f"{len(res)} feasible placements; top 5 by stroke:")
    for stroke, A, B, dmin, dmax in res[:5]:
        print(f"  stroke {stroke * 1000:5.0f} mm  A={A}  B={B}  pin length {dmin * 1000:.0f}-{dmax * 1000:.0f} mm")
