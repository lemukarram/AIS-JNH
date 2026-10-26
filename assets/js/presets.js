// Industry presets: cameras, scenes (normalized 0..1), alert catalogue. Not a label swap — scenes, rules and KPIs differ.
const door = (x1, y1, x2, y2) => ({ a: [x1, y1], b: [x2, y2] });
const R = (x, y, w, h, name, kind = 'zone') => ({ x, y, w, h, name, kind });

const cafe = {
  id: 'cafe', venue: 'Qahwa & Co. — Olaya Branch', capacity: 64, baseRate: 1,
  kpis: ['inside', 'footfall', 'queue', 'wait', 'occupancy', 'dwell', 'alerts', 'cams'],
  cameras: [
    { id: 'CAM-01', key: 'entrance', scene: 'door', line: door(.1, .55, .9, .55), spawn: [[.5, 1.02]], exit: [[.5, 1.05]],
      routes: [[[.5, .75], [.5, .3], [.5, -.05]], [[.35, .7], [.4, .4], [.5, -.05]]], zones: [R(.15, .4, .7, .4, 'Door threshold')], cls: 'person', flow: 1, rate: .55 },
    { id: 'CAM-02', key: 'counter', scene: 'queue', line: null, spawn: [[.05, .9]], exit: [[.95, .9]],
      routes: [[[.2, .78], [.2, .58, 4000], [.55, .35, 6000], [.9, .78], [1.05, .9]]],
      zones: [R(.08, .42, .26, .5, 'Queue zone', 'queue'), R(.45, .2, .4, .3, 'Counter', 'counter')], cls: 'person', rate: .35 },
    { id: 'CAM-03', key: 'seating', scene: 'seating', line: null, spawn: [[.5, 1.02]], exit: [[.5, 1.05]],
      routes: [[[.5, .8], [.22, .5, 40000], [.5, .8], [.5, 1.05]], [[.5, .8], [.7, .42, 55000], [.5, .8], [.5, 1.05]], [[.5, .8], [.4, .22, 30000], [.5, .8], [.5, 1.05]]],
      zones: [R(.1, .3, .35, .45, 'Seating A', 'seat'), R(.55, .25, .35, .45, 'Seating B', 'seat')], cls: 'person', rate: .2 },
    { id: 'CAM-04', key: 'kitchen', scene: 'kitchen', line: null, spawn: [[.05, .5]], exit: [[.05, .5]], night: false,
      routes: [[[.3, .5], [.6, .35, 9000], [.3, .7, 7000], [.05, .5]]], zones: [R(.45, .2, .4, .4, 'Prep station'), R(.1, .6, .3, .3, 'Dish area')], cls: 'person', rate: .08, staff: true },
    { id: 'CAM-05', key: 'outdoor', scene: 'parking', line: null, spawn: [[-.05, .8]], exit: [[1.05, .8]], night: true,
      routes: [[[.3, .8], [.5, .55, 8000], [.8, .8], [1.05, .8]]], zones: [R(.1, .3, .8, .5, 'Parking')], cls: 'car', rate: .1 },
  ],
  alerts: [
    ['queue', 'warn'], ['crowd', 'warn'], ['bag', 'warn'], ['spill', 'info'], ['staff', 'warn'], ['intrusion', 'crit'],
  ],
  funnel: ['passers', 'entered', 'queued', 'seated', 'paid'],
};

const restaurant = {
  ...cafe, id: 'restaurant', venue: 'Mijana Grill — Corniche', capacity: 120,
  cameras: [
    { ...cafe.cameras[0], id: 'CAM-01', key: 'entrance' },
    { ...cafe.cameras[2], id: 'CAM-02', key: 'dining', routes: [[[.5, .85], [.2, .4, 60000], [.5, .85], [.5, 1.05]], [[.5, .85], [.75, .35, 80000], [.5, .85], [.5, 1.05]], [[.5, .85], [.5, .2, 50000], [.5, .85], [.5, 1.05]]], rate: .4 },
    { ...cafe.cameras[1], id: 'CAM-03', key: 'bar', scene: 'bar' },
    { ...cafe.cameras[3], id: 'CAM-04', key: 'kitchen' },
    { ...cafe.cameras[4], id: 'CAM-05', key: 'terrace', scene: 'seating', cls: 'person', night: true, rate: .15,
      routes: [[[.5, .9], [.3, .5, 50000], [.5, .9], [.5, 1.05]]], spawn: [[.5, 1.02]], exit: [[.5, 1.05]] },
  ],
  funnel: ['passers', 'entered', 'seated', 'ordered', 'paid'],
};

