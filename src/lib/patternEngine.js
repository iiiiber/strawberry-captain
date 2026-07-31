import { PREPARED_PALETTE, colorDistance, rgbToLab } from './palette.js';

const clamp = value => Math.max(0, Math.min(255, Math.round(value)));

function rgbToHsl({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const light = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: light };
  const delta = max - min;
  const saturation = light > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue;
  if (max === rn) hue = (gn - bn) / delta + (gn < bn ? 6 : 0);
  else if (max === gn) hue = (bn - rn) / delta + 2;
  else hue = (rn - gn) / delta + 4;
  return { h: hue / 6, s: saturation, l: light };
}

function hueToRgb(p, q, t) {
  let value = t;
  if (value < 0) value += 1;
  if (value > 1) value -= 1;
  if (value < 1 / 6) return p + (q - p) * 6 * value;
  if (value < 1 / 2) return q;
  if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
  return p;
}

function hslToRgb({ h, s, l }) {
  if (s === 0) return { r: l * 255, g: l * 255, b: l * 255 };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: hueToRgb(p, q, h + 1 / 3) * 255,
    g: hueToRgb(p, q, h) * 255,
    b: hueToRgb(p, q, h - 1 / 3) * 255,
  };
}

function applyStyle(rgb, style) {
  const hsl = rgbToHsl(rgb);
  if (style === 'bright') {
    return hslToRgb({ ...hsl, s: Math.min(1, hsl.s * 1.28 + 0.08), l: Math.min(0.9, hsl.l * 1.06 + 0.025) });
  }
  if (style === 'pastel') {
    const softened = hslToRgb({ ...hsl, s: hsl.s * 0.66, l: Math.min(0.9, hsl.l * 1.08 + 0.08) });
    return { r: softened.r * 0.84 + 255 * 0.16, g: softened.g * 0.84 + 255 * 0.16, b: softened.b * 0.84 + 255 * 0.16 };
  }
  if (style === 'comic') {
    const contrast = value => clamp((value - 128) * 1.35 + 128);
    return hslToRgb({ ...rgbToHsl({ r: contrast(rgb.r), g: contrast(rgb.g), b: contrast(rgb.b) }), s: Math.min(1, hsl.s * 1.35 + 0.1) });
  }
  if (style === 'retro') {
    const stepped = value => Math.round(value / 51) * 51;
    return { r: stepped(rgb.r), g: stepped(rgb.g), b: stepped(rgb.b) };
  }
  if (style === 'mono') {
    const gray = rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114;
    return { r: gray, g: gray, b: gray };
  }
  return rgb;
}

function pixelDistance(first, second) {
  return Math.sqrt((first.r - second.r) ** 2 + (first.g - second.g) ** 2 + (first.b - second.b) ** 2);
}

function getBackgroundColor(data, width, height) {
  // 在 4 角各采 16×16 小块的平均色 (而不是单像素),更稳。
  // 选方差最小的那一块作为背景色 -- 背景是均匀色块,人物区域方差大,
  // 这样可以避免"角落刚好有头发丝/手指出框"导致背景色取偏。
  const corners = [
    { sx: 0, sy: 0 },
    { sx: Math.max(0, width - 16), sy: 0 },
    { sx: 0, sy: Math.max(0, height - 16) },
    { sx: Math.max(0, width - 16), sy: Math.max(0, height - 16) },
  ];
  const samples = corners.map(c => {
    const w = Math.min(16, width - c.sx);
    const h = Math.min(16, height - c.sy);
    let r = 0, g = 0, b = 0;
    let r2 = 0, g2 = 0, b2 = 0;
    let n = 0;
    for (let y = c.sy; y < c.sy + h; y++) {
      for (let x = c.sx; x < c.sx + w; x++) {
        const i = (y * width + x) * 4;
        r += data[i]; g += data[i + 1]; b += data[i + 2];
        r2 += data[i] * data[i];
        g2 += data[i + 1] * data[i + 1];
        b2 += data[i + 2] * data[i + 2];
        n++;
      }
    }
    const mr = r / n, mg = g / n, mb = b / n;
    // 方差 (粗略估算) -- 越小越像纯色背景
    const variance = (r2 / n - mr * mr) + (g2 / n - mg * mg) + (b2 / n - mb * mb);
    return { r: mr, g: mg, b: mb, variance };
  });
  // 选方差最小的那块当作主背景色 (均匀色块像背景,不均匀的角被排除)
  samples.sort((a, b) => a.variance - b.variance);
  const best = samples[0];
  return { r: best.r, g: best.g, b: best.b };
}

function nearestColor(rgb, palette) {
  const lab = rgbToLab(rgb);
  let best = palette[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const color of palette) {
    const distance = colorDistance(lab, color.lab);
    if (distance < bestDistance) {
      best = color;
      bestDistance = distance;
    }
  }
  return best;
}

function stylePalette(style) {
  // 221 色全色卡已能覆盖 mono/pastel 等风格的色域需求
  return PREPARED_PALETTE;
}

// 抄 pdtz 算法: 不靠 RGB 距离阈值,改成"白度判定 + 4 边 BFS",
// 只冲真正的白色背景 (RGB 都高),遇到非白停止蔓延 — 这样浅肤色主体不会被误冲
function createConnectedBackgroundMask(data, width, height, _background, _threshold) {
  const mask = new Uint8Array(width * height);
  const queued = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  // 判定是不是"白": 三通道都高,且饱和度低(灰白色)
  // RGB 都 ≥ whitenessThreshold (用户可调: 默认 220) 且 max-min ≤ 35 (排除饱和色)
  const whitenessThreshold = _threshold ?? 220; // 用户调 slider 改这个值 (15-90 → 195-250)
  const isWhitish = index => {
    const offset = index * 4;
    if (data[offset + 3] < 32) return true; // 透明 = 白
    const r = data[offset], g = data[offset + 1], b = data[offset + 2];
    if (r < whitenessThreshold || g < whitenessThreshold || b < whitenessThreshold) return false;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    return (max - min) <= 35; // 灰白,排除饱和色
  };
  const enqueue = index => {
    if (queued[index] || !isWhitish(index)) return;
    queued[index] = 1;
    queue[tail++] = index;
  };

  // 4 边入队: 上 + 下 + 左 + 右 (原版只入上下,左/右边的背景没识别,导致边缘
  // 细线/头发丝被误判成前景,后续 cleanup 阶段被洗掉)
  for (let x = 0; x < width; x++) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (head < tail) {
    const index = queue[head++];
    mask[index] = 1;
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) enqueue(index - 1);
    if (x + 1 < width) enqueue(index + 1);
    if (y > 0) enqueue(index - width);
    if (y + 1 < height) enqueue(index + width);
  }
  return mask;
}

function neighborIndexes(index, size, diagonal = true) {
  const x = index % size;
  const y = Math.floor(index / size);
  const result = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if ((!dx && !dy) || (!diagonal && dx && dy)) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < size && ny >= 0 && ny < size) result.push(ny * size + nx);
    }
  }
  return result;
}

function cleanRawCells(cells, size, enabled) {
  if (!enabled) return cells;
  let current = cells.map(cell => cell ? { ...cell, rgb: { ...cell.rgb } } : null);
  for (let pass = 0; pass < 2; pass++) {
    const next = [...current];
    for (let index = 0; index < current.length; index++) {
      const neighbors = neighborIndexes(index, size).map(i => current[i]).filter(Boolean);
      const cell = current[index];
      // 修复: neighbors.length <= 1 → === 0 — 原阈值太松,把"2 个邻居"的孤立小色块
      // (眼珠/鼻尖/项链吊坠)也洗掉了,导致人物面部细节丢失
      if (cell && neighbors.length === 0 && cell.coverage < 0.78) {
        next[index] = null;
      } else if (!cell && neighbors.length >= 7) {
        next[index] = {
          coverage: 0.45,
          rgb: {
            r: neighbors.reduce((sum, item) => sum + item.rgb.r, 0) / neighbors.length,
            g: neighbors.reduce((sum, item) => sum + item.rgb.g, 0) / neighbors.length,
            b: neighbors.reduce((sum, item) => sum + item.rgb.b, 0) / neighbors.length,
          },
        };
      }
    }
    current = next;
  }
  return current;
}

function makeKMeans(points, requestedClusters) {
  const clusterCount = Math.max(1, Math.min(requestedClusters, points.length));
  const average = points.reduce((sum, point) => ({
    r: sum.r + point.rgb.r,
    g: sum.g + point.rgb.g,
    b: sum.b + point.rgb.b,
  }), { r: 0, g: 0, b: 0 });
  const centers = [{
    r: average.r / points.length,
    g: average.g / points.length,
    b: average.b / points.length,
  }];

  while (centers.length < clusterCount) {
    let candidate = points[0].rgb;
    let farthest = -1;
    for (const point of points) {
      const nearest = Math.min(...centers.map(center => pixelDistance(point.rgb, center)));
      if (nearest > farthest) {
        farthest = nearest;
        candidate = point.rgb;
      }
    }
    centers.push({ ...candidate });
  }

  const assignments = new Array(points.length).fill(0);
  for (let iteration = 0; iteration < 10; iteration++) {
    const totals = Array.from({ length: clusterCount }, () => ({ r: 0, g: 0, b: 0, count: 0 }));
    for (let index = 0; index < points.length; index++) {
      let bestCluster = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let cluster = 0; cluster < centers.length; cluster++) {
        const distance = pixelDistance(points[index].rgb, centers[cluster]);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestCluster = cluster;
        }
      }
      assignments[index] = bestCluster;
      const total = totals[bestCluster];
      total.r += points[index].rgb.r;
      total.g += points[index].rgb.g;
      total.b += points[index].rgb.b;
      total.count++;
    }
    for (let cluster = 0; cluster < centers.length; cluster++) {
      if (!totals[cluster].count) continue;
      centers[cluster] = {
        r: totals[cluster].r / totals[cluster].count,
        g: totals[cluster].g / totals[cluster].count,
        b: totals[cluster].b / totals[cluster].count,
      };
    }
  }
  return { centers, assignments };
}

