// Server-rendered passage text. Markup and class names follow the prototype (see src/app/reader.css).
import type { ReactNode } from 'react';
import type { EntMark, Run, ViNode, ZhNode, ZhUnit } from '@dvsktt/core';

const entProps = (e: EntMark) => ({
  'data-m': e.m,
  'data-ent': e.ent,
  ...(e.first ? { tabIndex: 0, role: 'button', 'aria-label': e.label } : {}),
});
const entCls = (e?: EntMark) => (e ? ` ent${e.rv ? ' erv' : ''}${e.first ? ' e1' : ''}${e.last ? ' e2' : ''}` : '');

function Unit({ u }: { u: ZhUnit }) {
  const cl = u.cl ? ` cl${u.cl.sf ? ' sf' : ''}${u.cl.sl ? ' sl' : ''}` : '';
  const clData = u.cl ? { 'data-g': u.cl.g, 'data-s': 'z' } : {};
  const ent = u.ent ? entProps(u.ent) : {};
  if (u.kind === 'zp') {
    return <span className={`zp${cl}${entCls(u.ent)}`} data-c={u.c} {...clData} {...ent}>{u.c}</span>;
  }
  const face: ReactNode = u.n ? <><span className="o">{u.c}</span><span className="n">{u.n}</span></> : u.c;
  const inner = u.hv ? <ruby>{face}<rt>{u.hv}</rt></ruby> : face;
  // the tooltip ("Tra từ điển từ …") is added on first hover by the client, to keep the page small
  return (
    <span className={`hz${u.flag ? ' flg' : ''}${cl}${entCls(u.ent)}`} data-c={u.c} {...clData} {...ent}>
      {inner}
    </span>
  );
}

export function ZhText({ nodes }: { nodes: ZhNode[] }) {
  return (
    <div className="zh" lang="zh-Hant">
      {nodes.map((n, i) =>
        n.t === 'u' ? <Unit key={i} u={n.u} /> : (
          <span key={i} className="zn"><span className="zd">〈</span>{n.units.map((u, k) => <Unit key={k} u={u} />)}<span className="zd">〉</span></span>
        ),
      )}
    </div>
  );
}

function RunText({ r }: { r: Run }) {
  return r.ent ? <span className={entCls(r.ent).trim()} {...entProps(r.ent)}>{r.text}</span> : <>{r.text}</>;
}

function Leaf({ runs }: { runs: Run[] }) {
  // consecutive runs of one clause range share one .cl span, as in the prototype's wrapVi()
  const out: ReactNode[] = [];
  for (let i = 0; i < runs.length;) {
    const r = runs[i];
    if (!r.cl) { out.push(<RunText key={i} r={r} />); i++; continue; }
    let j = i;
    while (j < runs.length && runs[j].cl?.r === r.cl.r) j++;
    const grp = runs.slice(i, j);
    out.push(
      <span key={i} className={`cl${r.cl.sf ? ' sf' : ''}${grp[grp.length - 1].cl!.sl ? ' sl' : ''}`} data-g={r.cl.g} data-s="v" data-r={r.cl.r}>
        {grp.map((x, k) => <RunText key={k} r={x} />)}
      </span>,
    );
    i = j;
  }
  return <>{out}</>;
}

export function ViNodes({ nodes }: { nodes: ViNode[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        if (n.t === 'text') return <Leaf key={i} runs={n.runs || [{ text: n.text }]} />;
        if (n.t === 'fo') return <span key={i} className="fo">tờ {n.folio}</span>;
        if (n.t === 'fr') return <span key={i} className="fr" role="button" tabIndex={0} data-n={n.n} aria-label={`Chú thích ${n.n}`}>{n.n}</span>;
        return <span key={i} className={n.cls}><ViNodes nodes={n.children} /></span>;
      })}
    </>
  );
}
