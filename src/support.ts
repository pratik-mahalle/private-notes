export type Env = { chromium: boolean; mobile: boolean; hasWebGPU: boolean; isolated: boolean; width: number };

export const REPO_URL = 'https://github.com/pratik-mahalle/private-notes';

// Chromium desktop only: Safari and Firefox now ship WebGPU too, but the app is untested there.
export const isSupported = (e: Env) => e.chromium && !e.mobile && e.hasWebGPU && e.isolated && e.width >= 480;

type UAData = { brands: { brand: string }[]; mobile: boolean }; // not in lib.dom yet
export const readEnv = (): Env => {
  const ua = (navigator as Navigator & { userAgentData?: UAData }).userAgentData;
  return {
    chromium: !!ua?.brands.some((b) => b.brand === 'Chromium'),
    mobile: ua?.mobile === true,
    hasWebGPU: 'gpu' in navigator,
    isolated: crossOriginIsolated,
    width: innerWidth,
  };
};
