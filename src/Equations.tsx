import { createElement as m } from 'react';
import type { ReactNode } from 'react';

// Native MathML: real fractions and mathematical spacing, with no font CDN or JS renderer.
const symbol = (text: string) => m('mi', null, text);
const operator = (text: string) => m('mo', null, text);
const number = (text: string) => m('mn', null, text);
const row = (...children: ReactNode[]) => m('mrow', null, ...children);
const fraction = (top: ReactNode, bottom: ReactNode) => m('mfrac', null, top, bottom);
const parens = (child: ReactNode) => row(operator('('), child, operator(')'));
const difference = () => row(symbol('A'), operator('−'), symbol('B'));
const fn = (name: string, argument: ReactNode) => row(m('mi', { mathvariant: 'normal' }, name), operator('\u2061'), parens(argument));
const line = (left: ReactNode, relation: string, right: ReactNode) => m('mtr', null, m('mtd', null, left), m('mtd', null, operator(relation)), m('mtd', null, right));

export function Equations() {
  return <div className="equations">
    {m('math', { xmlns: 'http://www.w3.org/1998/Math/MathML', display: 'block', 'aria-label': 'Theta equals one quarter of the arctangent of A minus B over L. Delta equals D times sine theta.' },
      m('mtable', { columnalign: 'right center left', columnspacing: '.5em', rowspacing: '.8em', displaystyle: 'true' },
        line(symbol('θ'), '=', row(fraction(number('1'), number('4')), m('mspace', { width: '.18em' }), fn('arctan', fraction(difference(), symbol('L'))))),
        line(symbol('δ'), '=', row(symbol('D'), m('mspace', { width: '.18em' }), fn('sin', symbol('θ')))),
      ),
    )}
    <p className="equation-key">θ · angle correction <span>δ · fence movement</span></p>
    <div className="equation-approx"><span>For small angles</span>{m('math', { xmlns: 'http://www.w3.org/1998/Math/MathML', 'aria-label': 'Delta is approximately D times A minus B, divided by four L.' }, row(symbol('δ'), operator('≈'), fraction(row(symbol('D'), parens(difference())), row(number('4'), symbol('L')))))}</div>
  </div>;
}
