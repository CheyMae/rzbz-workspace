/**
 * Turns the old plain notes (and pasted Markdown-ish text) into editor HTML.
 * Handles: # / ## / ### headings, - and * bullets (indented ones nest), 1. numbers,
 * - [ ] / - [x] / [] to-dos, > quotes, --- dividers, | tables | (a row may run over
 * several lines until it ends with "|"), and bare links.
 */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inline = (s: string) => esc(s)
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]])/g, '<a href="$1">$1</a>');

type Item = { kind: 'ul' | 'ol' | 'todo'; indent: number; text: string; checked?: boolean };

function listHtml(items: Item[]): string {
  // Build nested lists from indentation (2+ extra spaces = one level deeper).
  let html = '';
  const stack: { kind: Item['kind']; indent: number }[] = [];
  const open = (k: Item['kind']) => (k === 'todo' ? '<ul data-type="taskList">' : k === 'ol' ? '<ol>' : '<ul>');
  const close = (k: Item['kind']) => (k === 'ol' ? '</ol>' : '</ul>');
  const li = (it: Item) => (it.kind === 'todo'
    ? `<li data-type="taskItem" data-checked="${it.checked ? 'true' : 'false'}"><p>${inline(it.text)}</p>`
    : `<li><p>${inline(it.text)}</p>`);
  for (const it of items) {
    const top = stack[stack.length - 1];
    if (!top) { html += open(it.kind) + li(it); stack.push({ kind: it.kind, indent: it.indent }); continue; }
    if (it.indent > top.indent) { html += open(it.kind) + li(it); stack.push({ kind: it.kind, indent: it.indent }); continue; }
    while (stack.length > 1 && it.indent < stack[stack.length - 1].indent) { html += '</li>' + close(stack.pop()!.kind); }
    const cur = stack[stack.length - 1];
    if (cur.kind !== it.kind) { html += '</li>' + close(cur.kind); stack.pop(); html += open(it.kind) + li(it); stack.push({ kind: it.kind, indent: it.indent }); }
    else html += '</li>' + li(it);
  }
  while (stack.length) html += '</li>' + close(stack.pop()!.kind);
  return html;
}

function tableHtml(rows: string[]): string {
  const cells = rows.map((r) => r.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim()));
  const isRule = (r: string[]) => r.every((c) => /^:?-{2,}:?$/.test(c) || c === '');
  const hasHeader = cells.length > 1 && isRule(cells[1]);
  const body = cells.filter((_, i) => !(hasHeader && i === 1));
  const width = Math.max(...body.map((r) => r.length));
  const cell = (c: string, th: boolean) => {
    const tag = th ? 'th' : 'td';
    // Lines inside a cell become separate paragraphs.
    const paras = c.split('\n').map((l) => l.trim()).filter(Boolean);
    return `<${tag}>${(paras.length ? paras : ['']).map((p) => `<p>${inline(p)}</p>`).join('')}</${tag}>`;
  };
  return '<table><tbody>' + body.map((r, i) => '<tr>' + Array.from({ length: width }, (_, k) => cell(r[k] ?? '', hasHeader && i === 0)).join('') + '</tr>').join('') + '</tbody></table>';
}

export function markdownToHtml(src: string): string {
  const lines = src.replace(/\r/g, '').split('\n');
  let html = '';
  let list: Item[] = [];
  const flush = () => { if (list.length) { html += listHtml(list); list = []; } };
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const indent = raw.match(/^\s*/)![0].replace(/\t/g, '    ').length;
    const l = raw.trim();
    let m: RegExpExecArray | null;
    // A table: lines starting with "|"; a row continues until a line ends with "|".
    if (l.startsWith('|')) {
      flush();
      const rows: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        let row = lines[i].trim();
        while (!row.endsWith('|') && i + 1 < lines.length) { i++; row += '\n' + lines[i].trim(); }
        rows.push(row); i++;
      }
      i--;
      html += tableHtml(rows);
      continue;
    }
    if ((m = /^[-*] \[( |x|X)\] ?(.*)$/.exec(l)) || (m = /^\[( |x|X)?\] ?(.*)$/.exec(l))) { list.push({ kind: 'todo', indent, text: m[2], checked: !!m[1] && m[1] !== ' ' }); continue; }
    if ((m = /^[-*•] (.*)$/.exec(l))) { list.push({ kind: 'ul', indent, text: m[1] }); continue; }
    if ((m = /^\d+[.)] (.*)$/.exec(l))) { list.push({ kind: 'ol', indent, text: m[1] }); continue; }
    flush();
    if (/^-{3,}$/.test(l)) { html += '<hr>'; continue; }
    if ((m = /^(#{1,3}) (.*)$/.exec(l))) { html += `<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`; continue; }
    if ((m = /^> ?(.*)$/.exec(l))) { html += `<blockquote><p>${inline(m[1])}</p></blockquote>`; continue; }
    html += `<p>${inline(l)}</p>`;
  }
  flush();
  return html || '<p></p>';
}

/** True when pasted plain text has Markdown structure worth converting. */
export const looksLikeMarkdown = (s: string) =>
  /^\s*(#{1,3} |[-*•] |\d+[.)] |\[( |x)?\] |> |\|.*\||-{3,}$)/m.test(s) && s.includes('\n');
