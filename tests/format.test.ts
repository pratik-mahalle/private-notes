import { test, expect } from 'vitest';
import { formatClock, transcribedLabel, notesLabel } from '../src/format';

test('formatClock rounds to whole seconds', () => { expect(formatClock(29_661)).toBe('0:30'); expect(formatClock(600_000)).toBe('10:00'); });
test('transcribedLabel', () => { expect(transcribedLabel(29_661, 2_850)).toBe('Transcribed 0:30 in 3 s'); expect(transcribedLabel(5_000, 200)).toBe('Transcribed 0:05 in 1 s'); });
test('notesLabel', () => { expect(notesLabel(7_040)).toBe('Notes written in 7 s'); });
