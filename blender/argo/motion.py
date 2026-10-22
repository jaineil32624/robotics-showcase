"""
ARGO-Q4 motion system
=====================

Kinematics, gait planning and choreography for the ARGO-Q4 quadruped.

This module is deliberately *pure Python* (only ``math``) so that every pose the
robot takes can be generated, unit-tested and validated outside Blender.  The
Blender build script (``build_robot.py``) imports it, samples one pose per frame
and writes the results as keyframes.

Conventions (Blender world space, metres, radians)
--------------------------------------------------
* +X is the robot's forward direction, +Y is its left, +Z is up.
* Euler rotations follow Blender's ``XYZ`` order, i.e. ``R = Rz · Ry · Rx``.
* A rotation of ``+θ`` about **Y** turns the +X axis *downwards*:
  ``dir(θ) = (cos θ, -sin θ)`` in the X/Z plane.  Every pitch joint in the leg
  and arm uses this convention.
"""
from __future__ import annotations

import math
from typing import Callable, Dict, List, Sequence, Tuple

FPS = 30

# --------------------------------------------------------------------------- #
#  Robot geometry (all values in metres)                                       #
# --------------------------------------------------------------------------- #
HIP_X = 0.40           # abduction pivot, longitudinal offset from body centre
HIP_Y = 0.12           # abduction pivot, lateral offset from body centre
HIP_Z = -0.02          # abduction pivot, vertical offset from body centre
HIP_W = 0.10           # lateral offset abduction pivot -> hip-pitch pivot
L_THIGH = 0.32         # hip-pitch pivot -> knee pivot
L_SHIN = 0.34          # knee pivot -> foot centre
FOOT_R = 0.035         # foot sphere radius (foot centre height when planted)
STAND_Z = 0.62         # nominal body height while standing
CROUCH_Z = 0.13        # parked body height (skid plate just clear of the ground)

TURRET_POS = (0.0, 0.0, 0.135)   # slew bearing on top of the body
SHOULDER_Z = 0.09                # shoulder pivot above the turret origin
L_UPPER = 0.40                   # shoulder -> elbow
L_FORE = 0.36                    # elbow -> wrist pitch
ELBOW_OFF_Y = 0.055              # forearm runs beside the upper arm
L_GRIP = 0.17                    # wrist pitch -> grasp centre (between finger pads)
GRIP_MIN = 0.012                 # finger inner-face half gap when closed
GRIP_MAX = 0.072                 # finger inner-face half gap when fully open

LEGS: Dict[str, Tuple[int, int]] = {
    # name: (sx, sy)  sx=+1 front, sy=+1 left
    "FL": (1, 1),
    "FR": (1, -1),
    "RL": (-1, 1),
    "RR": (-1, -1),
}
FOOT_Y = HIP_Y + HIP_W           # lateral stance width per side (0.22 m)

# Props used by the object-interaction sequence
STAND_POS = (0.66, 0.0)          # work stand centre (x, y) in the root frame
STAND_H = 0.30                   # work stand height
CRATE_SIZE = 0.12                # sample crate edge length
DECK_POS = (-0.31, 0.0, 0.125)   # cargo deck centre on top cover (body frame)
GRIP_ON_CRATE = (CRATE_SIZE / 2 - GRIP_MIN) / (GRIP_MAX - GRIP_MIN)


def finger_offset(grip: float) -> float:
    """Inner-face half gap of the parallel gripper for a 0..1 opening."""
    return GRIP_MIN + (GRIP_MAX - GRIP_MIN) * grip

Vec3 = Tuple[float, float, float]


# --------------------------------------------------------------------------- #
#  Small math helpers                                                          #
# --------------------------------------------------------------------------- #
def clamp(v: float, lo: float, hi: float) -> float:
    return lo if v < lo else hi if v > hi else v


def lerp(a, b, t):
    if isinstance(a, (tuple, list)):
        return tuple(x + (y - x) * t for x, y in zip(a, b))
    return a + (b - a) * t


def min_jerk(s: float) -> float:
    """Minimum-jerk (quintic) profile: zero velocity & acceleration at ends."""
    s = clamp(s, 0.0, 1.0)
    return s * s * s * (10.0 + s * (-15.0 + 6.0 * s))


def smooth(t: float, t0: float, t1: float) -> float:
    """Minimum-jerk blend from 0 -> 1 between t0 and t1."""
    if t1 <= t0:
        return 1.0 if t >= t1 else 0.0
    return min_jerk((t - t0) / (t1 - t0))


def pulse(t: float, t0: float, t1: float) -> float:
    """Smooth 0 -> 1 -> 0 bump over [t0, t1]."""
    if t <= t0 or t >= t1:
        return 0.0
    u = (t - t0) / (t1 - t0)
    return math.sin(math.pi * u) ** 2


