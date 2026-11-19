import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { TableKit } from '@tiptap/extension-table';
import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details';
import { Placeholder } from '@tiptap/extensions';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import type { Node as PMNode } from '@tiptap/pm/model';
import {
  Bold, Check, ChevronRight, Code, Copy, GripVertical, Heading1, Heading2, Heading3, Italic, Lightbulb, Link as LinkIcon, List,
  ListOrdered, ListTodo, Minus, Plus, Quote, Strikethrough, Table2, Trash2, Type, Underline, Unlink,
} from 'lucide-react';
import { CALLOUT_TONES, Callout, NotionQuote, SmartSwitch, ToggleShortcut, type CalloutTone } from './extensions';
import { looksLikeMarkdown, markdownToHtml } from './markdown';

/* ------------------------------------------------------------------ blocks */

type BlockItem = { id: string; label: string; desc: string; icon: ReactNode; keys: string; run: (e: Editor) => void; turnInto?: boolean };

const BLOCKS: BlockItem[] = [
  { id: 'text', label: 'Text', desc: 'Just start writing', icon: <Type size={16} />, keys: 'text paragraph plain', turnInto: true, run: (e) => e.chain().focus().clearNodes().setParagraph().run() },
  { id: 'h1', label: 'Heading 1', desc: 'Big section heading', icon: <Heading1 size={16} />, keys: 'heading h1 title #', turnInto: true, run: (e) => e.chain().focus().clearNodes().setHeading({ level: 1 }).run() },
  { id: 'h2', label: 'Heading 2', desc: 'Medium section heading', icon: <Heading2 size={16} />, keys: 'heading h2 subheading ##', turnInto: true, run: (e) => e.chain().focus().clearNodes().setHeading({ level: 2 }).run() },
  { id: 'h3', label: 'Heading 3', desc: 'Small section heading', icon: <Heading3 size={16} />, keys: 'heading h3 ###', turnInto: true, run: (e) => e.chain().focus().clearNodes().setHeading({ level: 3 }).run() },
  { id: 'bullet', label: 'Bulleted list', desc: 'A simple bulleted list', icon: <List size={16} />, keys: 'bulleted list bullet ul -', turnInto: true, run: (e) => e.chain().focus().clearNodes().toggleBulletList().run() },
  { id: 'numbered', label: 'Numbered list', desc: 'A list with numbers', icon: <ListOrdered size={16} />, keys: 'numbered list ordered ol 1.', turnInto: true, run: (e) => e.chain().focus().clearNodes().toggleOrderedList().run() },
  { id: 'todo', label: 'To-do list', desc: 'Track tasks with a checkbox', icon: <ListTodo size={16} />, keys: 'todo to-do checkbox check task []', turnInto: true, run: (e) => e.chain().focus().clearNodes().toggleTaskList().run() },
  { id: 'toggle', label: 'Toggle list', desc: 'Hide and show content inside', icon: <ChevronRight size={16} />, keys: 'toggle details collapse >', turnInto: true, run: (e) => e.chain().focus().clearNodes().setToggle().run() },
  { id: 'callout', label: 'Callout', desc: 'Make writing stand out', icon: <Lightbulb size={16} />, keys: 'callout note tip warning info', turnInto: true, run: (e) => e.chain().focus().clearNodes().setCallout().run() },
  { id: 'quote', label: 'Quote', desc: 'Capture a quote', icon: <Quote size={16} />, keys: 'quote blockquote "', turnInto: true, run: (e) => e.chain().focus().clearNodes().toggleBlockquote().run() },
  { id: 'code', label: 'Code', desc: 'Capture a code snippet', icon: <Code size={16} />, keys: 'code snippet pre', turnInto: true, run: (e) => e.chain().focus().clearNodes().toggleCodeBlock().run() },
  { id: 'table', label: 'Table', desc: 'Rows and columns', icon: <Table2 size={16} />, keys: 'table grid rows columns spreadsheet', run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { id: 'divider', label: 'Divider', desc: 'Visually split blocks', icon: <Minus size={16} />, keys: 'divider line rule hr ---', run: (e) => e.chain().focus().setHorizontalRule().run() },
];
const matchBlocks = (q: string) => BLOCKS.filter((b) => !q || b.label.toLowerCase().includes(q) || b.keys.includes(q));

const TONE_LABEL: Record<CalloutTone, string> = { default: 'Default', blue: 'Blue', yellow: 'Yellow', red: 'Red', green: 'Green' };

/** Is the cursor right after "/" (at a line start or after a space)? Returns the range to replace and the typed filter. */
function findSlash(editor: Editor) {
  const { selection } = editor.state;
  if (!selection.empty || !(selection instanceof TextSelection)) return null;
  const $f = selection.$from;
  if (!$f.parent.isTextblock || $f.parent.type.name === 'codeBlock') return null;
  const before = $f.parent.textBetween(0, $f.parentOffset, undefined, '￼');
  const m = /(?:^|\s)\/([\w-]{0,20})$/.exec(before);
  if (!m) return null;
  return { from: selection.from - m[1].length - 1, to: selection.from, query: m[1].toLowerCase() };
}

/** The block under the pointer: a list item if inside a list, else the top-level block. */
function blockAtY(editor: Editor, y: number): { pos: number; node: PMNode } | null {
  const view = editor.view;
  const r = view.dom.getBoundingClientRect();
  const hit = view.posAtCoords({ left: r.left + 24, top: y }) ?? view.posAtCoords({ left: r.left + 2, top: y });
  if (!hit) return null;
  const doc = view.state.doc;
  const at = hit.inside >= 0 ? hit.inside : hit.pos;
  const $p = doc.resolve(Math.min(at, doc.content.size));
  if ($p.depth === 0) { const n = doc.nodeAt(at); return n ? { pos: at, node: n } : null; }
  let target: { pos: number; node: PMNode } | null = null;
  for (let d = 1; d <= $p.depth; d++) {
    const n = $p.node(d);
    if (d === 1) target = { pos: $p.before(1), node: n };
    else if (n.type.name === 'listItem' || n.type.name === 'taskItem') target = { pos: $p.before(d), node: n };
    if (['table', 'callout', 'details', 'codeBlock'].includes(n.type.name)) break;
  }
  return target;
}

/* ------------------------------------------------------------------ editor */

export type NotesDoc = Record<string, unknown>;

/**
 * Notion-style notes: one editing surface, so you can select across blocks, copy and paste
 * structure, and use "/" blocks, Markdown shortcuts, tables, toggles and callouts.
 * Saves as editor JSON plus a plain-text copy, a moment after typing stops and when focus leaves.
 */
export function NotesEditor({ doc, legacy, onChange, onEditing, label = 'Notes', emptyHint = 'Add notes, or type ‘/’ for blocks' }: {
  doc: unknown; legacy: string | null; onChange: (doc: NotesDoc | null, text: string) => void; onEditing?: () => void; label?: string; emptyHint?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [, setTick] = useState(0);
  const [slashIndex, setSlashIndex] = useState(0);
  const [dismissed, setDismissed] = useState<number | null>(null);
  const [hover, setHover] = useState<{ pos: number; top: number; node: PMNode } | null>(null);
  const [blockMenu, setBlockMenu] = useState<{ pos: number; x: number; y: number } | null>(null);
  const [linkEdit, setLinkEdit] = useState<string | null>(null);
  const [turnMenu, setTurnMenu] = useState(false);

  // Saving: keep the latest document in refs so closing the panel mid-sentence still saves.
  const latest = useRef<{ json: NotesDoc; text: string } | null>(null);
  const saved = useRef('');
  const timer = useRef<number>();
  const cb = useRef({ onChange, onEditing });
  cb.current = { onChange, onEditing };
  const commit = () => {
    clearTimeout(timer.current);
    const l = latest.current; if (!l) return;
    const key = JSON.stringify(l.json);
    if (key === saved.current) return;
    saved.current = key;
    const empty = !l.text.trim() && !key.includes('"table"') && !key.includes('"horizontalRule"');
    cb.current.onChange(empty ? null : l.json, l.text);
  };

  // Menu state the keyboard handler needs (it runs outside React).
  const keys = useRef<{ slash: ReturnType<typeof findSlash>; items: BlockItem[]; index: number }>({ slash: null, items: [], index: 0 });

  const initial = useMemo(() => {
    if (doc && typeof doc === 'object' && (doc as { type?: string }).type === 'doc') return doc as NotesDoc;
    return legacy ? markdownToHtml(legacy) : '';
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        blockquote: false,
        link: { openOnClick: true, autolink: true, linkOnPaste: true, HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' } },
        heading: { levels: [1, 2, 3] },
      }),
      NotionQuote,
      TaskList, TaskItem.configure({ nested: true }),
      TableKit.configure({ table: { resizable: true, cellMinWidth: 80 } }),
      Details.configure({ persist: true, HTMLAttributes: { class: 'toggle-block' } }), DetailsSummary, DetailsContent,
      Callout, ToggleShortcut, SmartSwitch,
      Placeholder.configure({
        includeChildren: true,
        placeholder: ({ editor: ed, node, pos }) => {
          if (node.type.name === 'heading') return `Heading ${node.attrs.level}`;
          if (node.type.name === 'detailsSummary') return 'Toggle';
          let parent = '';
          try { parent = ed.state.doc.resolve(pos).parent.type.name; } catch { /* stale position */ }
          if (parent === 'tableCell' || parent === 'tableHeader') return '';
          if (parent === 'listItem') return 'List';
          if (parent === 'taskItem') return 'To-do';
          if (ed.isEmpty) return emptyHint;
          return 'Type ‘/’ for blocks';
        },
      }),
    ],
    content: initial,
    editorProps: {
      attributes: { class: 'notes-doc', 'aria-label': label },
      handleKeyDown: (_view, event) => {
        const k = keys.current;
        if (!k.slash || !k.items.length) return false;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          const d = event.key === 'ArrowDown' ? 1 : -1;
          setSlashIndex((i) => (i + d + k.items.length) % k.items.length);
          return true;
        }
        if (event.key === 'Enter' || event.key === 'Tab') { choose(k.items[Math.min(k.index, k.items.length - 1)]); return true; }
        if (event.key === 'Escape') { event.stopPropagation(); setDismissed(k.slash.from); return true; }
        return false;
      },
      // Pasted plain text with Markdown structure (lists, headings, | tables |) becomes real blocks.
      handlePaste: (_view, event) => {
        const html = event.clipboardData?.getData('text/html');
        const text = event.clipboardData?.getData('text/plain') ?? '';
        if (html || !looksLikeMarkdown(text)) return false;
        editorRef.current?.commands.insertContent(markdownToHtml(text));
        return true;
      },
    },
    onCreate: ({ editor: ed }) => { latest.current = { json: ed.getJSON() as NotesDoc, text: ed.getText({ blockSeparator: '\n' }) }; saved.current = JSON.stringify(latest.current.json); },
    onUpdate: ({ editor: ed }) => {
      latest.current = { json: ed.getJSON() as NotesDoc, text: ed.getText({ blockSeparator: '\n' }) };
      if (JSON.stringify(latest.current.json) === saved.current) return;
      cb.current.onEditing?.();
      clearTimeout(timer.current);
      timer.current = window.setTimeout(commit, 700);
    },
    onBlur: () => commit(),
  });
  const editorRef = useRef<Editor | null>(null);
  editorRef.current = editor;

  // Redraw menus on every change of selection or content, and when the panel scrolls.
  useEffect(() => {
    if (!editor) return;
    const t = () => setTick((x) => x + 1);
    editor.on('transaction', t); editor.on('focus', t); editor.on('blur', t);
    window.addEventListener('scroll', t, true); window.addEventListener('resize', t);
    return () => { editor.off('transaction', t); editor.off('focus', t); editor.off('blur', t); window.removeEventListener('scroll', t, true); window.removeEventListener('resize', t); };
  }, [editor]);
  useEffect(() => {
    window.addEventListener('pagehide', commit);
    return () => { window.removeEventListener('pagehide', commit); commit(); };
  }, []);

  // Escape closes our menus first (and doesn't close the task panel).
  useEffect(() => {
    if (!blockMenu && linkEdit === null && !turnMenu) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); setBlockMenu(null); setLinkEdit(null); setTurnMenu(false); editor?.commands.focus(); } };
    window.addEventListener('keydown', k, true); return () => window.removeEventListener('keydown', k, true);
  }, [blockMenu, linkEdit, turnMenu, editor]);

  if (!editor) return null;

  /* ---- slash menu */
  const slashRaw = editor.isFocused ? findSlash(editor) : null;
  const slash = slashRaw && slashRaw.from !== dismissed ? slashRaw : null;
  const items = slash ? matchBlocks(slash.query) : [];
  const index = Math.min(slashIndex, Math.max(items.length - 1, 0));
  keys.current = { slash, items, index };
  if (!slash && slashIndex !== 0) setTimeout(() => setSlashIndex(0));
  if (!slashRaw && dismissed !== null) setTimeout(() => setDismissed(null));
  function choose(item: BlockItem) {
    const s = keys.current.slash; const ed = editorRef.current; if (!s || !ed) return;
    ed.chain().focus().deleteRange({ from: s.from, to: s.to }).run();
    item.run(ed);
    setSlashIndex(0);
  }

  /* ---- floating positions (fixed to the viewport) */
  const below = (pos: number, h: number) => {
    const c = editor.view.coordsAtPos(pos);
    const top = c.bottom + 6 + h > window.innerHeight ? Math.max(8, c.top - 6 - h) : c.bottom + 6;
    return { top, left: Math.min(c.left, window.innerWidth - 300) };
  };

  /* ---- format toolbar: on a text selection */
  const sel = editor.state.selection;
  const inCode = editor.isActive('codeBlock');
  const showFormat = (editor.isFocused || linkEdit !== null || turnMenu) && sel instanceof TextSelection && !sel.empty && !inCode;
  let formatPos: { top: number; left: number } | null = null;
  if (showFormat) {
    const a = editor.view.coordsAtPos(sel.from), b = editor.view.coordsAtPos(sel.to);
    const top = Math.min(a.top, b.top) - 44;
    formatPos = { top: top < 8 ? Math.max(a.bottom, b.bottom) + 8 : top, left: Math.max(8, Math.min(a.left, window.innerWidth - 340)) };
  }
  const mark = (name: string, run: () => void, icon: ReactNode, title: string) => (
    <button type="button" className={`fmt-button${editor.isActive(name) ? ' is-active' : ''}`} title={title} aria-label={title} aria-pressed={editor.isActive(name)}
      onMouseDown={(e) => { e.preventDefault(); run(); }}>{icon}</button>
  );

  /* ---- table controls: when the cursor is in a table */
  let tableBar: { top: number; left: number } | null = null;
  if (editor.isFocused && editor.isActive('table')) {
    const $f = sel.$from;
    for (let d = $f.depth; d > 0; d--) if ($f.node(d).type.name === 'table') {
      const dom = editor.view.nodeDOM($f.before(d)) as HTMLElement | null;
      if (dom) { const r = dom.getBoundingClientRect(); tableBar = { top: Math.max(8, r.top - 40), left: r.left }; }
      break;
    }
  }

  /* ---- block handle (+ and drag ⋮⋮) */
  const onMove = (e: React.MouseEvent) => {
    if (blockMenu || !wrapRef.current) return;
    if ((e.target as HTMLElement).closest('.block-handle')) return;
    const b = blockAtY(editor, e.clientY);
    if (!b) { setHover(null); return; }
    const dom = editor.view.nodeDOM(b.pos) as HTMLElement | null;
    if (!dom || !dom.getBoundingClientRect) { setHover(null); return; }
    const wr = wrapRef.current.getBoundingClientRect();
    const lead = b.node.type.name === 'heading' ? (b.node.attrs.level === 1 ? 8 : 4) : 0;
    const top = dom.getBoundingClientRect().top - wr.top + lead;
    if (!hover || hover.pos !== b.pos || hover.top !== top) setHover({ pos: b.pos, top, node: b.node });
  };
  const addBelow = () => {
    if (!hover) return;
    const { pos, node } = hover;
    const end = pos + node.nodeSize;
    const isItem = node.type.name === 'listItem' || node.type.name === 'taskItem';
    const content = isItem
      ? { type: node.type.name, ...(node.type.name === 'taskItem' ? { attrs: { checked: false } } : {}), content: [{ type: 'paragraph', content: [{ type: 'text', text: '/' }] }] }
      : { type: 'paragraph', content: [{ type: 'text', text: '/' }] };
    editor.chain().insertContentAt(end, content).setTextSelection(end + (isItem ? 3 : 2)).focus().run();
  };
  const onDragStart = (e: React.DragEvent) => {
    if (!hover) return;
    const view = editor.view;
    const ns = NodeSelection.create(view.state.doc, hover.pos);
    view.dispatch(view.state.tr.setSelection(ns));
    (view as unknown as { dragging: unknown }).dragging = { slice: ns.content(), move: true };
    e.dataTransfer.effectAllowed = 'copyMove';
    e.dataTransfer.setData('text/plain', hover.node.textContent);
    const dom = view.nodeDOM(hover.pos) as HTMLElement | null;
    if (dom) e.dataTransfer.setDragImage(dom, 0, 0);
  };
  const openBlockMenu = (e: React.MouseEvent) => {
    if (!hover) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, hover.pos)));
    setBlockMenu({ pos: hover.pos, x: r.left, y: r.bottom + 4 });
  };
  const menuNode = blockMenu ? editor.state.doc.nodeAt(blockMenu.pos) : null;
  const turnBlockInto = (item: BlockItem) => {
    if (!blockMenu) return;
    editor.chain().setTextSelection(TextSelection.near(editor.state.doc.resolve(blockMenu.pos + 1)).from).run();
    item.run(editor); setBlockMenu(null);
  };

  const fixedMenu = (style: React.CSSProperties, children: ReactNode, cls = '') => (
    <div className={`menu notes-menu ${cls}`} style={{ position: 'fixed', ...style }} onMouseDown={(e) => e.preventDefault()}>{children}</div>
  );
  const blockOption = (b: BlockItem, active: boolean, onPick: () => void, onEnter?: () => void) => (
    <button key={b.id} type="button" role="option" aria-selected={active} className={`menu-item slash-item${active ? ' is-active' : ''}`}
      onMouseDown={(e) => { e.preventDefault(); onPick(); }} onMouseEnter={onEnter}>
      <span className="slash-icon">{b.icon}</span>
      <span className="slash-text"><span className="t-caption-emphasis">{b.label}</span><span className="t-caption muted">{b.desc}</span></span>
    </button>
  );

  return (
    <div className="notes-editor" ref={wrapRef} onMouseMove={onMove} onMouseLeave={() => !blockMenu && setHover(null)}>
      {hover && (
        <div className="block-handle" style={{ top: hover.top }}>
          <button type="button" className="block-handle-btn" aria-label="Add a block below" title="Add a block below" onClick={addBelow}><Plus size={16} /></button>
          <button type="button" className="block-handle-btn grip" aria-label="Drag to move, click for options" title="Drag to move · click for options"
            draggable onDragStart={onDragStart} onDragEnd={() => setHover(null)} onClick={openBlockMenu}><GripVertical size={16} /></button>
        </div>
      )}
      <EditorContent editor={editor} />
      <div className="notes-tail" aria-hidden onClick={() => {
        const last = editor.state.doc.lastChild;
        if (last && last.type.name === 'paragraph' && !last.content.size) editor.commands.focus('end');
        else editor.chain().insertContentAt(editor.state.doc.content.size, { type: 'paragraph' }).focus('end').run();
      }} />

      {slash && fixedMenu(below(slash.from, 320), <>
        <span className="t-caption muted notes-menu-title">{items.length ? 'Basic blocks' : 'No matching blocks'}</span>
        <div role="listbox" aria-label="Blocks">{items.map((b, i) => blockOption(b, i === index, () => choose(b), () => setSlashIndex(i)))}</div>
      </>, 'slash-menu')}

      {formatPos && fixedMenu(formatPos, linkEdit !== null ? (
        <form className="fmt-link" onSubmit={(e) => {
          e.preventDefault();
          const url = linkEdit.trim();
          const c = editor.chain().focus().extendMarkRange('link');
          (url ? c.setLink({ href: /^[a-z]+:/i.test(url) ? url : `https://${url}` }) : c.unsetLink()).run();
          setLinkEdit(null);
        }}>
          <input autoFocus className="input" placeholder="Paste a link" value={linkEdit} onChange={(e) => setLinkEdit(e.target.value)} aria-label="Link address" />
          <button type="submit" className="fmt-button" aria-label="Apply link"><Check size={16} /></button>
          {editor.isActive('link') && <button type="button" className="fmt-button" aria-label="Remove link" onClick={() => { editor.chain().focus().extendMarkRange('link').unsetLink().run(); setLinkEdit(null); }}><Unlink size={16} /></button>}
        </form>
      ) : (
        <div className="format-toolbar" role="toolbar" aria-label="Format text">
          <button type="button" className={`fmt-button fmt-turn${turnMenu ? ' is-active' : ''}`} onMouseDown={(e) => { e.preventDefault(); setTurnMenu(!turnMenu); }} aria-label="Turn into" title="Turn into">
            <Type size={16} /><span className="t-caption">Turn into</span>
          </button>
          <span className="fmt-sep" />
          {mark('bold', () => editor.chain().focus().toggleBold().run(), <Bold size={16} />, 'Bold (⌘B)')}
          {mark('italic', () => editor.chain().focus().toggleItalic().run(), <Italic size={16} />, 'Italic (⌘I)')}
          {mark('underline', () => editor.chain().focus().toggleUnderline().run(), <Underline size={16} />, 'Underline (⌘U)')}
          {mark('strike', () => editor.chain().focus().toggleStrike().run(), <Strikethrough size={16} />, 'Strikethrough (⌘⇧S)')}
          {mark('code', () => editor.chain().focus().toggleCode().run(), <Code size={16} />, 'Inline code (⌘E)')}
          {mark('link', () => setLinkEdit(editor.getAttributes('link').href ?? ''), <LinkIcon size={16} />, 'Link (⌘K)')}
          {turnMenu && (
            <div className="menu notes-menu turn-menu">
              {BLOCKS.filter((b) => b.turnInto).map((b) => blockOption(b, false, () => { b.run(editor); setTurnMenu(false); }))}
            </div>
          )}
        </div>
      ), 'format-pop')}

      {tableBar && !formatPos && fixedMenu(tableBar, (
        <div className="table-bar" role="toolbar" aria-label="Table">
          <button type="button" className="fmt-button text" onClick={() => editor.chain().focus().addRowAfter().run()}><Plus size={14} /> Row</button>
          <button type="button" className="fmt-button text" onClick={() => editor.chain().focus().addColumnAfter().run()}><Plus size={14} /> Column</button>
          <span className="fmt-sep" />
          <button type="button" className="fmt-button text" onClick={() => editor.chain().focus().deleteRow().run()}><Minus size={14} /> Row</button>
          <button type="button" className="fmt-button text" onClick={() => editor.chain().focus().deleteColumn().run()}><Minus size={14} /> Column</button>
          <span className="fmt-sep" />
          <button type="button" className="fmt-button text" onClick={() => editor.chain().focus().toggleHeaderRow().run()}>Header row</button>
          <button type="button" className="fmt-button danger" aria-label="Delete table" title="Delete table" onClick={() => editor.chain().focus().deleteTable().run()}><Trash2 size={14} /></button>
        </div>
      ), 'table-pop')}

      {blockMenu && menuNode && <>
        <div className="menu-backdrop" onMouseDown={() => { setBlockMenu(null); setHover(null); }} />
        {fixedMenu({ top: Math.min(blockMenu.y, window.innerHeight - 420), left: blockMenu.x }, <>
          {menuNode.isTextblock || ['listItem', 'taskItem', 'bulletList', 'orderedList', 'taskList', 'blockquote', 'callout', 'details'].includes(menuNode.type.name) ? <>
            <span className="t-caption muted notes-menu-title">Turn into</span>
            {BLOCKS.filter((b) => b.turnInto).map((b) => blockOption(b, false, () => turnBlockInto(b)))}
          </> : null}
          {menuNode.type.name === 'callout' && <>
            <span className="t-caption muted notes-menu-title">Color</span>
            <div className="tone-row">{CALLOUT_TONES.map((t) => (
              <button key={t} type="button" className={`tone-swatch tone-${t}${menuNode.attrs.tone === t ? ' is-active' : ''}`} aria-label={TONE_LABEL[t]} title={TONE_LABEL[t]}
                onClick={() => { editor.chain().command(({ tr }) => { tr.setNodeMarkup(blockMenu.pos, undefined, { ...menuNode.attrs, tone: t }); return true; }).run(); setBlockMenu(null); }} />
            ))}</div>
          </>}
          <span className="notes-menu-rule" />
          <button type="button" className="menu-item t-caption" onClick={() => { editor.chain().insertContentAt(blockMenu.pos + menuNode.nodeSize, menuNode.toJSON()).run(); setBlockMenu(null); }}><Copy size={14} /> Duplicate</button>
          <button type="button" className="menu-item menu-item-danger t-caption" onClick={() => { editor.chain().command(({ tr }) => { tr.delete(blockMenu.pos, blockMenu.pos + menuNode.nodeSize); return true; }).focus().run(); setBlockMenu(null); setHover(null); }}><Trash2 size={14} /> Delete</button>
        </>, 'block-menu')}
      </>}
    </div>
  );
}