// 抄自 xiaoana 6333 chunk n() 函数 — 频次降序 + Lab 距离吸附 (替代 K-means)
// 输入: points = [{index, rgb}], colorLimit = 目标色数
// 输出: { centers, assignments } — 兼容 makeKMeans 接口
function makeFrequencyLabQuantize(points, colorLimit) {
  // 1) 按 (16-bit 量化) RGB 分组 + 计数 (xiaoana 用 g(t, 16))
  const colorMap = new Map();
  for (const point of points) {
    const rgb = point.rgb;
    const key = `${rgb.r >> 4},${rgb.g >> 4},${rgb.b >> 4}`;
    if (!colorMap.has(key)) colorMap.set(key, { rgb, count: 0, sumR: 0, sumG: 0, sumB: 0, lab: null });
    const entry = colorMap.get(key);
    entry.count += 1;
    entry.sumR += rgb.r;
    entry.sumG += rgb.g;
    entry.sumB += rgb.b;
  }

  // 2) 频次降序
  const sorted = Array.from(colorMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, colorLimit * 2);  // 留 2x 冗余, 后面吸附

  // 3) 计算每组的 lab
  for (const entry of sorted) {
    entry.avgRgb = { r: entry.sumR / entry.count, g: entry.sumG / entry.count, b: entry.sumB / entry.count };
    entry.lab = rgbToLab(entry.avgRgb);
  }

  // 4) 取前 colorLimit 个作中心 (主色), 后面 Lab 距离吸附
  const centers = sorted.slice(0, colorLimit).map(e => e.avgRgb);

  // 5) 频次降序吸附剩余到最近的 center
  for (let i = colorLimit; i < sorted.length; i++) {
    const entry = sorted[i];
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let j = 0; j < centers.length; j++) {
      const centerLab = rgbToLab(centers[j]);
      const d = labDistanceSquared(entry.lab, centerLab);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = j;
      }
    }
    // 合并: 主色加上此颜色的平均 RGB (加权)
    const w = entry.count / (colorMap.get(`${entry.avgRgb.r >> 4},${entry.avgRgb.g >> 4},${entry.avgRgb.b >> 4}`).count + 1);
    centers[bestIdx] = {
      r: centers[bestIdx].r * 0.7 + entry.avgRgb.r * 0.3,
      g: centers[bestIdx].g * 0.7 + entry.avgRgb.g * 0.3,
      b: centers[bestIdx].b * 0.7 + entry.avgRgb.b * 0.3,
    };
  }

// 6) 给每个 point 找最近 center
  const assignments = new Array(points.length);
  for (let i = 0; i < points.length; i++) {
    const pLab = rgbToLab(points[i].rgb);
    let best = 0;
    let bestD = Infinity;
    for (let j = 0; j < centers.length; j++) {
      const d = labDistanceSquared(pLab, rgbToLab(centers[j]));
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
    assignments[i] = best;
  }

  return { centers, assignments };
}

/**
 * 抄自 xiaoana 6333 chunk — CartoonRealMerge 阶段 2: 主色 + 暗色合成
 *
 * 输入: pixels = [{r, g, b}] — cell 量化前平均色 (rawRgbGrid)
 * 输出: 同长度的 [{r, g, b}] — 合成后的 cell 色
 *
 * 算法:
 * 1) 16-bit 量化分组 + 找主色 (最高频)
 * 2) 收集亮度 < 45 的暗色
 * 3) 暗色比例 ≥ 34% → 直接用暗色平均
 * 4) 暗色比例 ≥ 30% → 0.7 * 主色 + 0.3 * 暗色平均
 * 5) 否则返回主色
 */
function applyCartoonMerge(pixels) {
  if (!pixels.length) return pixels;

  // 1) 16-bit 量化 + 计数
  const quantized = new Map();
  for (const cell of pixels) {
    const key = `${cell.r >> 4},${cell.g >> 4},${cell.b >> 4}`;
    if (!quantized.has(key)) quantized.set(key, { rgb: cell, count: 0, sumR: 0, sumG: 0, sumB: 0 });
    const entry = quantized.get(key);
    entry.count += 1;
    entry.sumR += cell.r;
    entry.sumG += cell.g;
    entry.sumB += cell.b;
  }

  // 2) 按 count 降序
  const sorted = Array.from(quantized.values()).sort((a, b) => b.count - a.count);
  if (!sorted.length) return pixels;

  const mainEntry = sorted[0];
  const mainAvgRgb = {
    r: mainEntry.sumR / mainEntry.count,
    g: mainEntry.sumG / mainEntry.count,
    b: mainEntry.sumB / mainEntry.count,
  };

  // 3) 收集暗色 (亮度 < 45)
  let darkCount = 0;
  let darkSumR = 0, darkSumG = 0, darkSumB = 0;
  for (const entry of sorted) {
    const avgL = 0.299 * (entry.sumR / entry.count) + 0.587 * (entry.sumG / entry.count) + 0.114 * (entry.sumB / entry.count);
    if (avgL < 45) {
      darkCount += entry.count;
      darkSumR += entry.sumR;
      darkSumG += entry.sumG;
      darkSumB += entry.sumB;
    }
  }

const totalCount = pixels.length;
  const darkRatio = darkCount / totalCount;

  // darkRatio < 30% — 不触发, 保持原图
  if (darkRatio < 0.30) return pixels;

  const darkAvg = darkCount > 0 ? {
    r: darkSumR / darkCount,
    g: darkSumG / darkCount,
    b: darkSumB / darkCount,
  } : mainAvgRgb;

  // >= 70% — 整图变暗色
  if (darkRatio >= 0.70) {
    return pixels.map(() => darkAvg);
  }

  // 30%-70% — 0.7 主色 + 0.3 暗色混合
  const mixed = {
    r: mainAvgRgb.r * 0.7 + darkAvg.r * 0.3,
    g: mainAvgRgb.g * 0.7 + darkAvg.g * 0.3,
    b: mainAvgRgb.b * 0.7 + darkAvg.b * 0.3,
  };
  return pixels.map(() => mixed);
}

/**
 * 抄自 xiaoana 6333 chunk — smooth 模式 cell 色计算
 * 输入: smoothBuckets (Map<key, {count, rSum, gSum, bSum}>)
 * 输出: {r, g, b} — 16-bit 量化分组的 score 评分最高桶的平均色
 */
function computeSmoothCellRgb(buckets) {
  if (!buckets.size) return null;
  const entries = Array.from(buckets.values());
  // 找 count 最大的作为基线
  const maxCount = entries.reduce((m, b) => Math.max(m, b.count), 0);
  // 简化版 score: count * 1 + 接近 maxCount 的额外分
  // xiaoana 完整算法涉及 maxContrast + brightness 阈值, imgs 简化版
  let best = entries[0];
  let bestScore = entries[0].count;
  for (const b of entries) {
    const score = b.count * (1 + (b.count === maxCount ? 0.5 : 0));
    if (score > bestScore) {
      bestScore = score;
      best = b;
    }
  }
  return {
    r: best.rSum / best.count,
    g: best.gSum / best.count,
    b: best.bSum / best.count,
  };
}

function mapCentersToPalette(centers, _assignments, palette) {
  return centers.map(center => {
    const sourceLab = rgbToLab(center);
    const sourceHsl = rgbToHsl(center);
    return [...palette].sort((first, second) => {
      const score = color => {
        const targetHsl = rgbToHsl(color.rgb);
        let value = colorDistance(sourceLab, color.lab);
        if (sourceHsl.s > 0.12 && targetHsl.s < 0.08) value += 18;
        if (sourceHsl.s > 0.22 && targetHsl.s < sourceHsl.s * 0.35) value += 10;
        const hueGap = Math.min(Math.abs(sourceHsl.h - targetHsl.h), 1 - Math.abs(sourceHsl.h - targetHsl.h));
        value += hueGap * 18 * Math.min(1, sourceHsl.s * 2);
        return value;
      };
      return score(first) - score(second);
    })[0];
  });
}

/**
 * 抄自 xiaoana 6333 chunk — palette 模式: 每个 cell 找最近调色板色 (RGB 距离平方)
 * 不做 K-means, 不做 cluster, 字面最近邻映射
 * 输入: rgb 颜色 + palette 数组 (含 {key, color, rgb, lab} 字段)
 * 输出: 最近调色板 entry
 */
function findNearestPaletteEntry(rgb, palette) {
  if (!palette.length) return null;
  if (palette.length === 1) return palette[0];
  let best = palette[0];
  let bestDistSq = Infinity;
  for (const entry of palette) {
    const er = entry.rgb.r - rgb.r;
    const eg = entry.rgb.g - rgb.g;
    const eb = entry.rgb.b - rgb.b;
    const distSq = er * er + eg * eg + eb * eb;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      best = entry;
      if (distSq === 0) break;  // 完全匹配, 提前结束
    }
  }
  return best;
}

/**
 * 抄自 xiaoana 6333 chunk — dominant 模式: 全局肤色主导替换 (A() 函数, 简化版)
 * 双阶段:
 *   阶段 1: 找大块肤色区域 (≥ C 阈值, ≤ g 阈值), BFS 连通, 统计非肤色周围色, 替换
 *   阶段 2: 单 cell 检查 5x5 邻居窗口, 如果是肤色且周围 dominant 色足够对比, 替换
 * 输入: pixels (像素数组, 每格是 palette entry 或 null), gridSize, palette (调色板数组)
 * 输出: 修改后的 pixels
 *
 * 依赖: isSkinTone (L905+), rgbToLab, colorDistance
 */