def wrap(a: float) -> float:
    return (a + math.pi) % (2.0 * math.pi) - math.pi


def rot_x(a):
    c, s = math.cos(a), math.sin(a)
    return ((1, 0, 0), (0, c, -s), (0, s, c))


def rot_y(a):
    c, s = math.cos(a), math.sin(a)
    return ((c, 0, s), (0, 1, 0), (-s, 0, c))


def rot_z(a):
    c, s = math.cos(a), math.sin(a)
    return ((c, -s, 0), (s, c, 0), (0, 0, 1))


def mmul(a, b):
    return tuple(tuple(sum(a[i][k] * b[k][j] for k in range(3)) for j in range(3)) for i in range(3))


def mvec(m, v):
    return tuple(m[i][0] * v[0] + m[i][1] * v[1] + m[i][2] * v[2] for i in range(3))


def mT(m):
    return tuple(tuple(m[j][i] for j in range(3)) for i in range(3))


def euler_xyz(rx, ry, rz):
    """Rotation matrix identical to Blender's Euler((rx, ry, rz), 'XYZ')."""
    return mmul(rot_z(rz), mmul(rot_y(ry), rot_x(rx)))


class Track:
    """Piecewise minimum-jerk interpolation through (time, value) keys.

    Values may be floats or tuples.  Between two keys the value follows a
    quintic profile so every segment starts and ends at rest - the way servo
    controllers execute point-to-point moves.
    """

    def __init__(self, keys: Sequence[Tuple[float, object]]):
        self.keys = sorted(keys, key=lambda k: k[0])

    def __call__(self, t: float):
        k = self.keys
        if t <= k[0][0]:
            return k[0][1]
        for (t0, v0), (t1, v1) in zip(k, k[1:]):
            if t <= t1:
                return lerp(v0, v1, smooth(t, t0, t1))
        return k[-1][1]


# --------------------------------------------------------------------------- #
#  Kinematics                                                                  #
# --------------------------------------------------------------------------- #
def hip_pos(leg: str) -> Vec3:
    sx, sy = LEGS[leg]
    return (sx * HIP_X, sy * HIP_Y, HIP_Z)


def leg_ik(leg: str, foot_body: Vec3) -> Tuple[float, float, float]:
    """Analytic 3-DOF leg IK.

    ``foot_body`` is the desired foot-centre position in the *body* frame.
    Returns ``(abduction, hip_pitch, knee)`` joint angles.  Knees always fold
    backwards (knee behind the hip-foot line), like most modern quadrupeds.
    """
    sx, sy = LEGS[leg]
    hx, hy, hz = hip_pos(leg)
    rx, ry, rz = foot_body[0] - hx, foot_body[1] - hy, foot_body[2] - hz

    # --- abduction: rotate the leg plane so the foot sits HIP_W outboard ---
    d = max(math.hypot(ry, rz), HIP_W + 1e-6)
    beta = math.atan2(rz, ry)
    abd = wrap(beta + math.acos(clamp(sy * HIP_W / d, -1.0, 1.0)))
    ca, sa = math.cos(abd), math.sin(abd)
    pz = -ry * sa + rz * ca            # foot in the abducted leg plane
    px = rx

    # --- planar two-link solution in the X/Z plane --------------------------
    D = clamp(math.hypot(px, pz), abs(L_THIGH - L_SHIN) + 1e-4, L_THIGH + L_SHIN - 1e-4)
    a = math.atan2(pz, px)
    b = math.acos(clamp((L_THIGH ** 2 + D ** 2 - L_SHIN ** 2) / (2 * L_THIGH * D), -1, 1))
    cands = [(L_THIGH * math.cos(a + b), L_THIGH * math.sin(a + b)),
             (L_THIGH * math.cos(a - b), L_THIGH * math.sin(a - b))]
    kx, kz = min(cands, key=lambda k: k[0])          # knee behind
    hip = math.atan2(-kx, -kz)
    shin = math.atan2(-(px - kx), -(pz - kz))
    return abd, hip, wrap(shin - hip)


def leg_fk(leg: str, abd: float, hip: float, knee: float) -> Vec3:
    """Forward kinematics (foot centre in body frame) - used for validation."""
    sx, sy = LEGS[leg]
    # in the hip-pitch frame
    kx, kz = -math.sin(hip) * L_THIGH, -math.cos(hip) * L_THIGH
    ang = hip + knee
    fx, fz = kx - math.sin(ang) * L_SHIN, kz - math.cos(ang) * L_SHIN
    p = (fx, sy * HIP_W, fz)
    p = mvec(rot_x(abd), p)
    h = hip_pos(leg)
    return (p[0] + h[0], p[1] + h[1], p[2] + h[2])


