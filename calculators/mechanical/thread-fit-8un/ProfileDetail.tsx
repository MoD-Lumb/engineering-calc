'use client';

import { useMemo } from 'react';
import { fmtIn, type ThreadFit } from './b11';
import {
  basicProfile,
  boltProfile,
  clipPolyline,
  evalProfile,
  nutProfile,
  regionBetween,
  visualDims,
  type Cond,
  type ProfileSample,
  type Pt,
} from './geometry';
import { stretchDx, stretchR, type StretchParams } from './strength';
import { PALETTE, type Visibility } from './viewTypes';

type P2 = [number, number];

/** Profile points over s ∈ [s0, s1] (periodic extension of one-pitch samples). */
function periodic(samples: ProfileSample[], P: number, s0: number, s1: number): P2[] {
  const pts: P2[] = [[s0, evalProfile(samples, P, s0)]];
  for (let n = Math.floor(s0 / P) - 1; n <= Math.ceil(s1 / P) + 1; n++) {
    for (const smp of samples) {
      const s = n * P + smp.s;
      if (s > s0 && s < s1) pts.push([s, smp.r]);
    }
  }
  pts.push([s1, evalProfile(samples, P, s1)]);
  pts.sort((a, b) => a[0] - b[0]);
  return pts;
}

interface Props {
  fit: ThreadFit;
  k: number;
  vis: Visibility;
  /** Working load applied: bolt displacement field (drawing units) and end of engagement */
  loaded?: { params: StretchParams; eB: number } | null;
}

/**
 * Axial section of the engaged threads over two pitches, drawn at 1:1 aspect,
 * using the same colours and toggles as the 3D view.
 */
