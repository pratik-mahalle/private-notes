import { test, expect } from 'vitest';
import { parseNotes, hasEnoughSpeech, notesToMarkdown, EXAMPLE, NOTES_SYSTEM_PROMPT } from '../src/notes';

const qwenMeeting = '{"summary":"The team agreed to delay the Android release by one week.","decisions":["Delay Android release by one week","Assign Marcus to handle pricing page","Schedule Sam\'s developer meetup for the 25th"],"actionItems":[{"owner":"Priya","task":"Finish onboarding docs","due":"Thursday"},{"owner":"Marcus","task":"Handle pricing page","due":"Friday"},{"owner":"Sam","task":"Book developer meetup venue","due":"25th"}]}';
test('drops decisions that name an action-item owner', () => {
  expect(parseNotes(qwenMeeting)!.decisions).toEqual(['Delay Android release by one week']);
});
test('keeps action items, fills missing due with empty string, drops unknown keys', () => {
  const n = parseNotes('{"summary":"S","decisions":[],"actionItems":[{"owner":"Ana","task":"T"}],"required":["summary"]}')!;
  expect(n).toEqual({ summary: 'S', decisions: [], actionItems: [{ owner: 'Ana', task: 'T', due: '' }] });
});
test('extracts JSON from surrounding prose or code fences', () => {
  expect(parseNotes('Sure!\n```json\n{"summary":"S","decisions":[],"actionItems":[]}\n```')?.summary).toBe('S');
});
test('returns null for empty, non-JSON, or summary-less output', () => {
  expect(parseNotes('')).toBeNull();
  expect(parseNotes('Thinking Process: …')).toBeNull();
  expect(parseNotes('{"decisions":[],"actionItems":[]}')).toBeNull();
});
test('drops action items without a task', () => {
  expect(parseNotes('{"summary":"S","decisions":[],"actionItems":[{"owner":"A","task":""}]}')!.actionItems).toEqual([]);
});
test('hasEnoughSpeech needs at least five words', () => {
  expect(hasEnoughSpeech(' [BLANK_AUDIO] ')).toBe(false);
  expect(hasEnoughSpeech('Priya will finish the docs')).toBe(true);
});
test('notesToMarkdown format', () => {
  expect(notesToMarkdown({ summary: 'S.', decisions: ['D'], actionItems: [{ owner: 'Ana', task: 'Update changelog', due: 'Friday' }, { owner: 'Bo', task: 'Ship', due: '' }] }))
    .toBe('## Summary\nS.\n\n## Decisions\n- D\n\n## Action items\n- [ ] Ana — Update changelog (due Friday)\n- [ ] Bo — Ship\n');
});
test('notesToMarkdown omits an empty Decisions section', () => {
  expect(notesToMarkdown({ summary: 'S.', decisions: [], actionItems: [] })).toBe('## Summary\nS.\n');
});
test('notesToMarkdown leaves out the dash when an action item has no owner', () => {
  expect(notesToMarkdown({ summary: 'S.', decisions: [], actionItems: [{ owner: '', task: 'Send the recap', due: '' }] }))
    .toBe('## Summary\nS.\n\n## Action items\n- [ ] Send the recap\n');
});
test('removes a deadline the task repeats, but never empties or rewrites the task otherwise', () => {
  const item = (task: string, due: string) => `{"owner":"A","task":${JSON.stringify(task)},"due":${JSON.stringify(due)}}`;
  const n = parseNotes(`{"summary":"S","decisions":[],"actionItems":[${[
    item('Finish onboarding documentation by Thursday', 'Thursday'),
    item('Book venue for developer meet-up by October 25.', 'October 25'),
    item('Update pricing page by Friday', 'by Friday'),
    item('Ship the build Friday', 'Friday'),
    item('Friday', 'Friday'),
    item("Prepare Friday's demo", 'Friday'),
    item('Send recap by Monday', ''),
    item('Profile the query layer and report back by next Wednesday', 'Wednesday'),
  ].join(',')}]}`)!;
  expect(n.actionItems.map((i) => i.task)).toEqual([
    'Finish onboarding documentation', 'Book venue for developer meet-up', 'Update pricing page', 'Ship the build', 'Friday', "Prepare Friday's demo", 'Send recap by Monday', 'Profile the query layer and report back',
  ]);
});
test('drops decisions and action items copied from the prompt example, whatever the case or spacing', () => {
  const n = parseNotes(JSON.stringify({
    summary: 'Lena will run the verification experiment.',
    decisions: [' skip the WEBINAR ', 'Ship the beta on Monday', 'Delay caching'],
    actionItems: [{ owner: 'ana', task: 'Update the changelog ', due: 'Friday' }, { owner: 'Lena', task: 'Run the experiment', due: '' }],
  }))!;
  expect(n.decisions).toEqual(['Delay caching']);
  expect(n.actionItems).toEqual([{ owner: 'Lena', task: 'Run the experiment', due: '' }]);
});
test('the example copied wholesale counts as a failed reply', () => {
  expect(parseNotes(JSON.stringify(EXAMPLE))).toBeNull();
});
test('the guard uses the same example the prompt shows', () => {
  expect(NOTES_SYSTEM_PROMPT).toContain(EXAMPLE.summary);
  for (const d of EXAMPLE.decisions) expect(NOTES_SYSTEM_PROMPT).toContain(d);
  expect(EXAMPLE.actionItems[0]).toEqual({ owner: 'Ana', task: 'Update the changelog', due: 'Friday' });
});
test('with the transcript, a reply that uses example phrases the meeting never said is rejected', () => {
  const leaked = '{"summary":"The team decided to skip the webinar and update the changelog by Friday.","decisions":["Update the changelog"],"actionItems":[]}';
  expect(parseNotes(leaked, 'Welcome to the weekly product review. Lena will run an experiment.')).toBeNull();
  expect(parseNotes(leaked, 'We will skip the webinar. Bo will update the changelog by Friday.')?.summary).toMatch(/webinar/);
});