def arm_ik(target_body: Vec3, approach: float = math.pi / 2, roll: float = 0.0):
    """Analytic arm IK.

    ``target_body`` - grasp centre in the body frame.
    ``approach``    - gripper direction angle in the arm plane
                      (0 = horizontal forward, pi/2 = straight down).
    Returns dict of turret, shoulder, elbow, wpitch, wroll angles.
    """
    tx = target_body[0] - TURRET_POS[0]
    ty = target_body[1] - TURRET_POS[1]
    tz = target_body[2] - TURRET_POS[2]
    rho = max(math.hypot(tx, ty), ELBOW_OFF_Y + 1e-4)
    yaw = math.atan2(ty, tx) - math.asin(ELBOW_OFF_Y / rho)
    x = math.sqrt(max(rho ** 2 - ELBOW_OFF_Y ** 2, 0.0))
    z = tz - SHOULDER_Z
    # wrist pitch pivot
    wx = x - L_GRIP * math.cos(approach)
    wz = z + L_GRIP * math.sin(approach)
    D = clamp(math.hypot(wx, wz), abs(L_UPPER - L_FORE) + 1e-4, L_UPPER + L_FORE - 1e-4)
    ta = math.atan2(-wz, wx)
    b = math.acos(clamp((L_UPPER ** 2 + D ** 2 - L_FORE ** 2) / (2 * L_UPPER * D), -1, 1))
    th_s = ta - b                       # elbow-up solution
    ex, ez = L_UPPER * math.cos(th_s), -L_UPPER * math.sin(th_s)
    th_f = math.atan2(-(wz - ez), wx - ex)
    return {
        "turret": yaw,
        "shoulder": th_s,
        "elbow": wrap(th_f - th_s),
        "wpitch": wrap(approach - th_f),
        "wroll": roll,
    }


def arm_fk(arm) -> Vec3:
    """Grasp-centre position in the body frame for a set of arm angles."""
    s, e, w = arm["shoulder"], arm["elbow"], arm["wpitch"]
    ex, ez = L_UPPER * math.cos(s), -L_UPPER * math.sin(s)
    f = s + e
    wx, wz = ex + L_FORE * math.cos(f), ez - L_FORE * math.sin(f)
    g = f + w
    gx, gz = wx + L_GRIP * math.cos(g), wz - L_GRIP * math.sin(g)
    p = mvec(rot_z(arm["turret"]), (gx, ELBOW_OFF_Y, gz + SHOULDER_Z))
    return (p[0] + TURRET_POS[0], p[1] + TURRET_POS[1], p[2] + TURRET_POS[2])


# Reference arm postures ---------------------------------------------------- #
ARM_STOW = {"turret": 0.0, "shoulder": -math.pi, "elbow": math.pi, "wpitch": 0.0, "wroll": 0.0}
ARM_READY = {"turret": 0.0, "shoulder": -0.75, "elbow": 1.85, "wpitch": -0.55, "wroll": 0.0}
ARM_KEYS = ("turret", "shoulder", "elbow", "wpitch", "wroll")


def arm_lerp(a, b, s):
    return {k: lerp(a[k], b[k], s) for k in ARM_KEYS}


class ArmTrack:
    """Track for full arm postures (dicts of joint angles)."""

    def __init__(self, keys):
        self.keys = sorted(keys, key=lambda k: k[0])

    def __call__(self, t):
        k = self.keys
        if t <= k[0][0]:
            return dict(k[0][1])
        for (t0, a0), (t1, a1) in zip(k, k[1:]):
            if t <= t1:
                return arm_lerp(a0, a1, smooth(t, t0, t1))
        return dict(k[-1][1])


# --------------------------------------------------------------------------- #
#  Pose container                                                              #
# --------------------------------------------------------------------------- #
def body_matrix(body) -> Tuple[tuple, Vec3]:
    """Rotation & translation of the body in the root frame."""
    bx, by, bz, roll, pitch = body
    return euler_xyz(roll, pitch, 0.0), (bx, by, bz)


def foot_to_body(body, foot_root: Vec3) -> Vec3:
    R, t = body_matrix(body)
    d = (foot_root[0] - t[0], foot_root[1] - t[1], foot_root[2] - t[2])
    return mvec(mT(R), d)


def nominal_feet(dx: float = 0.0) -> Dict[str, Vec3]:
    """Feet planted directly below the hips (root frame)."""
    return {leg: (sx * HIP_X + dx, sy * FOOT_Y, FOOT_R) for leg, (sx, sy) in LEGS.items()}


