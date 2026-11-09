function luminance(hex: string) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error('Invalid color');
  return [1, 3, 5].reduce((sum, offset, index) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return (
      sum +
      (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4) *
        [0.2126, 0.7152, 0.0722][index]!
    );
  }, 0);
}
export function contrastRatio(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}
export function brandForeground(background: string) {
  const navy = contrastRatio(background, '#071022');
  const white = contrastRatio(background, '#ffffff');
  return Math.max(navy, white) < 4.5 ? '#000000' : navy > white ? '#071022' : '#ffffff';
}
export function brandInk(color: string, theme: 'light' | 'dark') {
  const surface = theme === 'dark' ? '#16243f' : '#eaf5ff';
  if (contrastRatio(color, surface) >= 4.5) return color;
  const channels = [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16));
  for (let factor = 0.1; factor <= 1; factor += 0.1) {
    const adjusted =
      '#' +
      channels
        .map((channel) =>
          Math.round(theme === 'dark' ? channel + (255 - channel) * factor : channel * (1 - factor))
            .toString(16)
            .padStart(2, '0'),
        )
        .join('');
    if (contrastRatio(adjusted, surface) >= 4.5) return adjusted;
  }
  return theme === 'dark' ? '#ffffff' : '#071022';
}