const hospital = {
  id: 'hospital', venue: 'Al Noor Medical Centre', capacity: 220, baseRate: 1.4,
  kpis: ['inside', 'footfall', 'waiting', 'wait', 'occupancy', 'restricted', 'alerts', 'cams'],
  cameras: [
    { id: 'CAM-01', key: 'lobby', scene: 'door', line: door(.1, .6, .9, .6), spawn: [[.5, 1.02]], exit: [[.5, 1.05]],
      routes: [[[.5, .8], [.5, .3], [.15, .2, 3000], [.5, 1.05]], [[.5, .8], [.8, .25], [.5, 1.05]]], zones: [R(.2, .45, .6, .35, 'Reception')], cls: 'person', rate: .6 },
    { id: 'CAM-02', key: 'waiting', scene: 'seating', line: null, spawn: [[.5, 1.02]], exit: [[.5, 1.05]],
      routes: [[[.5, .85], [.2, .4, 70000], [.9, .1], [.5, 1.05]], [[.5, .85], [.7, .5, 90000], [.5, 1.05]], [[.5, .85], [.45, .25, 80000], [.5, 1.05]]],
      zones: [R(.1, .25, .8, .5, 'Waiting area', 'queue')], cls: 'person', rate: .35 },
    { id: 'CAM-03', key: 'corridor', scene: 'corridor', line: door(.5, .0, .5, 1), spawn: [[-.05, .5]], exit: [[1.05, .5]],
      routes: [[[.3, .5], [.7, .5], [1.05, .5]], [[1.05, .5], [.6, .5], [-.05, .5]]], zones: [R(.62, .3, .3, .4, 'Restricted — Radiology', 'restricted')], cls: 'person', rate: .3 },
    { id: 'CAM-04', key: 'er', scene: 'queue', line: null, spawn: [[.05, .9]], exit: [[.95, .9]],
      routes: [[[.2, .75], [.2, .55, 10000], [.55, .35, 15000], [1.05, .9]]], zones: [R(.08, .42, .3, .5, 'ER triage queue', 'queue')], cls: 'person', rate: .18, night: true },
    { id: 'CAM-05', key: 'parking', scene: 'parking', line: null, spawn: [[-.05, .8]], exit: [[1.05, .8]],
      routes: [[[.3, .8], [.5, .55, 12000], [.8, .8], [1.05, .8]]], zones: [R(.1, .3, .8, .5, 'Visitor parking')], cls: 'car', rate: .12 },
  ],
  alerts: [['crowd', 'warn'], ['fall', 'crit'], ['restricted', 'crit'], ['stretcher', 'warn'], ['bag', 'warn'], ['hygiene', 'info'], ['afterhours', 'warn']],
  funnel: ['arrived', 'registered', 'triage', 'seen', 'discharged'],
};

export const PRESETS = { cafe, restaurant, hospital };
export const ALERT_TYPES = ['queue', 'crowd', 'bag', 'spill', 'staff', 'intrusion', 'fall', 'restricted', 'stretcher', 'hygiene', 'afterhours'];
// Which camera key each alert type is naturally raised from (falls back to first camera)
export const ALERT_CAM = { queue: 'counter', crowd: 'entrance', bag: 'seating', spill: 'seating', staff: 'counter', intrusion: 'outdoor',
  fall: 'corridor', restricted: 'corridor', stretcher: 'corridor', hygiene: 'lobby', afterhours: 'corridor' };