def make_pose(
    body=(0.0, 0.0, STAND_Z, 0.0, 0.0),
    feet: Dict[str, Vec3] | None = None,
    legs: Dict[str, Tuple[float, float, float]] | None = None,
    arm=None,
    grip: float = 0.0,
    root=(0.0, 0.0, 0.0),
    omega=None,
    power: float = 1.0,
    explode: float = 0.0,
    props: bool = False,
    events=None,
):
    """Resolve feet targets through IK and return a complete pose dict."""
    feet = feet or nominal_feet()
    joints = {}
    for leg in LEGS:
        if legs and leg in legs:
            joints[leg] = legs[leg]
        else:
            joints[leg] = leg_ik(leg, foot_to_body(body, feet[leg]))
    return {
        "root": root,
        "body": body,
        "legs": joints,
        "arm": dict(arm or ARM_READY),
        "grip": clamp(grip, 0.0, 1.0),
        "omega": dict(omega or {"lidar": 1.0, "fan": 3.0, "pump": 1.5}),
        "power": power,
        "explode": explode,
        "props": props,
        "events": events or {},
    }


# --------------------------------------------------------------------------- #
#  Gait planner                                                                #
# --------------------------------------------------------------------------- #
class TrotGait:
    """Diagonal-pair trot with Raibert-style foothold placement.

    The body follows an arbitrary forward-velocity profile.  Each foot is
    planted (fixed in the world) during stance and swings along a minimum-jerk
    arc to its next foothold, which is placed below the hip at the middle of
    the coming stance phase.  This keeps feet perfectly planted - no sliding -
    even while accelerating and braking.
    """

    def __init__(self, duration: float, v_max: float, t_acc: float = 1.4,
                 t_start: float = 0.4, t_stop: float | None = None,
                 period: float = 0.9, duty: float = 0.6, step_h: float = 0.075):
        self.T, self.duty, self.h = period, duty, step_h
        self.dur = duration
        t_stop = duration - 0.6 if t_stop is None else t_stop
        self.t_start, self.t_stop, self.t_acc, self.v_max = t_start, t_stop, t_acc, v_max
        # numerically integrate body x(t)
        self.dt = 1.0 / (FPS * 4)
        n = int(duration / self.dt) + 2
        xs, x = [], 0.0
        for i in range(n):
            xs.append(x)
            x += self.velocity(i * self.dt) * self.dt
        self._xs = xs
        self.offsets = {"FL": 0.0, "RR": 0.0, "FR": 0.5, "RL": 0.5}

    def velocity(self, t: float) -> float:
        up = smooth(t, self.t_start, self.t_start + self.t_acc)
        down = 1.0 - smooth(t, self.t_stop - self.t_acc, self.t_stop)
        return self.v_max * min(up, down)

    def accel(self, t: float) -> float:
        e = 1e-3
        return (self.velocity(t + e) - self.velocity(t - e)) / (2 * e)

    def body_x(self, t: float) -> float:
        i = clamp(t / self.dt, 0, len(self._xs) - 1.001)
        i0 = int(i)
        return lerp(self._xs[i0], self._xs[i0 + 1], i - i0)

    def activity(self, t: float) -> float:
        """0 when standing still, 1 at cruise - scales bob & sway."""
        return clamp(self.velocity(t) / max(self.v_max, 1e-6), 0, 1)

    def foot(self, leg: str, t: float) -> Vec3:
        sx, sy = LEGS[leg]
        o, T, duty = self.offsets[leg], self.T, self.duty
        k = math.floor(t / T + o)                  # current cycle index
        start = (k - o) * T                        # stance start of cycle k
        stance_end = start + duty * T

        def foothold(j):
            mid = (j - o) * T + 0.5 * duty * T
            return self.body_x(clamp(mid, 0.0, self.dur)) + sx * HIP_X

        y = sy * FOOT_Y
        if t < stance_end:
            return (foothold(k), y, FOOT_R)
        u = (t - stance_end) / ((1 - duty) * T)
        x0, x1 = foothold(k), foothold(k + 1)
        lift = self.h * clamp(abs(x1 - x0) / 0.04, 0.0, 1.0)
        x = lerp(x0, x1, min_jerk(u))
        z = FOOT_R + lift * math.sin(math.pi * clamp(u, 0, 1)) ** 1.5
        return (x, y, z)

    def feet(self, t: float) -> Dict[str, Vec3]:
        return {leg: self.foot(leg, t) for leg in LEGS}


# --------------------------------------------------------------------------- #
#  Second-order suspension response (payload sag)                              #
# --------------------------------------------------------------------------- #
class SpringResponse:
    """Critically under-damped mass-spring response to a load profile."""

    def __init__(self, load: Callable[[float], float], duration: float,
                 gain: float = -0.014, omega: float = 11.0, zeta: float = 0.32):
        dt = 1.0 / (FPS * 8)
        self.dt = dt
        x, v, out = 0.0, 0.0, []
        for i in range(int(duration / dt) + 2):
            target = gain * load(i * dt)
            a = omega * omega * (target - x) - 2 * zeta * omega * v
            v += a * dt
            x += v * dt
            out.append(x)
        self._x = out

    def __call__(self, t):
        i = int(clamp(t / self.dt, 0, len(self._x) - 1))
        return self._x[i]


