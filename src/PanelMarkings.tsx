import type { Setup } from './domain';
import { materialEdge } from './cut-animation';

const handwrittenDigits = [
  'M-5-5 1-10 0 10M-5 11l10-1',
  'M-6-6C-3-14 8-11 6-4 4 1-3 5-7 10L7 9',
  'M-6-8C0-13 9-10 5-4L-1 0C10-3 9 11 1 11L-6 9',
  'M2-11-7 3 7 2M4-9 2 11',
];

/** Permanent ink in the panel's material coordinates; never scaled or re-labelled. */
export function PanelMarkings({ setup }: { setup: Setup }) {
  return <>
    <rect x="-61" y="-64" width="122" height="128" fill="none" stroke="currentColor" strokeDasharray="2 5" opacity=".2" />
    {[1, 2, 3, 4].map(number => {
      const edge = materialEdge(setup, number);
      const x = [0, 58, 0, -58][edge];
      const y = [-57, 0, 57, 0][edge];
      return <g key={number} className="handwritten-edge" data-edge={number} data-x={x} data-y={y} role="img" aria-label={`Handwritten edge ${number}`} transform={`translate(${x} ${y})`}>
        <path d={handwrittenDigits[number - 1]} transform="rotate(-6)" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </g>;
    })}
    <g className="handwritten-up" role="img" aria-label="Handwritten up marking" transform="rotate(-8)">
      <path d="M-26-12c-2 10-6 27 2 29 10 2 17-20 18-30l-5 30M6 35l8-50-4 18c5-20 25-19 24-5-1 12-12 18-24 13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M-31 25l27-2" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </g>
  </>;
}
