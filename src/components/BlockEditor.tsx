import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, CheckSquare, Heading1, Heading2, List, ListOrdered, Minus, Plus, Quote, Type } from 'lucide-react';

/**
 * A small Notion-style editor: the text is a list of blocks you type straight into.
 * Enter makes a new block, "/" opens the block menu, and Markdown shortcuts work
 * ("# ", "## ", "- ", "1. ", "[] ", "> ", "---"). It is saved as plain Markdown-ish text,
 * so older plain notes open as paragraphs.
 */
type Kind = 'p' | 'h1' | 'h2' | 'ul' | 'ol' | 'todo' | 'quote' | 'hr';
type Block = { id: string; kind: Kind; text: string; checked?: boolean };

const nid = () => `b${Math.random().toString(36).slice(2, 10)}`;

export function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r/g, '').split('\n');
  const out = lines.map((l): Block => {
    let m;
    if (/^-{3,}\s*$/.test(l)) return { id: nid(), kind: 'hr', text: '' };
    if ((m = /^- \[( |x|X)\] ?(.*)$/.exec(l))) return { id: nid(), kind: 'todo', text: m[2], checked: m[1] !== ' ' };
    if ((m = /^## (.*)$/.exec(l))) return { id: nid(), kind: 'h2', text: m[1] };
    if ((m = /^# (.*)$/.exec(l))) return { id: nid(), kind: 'h1', text: m[1] };
    if ((m = /^[-*] (.*)$/.exec(l))) return { id: nid(), kind: 'ul', text: m[1] };
    if ((m = /^\d+\. (.*)$/.exec(l))) return { id: nid(), kind: 'ol', text: m[1] };
    if ((m = /^> ?(.*)$/.exec(l))) return { id: nid(), kind: 'quote', text: m[1] };
    return { id: nid(), kind: 'p', text: l };
  });
  return out.length ? out : [{ id: nid(), kind: 'p', text: '' }];
}

export function serializeBlocks(blocks: Block[]): string {
  let n = 0;
  const lines = blocks.map((b) => {
    n = b.kind === 'ol' ? n + 1 : 0;
    switch (b.kind) {
      case 'h1': return `# ${b.text}`;
      case 'h2': return `## ${b.text}`;
      case 'ul': return `- ${b.text}`;
      case 'ol': return `${n}. ${b.text}`;
      case 'todo': return `- [${b.checked ? 'x' : ' '}] ${b.text}`;
      case 'quote': return `> ${b.text}`;
      case 'hr': return '---';
      default: return b.text;
    }
  });
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  return lines.join('\n');
}

const MENU: { kind: Kind; label: string; hint: string; icon: JSX.Element; keys: string }[] = [
  { kind: 'p', label: 'Text', hint: 'Plain writing', icon: <Type size={16} />, keys: 'text paragraph plain' },
  { kind: 'h1', label: 'Heading', hint: '#', icon: <Heading1 size={16} />, keys: 'heading h1 title' },
  { kind: 'h2', label: 'Subheading', hint: '##', icon: <Heading2 size={16} />, keys: 'subheading h2' },
  { kind: 'ul', label: 'Bulleted list', hint: '-', icon: <List size={16} />, keys: 'bulleted list bullet ul' },
  { kind: 'ol', label: 'Numbered list', hint: '1.', icon: <ListOrdered size={16} />, keys: 'numbered list ol number' },
  { kind: 'todo', label: 'To-do list', hint: '[]', icon: <CheckSquare size={16} />, keys: 'todo to-do checkbox check task' },
  { kind: 'quote', label: 'Quote', hint: '>', icon: <Quote size={16} />, keys: 'quote callout' },
  { kind: 'hr', label: 'Divider', hint: '---', icon: <Minus size={16} />, keys: 'divider line rule hr' },
];

const PLACEHOLDER: Record<Kind, string> = {
  p: 'Type ‘/’ for blocks', h1: 'Heading', h2: 'Subheading', ul: 'List', ol: 'List', todo: 'To-do', quote: 'Quote', hr: '',
};
const continues = (k: Kind) => k === 'ul' || k === 'ol' || k === 'todo';

export function BlockEditor({ value, onChange, label = 'Notes', emptyHint = 'Add notes, or type ‘/’ for blocks' }: {
  value: string; onChange: (v: string) => void; label?: string; emptyHint?: string;
}) {
  const [blocks, setBlocks] = useState<Block[]>(() => parseBlocks(value));
  const [menu, setMenu] = useState<{ id: string; index: number } | null>(null);
  const refs = useRef(new Map<string, HTMLTextAreaElement>());
  const focusNext = useRef<{ id: string; pos: number | 'end' } | null>(null);
  const saved = useRef(value);
  const latest = useRef(blocks);
  latest.current = blocks;

  // Put the caret where the last edit asked for it (after React has drawn the new blocks).
  useLayoutEffect(() => {
    const f = focusNext.current; if (!f) return;
    focusNext.current = null;
    const el = refs.current.get(f.id); if (!el) return;
    el.focus();
    const p = f.pos === 'end' ? el.value.length : f.pos;
    el.setSelectionRange(p, p);
  });

  // Save a moment after typing stops, and whenever focus leaves the editor or it closes.
  const commit = () => {
    const v = serializeBlocks(latest.current);
    if (v !== saved.current) { saved.current = v; onChange(v); }
  };
  useEffect(() => { const t = setTimeout(commit, 700); return () => clearTimeout(t); }, [blocks]);
  useEffect(() => () => commit(), []);

  const update = (fn: (b: Block[]) => Block[]) => setBlocks((b) => { const n = fn(b); return n.length ? n : [{ id: nid(), kind: 'p', text: '' }]; });
  const setBlock = (id: string, patch: Partial<Block>) => update((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  const query = (b: Block) => (menu?.id === b.id ? b.text.slice(1).toLowerCase() : '');
  const options = (b: Block) => MENU.filter((m) => !query(b) || m.label.toLowerCase().includes(query(b)) || m.keys.includes(query(b)));

  const turnInto = (b: Block, kind: Kind) => {
    setMenu(null);
    if (kind === 'hr') {
      const after = { id: nid(), kind: 'p' as Kind, text: '' };
      update((bs) => bs.flatMap((x) => (x.id === b.id ? [{ ...x, kind: 'hr' as Kind, text: '' }, after] : [x])));
      focusNext.current = { id: after.id, pos: 0 };
      return;
    }
    setBlock(b.id, { kind, text: '', checked: false });
    focusNext.current = { id: b.id, pos: 0 };
  };

  const onText = (b: Block, text: string) => {
    // Markdown shortcuts, typed at the start of a plain block.
    // Works when typed key by key or pasted: the prefix turns the block and the rest stays as its text.
    if (b.kind === 'p') {
      if (/^---$/.test(text)) { turnInto(b, 'hr'); return; }
      const sc: [RegExp, Kind][] = [[/^## /, 'h2'], [/^# /, 'h1'], [/^[-*] /, 'ul'], [/^1\. /, 'ol'], [/^\[ ?\] /, 'todo'], [/^> /, 'quote']];
      for (const [re, kind] of sc) {
        if (re.test(text) && !re.test(b.text)) {
          const rest = text.replace(re, '');
          setMenu(null); setBlock(b.id, { kind, text: rest, checked: false });
          focusNext.current = { id: b.id, pos: rest.length };
          return;
        }
      }
    }
    if (text.startsWith('/') && !text.includes(' ') && (b.text === '' || menu?.id === b.id)) setMenu({ id: b.id, index: 0 });
    else if (menu?.id === b.id) setMenu(null);
    setBlock(b.id, { text });
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>, b: Block, i: number) => {
    const el = e.currentTarget;
    const atStart = el.selectionStart === 0 && el.selectionEnd === 0;
    if (menu?.id === b.id) {
      const opts = options(b);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const d = e.key === 'ArrowDown' ? 1 : -1; setMenu({ id: b.id, index: (menu.index + d + opts.length) % Math.max(opts.length, 1) }); return; }
      if (e.key === 'Enter' && opts.length) { e.preventDefault(); turnInto(b, opts[Math.min(menu.index, opts.length - 1)].kind); return; }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setMenu(null); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Enter on an empty list item ends the list (like Notion).
      if (continues(b.kind) && !b.text) { setBlock(b.id, { kind: 'p' }); return; }
      const before = b.text.slice(0, el.selectionStart), after = b.text.slice(el.selectionEnd);
      const next: Block = { id: nid(), kind: continues(b.kind) || (b.kind === 'quote' && after) ? b.kind : 'p', text: after };
      update((bs) => bs.flatMap((x) => (x.id === b.id ? [{ ...x, text: before }, next] : [x])));
      focusNext.current = { id: next.id, pos: 0 };
      return;
    }
    if (e.key === 'Backspace' && atStart) {
      if (b.kind !== 'p') { e.preventDefault(); setBlock(b.id, { kind: 'p' }); return; }
      if (i === 0) return;
      e.preventDefault();
      const prev = blocks[i - 1];
      if (prev.kind === 'hr') { update((bs) => bs.filter((x) => x.id !== prev.id)); focusNext.current = { id: b.id, pos: 0 }; return; }
      update((bs) => bs.filter((x) => x.id !== b.id).map((x) => (x.id === prev.id ? { ...x, text: x.text + b.text } : x)));
      focusNext.current = { id: prev.id, pos: prev.text.length };
      return;
    }
    if (e.key === 'ArrowUp' && el.selectionStart === 0) {
      const prev = blocks.slice(0, i).reverse().find((x) => x.kind !== 'hr');
      if (prev) { e.preventDefault(); focusNext.current = { id: prev.id, pos: 'end' }; setBlocks([...blocks]); }
      return;
    }
    if (e.key === 'ArrowDown' && el.selectionEnd === el.value.length) {
      const next = blocks.slice(i + 1).find((x) => x.kind !== 'hr');
      if (next) { e.preventDefault(); focusNext.current = { id: next.id, pos: 0 }; setBlocks([...blocks]); }
    }
  };

  const addBelow = (i: number) => {
    const n: Block = { id: nid(), kind: 'p', text: '' };
    update((bs) => [...bs.slice(0, i + 1), n, ...bs.slice(i + 1)]);
    focusNext.current = { id: n.id, pos: 0 };
  };

  // Clicking the empty space under the last block puts you at the end (or in a fresh line).
  const clickBelow = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    const last = blocks[blocks.length - 1];
    if (last.kind === 'p' && !last.text) focusNext.current = { id: last.id, pos: 0 }, setBlocks([...blocks]);
    else addBelow(blocks.length - 1);
  };

  const isEmpty = blocks.length === 1 && blocks[0].kind === 'p' && !blocks[0].text;
  let n = 0;
  return (
    <div className="block-editor" aria-label={label} role="group"
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) { setMenu(null); commit(); } }}>
      {blocks.map((b, i) => {
        n = b.kind === 'ol' ? n + 1 : 0;
        const opts = menu?.id === b.id ? options(b) : [];
        return (
          <div key={b.id} className={`block block-${b.kind}${b.checked ? ' is-checked' : ''}`}>
            <button type="button" className="block-add" aria-label="Add a block below" tabIndex={-1} onClick={() => addBelow(i)}><Plus size={14} /></button>
            {b.kind === 'hr' ? <hr className="block-rule" /> : <>
              {b.kind === 'ul' && <span className="block-mark" aria-hidden>•</span>}
              {b.kind === 'ol' && <span className="block-mark" aria-hidden>{n}.</span>}
              {b.kind === 'todo' && (
                <button type="button" className={`checkbox${b.checked ? ' is-checked' : ''}`} role="checkbox" aria-checked={!!b.checked}
                  aria-label={b.checked ? 'Mark not done' : 'Mark done'} onClick={() => setBlock(b.id, { checked: !b.checked })}>
                  {b.checked && <Check size={12} strokeWidth={3} />}
                </button>
              )}
              <div className="grow-text block-text" data-value={b.text}>
                <textarea rows={1} value={b.text} ref={(el) => { if (el) refs.current.set(b.id, el); else refs.current.delete(b.id); }}
                  aria-label={`${label}: ${MENU.find((m) => m.kind === b.kind)?.label ?? 'Text'}`}
                  placeholder={isEmpty ? emptyHint : PLACEHOLDER[b.kind]} data-always={isEmpty || b.kind !== 'p' || undefined}
                  onChange={(e) => onText(b, e.target.value)} onKeyDown={(e) => onKey(e, b, i)} />
              </div>
            </>}
            {menu?.id === b.id && (
              <div className="menu block-menu" role="listbox" aria-label="Turn into">
                <span className="t-caption muted block-menu-title">Blocks</span>
                {opts.length ? opts.map((m, k) => (
                  <button key={m.kind} type="button" role="option" aria-selected={k === menu.index} tabIndex={-1}
                    className={`menu-item t-caption${k === menu.index ? ' is-active' : ''}`}
                    onMouseDown={(e) => { e.preventDefault(); turnInto(b, m.kind); }} onMouseEnter={() => setMenu({ id: b.id, index: k })}>
                    <span className="menu-icon">{m.icon}</span>{m.label}<span className="grow" /><span className="t-caption muted">{m.hint}</span>
                  </button>
                )) : <span className="t-caption muted block-menu-title">No matching block</span>}
              </div>
            )}
          </div>
        );
      })}
      <div className="block-tail" onClick={clickBelow} aria-hidden />
    </div>
  );
}