export function ProfileDetail({ fit, k, vis, loaded }: Props) {
  const data = useMemo(() => {
    const { P, D, E, D1 } = fit;
    const dims = visualDims(fit, k);
    const bolt: Record<Cond, ProfileSample[]> = {
      MMC: boltProfile(dims.bolt.MMC, P, 8, 8),
      LMC: boltProfile(dims.bolt.LMC, P, 8, 8),
    };
    const nut: Record<Cond, ProfileSample[]> = {
      MMC: nutProfile(dims.nut.MMC, P, 8),
      LMC: nutProfile(dims.nut.LMC, P, 8),
    };
    // unloaded: two pitches around a bolt crest; loaded: the last engaged threads
    const xc = loaded ? Math.floor((loaded.eB - P) / P) * P : 0;
    const s0 = xc - P;
    const s1 = xc + P;
    const rMin = Math.min(dims.bolt.MMC.minor, dims.bolt.LMC.minor, D1) / 2 - 0.1 * P;
    const rMax = Math.max(dims.nut.MMC.major, dims.nut.LMC.major, D) / 2 + 0.1 * P;
    const S = 1000; // drawing units per inch
    const W = (s1 - s0) * S;
    const Hh = (rMax - rMin) * S;
    const X = (s: number) => (s - s0) * S;
    const Y = (r: number) => (rMax - r) * S;
    const path = (pts: P2[]) => pts.map(([s, r], i) => `${i ? 'L' : 'M'}${X(s).toFixed(2)},${Y(r).toFixed(2)}`).join('');
    const line = (smp: ProfileSample[]) => periodic(smp, P, s0, s1);
    const boltLine = (smp: ProfileSample[]): Pt[] => {
      if (!loaded) return line(smp);
      const sp = loaded.params;
      const moved = periodic(smp, P, s0 - 2 * P, s1 + 2 * P).map(
        ([x, r]) => [x + stretchDx(sp, x), r * stretchR(sp, x)] as Pt
      );
      return clipPolyline(moved, s0, s1);
    };
    const boltL = { MMC: boltLine(bolt.MMC), LMC: boltLine(bolt.LMC) };
    const nutL = { MMC: line(nut.MMC), LMC: line(nut.LMC) };
    const nutFill = (c: Cond) => path([...nutL[c], [s1, rMax], [s0, rMax]]) + 'Z';
    const boltFill = (c: Cond) => path([...boltL[c], [s1, rMin], [s0, rMin]]) + 'Z';
    const polys = (ps: Pt[][]) => ps.map((pp) => path(pp) + 'Z').join('');
    const clr = (bc: Cond, nc: Cond) => polys(regionBetween(boltL[bc], nutL[nc], s0, s1));
    const intf = (bc: Cond, nc: Cond) => polys(regionBetween(nutL[nc], boltL[bc], s0, s1));
    return {
      P,
      xc,
      intf,
      W,
      Hh,
      X,
      Y,
      path,
      nutFill,
      boltFill,
      clr,
      lines: {
        boltMMC: path(boltL.MMC),
        boltLMC: path(boltL.LMC),
        nutMMC: path(nutL.MMC),
        nutLMC: path(nutL.LMC),
        basic: path(line(basicProfile(fit))),
      },
      refs: [
        { r: D / 2, label: `D = ${fmtIn(D)}` },
        { r: E / 2, label: `E = ${fmtIn(E)}` },
        { r: D1 / 2, label: `D₁ = ${fmtIn(D1)}` },
      ],
    };
  }, [fit, k, loaded]);

  const { W, Hh, X, Y } = data;
  const labelW = W * 0.34;
  const fs = Math.min(Hh * 0.05, W * 0.022);
  const bc: Cond | null = vis.boltMMC ? 'MMC' : vis.boltLMC ? 'LMC' : null;
  const nc: Cond | null = vis.nutMMC ? 'MMC' : vis.nutLMC ? 'LMC' : null;

  return (
    <svg
      viewBox={`0 0 ${W + labelW} ${Hh}`}
      className="w-full h-auto"
      role="img"
      aria-label="Thread profile detail: axial section over two pitches"
    >
      <rect x={0} y={0} width={W} height={Hh} className="fill-white dark:fill-slate-900" />
      {/* nut (top) — MMC first, LMC on top: the MMC colour remains only in the tolerance band */}
      {vis.nutMMC && <path d={data.nutFill('MMC')} fill={PALETTE.nutMMC.fill} />}
      {vis.nutLMC && <path d={data.nutFill('LMC')} fill={PALETTE.nutLMC.fill} />}
      {vis.boltMMC && <path d={data.boltFill('MMC')} fill={PALETTE.boltMMC.fill} />}
      {vis.boltLMC && <path d={data.boltFill('LMC')} fill={PALETTE.boltLMC.fill} />}
      {vis.clearance && bc && nc && (
        <path d={data.clr(bc, nc)} fill={PALETTE.clearance} fillOpacity={0.9} />
      )}
      {loaded && bc && nc && (
        <path
          d={data.intf(bc, nc)}
          fill={PALETTE.interference}
          stroke={PALETTE.interference}
          strokeWidth={3}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {vis.nutMMC && <Stroke d={data.lines.nutMMC} color={PALETTE.nutMMC.line} />}
      {vis.nutLMC && <Stroke d={data.lines.nutLMC} color={PALETTE.nutLMC.line} />}
      {vis.boltMMC && <Stroke d={data.lines.boltMMC} color={PALETTE.boltMMC.line} />}
      {vis.boltLMC && <Stroke d={data.lines.boltLMC} color={PALETTE.boltLMC.line} />}
      {vis.basic && (
        <path
          d={data.lines.basic}
          fill="none"
          className="stroke-fuchsia-700 dark:stroke-fuchsia-300"
          strokeWidth={1.6}
          strokeDasharray="6 4"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {data.refs.map((ref) => (
        <g key={ref.label}>
          <line
            x1={0}
            x2={W + labelW * 0.04}
            y1={Y(ref.r)}
            y2={Y(ref.r)}
            className="stroke-slate-500 dark:stroke-slate-400"
            strokeWidth={0.8}
            strokeDasharray="2 3"
            vectorEffect="non-scaling-stroke"
          />
          <text
            x={W + labelW * 0.07}
            y={Y(ref.r)}
            dy="0.35em"
            fontSize={fs}
            className="fill-slate-600 dark:fill-slate-300"
            fontFamily="ui-monospace, monospace"
          >
            {ref.label}
          </text>
        </g>
      ))}
      {/* pitch dimension */}
      <g className="stroke-slate-700">
        <line
          x1={X(data.xc - data.P / 2)}
          x2={X(data.xc + data.P / 2)}
          y1={Hh * 0.1}
          y2={Hh * 0.1}
          strokeWidth={0.8}
          vectorEffect="non-scaling-stroke"
        />
        <line x1={X(data.xc - data.P / 2)} x2={X(data.xc - data.P / 2)} y1={Hh * 0.06} y2={Hh * 0.14} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
        <line x1={X(data.xc + data.P / 2)} x2={X(data.xc + data.P / 2)} y1={Hh * 0.06} y2={Hh * 0.14} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
      </g>
      <text
        x={X(data.xc)}
        y={Hh * 0.1}
        dy="-0.4em"
        textAnchor="middle"
        fontSize={fs}
        className="fill-slate-800"
        fontFamily="ui-monospace, monospace"
      >
        P = {fmtIn(data.P)}
      </text>
      <text x={W + labelW * 0.07} y={Hh * 0.06} dy="0.35em" fontSize={fs} className="fill-slate-500 dark:fill-slate-400">
        nut 2B ↑
      </text>
      <text x={W + labelW * 0.07} y={Hh * 0.94} dy="0.35em" fontSize={fs} className="fill-slate-500 dark:fill-slate-400">
        bolt 2A ↓
      </text>
      <rect
        x={0}
        y={0}
        width={W}
        height={Hh}
        fill="none"
        className="stroke-slate-300 dark:stroke-slate-700"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function Stroke({ d, color }: { d: string; color: string }) {
  return <path d={d} fill="none" stroke={color} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />;
}
