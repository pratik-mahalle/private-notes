export type ActionItem = { owner: string; task: string; due: string };
export type Notes = { summary: string; decisions: string[]; actionItems: ActionItem[] };

// Also parsed below: notes that copy the example back are dropped, so prompt and guard cannot drift.
const EXAMPLE_REPLY = '{"summary": "The team set the beta date and assigned the changelog.", "decisions": ["Ship the beta on Monday", "Skip the webinar"], "actionItems": [{"owner": "Ana", "task": "Update the changelog", "due": "Friday"}]}';
export const EXAMPLE: Notes = JSON.parse(EXAMPLE_REPLY);

export const NOTES_SYSTEM_PROMPT = [
  'You turn meeting transcripts into notes. Reply with JSON only, in exactly this shape:',
  '{"summary": "...", "decisions": ["..."], "actionItems": [{"owner": "...", "task": "...", "due": "..."}]}',
  'Rules: "summary" is one or two short sentences. "decisions" are things the group agreed or decided, not tasks.',
  '"actionItems" are tasks a named person must do; "due" is the deadline as spoken, or "" if none. Do not add other keys.',
  'Example transcript: "Let\'s ship the beta on Monday. Ana will update the changelog by Friday. We agreed to skip the webinar."',
  `Example reply: ${EXAMPLE_REPLY}`,
].join('\n');

export function hasEnoughSpeech(transcript: string): boolean {
  const words = transcript.replace(/\[[^\]]*\]/g, ' ').match(/[A-Za-z]{2,}/g);
  return (words?.length ?? 0) >= 5;
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Qwen3.5 0.8B often repeats the deadline in the task ("… by Thursday" · Thursday): keep it only in "due".
// A prompt rule against it was tried and dropped: the model ignored it and began copying the example on long transcripts.
const dropDue = (task: string, due: string) =>
  (due && task.replace(new RegExp(`[\\s,]*(?:\\b(?:by|on|before|until|due)\\s+)?(?:(?:the|next|this)\\s+)?${esc(due)}[.\\s]*$`, 'i'), '')) || task;

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const fromExample = {
  decision: (d: string) => EXAMPLE.decisions.some((e) => same(d, e)),
  item: (i: ActionItem) => EXAMPLE.actionItems.some((e) => same(i.owner, e.owner) && same(i.task, e.task)),
};

// Given the transcript, a reply that uses example phrases the meeting never said is a copy of the example: reject it.
const copiesExample = (raw: string, transcript: string) =>
  [...EXAMPLE.decisions, ...EXAMPLE.actionItems.map((i) => i.task)]
    .some((p) => raw.toLowerCase().includes(p.toLowerCase()) && !transcript.toLowerCase().includes(p.toLowerCase()));

export function parseNotes(raw: string, transcript?: string): Notes | null {
  if (transcript !== undefined && copiesExample(raw, transcript)) return null;
  const a = raw.indexOf('{'), b = raw.lastIndexOf('}');
  if (a < 0 || b < a) return null;
  let o: any;
  try { o = JSON.parse(raw.slice(a, b + 1)); } catch { return null; }
  const summary = str(o?.summary);
  if (!summary || same(summary, EXAMPLE.summary)) return null; // the example copied wholesale is a failure, not notes
  const actionItems = (Array.isArray(o.actionItems) ? o.actionItems : [])
    .map((i: any) => ({ owner: str(i?.owner), task: dropDue(str(i?.task), str(i?.due)), due: str(i?.due) }))
    .filter((i: ActionItem) => i.task && !fromExample.item(i));
  const owners = actionItems.map((i: ActionItem) => i.owner).filter(Boolean);
  const named = owners.length ? new RegExp(`\\b(${owners.map(esc).join('|')})\\b`, 'i') : null;
  const decisions = (Array.isArray(o.decisions) ? o.decisions : [])
    .map(str)
    .filter((d: string) => d && !named?.test(d) && !fromExample.decision(d));
  return { summary, decisions, actionItems };
}

export function notesToMarkdown(n: Notes): string {
  let md = `## Summary\n${n.summary}\n`;
  if (n.decisions.length) md += `\n## Decisions\n${n.decisions.map((d) => `- ${d}`).join('\n')}\n`;
  if (n.actionItems.length)
    md += `\n## Action items\n${n.actionItems.map((i) => `- [ ] ${i.owner ? `${i.owner} — ` : ''}${i.task}${i.due ? ` (due ${i.due})` : ''}`).join('\n')}\n`;
  return md;
}
