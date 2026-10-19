import { test, expect } from 'vitest';
import { isSupported } from '../src/support';

const ok = { chromium: true, mobile: false, hasWebGPU: true, isolated: true, width: 1280 };
test.each([
  [ok, true],
  [{ ...ok, hasWebGPU: false }, false],
  [{ ...ok, isolated: false }, false],
  [{ ...ok, width: 390 }, false],
  [{ ...ok, width: 768 }, true],
  [{ ...ok, width: 600 }, true],
  [{ ...ok, width: 480 }, true],
  [{ ...ok, chromium: false }, false],   // Safari / Firefox with WebGPU
  [{ ...ok, mobile: true }, false],      // Chrome on Android
])('isSupported(%o) is %s', (env, expected) => expect(isSupported(env)).toBe(expected));