# --------------------------------------------------------------------------- #
#  Choreography                                                                #
# --------------------------------------------------------------------------- #
CROUCH_BODY = (0.0, 0.0, CROUCH_Z, 0.0, 0.0)
STAND_BODY = (0.0, 0.0, STAND_Z, 0.0, 0.0)
CROUCH_FEET_DX = 0.02
OMEGA_OFF = {"lidar": 0.0, "fan": 0.0, "pump": 0.0}
OMEGA_ON = {"lidar": 1.0, "fan": 3.0, "pump": 1.5}


def _omega(scale_lidar, scale_fan, scale_pump):
    return {"lidar": OMEGA_ON["lidar"] * scale_lidar,
            "fan": OMEGA_ON["fan"] * scale_fan,
            "pump": OMEGA_ON["pump"] * scale_pump}


# 1. POWER-ON ---------------------------------------------------------------- #
def clip_power_on(t):
    flicker = Track([(0.0, 0.0), (0.25, 0.0), (0.35, 0.35), (0.45, 0.05), (0.6, 0.55),
                     (0.72, 0.15), (0.9, 0.2), (2.4, 1.0)])
    p = flicker(t)
    om = _omega(smooth(t, 2.0, 3.6), smooth(t, 0.9, 2.6), smooth(t, 1.4, 2.8))
    legs = {}
    feet = nominal_feet(CROUCH_FEET_DX)
    base = {leg: leg_ik(leg, foot_to_body(CROUCH_BODY, feet[leg])) for leg in LEGS}
    # servo self-test: each leg twitches in turn
    for i, leg in enumerate(("FL", "FR", "RL", "RR")):
        tw = pulse(t, 2.9 + i * 0.22, 3.25 + i * 0.22) * 0.06
        a, h, k = base[leg]
        legs[leg] = (a, h + tw * 0.5, k - tw)
    arm = dict(ARM_STOW)
    arm["wroll"] = 0.25 * pulse(t, 3.2, 3.8)
    return make_pose(body=CROUCH_BODY, legs=legs, arm=arm, omega=om, power=p,
                     events={"label": "Power-on self test"})


# 2. MECHANICAL STARTUP ----------------------------------------------------- #
def clip_startup(t):
    feet = nominal_feet(CROUCH_FEET_DX * (1 - smooth(t, 1.5, 4.0)))
    # abduction calibration sweep: feet slide outward then return while unloaded
    splay = 0.06 * pulse(t, 0.2, 1.4)
    for leg, (sx, sy) in LEGS.items():
        x, y, z = feet[leg]
        feet[leg] = (x, y + sy * splay, z)
    z = lerp(CROUCH_Z, STAND_Z, smooth(t, 1.5, 4.0))
    settle = 0.012 * math.exp(-4.0 * max(t - 4.0, 0)) * math.sin(9.0 * max(t - 4.0, 0))
    pitch = -0.05 * pulse(t, 1.5, 3.0) + 0.03 * pulse(t, 2.8, 4.1)   # rear rises first
    body = (0.0, 0.0, z + settle, 0.0, pitch)
    arm = ArmTrack([
        (0.0, ARM_STOW),
        (4.0, ARM_STOW),
        (5.2, {"turret": 0.0, "shoulder": -1.75, "elbow": 2.6, "wpitch": -0.4, "wroll": 0.0}),
        (6.5, ARM_READY),
    ])(t)
    return make_pose(body=body, feet=feet, arm=arm, grip=0.4 * pulse(t, 5.6, 6.8),
                     events={"label": "Stand-up & arm deployment"})


# 3. IDLE (seamless 4 s loop) ----------------------------------------------- #
def clip_idle(t):
    w = 2 * math.pi * t / 4.0
    body = (0.004 * math.sin(w), 0.0, STAND_Z + 0.006 * math.sin(w), 0.008 * math.sin(w + 1.0),
            0.01 * math.sin(w))
    arm = dict(ARM_READY)
    arm["turret"] += 0.18 * math.sin(w)
    arm["shoulder"] += 0.04 * math.sin(2 * w)
    arm["wpitch"] += 0.06 * math.sin(w + 0.7)
    arm["wroll"] = 0.12 * math.sin(w)
    return make_pose(body=body, arm=arm, grip=0.15 + 0.1 * math.sin(w),
                     events={"label": "Idle - sensors scanning"})


