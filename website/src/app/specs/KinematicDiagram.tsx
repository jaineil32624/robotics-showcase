/**
 * Side-view schematic of one leg and the arm, drawn to scale (1 px = 2 mm)
 * from the same constants as blender/argo/motion.py.
 */
export function KinematicDiagram() {
  // standing pose angles (rad) from the IK solution at nominal stance
  const hip = 0.562; // ≈ 32.2°
  const knee = -1.087; // ≈ -62.3°
  const S = 500; // px per metre
  const ox = 230;
  const oy = 70;
  const k = { x: ox - Math.sin(hip) * 0.32 * S, y: oy + Math.cos(hip) * 0.32 * S };
  const a = hip + knee;
  const f = { x: k.x - Math.sin(a) * 0.34 * S, y: k.y + Math.cos(a) * 0.34 * S };
  const groundY = f.y + 0.035 * S;
  // cylinder anchors
  const A = { x: ox + 0.11 * Math.cos(hip) * S, y: oy + 0.11 * Math.sin(hip) * S };
  const B = { x: k.x + (Math.cos(a) * 0.07 + Math.sin(a) * 0.12) * S, y: k.y + (Math.sin(a) * 0.07 - Math.cos(a) * 0.12) * S };
  return (
    <svg viewBox="0 0 460 460" className="h-auto w-full" role="img" aria-label="Leg kinematic schematic">
      <defs>
        <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke="#2b3542" strokeWidth="2" />
        </pattern>
      </defs>
      <rect x="20" y={groundY} width="420" height="14" fill="url(#hatch)" />
      <line x1="20" y1={groundY} x2="440" y2={groundY} stroke="#7c8796" />
      {/* body */}
      <rect x={ox - 40} y={oy - 52} width="200" height="70" rx="6" fill="none" stroke="#7c8796" strokeDasharray="4 4" />
      <text x={ox + 56} y={oy - 30} fill="#7c8796" fontSize="11" fontFamily="monospace">BODY</text>
      {/* hydraulic */}
      <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="#ff5a1f" strokeWidth="7" strokeLinecap="round" opacity=".85" />
      <line x1={(A.x + B.x) / 2} y1={(A.y + B.y) / 2} x2={B.x} y2={B.y} stroke="#e8ecf1" strokeWidth="3" strokeLinecap="round" />
      {/* links */}
      <line x1={ox} y1={oy} x2={k.x} y2={k.y} stroke="#aab4c1" strokeWidth="12" strokeLinecap="round" />
      <line x1={k.x} y1={k.y} x2={f.x} y2={f.y} stroke="#aab4c1" strokeWidth="8" strokeLinecap="round" />
      <line x1={k.x} y1={k.y} x2={B.x} y2={B.y} stroke="#aab4c1" strokeWidth="5" strokeLinecap="round" />
      {[{ p: { x: ox, y: oy }, l: "HIP" }, { p: k, l: "KNEE" }].map(({ p, l }) => (
        <g key={l}>
          <circle cx={p.x} cy={p.y} r="10" fill="#07090c" stroke="#38d6ff" strokeWidth="2" />
          <circle cx={p.x} cy={p.y} r="2.5" fill="#38d6ff" />
          <text x={p.x + 16} y={p.y + 4} fill="#38d6ff" fontSize="11" fontFamily="monospace">{l}</text>
        </g>
      ))}
      <circle cx={f.x} cy={f.y} r={0.035 * S} fill="#1a1d22" stroke="#aab4c1" />
      <text x={f.x + 24} y={f.y + 4} fill="#aab4c1" fontSize="11" fontFamily="monospace">FOOT Ø70</text>
      {/* dimensions */}
      <g fontSize="10" fontFamily="monospace" fill="#7c8796">
        <text x={(ox + k.x) / 2 - 62} y={(oy + k.y) / 2}>L1 320</text>
        <text x={(k.x + f.x) / 2 - 58} y={(k.y + f.y) / 2 + 6}>L2 340</text>
        <text x={(A.x + B.x) / 2 + 10} y={(A.y + B.y) / 2}>CYL Ø32</text>
        <line x1="420" y1={oy} x2="420" y2={groundY} stroke="#2b3542" />
        <text x="424" y={(oy + groundY) / 2} transform={`rotate(90 424 ${(oy + groundY) / 2})`}>600 hip height</text>
      </g>
    </svg>
  );
}
