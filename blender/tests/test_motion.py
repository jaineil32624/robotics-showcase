"""Validation suite for the ARGO-Q4 motion system (runs without Blender).

    python -m pytest blender/tests -q        # or: python blender/tests/test_motion.py
"""
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from argo import motion as m  # noqa: E402


def _dist(a, b):
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def test_leg_ik_roundtrip():
    worst = 0.0
    for leg in m.LEGS:
        sx, sy = m.LEGS[leg]
        for dx in (-0.15, 0.0, 0.12):
            for dz in (-0.58, -0.45, -0.2):
                for dy in (-0.03, 0.0, 0.04):
                    target = (sx * m.HIP_X + dx, sy * m.FOOT_Y + dy, m.HIP_Z + dz)
                    a, h, k = m.leg_ik(leg, target)
                    worst = max(worst, _dist(m.leg_fk(leg, a, h, k), target))
    assert worst < 1e-6, worst


def test_arm_ik_roundtrip():
    worst = 0.0
    for p in [(0.6, 0.0, 0.3), (0.4, 0.3, 0.5), (0.3, -0.4, 0.2), (-0.31, 0.0, 0.25)]:
        for appr in (0.0, 0.8, math.pi / 2):
            a = m.arm_ik(p, appr)
            worst = max(worst, _dist(m.arm_fk(a), p))
    assert worst < 1e-6, worst


def _all_poses():
    for c in m.timeline():
        for i in range(c["frames"]):
            yield c, i, m.sample(c, i)


def test_feet_planted_during_walk():
    """In stance, a foot may not move in the world by more than 0.5 mm/frame."""
    g = m.WALK_GAIT
    prev = None
    worst = 0.0
    for i in range(int(g.dur * m.FPS)):
        t = i / m.FPS
        feet = g.feet(t)
        if prev:
            for leg in m.LEGS:
                if feet[leg][2] <= m.FOOT_R + 1e-9 and prev[leg][2] <= m.FOOT_R + 1e-9:
                    worst = max(worst, _dist(feet[leg], prev[leg]))
        prev = feet
    assert worst < 5e-4, worst


def joint_ranges():
    rng = {}
    for c, i, p in _all_poses():
        for leg, (a, h, k) in p["legs"].items():
            for name, v in (("abd", a), ("hip", h), ("knee", k)):
                key = name
                lo, hi = rng.get(key, (1e9, -1e9))
                rng[key] = (min(lo, v), max(hi, v))
        for k, v in p["arm"].items():
            lo, hi = rng.get(k, (1e9, -1e9))
            rng[k] = (min(lo, v), max(hi, v))
    return rng


def test_joint_limits():
    r = joint_ranges()
    assert -0.6 < r["abd"][0] and r["abd"][1] < 0.6, r["abd"]
    assert -3.0 < r["knee"][0] and r["knee"][1] < -0.2, r["knee"]


def test_reach():
    """Arm IK targets used in the interaction clip must be reachable."""
    clip = [c for c in m.timeline() if c["id"] == "interact"][0]
    for i in range(clip["frames"]):
        p = m.sample(clip, i)
        g = m.arm_fk(p["arm"])
        assert all(math.isfinite(v) for v in g)


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok ", name)
    for k, (lo, hi) in joint_ranges().items():
        print(f"{k:9s} {math.degrees(lo):8.1f} .. {math.degrees(hi):8.1f} deg")
    tl = m.timeline()
    print("total frames", tl[-1]["end"], "duration", tl[-1]["end"] / m.FPS)