# 4. JOINT DEMONSTRATION ---------------------------------------------------- #
def clip_joint_demo(t):
    feet = nominal_feet()
    # weight shift away from the front-left leg, then lift it
    shift = smooth(t, 0.0, 0.8) * (1 - smooth(t, 4.8, 5.6))
    body = (-0.05 * shift, -0.045 * shift, STAND_Z - 0.02 * shift, -0.035 * shift, 0.02 * shift)
    lift = smooth(t, 0.6, 1.1) * (1 - smooth(t, 4.6, 5.3))
    x, y, z = feet["FL"]
    feet["FL"] = (x + 0.04 * lift, y, z + 0.16 * lift)
    pose_legs = {}
    base = leg_ik("FL", foot_to_body(body, feet["FL"]))
    a, h, k = base
    a += 0.30 * pulse(t, 1.1, 2.3)                     # abduction sweep
    h += 0.45 * math.sin(2 * math.pi * clamp((t - 2.3) / 1.2, 0, 1)) * (2.3 < t < 3.5)
    k += 0.55 * pulse(t, 3.5, 4.6)                     # knee flex
    pose_legs["FL"] = (a, h, k)

    # body pose demonstration with all feet planted (12.4 s -> 14 s)
    if t > 12.3:
        u = clamp((t - 12.3) / 1.7, 0, 1)
        body = (0.0, 0.0, STAND_Z - 0.04 * math.sin(math.pi * u),
                0.10 * math.sin(2 * math.pi * u) * math.sin(math.pi * u),
                -0.10 * math.sin(math.pi * u) ** 2 * math.cos(2 * math.pi * u))
        pose_legs = {}

    a = dict(ARM_READY)
    a["turret"] += 1.4 * math.sin(2 * math.pi * clamp((t - 5.6) / 1.4, 0, 1)) * (5.6 < t < 7.0)
    a["shoulder"] += -0.55 * pulse(t, 7.0, 8.2)
    a["elbow"] += -0.8 * pulse(t, 8.2, 9.4)
    a["wpitch"] += 0.7 * math.sin(2 * math.pi * clamp((t - 9.4) / 1.0, 0, 1)) * (9.4 < t < 10.4)
    a["wroll"] = 2 * math.pi * smooth(t, 10.4, 11.6)
    grip = pulse(t, 11.6, 12.0) + pulse(t, 12.0, 12.4)
    labels = [(1.1, "Leg FL - hip abduction"), (2.3, "Leg FL - hip pitch"), (3.5, "Leg FL - knee (hydraulic)"),
              (5.6, "Arm - turret slew"), (7.0, "Arm - shoulder"), (8.2, "Arm - elbow"),
              (9.4, "Arm - wrist pitch"), (10.4, "Arm - wrist roll"), (11.6, "Gripper"),
              (12.3, "Body 6-DOF posture")]
    label = "Weight shift"
    for t0, name in labels:
        if t >= t0:
            label = name
    return make_pose(body=body, feet=feet, legs=pose_legs or None, arm=a, grip=grip,
                     events={"label": label})


# 5. WALK ------------------------------------------------------------------- #
WALK_GAIT = TrotGait(duration=8.0, v_max=0.42)


def _walk_body(g: TrotGait, t: float, lean_gain=0.035):
    """Body pose relative to the root; the root itself carries the forward travel."""
    act = g.activity(t)
    w = 2 * math.pi * t / g.T
    z = STAND_Z - 0.012 * act + 0.007 * act * math.cos(2 * w)
    roll = 0.018 * act * math.sin(w)
    pitch = lean_gain * g.accel(t) * 0.12 + 0.004 * act * math.sin(2 * w + 0.6)
    return (0.0, 0.0, z, roll, pitch)


def _walk_feet_root(g: TrotGait, t: float):
    """World-space footholds expressed in the moving root frame."""
    x = g.body_x(t)
    return {leg: (p[0] - x, p[1], p[2]) for leg, p in g.feet(t).items()}


def clip_walk(t):
    g = WALK_GAIT
    body = _walk_body(g, t)
    arm = dict(ARM_READY)
    # inertial lag of the arm against acceleration
    arm["shoulder"] += 0.10 * g.accel(t) * 0.25
    arm["wpitch"] -= 0.06 * g.accel(t) * 0.25
    return make_pose(body=body, feet=_walk_feet_root(g, t), arm=arm, grip=0.1, root=(g.body_x(t), 0.0, 0.0),
                     events={"label": "Trot gait 0.42 m/s"})


