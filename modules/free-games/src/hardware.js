/**
 * Referans sistem: ortalama hedef PC.
 * GPU/CPU skorları göreli tahmindir; kesin benchmark değildir.
 */
export const referenceSystem = {
  label: 'Ryzen 7 7800X3D + RTX 5070',
  cpu: 'Ryzen 7 7800X3D',
  gpu: 'RTX 5070',
  cpuScore: 98,
  gpuScore: 205,
  ramGb: 32,
};

/** Bilinen modeller için göreli skor (yüksek = daha güçlü). */
const GPU_EXACT = [
  [/rtx\s*5090/i, 330],
  [/rtx\s*5080/i, 265],
  [/rtx\s*5070\s*ti/i, 235],
  [/rtx\s*5070/i, 205],
  [/rtx\s*5060\s*ti/i, 155],
  [/rtx\s*5060/i, 135],
  [/rtx\s*4090/i, 300],
  [/rtx\s*4080\s*super/i, 230],
  [/rtx\s*4080/i, 220],
  [/rtx\s*4070\s*ti\s*super/i, 190],
  [/rtx\s*4070\s*ti/i, 180],
  [/rtx\s*4070\s*super/i, 165],
  [/rtx\s*4070/i, 150],
  [/rtx\s*4060\s*ti/i, 120],
  [/rtx\s*4060/i, 105],
  [/rtx\s*3090/i, 175],
  [/rtx\s*3080\s*ti/i, 165],
  [/rtx\s*3080/i, 155],
  [/rtx\s*3070\s*ti/i, 140],
  [/rtx\s*3070/i, 130],
  [/rtx\s*3060\s*ti/i, 115],
  [/rtx\s*3060/i, 95],
  [/rtx\s*3050/i, 70],
  [/rtx\s*2080\s*ti/i, 125],
  [/rtx\s*2080\s*super/i, 115],
  [/rtx\s*2080/i, 110],
  [/rtx\s*2070\s*super/i, 100],
  [/rtx\s*2070/i, 90],
  [/rtx\s*2060\s*super/i, 85],
  [/rtx\s*2060/i, 75],
  [/gtx\s*1660\s*ti/i, 65],
  [/gtx\s*1660\s*super/i, 60],
  [/gtx\s*1660/i, 55],
  [/gtx\s*1650/i, 40],
  [/gtx\s*1080\s*ti/i, 95],
  [/gtx\s*1080/i, 80],
  [/gtx\s*1070\s*ti/i, 72],
  [/gtx\s*1070/i, 65],
  [/gtx\s*1060/i, 45],
  [/gtx\s*1050\s*ti/i, 30],
  [/gtx\s*1050/i, 25],
  [/gtx\s*970/i, 40],
  [/gtx\s*960/i, 28],
  [/gtx\s*760/i, 18],
  [/rx\s*7900\s*xtx/i, 250],
  [/rx\s*7900\s*xt/i, 220],
  [/rx\s*7800\s*xt/i, 175],
  [/rx\s*7700\s*xt/i, 150],
  [/rx\s*7600/i, 110],
  [/rx\s*6950\s*xt/i, 165],
  [/rx\s*6900\s*xt/i, 155],
  [/rx\s*6800\s*xt/i, 145],
  [/rx\s*6700\s*xt/i, 120],
  [/rx\s*6600\s*xt/i, 100],
  [/rx\s*6600/i, 90],
  [/rx\s*580/i, 40],
  [/rx\s*570/i, 32],
  [/rx\s*560/i, 20],
  [/r7\s*260x/i, 12],
  [/r9\s*390/i, 30],
  [/arc\s*a770/i, 100],
  [/arc\s*a750/i, 85],
  [/intel\s*uhd|intel\s*hd\s*graphics|iris\s*xe/i, 8],
];

const CPU_EXACT = [
  [/ryzen\s*9\s*7950x3d/i, 100],
  [/ryzen\s*7\s*7800x3d/i, 98],
  [/ryzen\s*7\s*5800x3d/i, 88],
  [/ryzen\s*5\s*7600/i, 75],
  [/ryzen\s*5\s*5600/i, 60],
  [/ryzen\s*5\s*3600/i, 48],
  [/ryzen\s*3\s*3100/i, 35],
  [/i9-14/i, 92],
  [/i7-14/i, 85],
  [/i5-14/i, 75],
  [/i9-13/i, 90],
  [/i7-13/i, 82],
  [/i5-13/i, 72],
  [/i7-12700/i, 78],
  [/i5-12400/i, 65],
  [/i7-8700/i, 45],
  [/i5-8400/i, 38],
  [/i5-7600/i, 32],
  [/i5-6600/i, 28],
  [/i5-4460/i, 18],
  [/i5-2500/i, 12],
  [/i3-/i, 22],
  [/fx-6300/i, 10],
  [/fx-8350/i, 14],
];

function bestScore(text, rules) {
  let best = null;
  for (const [re, score] of rules) {
    if (re.test(text)) {
      best = best == null ? score : Math.max(best, score);
    }
  }
  return best;
}

/** Metinden en güçlü eşleşen GPU skorunu çıkarır (birden fazla alternatif varsa max). */
export function scoreGpuFromText(text) {
  return bestScore(String(text || ''), GPU_EXACT);
}

export function scoreCpuFromText(text) {
  return bestScore(String(text || ''), CPU_EXACT);
}

/**
 * @returns {{ level: string, label: string, ansiColor: string, detail: string }}
 */
export function assessCompatibility({ minText, recText }) {
  const minGpu = scoreGpuFromText(minText);
  const recGpu = scoreGpuFromText(recText);
  const minCpu = scoreCpuFromText(minText);
  const recCpu = scoreCpuFromText(recText);

  const ref = referenceSystem;
  const targetGpu = recGpu ?? minGpu;
  const targetCpu = recCpu ?? minCpu;

  if (targetGpu == null && targetCpu == null) {
    return {
      level: 'unknown',
      label: 'Değerlendirilemedi',
      ansiColor: '37',
      detail: 'Steam gereksinim metninden net GPU/CPU okunamadı.',
    };
  }

  const gpuRatio = targetGpu != null ? ref.gpuScore / targetGpu : 2;
  const cpuRatio = targetCpu != null ? ref.cpuScore / targetCpu : 2;
  const ratio = Math.min(gpuRatio, cpuRatio);

  // Minimumun bile altında kalıyorsa
  if (minGpu != null && ref.gpuScore < minGpu * 0.85) {
    return {
      level: 'poor',
      label: 'Yetersiz olabilir',
      ansiColor: '31',
      detail: `${ref.label} · önerilen/min. gereksinimin altında kalabilir`,
    };
  }

  if (ratio >= 1.6) {
    return {
      level: 'excellent',
      label: 'Çok yeterli',
      ansiColor: '32',
      detail: `${ref.label} · rahat yüksek ayar`,
    };
  }
  if (ratio >= 1.05) {
    return {
      level: 'good',
      label: 'Yeterli',
      ansiColor: '36',
      detail: `${ref.label} · sorunsuz çalışmalı`,
    };
  }
  if (ratio >= 0.75 || (minGpu != null && ref.gpuScore >= minGpu)) {
    return {
      level: 'tight',
      label: 'Biraz takılabilir',
      ansiColor: '33',
      detail: `${ref.label} · orta/düşük ayar gerekebilir`,
    };
  }

  return {
    level: 'poor',
    label: 'Yetersiz olabilir',
    ansiColor: '31',
    detail: `${ref.label} · zorlanabilir`,
  };
}