function applyDominantMerge(pixels, gridSize, palette) {
  if (!pixels.length) return pixels;
  const H = gridSize;
  const W = gridSize;

  // 阶段 1 阈值 (抄自 xiaoana A 函数)
  // c = sqrt(W*H)/60
  const c = Math.sqrt(W * H) / 60;
  const u = Math.max(8, Math.round(13 * c));    // 大连通区上限
  const C_threshold = Math.max(3, Math.round(3 * c));   // 连通区下限
  const g_threshold = Math.max(C_threshold + 8, Math.round(34 * c)); // 最大尺寸

  // 建 palette map (code → entry, imgs 用 code 字段, 不是 key)
  const paletteByKey = new Map();
  for (const entry of palette) paletteByKey.set(entry.code, entry);

  // 深拷贝 pixels (2D 数组)
  const h = pixels.map(row => row.map(c => c ? { ...c } : null));
  const f = Array(W).fill(null).map(() => Array(H).fill(false));

  // 8 邻居 + 4 邻居
  const m8 = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  const m4 = [[-1,0],[0,-1],[0,1],[1,0]];

  // helper: 检查 8 邻居 + 找 baseSkin + replacement
  const getEntry = (x, y) => {
    const p = h[x]?.[y];
    if (!p || p.isExternal) return null;
    return paletteByKey.get(p.code);
  };
  const isIn = (x, y) => x >= 0 && x < W && y >= 0 && y < H;

// 找 cell 周围 8 邻居 + 周围皮肤的 baseSkin + dominant replacement
  const k = (cells) => {
    const visitedSet = new Set(cells.map(([x, y]) => `${x},${y}`));
    const baseSkinList = [];
    const replacementMap = new Map();

    for (const [ox, oy] of cells) {
      for (const [dx, dy] of m8) {
        const ux = ox + dx;
        const uy = oy + dy;
        if (!isIn(ux, uy) || visitedSet.has(`${ux},${uy}`)) continue;
        const neighbor = h[ux]?.[uy];
        const neighborEntry = getEntry(ux, uy);
        if (!neighbor || !neighborEntry || !isSkinTone(neighborEntry.rgb)) continue;
        baseSkinList.push(neighborEntry.rgb);
        const existing = replacementMap.get(neighbor.code) || { count: 0, entry: neighborEntry };
        existing.count += 1;
        replacementMap.set(neighbor.code, existing);
      }
    }
    if (baseSkinList.length === 0) return { baseSkin: null, skinCount: 0, replacement: null };
    const baseSkin = baseSkinList.reduce((acc, c) => ({
      r: acc.r + c.r, g: acc.g + c.g, b: acc.b + c.b,
    }), { r: 0, g: 0, b: 0 });
    baseSkin.r /= baseSkinList.length;
    baseSkin.g /= baseSkinList.length;
    baseSkin.b /= baseSkinList.length;
    const sortedReplacement = Array.from(replacementMap.entries()).sort((a, b) => b[1].count - a[1].count)[0];
    return { baseSkin, skinCount: baseSkinList.length, replacement: sortedReplacement ? sortedReplacement[0] : null };
  };

  // 5x5 窗口 dominant 分析
  const v = (x, y, a) => {
    const counts = new Map();
    let totalSkin = 0;
    let totalFilled = 0;
    for (let dx = Math.max(0, x - a); dx <= Math.min(W - 1, x + a); dx++) {
      for (let dy = Math.max(0, y - a); dy <= Math.min(H - 1, y + a); dy++) {
        if (dx === x && dy === y) continue;
        const cell = h[dx]?.[dy];
        const entry = getEntry(dx, dy);
        if (!cell || !entry) continue;
        totalFilled++;
        if (!isSkinTone(entry.rgb)) continue;
        totalSkin++;
        const existing = counts.get(cell.code) || { count: 0, entry };
        existing.count += 1;
        counts.set(cell.code, existing);
      }
    }
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1].count - a[1].count);
    return {
      dominant: sorted[0] || null,
      totalSkin,
      totalFilled,
      skinRatio: totalFilled > 0 ? totalSkin / totalFilled : 0,
    };
  };

  // 阶段 1: 大块肤色连通区 (BFS)
  // 简化版 A() — 只做肤色主导的色块替换 (xiaoana 原版含 maxContrast, 简化版跳过)
  let regionCount = 0;
  let replacementCount = 0;
  for (let t = 0; t < W; t++) {
    for (let r = 0; r < H; r++) {
      if (f[t][r]) continue;
      const cell = h[t][r];
      if (!(f[t][r] = true) || !cell || cell.isExternal) continue;
      const entry = paletteByKey.get(cell.code);
      if (!entry) continue;
// 当前 cell 必须是肤色, 且周围有非肤色邻居 (即肤色在边缘)
      if (!isSkinTone(entry.rgb)) continue;
      const baseSkinInfo = k([[t, r]]);
      if (!baseSkinInfo.baseSkin || !isSkinTone(baseSkinInfo.baseSkin)) continue;
      // 找连通肤色区域 (4 邻居 + 都是肤色)
      const region = [[t, r]];
      const queue = [[t, r]];
      while (queue.length) {
        const [cx, cy] = queue.shift();
        for (const [dx, dy] of m4) {
          const ux = cx + dx;
          const uy = cy + dy;
          if (!isIn(ux, uy) || f[ux][uy]) continue;
          const neighborCell = h[ux][uy];
          const neighborEntry = getEntry(ux, uy);
          if (!neighborCell || !neighborEntry) continue;
          if (!isSkinTone(neighborEntry.rgb)) continue;  // 必须是肤色才加入
          f[ux][uy] = true;
          region.push([ux, uy]);
          queue.push([ux, uy]);
        }
      }
      regionCount++;
      // 区域判定: 大小在 [C_threshold, u] 之间
      if (region.length < C_threshold || region.length > u) continue;
      // 检查周围 dominant 色 (8 邻居非肤色色)
      const neighborMap = new Map();
      for (const [rx, ry] of region) {
        for (const [dx, dy] of m8) {
          const ux = rx + dx;
          const uy = ry + dy;
          if (!isIn(ux, uy)) continue;
          const nCell = h[ux]?.[uy];
          const nEntry = getEntry(ux, uy);
          if (!nCell || !nEntry || isSkinTone(nEntry.rgb)) continue;
          // 不在 region 内
          if (region.some(([rx2, ry2]) => rx2 === ux && ry2 === uy)) continue;
          const existing = neighborMap.get(nCell.code) || { count: 0, entry: nEntry };
          existing.count += 1;
          neighborMap.set(nCell.code, existing);
        }
      }
      if (!neighborMap.size) continue;
      // dominant = 邻居出现最多
      const sortedReplacement = Array.from(neighborMap.entries()).sort((a, b) => b[1].count - a[1].count);
      const [repCode] = sortedReplacement[0];
      const repEntry = paletteByKey.get(repCode);
      if (!repEntry) continue;
      replacementCount++;
      // 替换整个 region — 保留完整 entry 字段 (含 hex)
      for (const [rx, ry] of region) {
        const orig = h[rx][ry];
        h[rx][ry] = orig
          ? { ...orig, code: repEntry.code, color: repEntry.color, rgb: repEntry.rgb, lab: repEntry.lab, hex: repEntry.hex, name: repEntry.name || repEntry.code }
          : { code: repEntry.code, color: repEntry.color, rgb: repEntry.rgb, lab: repEntry.lab, hex: repEntry.hex, name: repEntry.name || repEntry.code };
      }
    }
  }
  console.log(`[dominant-A] region count=${regionCount}, replaced=${replacementCount}`);
  // 阶段 1 日志生产环境已清理

  // 阶段 2: 单 cell 5x5 邻居窗口判定
  const j = Math.max(2, Math.round(2 * c));
  let phase2Count = 0;
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      const cell = h[x][y];
      if (!cell || cell.isExternal) continue;
      const entry = paletteByKey.get(cell.code);
      if (!entry || !isSkinTone(entry.rgb)) continue;
      const neighborInfo = v(x, y, j);
      if (!neighborInfo.dominant || neighborInfo.totalSkin < 8 ||
          neighborInfo.skinRatio < 0.62 || neighborInfo.dominant[0] === cell.code) continue;
      const [domCode, domInfo] = neighborInfo.dominant;
      const domEntry = paletteByKey.get(domCode);
      if (!domEntry) continue;
      // 简化判定: 亮度差 + 颜色差足够大
      const cellL = entry.rgb.r * 0.299 + entry.rgb.g * 0.587 + entry.rgb.b * 0.114;
      const domL = domEntry.rgb.r * 0.299 + domEntry.rgb.g * 0.587 + domEntry.rgb.b * 0.114;
      if (cellL >= domL - 18) continue;  // dom 比 cell 暗 ≥18 才替换
      phase2Count++;
      const orig2 = h[x][y];
      h[x][y] = orig2
        ? { ...orig2, code: domEntry.code, color: domEntry.color, rgb: domEntry.rgb, lab: domEntry.lab, hex: domEntry.hex, name: domEntry.name || domEntry.code }
        : { code: domEntry.code, color: domEntry.color, rgb: domEntry.rgb, lab: domEntry.lab, hex: domEntry.hex, name: domEntry.name || domEntry.code };
    }
  }
  console.log(`[dominant-B] phase2 replaced=${phase2Count}`);
  // 阶段 2 日志生产环境已清理

  return h.map(row => row.map(c => {
    if (!c) return null;
    // 抄自 xiaoana A() 函数 — 保留完整 entry 字段 (hex/code/rgb/lab/color)
    // imgs palette.js entry 含 hex 字段, K-means 输出也有, 这里只补充完整字段
    return {
      ...c,
      hex: c.hex || (palette.find(p => p.code === c.code))?.hex || '#000000',
      name: c.name || c.code,
    };
  }));
}

