// Reader preferences (per browser). Applied as classes on <html> so the server-rendered sheet
// never re-renders when a preference changes.
export type Prefs = {
  lang: 'vi' | 'en';
  mode: 'both' | 'zh' | 'vi';
  al: boolean;      // highlight the matching clause
  ruby: boolean;    // Hán-Việt readings above characters
  norm: boolean;    // show normalized variant characters
  vert: boolean;    // vertical Chinese
  hideEd: boolean;  // hide translator insertions [ ]
  hideOn: boolean;  // hide original small notes ( )
  rs: number;       // reading size factor
  theme: 'auto' | 'light' | 'dark';
};
export const DEFAULT_PREFS: Prefs = { lang: 'vi', mode: 'both', al: true, ruby: false, norm: false, vert: false, hideEd: false, hideOn: false, rs: 1, theme: 'auto' };
export const PREFS_KEY = 'dvsktt.prefs.v1';
export const SIZES = [0.85, 1, 1.15, 1.3, 1.5];

/** Same logic as applyPrefs(), as a string for the pre-paint <script> in the root layout. */
export const PREPAINT = `(function(){try{var p=JSON.parse(localStorage.getItem('${PREFS_KEY}')||'{}');var d=Object.assign(${JSON.stringify(DEFAULT_PREFS)},p);var r=document.documentElement,c=r.classList;
c.add('m-'+d.mode);if(d.ruby)c.add('ruby');if(d.norm)c.add('norm');if(d.vert)c.add('vert');if(d.hideEd)c.add('hide-ed');if(d.hideOn)c.add('hide-on');if(d.al)c.add('al');if(d.lang==='en'){c.add('tl-en');r.lang='en'}
if(d.theme!=='auto')r.dataset.theme=d.theme;r.style.setProperty('--rs',d.rs);if(matchMedia('(hover:none)').matches)c.add('touch')}catch(e){document.documentElement.classList.add('m-both','al')}})()`;

export function applyPrefs(p: Prefs) {
  const r = document.documentElement, c = r.classList;
  c.remove('m-both', 'm-zh', 'm-vi');
  c.add('m-' + p.mode);
  c.toggle('ruby', p.ruby); c.toggle('norm', p.norm); c.toggle('vert', p.vert);
  c.toggle('hide-ed', p.hideEd); c.toggle('hide-on', p.hideOn); c.toggle('al', p.al);
  c.toggle('tl-en', p.lang === 'en');
  r.lang = p.lang;
  if (p.theme === 'auto') delete r.dataset.theme; else r.dataset.theme = p.theme;
  r.style.setProperty('--rs', String(p.rs));
  c.toggle('touch', matchMedia('(hover:none)').matches);
}

export function loadPrefs(): Prefs {
  try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }; } catch { return DEFAULT_PREFS; }
}
export function savePrefs(p: Prefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* private mode */ }
}
