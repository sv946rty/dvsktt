import { describe, expect, it } from 'vitest';
import { buildPassage, plainVi, viTree, zhUnits, type Passage } from '../src';

const lex = { hanviet: { 姓: 'tính', 丁: 'đinh' }, variants: { 䧺: '雄' } };

describe('viTree', () => {
  it('keeps brackets as visible text and drops folio and footnote markers from the offsets', () => {
    const t = viTree('|1a| Họ Đinh{n1} ở ngôi ⟦968⟧ ⟨Tống⟩.');
    expect(t.text).toBe(' Họ Đinh ở ngôi [968] (Tống).');
    expect(t.nodes[0]).toEqual({ t: 'fo', folio: '1a' });
    expect(t.nodes.some((n) => n.t === 'fr' && n.n === 1)).toBe(true);
  });
});

describe('zhUnits', () => {
  it('marks ⚑ on the next Han character only and groups 〈 〉 notes', () => {
    const { nodes, units } = zhUnits('⚑也，〈宋䧺〉', lex);
    expect(units.map((u) => u.c).join('')).toBe('也，宋䧺');
    expect(units[0].flag).toBe(true);
    expect(units[2].flag).toBe(false);
    expect(units[3].n).toBe('雄');
    expect(nodes[2]).toMatchObject({ t: 'note' });
  });
});

describe('buildPassage', () => {
  const p: Passage = {
    id: 'E01', chapter: 'x', reign: 'r', year: 'y', type: 'summary', folio: '1a', folios: ['1a'], page: 1,
    zh: '姓丁，諱部領', zhPartial: false, vi: 'Họ Đinh, tên húy là Bộ Lĩnh', en: 'Surname Đinh, name Bộ Lĩnh', notes: [],
    groups: [{ zh: ['姓丁'], vi: ['Họ Đinh'], en: ['Surname Đinh'] }, { zh: ['諱部領'], vi: ['tên húy là Bộ Lĩnh'], en: ['name Bộ Lĩnh'] }],
  };
  const mention = (lang: 'zh' | 'vi', start: number, end: number, text: string) => ({
    mentionId: 'm' + start, entityId: 'person:x', entryId: 'E01', lang, target: 'body' as const, text,
    render: { start, end, coord: 'x' }, groupIndex: 1, reviewRequired: false, context: ['', ''] as [string, string],
  });
  it('aligns clause groups on both sides and places entity mentions', () => {
    const m = buildPassage(p, lex, [{ i: 0, m: mention('zh', 4, 6, '部領'), label: 'x' }, { i: 1, m: mention('vi', 20, 27, 'Bộ Lĩnh'), label: 'x' }]);
    expect(m.stats).toEqual({ applied: 2, skipped: [] });
    const zh = m.zh!.flatMap((n) => (n.t === 'u' ? [n.u] : n.units));
    expect(zh.filter((u) => u.cl?.g === 1).map((u) => u.c).join('')).toBe('諱部領');
    expect(zh.filter((u) => u.ent).map((u) => u.c).join('')).toBe('部領');
    const runs = m.vi.flatMap((n) => (n.t === 'text' ? n.runs || [] : []));
    expect(runs.filter((r) => r.ent).map((r) => r.text).join('')).toBe('Bộ Lĩnh');
    expect(runs.find((r) => r.ent)!.cl!.g).toBe(1);
  });
  it('skips a mention whose text does not match instead of forcing it', () => {
    const m = buildPassage(p, lex, [{ i: 0, m: mention('vi', 0, 7, 'Lê Hoàn'), label: 'x' }]);
    expect(m.stats.skipped).toEqual(['m0']);
  });
});

describe('plainVi', () => {
  it('matches the prototype search text', () => expect(plainVi('|1b| A{n2} ⟦B⟧ ⟨C⟩')).toBe('A [B] [C]'));
});
