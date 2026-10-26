// Hand-drawn 24px square-cap icon sprite
const P = {
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  wall: 'M3 4h11v9H3zM16 4h5v4h-5zM16 10h5v3h-5zM3 15h5v5H3zM10 15h11v5H10z',
  bell: 'M6 17V11a6 6 0 0 1 12 0v6l2 2H4zM10 21h4',
  chart: 'M3 20h18M6 16v-5M11 16V6M16 16v-8M21 16v-3',
  play: 'M5 4l14 8-14 8zM',
  report: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7',
  cam: 'M3 7h12v10H3zM15 11l6-3v8l-6-3',
  sliders: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4',
  gear: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5v.5',
  search: 'M10 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM15 15l5 5',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19',
  moon: 'M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  user: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21c0-4 4-6 8-6s8 2 8 6',
  menu: 'M3 6h18M3 12h18M3 18h18',
  check: 'M4 12l5 5 11-11',
  x: 'M5 5l14 14M19 5L5 19',
  flag: 'M5 21V4h13l-2 4 2 4H5',
  bookmark: 'M6 3h12v18l-6-5-6 5z',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  presenter: 'M3 4h18v12H3zM12 16v4M8 20h8',
  logout: 'M10 4H4v16h6M15 8l5 4-5 4M20 12H9',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  mark: 'M12 2l9 5v10l-9 5-9-5V7zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  users: 'M9 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM2 20c0-3 3-5 7-5s7 2 7 5M17 6a3 3 0 0 1 0 5M18 15c2 .6 4 2 4 5',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
};
export function icon(name, cls = '') {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${P[name] || P.info}"/></svg>`;
}
