/**
 * HSL 颜色轮盘系统
 * 支持任意数量颜色，统一亮度和饱和度
 */

export interface HSLColor {
  hue: number;        // 0-360
  saturation: number; // 0-100 (%)
  lightness: number;  // 0-100 (%)
}

/**
 * HSL 转 RGB
 */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;

  if (0 <= h && h < 60) {
    r = c; g = x; b = 0;
  } else if (60 <= h && h < 120) {
    r = x; g = c; b = 0;
  } else if (120 <= h && h < 180) {
    r = 0; g = c; b = x;
  } else if (180 <= h && h < 240) {
    r = 0; g = x; b = c;
  } else if (240 <= h && h < 300) {
    r = x; g = 0; b = c;
  } else if (300 <= h && h < 360) {
    r = c; g = 0; b = x;
  }

  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);

  return [r, g, b];
}

/**
 * HSL 转 HEX
 */
export function hslToHex(h: number, s: number, l: number): string {
  const [r, g, b] = hslToRgb(h, s, l);
  return `#${[r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('')}`;
}

/**
 * HEX 转 HSL
 */
export function hexToHsl(hex: string): HSLColor | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return {
    hue: Math.round(h * 360),
    saturation: Math.round(s * 100),
    lightness: Math.round(l * 100)
  };
}

/**
 * 生成颜色轮盘颜色（均匀分布）
 */
export function generateColorWheel(count: number = 12, saturation: number = 70, lightness: number = 80): HSLColor[] {
  const colors: HSLColor[] = [];
  const step = 360 / count;
  
  for (let i = 0; i < count; i++) {
    colors.push({
      hue: Math.round(i * step),
      saturation,
      lightness
    });
  }
  
  return colors;
}

/**
 * 获取预设颜色（兼容旧代码）
 */
export function getPresetColors(): Array<{ value: string; label: string; hsl: HSLColor }> {
  const presets = [
    { hex: '#E0F3A2', label: '青柠' },
    { hex: '#FFD1DC', label: '浆果' },
    { hex: '#BFEFFF', label: '薄荷' },
    { hex: '#A8D8FF', label: '蓝色' },
    { hex: '#D4A5FF', label: '紫色' },
    { hex: '#FFB84D', label: '橙色' },
    { hex: '#FF6B6B', label: '红色' },
    { hex: '#4ECDC4', label: '青色' },
  ];

  return presets.map(p => {
    const hsl = hexToHsl(p.hex);
    return {
      value: p.hex,
      label: p.label,
      hsl: hsl || { hue: 0, saturation: 70, lightness: 80 }
    };
  });
}

/**
 * 生成扩展颜色轮盘（12色）
 */
export function getExtendedColorWheel(): Array<{ value: string; label: string; hsl: HSLColor }> {
  const colors = generateColorWheel(12, 70, 80);
  const labels = ['红', '橙红', '橙', '黄', '黄绿', '绿', '青绿', '青', '蓝', '紫蓝', '紫', '粉'];
  
  return colors.map((hsl, i) => ({
    value: hslToHex(hsl.hue, hsl.saturation, hsl.lightness),
    label: labels[i] || `色${i + 1}`,
    hsl
  }));
}

