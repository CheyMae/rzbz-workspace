import { Extension, InputRule, Node, mergeAttributes, wrappingInputRule } from '@tiptap/core';
import Blockquote from '@tiptap/extension-blockquote';
import { Plugin } from '@tiptap/pm/state';

export const CALLOUT_TONES = ['default', 'blue', 'yellow', 'red', 'green'] as const;
export type CalloutTone = (typeof CALLOUT_TONES)[number];

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (attrs?: { tone?: CalloutTone; emoji?: string }) => ReturnType;
      setCalloutTone: (tone: CalloutTone) => ReturnType;
    };
    toggleBlock: {
      /** Turn the current line into a toggle: its text becomes the toggle's heading (like Notion). */
      setToggle: () => ReturnType;
    };
  }
}

/** Figma "Callout": an emoji and a tinted box that holds any blocks. */
export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      tone: { default: 'default', parseHTML: (el) => el.getAttribute('data-tone') || 'default', renderHTML: (a) => ({ 'data-tone': a.tone }) },
      emoji: { default: '💡', parseHTML: (el) => el.getAttribute('data-emoji') || '💡', renderHTML: (a) => ({ 'data-emoji': a.emoji }) },
    };
  },
  parseHTML() { return [{ tag: 'div[data-callout]' }]; },
  renderHTML({ node, HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-callout': '', class: 'callout-block' }),
      ['span', { class: 'callout-emoji', contenteditable: 'false' }, node.attrs.emoji],
      ['div', { class: 'callout-body' }, 0]];
  },
  addCommands() {
    return {
      setCallout: (attrs) => ({ commands }) => commands.wrapIn(this.name, attrs),
      setCalloutTone: (tone) => ({ commands }) => commands.updateAttributes(this.name, { tone }),
    };
  },
  addKeyboardShortcuts() {
    return {
      // Backspace at the very start of a callout's first line takes the text out of the callout.
      Backspace: ({ editor }) => {
        const { $from, empty } = editor.state.selection;
        if (!empty || $from.parentOffset !== 0) return false;
        const d = $from.depth - 1;
        if (d < 1 || $from.node(d).type.name !== this.name || $from.index(d) !== 0) return false;
        return editor.commands.lift(this.name);
      },
    };
  },
});

/** Quotes start with " + space (like Notion); "> " is used for toggles instead. */
export const NotionQuote = Blockquote.extend({
  addInputRules() { return [wrappingInputRule({ find: /^\s*"\s$/, type: this.type })]; },
});

/** "> " makes a toggle (Notion's shortcut); setToggle turns a line into one. */
export const ToggleShortcut = Extension.create({
  name: 'toggleBlock',
  priority: 1000,
  addKeyboardShortcuts() {
    return {
      // Enter on a toggle's heading goes into its (empty) first line instead of adding another one.
      Enter: ({ editor }) => {
        const { $from, empty } = editor.state.selection;
        if (!empty || $from.parent.type.name !== 'detailsSummary') return false;
        const details = $from.node(-1);
        const body = details.childCount > 1 ? details.child(1) : null;
        const first = body?.firstChild;
        if (!first || first.type.name !== 'paragraph' || first.content.size) return false;
        const detailsPos = $from.before(-1);
        if (!details.attrs.open) editor.view.dispatch(editor.state.tr.setNodeMarkup(detailsPos, undefined, { ...details.attrs, open: true }));
        return editor.commands.setTextSelection($from.after() + 2);
      },
    };
  },
  addCommands() {
    return {
      setToggle: () => ({ state, chain }) => {
        const { $from } = state.selection;
        const para = $from.parent;
        if (!para.isTextblock) return false;
        const start = $from.before(), end = $from.after();
        return chain().insertContentAt({ from: start, to: end }, {
          type: 'details', attrs: { open: true },
          content: [{ type: 'detailsSummary', content: para.content.toJSON() ?? undefined }, { type: 'detailsContent', content: [{ type: 'paragraph' }] }],
        }).setTextSelection(start + 2 + para.content.size).run();
      },
    };
  },
  addInputRules() {
    return [new InputRule({
      find: /^>\s$/,
      handler: ({ range, chain }) => { chain().deleteRange(range).setToggle().run(); },
    })];
  },
});

/**
 * Smart switching: in a block with nothing typed yet, a shortcut changes the block's type
 * even inside a list or quote (an empty to-do + "- " becomes a bullet, an empty bullet + "[] " a to-do).
 */
const SWITCHES: [RegExp, string][] = [
  [/^[-*]$/, 'bullet'], [/^1[.)]$/, 'ordered'], [/^\[ ?\]$/, 'todo'], [/^\[x\]$/i, 'todoChecked'],
  [/^#$/, 'h1'], [/^##$/, 'h2'], [/^###$/, 'h3'], [/^>$/, 'toggle'], [/^"$/, 'quote'],
];
const WRAPPERS = new Set(['listItem', 'taskItem', 'blockquote']);

export const SmartSwitch = Extension.create({
  name: 'smartSwitch',
  priority: 1000,
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [new Plugin({
      props: {
        handleTextInput(view, from, to, text) {
          if (text !== ' ') return false;
          const { $from } = view.state.selection;
          const parent = $from.parent;
          if (!parent.isTextblock || $from.parentOffset !== parent.content.size) return false;
          let inWrapper = false;
          for (let d = $from.depth - 1; d > 0; d--) if (WRAPPERS.has($from.node(d).type.name)) { inWrapper = true; break; }
          if (!inWrapper) return false; // plain blocks use the normal shortcuts
          const typed = parent.textContent;
          const hit = SWITCHES.find(([re]) => re.test(typed));
          if (!hit) return false;
          const start = from - typed.length;
          const c = editor.chain().deleteRange({ from: start, to }).clearNodes();
          switch (hit[1]) {
            case 'bullet': c.toggleBulletList(); break;
            case 'ordered': c.toggleOrderedList(); break;
            case 'todo': c.toggleTaskList(); break;
            case 'todoChecked': c.toggleTaskList().updateAttributes('taskItem', { checked: true }); break;
            case 'h1': c.setHeading({ level: 1 }); break;
            case 'h2': c.setHeading({ level: 2 }); break;
            case 'h3': c.setHeading({ level: 3 }); break;
            case 'toggle': c.setToggle(); break;
            case 'quote': c.toggleBlockquote(); break;
          }
          return c.run();
        },
      },
    })];
  },
});