# 6. ARM MANIPULATION ------------------------------------------------------- #
def clip_arm(t):
    pts = [
        (0.0, None),
        (1.3, ((0.72, 0.0, 0.55), 0.15, 0.0)),
        (2.6, ((0.45, 0.42, 0.45), 0.6, 0.6)),
        (3.9, ((0.45, -0.42, 0.45), 0.6, -0.6)),
        (5.0, ((0.55, 0.0, 0.25), 1.3, 0.0)),
        (6.2, ((0.35, 0.0, 0.85), -0.6, 1.4)),
        (8.0, None),
    ]
    keys = []
    for tk, spec in pts:
        if spec is None:
            keys.append((tk, ARM_READY))
        else:
            (p, appr, roll) = spec
            keys.append((tk, arm_ik(p, appr, roll)))
    arm = ArmTrack(keys)(t)
    body = (0.0, 0.0, STAND_Z - 0.01 * pulse(t, 0.6, 5.5), 0.0, 0.03 * pulse(t, 0.5, 2.0))
    grip = pulse(t, 1.0, 2.0) + 0.6 * pulse(t, 4.6, 5.6) + pulse(t, 6.0, 7.2)
    return make_pose(body=body, arm=arm, grip=grip, events={"label": "Workspace sweep"})


# 7. OBJECT INTERACTION ----------------------------------------------------- #
def _crate_top_on_stand():
    return (STAND_POS[0], STAND_POS[1], STAND_H + CRATE_SIZE / 2)


INTERACT_LOAD = lambda t: smooth(t, 3.6, 4.4) * (1 - smooth(t, 8.8, 9.2))
INTERACT_SAG = SpringResponse(INTERACT_LOAD, 12.0)


def interact_body(t):
    crouch = smooth(t, 0.2, 1.6) * (1 - smooth(t, 4.0, 5.2))
    z = STAND_Z - 0.09 * crouch + INTERACT_SAG(t)
    pitch = 0.07 * crouch          # +pitch = nose down
    return (0.03 * crouch, 0.0, z, 0.0, pitch)


def clip_interact(t):
    body = interact_body(t)
    crate = _crate_top_on_stand()
    # targets are expressed in the body frame (account for crouch/pitch)
    def to_body(p):
        R, tr = body_matrix(body)
        return mvec(mT(R), (p[0] - tr[0], p[1] - tr[1], p[2] - tr[2]))

    above = (crate[0], crate[1], crate[2] + 0.16)
    deck_c = (DECK_POS[0], DECK_POS[1], DECK_POS[2] + CRATE_SIZE / 2 + 0.004)
    deck_above = (deck_c[0], deck_c[1], deck_c[2] + 0.17)
    ready = ARM_READY
    k = [
        (0.0, ready),
        (1.5, arm_ik(to_body(above), math.pi / 2)),
        (3.0, arm_ik(to_body(crate), math.pi / 2)),
        (3.6, arm_ik(to_body(crate), math.pi / 2)),
        (5.0, arm_ik(to_body((crate[0] - 0.1, 0.0, crate[2] + 0.30)), math.pi / 2)),
    ]
    # transport: swing over the top to the cargo deck behind the turret.
    over = {"turret": math.pi / 2, "shoulder": -1.95, "elbow": 2.35, "wpitch": 0.0, "wroll": 0.0}
    over["wpitch"] = math.pi / 2 - (over["shoulder"] + over["elbow"])
    k += [(6.3, over)]
    da = arm_ik(deck_above, math.pi / 2)
    dd = arm_ik(deck_c, math.pi / 2)
    # keep turret winding continuous (rotate through +pi/2 to +pi)
    for a in (da, dd):
        if a["turret"] < 0:
            a["turret"] += 2 * math.pi
    k += [(7.5, da), (8.7, dd), (9.2, dd), (10.4, da), (12.0, ready)]
    arm = ArmTrack(k)(t)
    # gripper: open on approach, close on crate, open to release
    # 1.0 = fully open, GRIP_ON_CRATE = fingers clamped on the 120 mm crate
    grip = Track([(0.0, 0.1), (1.2, 1.0), (3.0, 1.0), (3.55, GRIP_ON_CRATE), (8.7, GRIP_ON_CRATE),
                  (9.15, 1.0), (10.6, 1.0), (11.8, 0.1)])(t)
    events = {"label": "Pick & stow sample crate",
              "grasp": 3.55 <= t < 9.0,
              "release": t >= 9.0}
    if t < 1.5:
        events["label"] = "Approach & align"
    elif t < 3.6:
        events["label"] = "Descend & grasp"
    elif t < 7.5:
        events["label"] = "Lift & transport"
    elif t < 9.2:
        events["label"] = "Place on cargo deck"
    else:
        events["label"] = "Retract"
    return make_pose(body=body, arm=arm, grip=grip, props=True, events=events)


# 8. FULL OPERATING MODE ---------------------------------------------------- #
FULL_GAIT = TrotGait(duration=12.0, v_max=0.5, t_start=0.6, t_acc=1.6, t_stop=10.6)