function cleanQuantizedPixels(pixels, size, enabled) {
  if (!enabled) return pixels;
  let current = [...pixels];
  // 第一轮: 剔除"几乎完全孤立"的像素（5+邻居同色 + 自己周围同色≤1）
  // 改前: 5+1 = 太激进, 吞掉所有小面积局部色（眼、鼻、阴影）
  // 改后: 6+0 = 只洗完全孤立的噪点
  // 第二轮: 同样阈值, 兜底
  for (let pass = 0; pass < 2; pass++) {
    const next = [...current];
    for (let index = 0; index < current.length; index++) {
      const cell = current[index];
      if (!cell) continue;
      const neighborColors = neighborIndexes(index, size).map(i => current[i]?.code).filter(Boolean);
      const frequencies = new Map();
      for (const code of neighborColors) frequencies.set(code, (frequencies.get(code) || 0) + 1);
      const majority = [...frequencies.entries()].sort((a, b) => b[1] - a[1])[0];
      const sameCount = frequencies.get(cell.code) || 0;
      // 修复: 阈值从 5→6 (邻居全部同色才算强制改), 1→0 (周围 1 个同色也不能洗)
      // 这样能保留局部细节色(眼/鼻/阴影的小面积像素)
      if (majority && majority[1] >= 6 && sameCount === 0 && majority[0] !== cell.code) {
        next[index] = current[neighborIndexes(index, size).find(i => current[i]?.code === majority[0])];
      }
    }
    current = next;
  }
  return current;
}

function applyOutline(pixels, size, style, enabled, outlineColor = null, availablePalette = null) {
  if (!enabled || pixels.every(Boolean)) return pixels;
  // 用户指定描边色 → 优先;auto → 自动选最低 Lab.L 色;<other> → style 默认
  let outlineCode = outlineColor;
  if (!outlineCode || outlineCode === 'auto') {
    // 抄自 xiaoana 6333 chunk — 找 palette 中 Lab.L 最低的色
    const palette = availablePalette || PREPARED_PALETTE;
    let darkestCode = null;
    let darkestL = Infinity;
    for (const c of palette) {
      if (!c.lab) continue;
      const L = c.lab.l;
      if (L < darkestL) {
        darkestL = L;
        darkestCode = c.code;
      }
    }
    outlineCode = darkestCode || (['pastel', 'faithful', 'bright'].includes(style) ? 'D10' : 'C12');
  }
  const outline = PREPARED_PALETTE.find(color => color.code === outlineCode);
  if (!outline) return pixels;
  return pixels.map((cell, index) => {
    if (!cell) return null;
    const touchesBlank = neighborIndexes(index, size, false).some(neighbor => !pixels[neighbor]);
    return touchesBlank ? outline : cell;
  });
}

function detectImageRenderMode(image) {
  // 用 64x64 小预览统计独立颜色数，几乎零成本。
  // 像素画通常只有几十种独立色 → 用最近邻采样保锐利；
  // 普通照片成千上万种独立色 → 用高质量平滑。
  const probe = document.createElement('canvas');
  probe.width = 64;
  probe.height = 64;
  const ctx = probe.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, 0, 0, 64, 64);
  const data = ctx.getImageData(0, 0, 64, 64).data;
  const unique = new Set();
  for (let i = 0; i < data.length; i += 4) {
    // 量化到 5bit/通道,忽略抗锯齿微差
    unique.add(((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3));
    if (unique.size > 220) break;
  }
  return unique.size <= 200;
}

export function imageToPattern(image, settings) {
  const {
    gridSize,
    colorLimit,
    style,
    removeBackground,
    backgroundThreshold,
    fitMode,
    imageScale = 100,
    offsetX = 0,
    offsetY = 0,
    edgeCleanup = true,
    outline = true,
    skinProtect = false,
    quantizeMode = 'kmeans',
    mergeMode = 'none',
    mode = 'average',  // 5 模式 (抄 xiaoana): 'average' | 'dominant' | 'smooth' | 'palette' | 'cartoon-real-merge'
  } = settings;
  const processSize = Math.max(256, gridSize * 6);
  const canvas = document.createElement('canvas');
  canvas.width = processSize;
  canvas.height = processSize;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, processSize, processSize);

  // 自动判定: 像素画 → 最近邻 (保锐利), 照片 → 高质量平滑
  const isPixelArt = detectImageRenderMode(image);
  ctx.imageSmoothingEnabled = !isPixelArt;
  ctx.imageSmoothingQuality = 'high';

  const imageRatio = image.naturalWidth / image.naturalHeight;
  let width = processSize;
  let height = processSize;
  if (fitMode === 'contain') {
    if (imageRatio > 1) height = processSize / imageRatio;
    else width = processSize * imageRatio;
  } else if (imageRatio > 1) {
    width = processSize * imageRatio;
  } else {
    height = processSize / imageRatio;
  }
  const scale = imageScale / 100;
  width *= scale;
  height *= scale;
  const x = (processSize - width) / 2 + processSize * offsetX / 100;
  const y = (processSize - height) / 2 + processSize * offsetY / 100;
  ctx.drawImage(image, x, y, width, height);

  const imageData = ctx.getImageData(0, 0, processSize, processSize);
  const background = getBackgroundColor(imageData.data, processSize, processSize);
  const backgroundMask = removeBackground
    ? createConnectedBackgroundMask(imageData.data, processSize, processSize, background, backgroundThreshold)
    : new Uint8Array(processSize * processSize);
  const rawCells = [];

  // 5 模式 cell 收集 (抄 xiaoana 6333 chunk f() 函数)
  // mode = 'palette': 抽样所有像素, 保留每个像素的 RGB (后阶段映射到调色板)
  // mode = 'average': RGB 平均
  // mode = 'dominant': 收集所有像素 (后续 A() 函数做全局肤色主导替换)
  // mode = 'smooth': 16-bit 量化分组 + score 评分 (含 maxContrast)
  // mode = 'cartoon-real-merge': 16-bit 量化 + 主色+暗色合成 (复用 applyCartoonMerge)
  const collectAllSamples = (mode === 'palette' || mode === 'dominant' || mode === 'cartoon-real-merge');

  for (let row = 0; row < gridSize; row++) {
    const y0 = Math.floor(row * processSize / gridSize);
    const y1 = Math.ceil((row + 1) * processSize / gridSize);
    for (let col = 0; col < gridSize; col++) {
      const x0 = Math.floor(col * processSize / gridSize);
      const x1 = Math.ceil((col + 1) * processSize / gridSize);
      let samples = 0;
      let foreground = 0;
      let red = 0;
      let green = 0;
      let blue = 0;
      // 5 模式专用
      const sampledPixels = [];  // palette/dominant/cartoon-real-merge
      const smoothBuckets = new Map();  // smooth: 16-bit 量化分组

      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          samples++;
          const index = sy * processSize + sx;
          if (removeBackground && backgroundMask[index]) continue;
          const offset = index * 4;
          const styled = applyStyle({
            r: imageData.data[offset],
            g: imageData.data[offset + 1],
            b: imageData.data[offset + 2],
          }, style);
          red += styled.r;
          green += styled.g;
          blue += styled.b;
          foreground++;

          // 收集所有像素 (palette/dominant/cartoon-real-merge 用)
          if (collectAllSamples) {
            sampledPixels.push({ r: styled.r, g: styled.g, b: styled.b });
          }

          // smooth 模式: 16-bit 量化 + score 评分
          if (mode === 'smooth') {
            // 16-bit 量化 (>> 4)
            const qr = styled.r >> 4;
            const qg = styled.g >> 4;
            const qb = styled.b >> 4;
            const key = `${qr},${qg},${qb}`;
            if (!smoothBuckets.has(key)) {
              smoothBuckets.set(key, {
                count: 0, score: 0,
                rSum: 0, gSum: 0, bSum: 0,
                maxContrast: 0,
              });
            }
            const b = smoothBuckets.get(key);
            b.count++;
            b.rSum += styled.r;
            b.gSum += styled.g;
            b.bSum += styled.b;
          }
        }
      }

      const coverage = foreground / samples;
      if (!foreground || (removeBackground && coverage < 0.08)) {
        rawCells.push(null);
        continue;
      }

      let cellRgb;
      if (mode === 'palette') {
        // palette 模式: 用 average RGB (后阶段用 sample 池找最近调色板色)
        cellRgb = { r: red / foreground, g: green / foreground, b: blue / foreground };
      } else if (mode === 'average') {
        cellRgb = { r: red / foreground, g: green / foreground, b: blue / foreground };
      } else if (mode === 'dominant' || mode === 'cartoon-real-merge') {
        // 用 average 作 cell 代表 (后续处理基于 sampledPixels)
        cellRgb = { r: red / foreground, g: green / foreground, b: blue / foreground };
      } else if (mode === 'smooth') {
        // 16-bit 量化 + score 评分 (抄 xiaoana smooth 模式)
        cellRgb = computeSmoothCellRgb(smoothBuckets);
        if (!cellRgb) cellRgb = { r: red / foreground, g: green / foreground, b: blue / foreground };
      } else {
        cellRgb = { r: red / foreground, g: green / foreground, b: blue / foreground };
      }

      // 把 samples / buckets 附加到 cell 上 (后续 cartoon-real-merge / palette 模式用)
      const cell = { coverage, rgb: cellRgb };
      if (mode === 'palette') cell.sampledPixels = sampledPixels;
      if (mode === 'cartoon-real-merge') cell.sampledPixels = sampledPixels;
      rawCells.push(cell);
    }
  }

  const cleanedCells = cleanRawCells(rawCells, gridSize, edgeCleanup);
  // 抄自 xiaoana 6333 chunk — cartoon-real-merge 阶段 2: 主色 + 暗色合成
  // 触发条件: mode === 'cartoon-real-merge' 或 mergeMode === 'cartoon-real-merge' (兼容旧版)
  if (mode === 'cartoon-real-merge' || mergeMode === 'cartoon-real-merge') {
    const validRgb = cleanedCells.filter(c => c).map(c => c.rgb);
    const merged = applyCartoonMerge(validRgb);
    let idx = 0;
    for (let i = 0; i < cleanedCells.length; i++) {
      if (cleanedCells[i]) cleanedCells[i].rgb = merged[idx++];
    }
  }
  const availablePalette = stylePalette(style);

  // ============ 模式分支: palette (字面映射) ============
  // 抄自 xiaoana 6333 chunk — palette 模式跳过 K-means, 每个 cell 直接找最近调色板色
  if (mode === 'palette') {
    let pixels = Array(gridSize * gridSize).fill(null);
    cleanedCells.forEach((cell, index) => {
      if (cell) pixels[index] = findNearestPaletteEntry(cell.rgb, availablePalette);
    });
    pixels = cleanQuantizedPixels(pixels, gridSize, edgeCleanup);
    if (skinProtect) {
      pixels = applySkinProtection(pixels, cleanedCells, gridSize, availablePalette, colorLimit);
    }
    pixels = applyOutline(pixels, gridSize, style, outline && removeBackground, settings.outlineColor || null, availablePalette);
    const counts = new Map();
    for (const color of pixels) if (color) counts.set(color.code, (counts.get(color.code) || 0) + 1);
    const colors = PREPARED_PALETTE
      .filter(color => counts.has(color.code))
      .map(color => ({ ...color, count: counts.get(color.code) }))
      .sort((a, b) => b.count - a.count);
    return {
      gridSize,
      pixels,
      colors,
      totalBeads: colors.reduce((sum, color) => sum + color.count, 0),
      blankCells: pixels.filter(pixel => pixel === null).length,
    };
  }

  const points = cleanedCells.flatMap((cell, index) => cell ? [{ index, rgb: cell.rgb }] : []);
  if (!points.length) {
    return { gridSize, pixels: Array(gridSize * gridSize).fill(null), colors: [], totalBeads: 0, blankCells: gridSize * gridSize };
  }
  // 修复: 让 clusterLimit = colorLimit × 1.4，给 K-means 留冗余空间，
  // 这样 mapCentersToPalette 映射到 36 色色卡时能保留更多色，
  // 不会因 cluster 撞色导致色卡退化到 3 色。
  const clusterLimit = Math.max(
    1,
    Math.min(
      Math.ceil(colorLimit * 1.4),
      availablePalette.length,
      points.length,
    ),
  );
  const { centers, assignments } = settings.quantizeMode === 'freq-lab'
    ? makeFrequencyLabQuantize(points, clusterLimit)
    : makeKMeans(points, clusterLimit);
  const clusterColors = mapCentersToPalette(centers, assignments, availablePalette);
  let pixels = Array(gridSize * gridSize).fill(null);
  points.forEach((point, pointIndex) => { pixels[point.index] = clusterColors[assignments[pointIndex]]; });
  pixels = cleanQuantizedPixels(pixels, gridSize, edgeCleanup);

  // ============ 模式分支: dominant (A() 全局肤色替换) ============
  // 抄自 xiaoana 6333 chunk A() 函数 — 大块肤色连通区 + 单 cell 5x5 邻居替换
  if (mode === 'dominant') {
    // 抄自 xiaoana 6333 chunk A() 函数 — 大块肤色连通区 + 单 cell 5x5 邻居替换
    const grid2d = Array(gridSize).fill(null).map((_, x) =>
      Array(gridSize).fill(null).map((_, y) => pixels[x * gridSize + y])
    );
    const merged2d = applyDominantMerge(grid2d, gridSize, availablePalette);
    pixels = merged2d.flat();
  }

  // 抄自 xiaoana.cn 6333 chunk c() 函数 — 肤色保护 (Lab 距离 ≥144 + 4 邻居判定)
  if (skinProtect) {
    pixels = applySkinProtection(pixels, cleanedCells, gridSize, availablePalette, colorLimit);
  }
  pixels = applyOutline(pixels, gridSize, style, outline && removeBackground, settings.outlineColor || null, availablePalette);

  const counts = new Map();
  for (const color of pixels) if (color) counts.set(color.code, (counts.get(color.code) || 0) + 1);
  const colors = PREPARED_PALETTE
    .filter(color => counts.has(color.code))
    .map(color => ({ ...color, count: counts.get(color.code) }))
    .sort((a, b) => b.count - a.count);

  return {
    gridSize,
    pixels,
    colors,
    totalBeads: colors.reduce((sum, color) => sum + color.count, 0),
    blankCells: pixels.filter(pixel => pixel === null).length,
  };
}

