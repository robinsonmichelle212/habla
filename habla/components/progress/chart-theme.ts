export const progressPalette = {
  background: '#0B0F14',
  surface: '#151B24',
  surfaceBorder: '#252D3A',
  text: '#F4F6F8',
  muted: '#8B95A5',
  accent: '#FF7A59',
  grid: '#252D3A',
  heatmapNone: '#3D4654',
  heatmapDrill: 'rgba(255, 122, 89, 0.35)',
  heatmapLesson: 'rgba(255, 122, 89, 0.6)',
  heatmapBoth: '#FF7A59',
};

export const chartKitConfig = {
  backgroundColor: progressPalette.surface,
  backgroundGradientFrom: progressPalette.surface,
  backgroundGradientTo: progressPalette.surface,
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(255, 122, 89, ${opacity})`,
  labelColor: () => progressPalette.muted,
  propsForBackgroundLines: {
    stroke: progressPalette.grid,
    strokeDasharray: '4 6',
  },
  barPercentage: 0.6,
};