def clip_full(t):
    g = FULL_GAIT
    body = _walk_body(g, t)
    scan = math.sin(2 * math.pi * t / 4.0)
    arm = arm_ik((0.62, 0.0, 0.62), 0.35, 0.0)
    arm["turret"] += 0.9 * scan * smooth(t, 1.0, 2.5) * (1 - smooth(t, 10.0, 11.5))
    arm["shoulder"] += 0.12 * math.sin(2 * math.pi * t / 2.0) * smooth(t, 1.0, 2.5)
    arm = arm_lerp(ARM_READY, arm, smooth(t, 0.0, 1.4) * (1 - smooth(t, 10.6, 12.0)))
    return make_pose(body=body, feet=_walk_feet_root(g, t), arm=arm, grip=0.2, root=(g.body_x(t), 0.0, 0.0),
                     omega=_omega(2.0, 4.5, 2.5),
                     events={"label": "Autonomous patrol - lidar mapping"})


# 9. SHUTDOWN --------------------------------------------------------------- #
def clip_shutdown(t):
    arm = ArmTrack([(0.0, ARM_READY),
                    (1.0, {"turret": 0.0, "shoulder": -1.75, "elbow": 2.6, "wpitch": -0.4, "wroll": 0.0}),
                    (2.2, ARM_STOW)])(t)
    s = smooth(t, 2.2, 4.6)
    z = lerp(STAND_Z, CROUCH_Z, s)
    pitch = 0.04 * pulse(t, 2.2, 4.6)
    feet = nominal_feet(CROUCH_FEET_DX * s)
    p = 1.0 - smooth(t, 4.6, 5.8)
    om = _omega(1 - smooth(t, 3.8, 5.4), 1 - smooth(t, 4.4, 6.0), 1 - smooth(t, 4.0, 5.6))
    return make_pose(body=(0.0, 0.0, z, 0.0, pitch), feet=feet, arm=arm, omega=om, power=p,
                     events={"label": "Shutdown & park"})


# 10. EXPLODED VIEW --------------------------------------------------------- #
def clip_exploded(t):
    e = smooth(t, 0.3, 2.8) * (1 - smooth(t, 5.4, 7.8))
    return make_pose(body=STAND_BODY, omega=_omega(0.5, 0.6, 0.6), explode=e,
                     events={"label": "Exploded assembly"})


# --------------------------------------------------------------------------- #
#  Timeline                                                                    #
# --------------------------------------------------------------------------- #
CLIPS: List[dict] = [
    dict(id="power_on", label="Power-On Sequence", dur=4.0, fn=clip_power_on, loop=False,
         desc="Boot flicker, power-core charge, cooling fan and hydraulic pump spin-up, servo self-test."),
    dict(id="startup", label="Mechanical Startup", dur=7.0, fn=clip_startup, loop=False,
         desc="Abduction calibration, synchronized stand-up from crouch and arm deployment from stowed."),
    dict(id="idle", label="Idle", dur=4.0, fn=clip_idle, loop=True,
         desc="Seamless loop: suspension breathing, turret scanning, wrist micro-motions."),
    dict(id="joint_demo", label="Joint Demonstration", dur=14.0, fn=clip_joint_demo, loop=False,
         desc="Every actuator exercised in isolation: leg abduction, hip, knee, turret, shoulder, elbow, wrist and gripper, then body posture."),
    dict(id="walk", label="Walking Cycle", dur=8.0, fn=clip_walk, loop=False,
         desc="Diagonal trot with planted feet, acceleration lean and inertial arm lag."),
    dict(id="arm", label="Arm Manipulation", dur=8.0, fn=clip_arm, loop=False,
         desc="Inverse-kinematics workspace sweep through five waypoints with wrist roll and gripper cycles."),
    dict(id="interact", label="Object Interaction", dur=12.0, fn=clip_interact, loop=False,
         desc="Pick a 2 kg sample crate from the work stand and stow it on the cargo deck; suspension reacts to the payload."),
    dict(id="full", label="Full Operating Mode", dur=12.0, fn=clip_full, loop=False,
         desc="Autonomous patrol: trotting at 0.5 m/s while the arm scans and the lidar maps at double rate."),
    dict(id="shutdown", label="Shutdown Sequence", dur=6.0, fn=clip_shutdown, loop=False,
         desc="Arm stows, body parks on the skid plate, rotating machinery spins down, power fades."),
    dict(id="exploded", label="Exploded View", dur=8.0, fn=clip_exploded, loop=False,
         desc="Every component separates along its assembly axis, holds, and re-assembles."),
]


def timeline():
    """Yield clip metadata with frame ranges (1-based Blender frames)."""
    f = 1
    out = []
    for c in CLIPS:
        n = int(round(c["dur"] * FPS))
        out.append(dict(c, start=f, end=f + n - 1, frames=n))
        f += n
    return out


def sample(clip: dict, frame_in_clip: int):
    """Pose for the given frame index within a clip."""
    t = frame_in_clip / FPS
    return clip["fn"](t)