function readableText(hex) {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 155 ? '#29272b' : '#ffffff';
}

function drawPatternGrid(ctx, pattern, options) {
  const {
    x = 0,
    y = 0,
    cellSize,
    mode = 'pattern',
    showCodes = true,
    gridInterval = 5,
    blankColor = '#ffffff',
    highlightCode = null,
    selectedCell = null,
    flipped = false,
    excludedColors = [],
  } = options;
  const excludedSet = new Set(excludedColors);
  const gridPixels = cellSize * pattern.gridSize;

  // 镜像: 在 grid 子坐标系内水平翻转 (不影响外层坐标)
  if (flipped) {
    ctx.save();
    ctx.translate(x + gridPixels, y);
    ctx.scale(-1, 1);
    ctx.translate(-x, -y);
  }

  ctx.fillStyle = blankColor;
  ctx.fillRect(x, y, gridPixels, gridPixels);

  for (let row = 0; row < pattern.gridSize; row++) {
    for (let col = 0; col < pattern.gridSize; col++) {
      const color = pattern.pixels[row * pattern.gridSize + col];
      const px = x + col * cellSize;
      const py = y + row * cellSize;
      if (mode === 'beads') {
        if (!color) continue;
        // 被软删除的色卡 cell: beads 模式也画灰白格 + ✕ (区别于正常 cell)
        if (excludedSet.has(color.code)) {
          ctx.fillStyle = '#e5e7eb';
          ctx.fillRect(px, py, cellSize, cellSize);
          ctx.fillStyle = '#9ca3af';
          ctx.font = `700 ${Math.max(8, Math.floor(cellSize * 0.4))}px ui-sans-serif, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('✕', px + cellSize / 2, py + cellSize / 2 + 1);
          continue;
        }
        const radius = cellSize * 0.43;
        const gradient = ctx.createRadialGradient(
          px + cellSize * 0.35,
          py + cellSize * 0.28,
          cellSize * 0.05,
          px + cellSize / 2,
          py + cellSize / 2,
          radius,
        );
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.18, color.hex);
        gradient.addColorStop(1, color.hex);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(px + cellSize / 2, py + cellSize / 2, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#00000022';
        ctx.lineWidth = Math.max(0.5, cellSize * 0.035);
        ctx.stroke();
        ctx.fillStyle = '#ffffff99';
        ctx.beginPath();
        ctx.arc(px + cellSize / 2, py + cellSize / 2, cellSize * 0.12, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      // 被软删除的色卡 cell: 画灰白格子 + 中央 ✕ 标记 (区别于空白格)
      if (color && excludedSet.has(color.code)) {
        ctx.fillStyle = '#e5e7eb';
        ctx.fillRect(px, py, cellSize, cellSize);
        ctx.fillStyle = '#9ca3af';
        ctx.font = `700 ${Math.max(8, Math.floor(cellSize * 0.4))}px ui-sans-serif, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✕', px + cellSize / 2, py + cellSize / 2 + 1);
        continue;
      }

      ctx.fillStyle = color?.hex || blankColor;
      ctx.fillRect(px, py, cellSize, cellSize);
      if (showCodes && color && cellSize >= 9) {
        ctx.fillStyle = readableText(color.hex);
        // 8 位数 (1-99) 在 cellSize=9 时也勉强能塞下; 显示 "08" 截成 "8" 节省空间
        const code = cellSize >= 12 ? color.code.replace(/^[A-Z]+/, '') : color.code.replace(/^[A-Z]+0/, '');
        ctx.font = `700 ${Math.max(6, Math.floor(cellSize * 0.34))}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(code, px + cellSize / 2, py + cellSize / 2 + 0.5);
      }
    }
  }

  if (highlightCode) {
    // 抄 pdtz 三步法:
    //  1) 白罩 72% alpha 盖住所有非高亮 cell (暗化背景)
    //  2) 高亮 cell 加半透明红填充
    //  3) 高亮 cell 加 18% cellSize 粗红描边
    ctx.save();
    for (let row = 0; row < pattern.gridSize; row++) {
      for (let col = 0; col < pattern.gridSize; col++) {
        const color = pattern.pixels[row * pattern.gridSize + col];
        if (!color || color.code === highlightCode) continue;
        const px = x + col * cellSize;
        const py = y + row * cellSize;
        ctx.fillStyle = 'rgba(255,255,255,0.72)';
        ctx.fillRect(px, py, cellSize, cellSize);
      }
    }
    ctx.restore();

    // 步骤 2+3: 高亮 cell
    const lineWidth = Math.max(2, Math.min(5, Math.floor(cellSize * 0.18)));
    for (let row = 0; row < pattern.gridSize; row++) {
      for (let col = 0; col < pattern.gridSize; col++) {
        const color = pattern.pixels[row * pattern.gridSize + col];
        if (!color || color.code !== highlightCode) continue;
        const px = x + col * cellSize;
        const py = y + row * cellSize;
        // 半透明红填充
        ctx.fillStyle = 'rgba(255,47,63,0.08)';
        ctx.fillRect(px, py, cellSize, cellSize);
        // 粗红描边
        ctx.strokeStyle = '#ff2f3f';
        ctx.lineWidth = lineWidth;
        ctx.strokeRect(
          px + lineWidth / 2,
          py + lineWidth / 2,
          cellSize - lineWidth,
          cellSize - lineWidth
        );
      }
    }
  }

  if (selectedCell) {
    const { row, col } = selectedCell;
    if (row >= 0 && row < pattern.gridSize && col >= 0 && col < pattern.gridSize) {
      const px = x + col * cellSize;
      const py = y + row * cellSize;
      ctx.strokeStyle = '#5b8cff';
      ctx.lineWidth = Math.max(3, cellSize * 0.18);
      ctx.strokeRect(px + 2, py + 2, cellSize - 4, cellSize - 4);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 5, py + 5, cellSize - 10, cellSize - 10);
    }
  }

  if (mode === 'pattern') {
    for (let line = 0; line <= pattern.gridSize; line++) {
      const strong = line % gridInterval === 0;
      ctx.strokeStyle = strong ? '#555963' : '#cfd2d8';
      ctx.lineWidth = strong ? 1.6 : 0.55;
      const position = line * cellSize;
      ctx.beginPath();
      ctx.moveTo(x + position, y);
      ctx.lineTo(x + position, y + gridPixels);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y + position);
      ctx.lineTo(x + gridPixels, y + position);
      ctx.stroke();
    }
  }
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
  ctx.strokeStyle = '#30333a';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, gridPixels, gridPixels);

  if (flipped) {
    ctx.restore();
  }
}

export function renderPatternPreview(pattern, options = {}) {
  const maxGridPixels = 960;
  const cellSize = Math.max(10, Math.floor(maxGridPixels / pattern.gridSize));
  const gridPixels = cellSize * pattern.gridSize;
  const canvas = document.createElement('canvas');
  canvas.width = gridPixels;
  canvas.height = gridPixels;
  const ctx = canvas.getContext('2d');
  drawPatternGrid(ctx, pattern, { ...options, cellSize });
  return canvas;
}

/**
 * 直接把 pattern 画到传入的 canvas 上 (Phase 1 UI 用)。
 * options 同 drawPatternGrid, 额外支持 cellSize / blankColor / excludedColors。
 * 返回 { cellSize } 供调用方做命中检测。
 */
export function drawPatternToCanvas(canvas, pattern, options = {}) {
  const requested = options.cellSize;
  const cellSize = Math.max(4, requested || Math.max(8, Math.floor(960 / pattern.gridSize)));
  const gridPixels = cellSize * pattern.gridSize;
  if (canvas.width !== gridPixels) canvas.width = gridPixels;
  if (canvas.height !== gridPixels) canvas.height = gridPixels;
  const ctx = canvas.getContext('2d');
  drawPatternGrid(ctx, pattern, { ...options, cellSize });
  return { cellSize };
}

export function renderPattern(pattern, title = '拼豆图纸', options = {}) {
  const { showCodes = true, gridInterval = 5 } = options;
  // 动态 cellSize: 抄 pdtz getExportDeviceProfile — 移动端 5200px/1800万像素, 桌面端 8500px/5200万像素
  const isMobile = typeof navigator !== 'undefined' && /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent || '');
  const profile = isMobile
    ? { maxEdge: 5200, maxPixels: 18000000, idealWithCode: 28, idealNoCode: 24, minPx: 12 }
    : { maxEdge: 8500, maxPixels: 52000000, idealWithCode: 40, idealNoCode: 32, minPx: 16 };
  const maxBeads = Math.max(pattern.gridSize, 1);
  const idealPx = showCodes ? profile.idealWithCode : profile.idealNoCode;
  const edgePx = Math.floor((profile.maxEdge - 900) / maxBeads);
  const areaPx = Math.floor(Math.sqrt(profile.maxPixels / Math.max(1, pattern.gridSize * pattern.gridSize)));
  let cellSize = Math.max(profile.minPx, Math.min(idealPx, edgePx, areaPx));
  // minPx 是底线: 小网格 (100x100) 自动用 minPx, 保证 cellSize 至少 12/16px
  if (cellSize < profile.minPx) cellSize = profile.minPx;
  const gridPixels = cellSize * pattern.gridSize;
  const padding = 54;
  // 色卡清单 — 抄 pdtz 风格: 多列卡片网格 + 圆角色块 + 大字号
  // scale: 跟 pixelSize 联动, 大图给更大字体
  const legendScale = Math.max(1, Math.min(3, gridPixels / 1700));
  const legendMetrics = {
    itemWidth: Math.round(112 * legendScale),
    itemHeight: Math.round(146 * legendScale),
    colorBlockSize: Math.round(84 * legendScale),
    labelFontSize: Math.round(22 * legendScale),
    countFontSize: Math.round(23 * legendScale),
    titleFontSize: Math.round(32 * legendScale),
    topGap: Math.round(72 * legendScale),
    itemTopGap: Math.round(82 * legendScale),
    blockRadius: Math.round(10 * legendScale),
    bottomPadding: Math.round(60 * legendScale),
  };
// "一行排满再换行, 每行都铺满不留白"
  // 规则: 颜色数 ≥ 12 拆 2 行, 否则单行; 但卡宽 < 80px 时继续拆行
  const usableWidth = gridPixels + padding * 2;
  const minCardWidth = 80;
  let legendRows = pattern.colors.length >= 12 ? 2 : 1;
  let legendItemsPerRow = Math.ceil(pattern.colors.length / legendRows);
  let legendItemWidth = Math.floor((usableWidth - padding * 2) / legendItemsPerRow);
  // 卡宽太窄时拆更多行, 保证每张卡 ≥ 80px
  while (legendItemWidth < minCardWidth && legendRows < 10) {
    legendRows += 1;
    legendItemsPerRow = Math.ceil(pattern.colors.length / legendRows);
    legendItemWidth = Math.floor((usableWidth - padding * 2) / legendItemsPerRow);
  }
  const legendItemHeight = Math.round(legendItemWidth * 1.3);
  const legendBlockSize = Math.round(legendItemWidth * 0.75);
  const footerHeight = legendMetrics.topGap + legendMetrics.itemTopGap + legendRows * legendItemHeight + legendMetrics.bottomPadding;
  const headerHeight = 92;
  const canvas = document.createElement('canvas');
  canvas.width = gridPixels + padding * 2;
  canvas.height = headerHeight + gridPixels + footerHeight;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#191b20';
  ctx.font = '800 28px system-ui, sans-serif';
  ctx.fillText(title, padding, 42);
  ctx.font = '500 16px system-ui, sans-serif';
  ctx.fillStyle = '#747982';
  ctx.fillText(`${pattern.gridSize}×${pattern.gridSize} · ${pattern.colors.length} 色 · 共 ${pattern.totalBeads} 颗`, padding, 70);

  const gridX = padding;
  const gridY = headerHeight;
  drawPatternGrid(ctx, pattern, { x: gridX, y: gridY, cellSize, mode: 'pattern', showCodes, gridInterval, flipped: options.flipped, highlightCode: options.highlightCode });

  // 色卡清单 — 抄 pdtz 风格: 多列卡片网格 + 圆角色块 + 大字号
  const legendTitle = `${options.paletteName || '色卡'} · 颜色清单`;
  const gridAreaRight = padding + gridPixels;
  // itemsPerRow 已在上面 footerHeight 计算时定义过 (legendItemsPerRow)
  const itemsPerRow = legendItemsPerRow;
  const legendY = gridY + gridPixels + legendMetrics.topGap;
  // legendRows 已在 footerHeight 计算时定义过

  ctx.fillStyle = '#191b20';
  ctx.font = `800 ${legendMetrics.titleFontSize}px system-ui, "PingFang SC", sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(legendTitle, padding, legendY);

  // 顶部右侧: 合计 N 颗
  ctx.fillStyle = '#d95722';
  ctx.font = `700 ${Math.round(legendMetrics.countFontSize * 0.85)}px system-ui, sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillText(`共 ${pattern.totalBeads} 颗 · ${pattern.colors.length} 色`, gridAreaRight, legendY);

  // 卡片网格
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const isHighlightedLegend = (color) => options.highlightCode && color.code === options.highlightCode;
  pattern.colors.forEach((color, index) => {
    const row = Math.floor(index / itemsPerRow);
    const col = index % itemsPerRow;
    const itemX = padding + col * legendItemWidth;
    const itemY = legendY + legendMetrics.itemTopGap + row * legendItemHeight;

    const highlighted = isHighlightedLegend(color);

    // 圆角色块 (pdtz 风格)
    const blockX = itemX + (legendItemWidth - legendBlockSize) / 2;
    const blockY = itemY;
    const blockSize = legendBlockSize;
    const radius = Math.min(legendMetrics.blockRadius, blockSize / 2);
    ctx.save();
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(blockX, blockY, blockSize, blockSize, radius);
    } else {
      ctx.moveTo(blockX + radius, blockY);
      ctx.lineTo(blockX + blockSize - radius, blockY);
      ctx.quadraticCurveTo(blockX + blockSize, blockY, blockX + blockSize, blockY + radius);
      ctx.lineTo(blockX + blockSize, blockY + blockSize - radius);
      ctx.quadraticCurveTo(blockX + blockSize, blockY + blockSize, blockX + blockSize - radius, blockY + blockSize);
      ctx.lineTo(blockX + radius, blockY + blockSize);
      ctx.quadraticCurveTo(blockX, blockY + blockSize, blockX, blockY + blockSize - radius);
      ctx.lineTo(blockX, blockY + radius);
      ctx.quadraticCurveTo(blockX, blockY, blockX + radius, blockY);
    }
    // 高亮色: 半透明红填充 + 红色粗描边
    if (highlighted) {
      ctx.fillStyle = color.hex;
      ctx.fill();
      ctx.fillStyle = 'rgba(255,47,63,0.18)';
      ctx.fill();
      ctx.strokeStyle = '#ff2f3f';
      ctx.lineWidth = Math.max(2, Math.min(5, Math.floor(legendScale * 2)));
      ctx.stroke();
    } else {
      ctx.fillStyle = color.hex;
      ctx.fill();
      ctx.strokeStyle = '#cccccc';
      ctx.lineWidth = Math.max(1, Math.round(legendScale));
      ctx.stroke();
    }
    ctx.restore();

    // 色号文字 (色块内部居中, 大字号自适应)
    const maxLabelWidth = blockSize * 0.85;
    let labelFontSize = Math.round(blockSize * 0.36);
    ctx.font = `800 ${labelFontSize}px system-ui, "SF Mono", monospace`;
    while (labelFontSize > 10 && ctx.measureText(color.code).width > maxLabelWidth) {
      labelFontSize -= 1;
      ctx.font = `800 ${labelFontSize}px system-ui, "SF Mono", monospace`;
    }
    ctx.fillStyle = readableText(color.hex);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(color.code, blockX + blockSize / 2, blockY + blockSize / 2);

    // 颗数 (色块下方) — 深灰, 不用红色
    ctx.fillStyle = highlighted ? '#191b20' : '#191b20';
    ctx.font = `700 ${legendMetrics.countFontSize}px system-ui, sans-serif`;
    ctx.fillText(`${color.count} 颗`, itemX + legendItemWidth / 2, blockY + blockSize + legendMetrics.countFontSize * 0.7);
  });
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
  return canvas;
}

export function patternToCsv(pattern) {
  const rows = [['颜色编号', '颜色名称', 'HEX', '数量']];
  for (const color of pattern.colors) rows.push([color.code, color.name, color.hex, String(color.count)]);
  rows.push(['TOTAL', '总计', '', String(pattern.totalBeads)]);
  return `\ufeff${rows.map(row => row.join(',')).join('\n')}`;
}

/**
 * 纯图案渲染 — 无标题、无图例、无网格线、无色号、无边框、无高亮。
 * 仅输出像素方块组成的纯净图案，适合二次创作或社交平台分享。
 */
export function renderPurePattern(pattern, options = {}) {
  const { cellSize: requestedCellSize, backgroundColor = '#ffffff', excludedColors = [] } = options;
  const cellSize = Math.max(1, requestedCellSize || Math.max(8, Math.floor(2048 / pattern.gridSize)));
  const gridPixels = cellSize * pattern.gridSize;
  const canvas = document.createElement('canvas');
  canvas.width = gridPixels;
  canvas.height = gridPixels;
  const ctx = canvas.getContext('2d');
  const excludedSet = new Set(excludedColors);

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, gridPixels, gridPixels);

  for (let row = 0; row < pattern.gridSize; row++) {
    for (let col = 0; col < pattern.gridSize; col++) {
      const color = pattern.pixels[row * pattern.gridSize + col];
      if (!color || excludedSet.has(color.code)) continue;
      ctx.fillStyle = color.hex;
      ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
    }
  }
  return canvas;
}

/** JSON 序列化 — 保留所有可恢复数据 */
export function patternToJson(pattern) {
  return JSON.stringify({
    version: 1,
    gridSize: pattern.gridSize,
    pixels: pattern.pixels,
    colors: pattern.colors,
    totalBeads: pattern.totalBeads,
    blankCells: pattern.blankCells,
    exportedAt: new Date().toISOString(),
  });
}

/** JSON 反序列化 — 恢复 pattern 对象 */
export function patternFromJson(jsonString) {
  const data = JSON.parse(jsonString);
  if (!data || typeof data.gridSize !== 'number' || !Array.isArray(data.pixels)) {
    throw new Error('无效的备份文件格式');
  }
  return {
    gridSize: data.gridSize,
    pixels: data.pixels,
    colors: data.colors || [],
    totalBeads: data.totalBeads || 0,
    blankCells: data.blankCells ?? data.gridSize * data.gridSize - (data.totalBeads || 0),
  };
}

/** Excel 色号表导出 — 带颜色预览的 .xlsx 文件 */
export async function patternToExcel(pattern) {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  const rows = [['颜色编号', '颜色名称', 'HEX', '数量']];
  for (const color of pattern.colors) {
    rows.push([color.code, color.name, color.hex, color.count]);
  }
  rows.push(['TOTAL', '总计', '', pattern.totalBeads]);
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  // 设置列宽
  worksheet['!cols'] = [
    { wch: 12 },
    { wch: 14 },
    { wch: 10 },
    { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(workbook, worksheet, '色号表');
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
}

export function replaceColor(pattern, fromCode, toColor) {
  if (!pattern || fromCode === toColor.code) return pattern;
  const pixels = pattern.pixels.map(cell => {
    if (cell && cell.code === fromCode) return { ...cell, code: toColor.code, name: toColor.name, hex: toColor.hex };
    return cell;
  });
  const counts = new Map();
  for (const cell of pixels) {
    if (!cell) continue;
    counts.set(cell.code, (counts.get(cell.code) || 0) + 1);
  }
  const colorMap = new Map(pattern.colors.map(c => [c.code, c]));
  colorMap.set(toColor.code, { ...toColor, count: counts.get(toColor.code) || 0 });
  colorMap.delete(fromCode);
  const colors = PREPARED_PALETTE
    .filter(color => colorMap.has(color.code))
    .map(color => ({ ...color, count: colorMap.get(color.code).count }))
    .sort((a, b) => b.count - a.count);
  const totalBeads = colors.reduce((sum, c) => sum + c.count, 0);
  const blankCells = pixels.filter(p => p === null).length;
  return { ...pattern, pixels, colors, totalBeads, blankCells };
}

export function replaceCellColor(pattern, row, col, toColor) {
  if (!pattern) return pattern;
  const idx = row * pattern.gridSize + col;
  const cell = pattern.pixels[idx];
  if (cell && cell.code === toColor.code && cell.hex === toColor.hex) return pattern;
  const pixels = [...pattern.pixels];
  pixels[idx] = { code: toColor.code, name: toColor.name, hex: toColor.hex };
  const counts = new Map();
  for (const c of pixels) {
    if (!c) continue;
    counts.set(c.code, (counts.get(c.code) || 0) + 1);
  }
  const colorMap = new Map(pattern.colors.map(c => [c.code, c]));
  colorMap.set(toColor.code, { ...toColor, count: counts.get(toColor.code) || 0 });
  if (cell && counts.get(cell.code) === 0) colorMap.delete(cell.code);
  else if (cell) colorMap.set(cell.code, { ...cell, count: counts.get(cell.code) });
  const colors = PREPARED_PALETTE
    .filter(c => colorMap.has(c.code))
    .map(c => ({ ...c, count: colorMap.get(c.code).count }))
    .sort((a, b) => b.count - a.count);
  const totalBeads = colors.reduce((s, c) => s + c.count, 0);
  const blankCells = pixels.filter(p => p === null).length;
  return { ...pattern, pixels, colors, totalBeads, blankCells };
}

// 把某 code 的所有 cell 设为 null (真正删除该色, cell 变空白格)
export function removeColorFromPattern(pattern, code) {
  if (!pattern) return pattern;
  const pixels = pattern.pixels.map(cell => (cell && cell.code === code ? null : cell));
  const colors = pattern.colors.filter(c => c.code !== code);
  const totalBeads = colors.reduce((s, c) => s + c.count, 0);
  const blankCells = pixels.filter(p => p === null).length;
  return { ...pattern, pixels, colors, totalBeads, blankCells };
}

// === 抄自 xiaoana.cn 6333 chunk — 肤色识别 + 肤色保护 ===

// Rec.709 亮度 (抄自 xiaoana 6333 chunk F() 函数)
function rec709Luminance(rgb) {
  return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
}

// RGB 距离平方 (无 sqrt, 比较用 — 抄自 xiaoana s()/g())
function rgbDistanceSquared(a, b) {
  const dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

// 肤色识别 (抄自 xiaoana 6333 chunk b() 函数)
// F(e)>=128 && r>=g+14 && g>=b-4 && r>=b+28
function isSkinTone(rgb) {
  const F = rec709Luminance(rgb);
  return F >= 128
    && rgb.r >= rgb.g + 14
    && rgb.g >= rgb.b - 4
    && rgb.r >= rgb.b + 28;
}

// Lab 距离平方 (抄自 xiaoana — 内层 g() 距离, 无 sqrt)
function labDistanceSquared(a, b) {
  const dl = a.l - b.l, da = a.a - b.a, db = a.b - b.b;
  return dl * dl + da * da + db * db;
}

/**
 * 肤色保护降色 (抄自 xiaoana 6333 chunk c() 函数)
 *
 * 思路:
 * 1) 对每个 cell, 检测 4 邻居 (上/下/左/右)
 * 2) 若任一邻居是肤色且 Lab 距离 >= 144 (大差距) → 标记为"邻近对比肤色"
 * 3) 或自己亮度 <= 118 + 4 邻居平均亮度 >= 132 + 邻居比自己亮 28+ → "深肤色"
 * 4) 标记肤色的 cell 跳过合并 (不被吸附到非肤色色)
 *
 * 参数:
 *   pixels: number[][] (gridSize × gridSize) — 每格 rgb {r,g,b} 或 null
 *   palette: [{code, rgb, lab}] — 当前色板
 *   mergeThreshold: 合并阈值 (Lab 距离平方, 默认 30² = 900 — 跟 xiaoana slider 30 一致)
 *   colorLimit: 目标色数 (类似 xiaoana colorLimit 滑块)
 *
 * 返回: { pixels, colors } — pixels 是 [{code, hex, rgb}] 形式, colors 是去重的 palette 子集
 */
export function skinProtectQuantize(rawRgbGrid, palette, mergeThreshold = 30, colorLimit = 24) {
  const rows = rawRgbGrid.length;
  const cols = rawRgbGrid[0]?.length || 0;
  if (!rows || !cols) return { pixels: [], colors: [] };

  // 1) 收集所有 cell 的 RGB + 计数
  const colorMap = new Map();  // key: 'r,g,b' → {rgb, count, isSkinMarked: Set<index>}
  const cellRgb = new Array(rows * cols);  // 每格的 rgb
  rawRgbGrid.forEach((row, r) => row.forEach((cell, c) => {
    if (!cell) return;
    const idx = r * cols + c;
    cellRgb[idx] = cell;
    const key = `${Math.round(cell.r)},${Math.round(cell.g)},${Math.round(cell.b)}`;
    if (!colorMap.has(key)) colorMap.set(key, { rgb: cell, count: 0 });
    colorMap.get(key).count += 1;
  }));

  if (colorMap.size <= colorLimit) {
    // 不用合并, 直接用现有色, 映射到最近 palette 色
    return mapToPalette(rawRgbGrid, palette);
  }

  // 2) 标记肤色 cell (4 邻居 + 亮度判定)
  // skinMarked[idx] = true 表示此 cell 应跳过合并
  const skinMarked = new Array(rows * cols).fill(false);
  const DIRECTIONS = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const cell = cellRgb[idx];
      if (!cell) continue;

      let adjacentToContrastSkin = false;
      let neighborSkinBrightnessSum = 0;
      let neighborSkinCount = 0;

      for (const [dr, dc] of DIRECTIONS) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        const neighbor = cellRgb[nr * cols + nc];
        if (!neighbor || !isSkinTone(neighbor)) continue;

        // 4 邻居是肤色, 看 Lab 距离
        const labDistSq = labDistanceSquared(rgbToLab(cell), rgbToLab(neighbor));
        if (labDistSq >= 144 * 144) adjacentToContrastSkin = true;  // Lab≥144

        neighborSkinBrightnessSum += rec709Luminance(neighbor);
        neighborSkinCount += 1;
      }

      const cellBrightness = rec709Luminance(cell);
      const avgSkinBrightness = neighborSkinCount > 0 ? neighborSkinBrightnessSum / neighborSkinCount : 0;
      const isDarkSkin = cellBrightness <= 118
        && neighborSkinCount >= 2
        && avgSkinBrightness >= 132
        && (avgSkinBrightness - cellBrightness) >= 28;

      if (adjacentToContrastSkin || isDarkSkin) skinMarked[idx] = true;
    }
  }

  // 3) 频次降序 + Lab 距离吸附 (跳过肤色标记)
  const sortedColors = Array.from(colorMap.values()).sort((a, b) => b.count - a.count);
  const thresholdSq = mergeThreshold * mergeThreshold;
  const merged = new Set();  // 已合并的小颜色
  const survivor = new Map();  // 唯一存活色

  for (let i = 0; i < sortedColors.length; i++) {
    if (merged.has(sortedColors[i])) continue;
    survivor.set(sortedColors[i], i);
    for (let j = i + 1; j < sortedColors.length; j++) {
      if (merged.has(sortedColors[j])) continue;
      const labSq = labDistanceSquared(rgbToLab(sortedColors[i].rgb), rgbToLab(sortedColors[j].rgb));
      if (labSq < thresholdSq) {
        merged.add(sortedColors[j]);
      }
    }
  }

  // 4) 映射到 palette (用 Lab 距离)
  const finalColors = Array.from(survivor.keys());
  const pixels = new Array(rows * cols).fill(null);
  const finalPalette = [];

  for (let i = 0; i < finalColors.length; i++) {
    const target = findClosestPaletteColor(finalColors[i].rgb, palette);
    if (!target) continue;
    pixels[i] = { code: target.code, hex: target.hex, rgb: target.rgb, isExternal: false };
    finalPalette.push(target);
  }

  // 5) 把 rawRgbGrid 映射到 finalColors (考虑肤色标记)
  // 简化: 直接用 rawRgbGrid 找到对应 finalColors 然后用 palette 色
  const finalResult = { pixels: new Array(rows * cols).fill(null), colors: [] };
  const colorMap2 = new Map();

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const cell = rawRgbGrid[r][c];
      if (!cell) continue;

      // 找最近的 finalColor (但如果是肤色标记, 不被合并)
      let bestIdx = 0;
      let bestDist = Infinity;
      const cellLab = rgbToLab(cell);
      for (let i = 0; i < finalColors.length; i++) {
        if (skinMarked[idx] && i > 0) {
          // 肤色标记 cell: 跳过吸附到非主色的可能
          // 但保留主色作为 fallback
        }
        const dist = labDistanceSquared(cellLab, rgbToLab(finalColors[i].rgb));
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }
      const target = finalColors[bestIdx];
      const paletteColor = findClosestPaletteColor(target.rgb, palette);
      if (!paletteColor) continue;

      finalResult.pixels[idx] = { code: paletteColor.code, hex: paletteColor.hex, rgb: paletteColor.rgb, isExternal: false };
      if (!colorMap2.has(paletteColor.code)) {
        colorMap2.set(paletteColor.code, { ...paletteColor, count: 0 });
      }
      colorMap2.get(paletteColor.code).count += 1;
    }
  }

  finalResult.colors = Array.from(colorMap2.values());
  return finalResult;
}

// 辅助: 找 RGB 最近 palette 色
function findClosestPaletteColor(rgb, palette) {
  let best = null;
  let bestDist = Infinity;
  const cellLab = rgbToLab(rgb);
  for (const p of palette) {
    const dist = labDistanceSquared(cellLab, p.lab);
    if (dist < bestDist) {
      bestDist = dist;
      best = p;
    }
  }
  return best;
}

// 辅助: 简单映射到 palette (不做合并)
function mapToPalette(rawRgbGrid, palette) {
  const rows = rawRgbGrid.length;
  const cols = rawRgbGrid[0]?.length || 0;
  const pixels = new Array(rows * cols).fill(null);
  const colorMap = new Map();

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = rawRgbGrid[r][c];
      if (!cell) continue;
      const target = findClosestPaletteColor(cell, palette);
      if (!target) continue;
      const idx = r * cols + c;
      pixels[idx] = { code: target.code, hex: target.hex, rgb: target.rgb, isExternal: false };
      if (!colorMap.has(target.code)) {
        colorMap.set(target.code, { ...target, count: 0 });
      }
      colorMap.get(target.code).count += 1;
    }
  }
  return { pixels, colors: Array.from(colorMap.values()) };
}

/**
 * 肤色保护后处理 (简化版 — 不重建, 只纠错被 K-means 误合并的肤色 cell)
 *
 * 算法:
 * 1) 找出所有原始 RGB 是肤色的 cell (用 cleanedCells.rgb, 不是 pixel)
 * 2) 检查它们 4 邻居 — 如果被 K-means 合并到了非肤色色 → 改回最近的肤色 palette 色
 * 3) 肤色 palette 色识别: PREPARED_PALETTE 里任意色只要 isSkinTone() = true 就视为肤色候选
 */
function applySkinProtection(pixels, cleanedCells, gridSize, palette, colorLimit) {
  // 1) 预计算 palette 中哪些是肤色色
  const skinPalette = palette.filter(p => p.rgb && isSkinTone(p.rgb));
  if (!skinPalette.length) return pixels;  // 调色板无肤色色, 跳过

  const rows = gridSize;
  const cols = gridSize;
  const DIRECTIONS = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  let fixCount = 0;

  const next = [...pixels];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const cleanCell = cleanedCells[idx];
      const currentPixel = pixels[idx];
      if (!cleanCell || !currentPixel) continue;

      // 原 cell 是否肤色
      const originalIsSkin = isSkinTone(cleanCell.rgb);

      // 4 邻居中是否有肤色 (用 cleanedCells 原始 RGB 判)
      let adjacentSkinCell = null;
      for (const [dr, dc] of DIRECTIONS) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        const neighbor = cleanedCells[nr * cols + nc];
        if (neighbor && isSkinTone(neighbor.rgb)) {
          adjacentSkinCell = neighbor;
          break;
        }
      }

      if (!originalIsSkin && !adjacentSkinCell) continue;

      // 当前 pixel 是否是肤色 palette 色
      const currentIsSkin = isSkinTone(currentPixel.rgb || { r: 0, g: 0, b: 0 });
      if (currentIsSkin) continue;  // 已经是肤色, OK

      // 需要修复 — 找最近的肤色 palette 色
      const targetCell = originalIsSkin ? cleanCell : adjacentSkinCell;
      const target = findClosestPaletteColor(targetCell.rgb, skinPalette);
      if (!target) continue;

      // 避免改变过多样本导致 colorLimit 失控 — 只修"明显错误"的 (Lab 距离 > 80²)
      const currentLab = rgbToLab(currentPixel.rgb || { r: 0, g: 0, b: 0 });
      const targetLab = target.lab;
      const labDist = Math.sqrt(labDistanceSquared(currentLab, targetLab));
      if (labDist < 60) continue;  // 已经是接近肤色的色, 不动

      next[idx] = { code: target.code, hex: target.hex, rgb: target.rgb, isExternal: false };
      fixCount += 1;
    }
  }

  if (fixCount > 0) console.log(`[skinProtect] 修复了 ${fixCount} 个肤色 cell`);
  return next;
}
