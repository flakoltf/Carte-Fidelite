import { describe, expect, it } from 'vitest';
import { buildTimeline, dayLabel, parseActivityRange } from '../activity';

const NOW = new Date('2026-06-10T14:00:00');

describe('buildTimeline', () => {
  it('fusionne, trie (récent → ancien) et groupe par jour', () => {
    const { days, stats } = buildTimeline(
      [
        { scanned_at: '2026-06-10T09:00:00', who: 'Anna', points_added: 1 },
        { scanned_at: '2026-06-09T11:00:00', who: 'Marc', points_added: 2 },
      ],
      [{ created_at: '2026-06-10T08:00:00', who: 'Léa' }],
      [{ created_at: '2026-06-09T12:00:00', who: 'Marc' }],
      NOW
    );
    expect(days.map((d) => d.label)).toEqual(["Aujourd'hui", 'Hier']);
    expect(days[0].events.map((e) => e.type)).toEqual(['scan', 'signup']);
    expect(days[1].events.map((e) => e.type)).toEqual(['reward', 'scan']);
    expect(stats).toEqual({ scans: 2, signups: 1, rewards: 1 });
  });

  it('ignore les dates invalides et applique la limite', () => {
    const { days, stats } = buildTimeline(
      [{ scanned_at: 'invalid', who: 'X', points_added: 1 }],
      Array.from({ length: 10 }, (_, i) => ({
        created_at: `2026-06-0${(i % 8) + 1}T10:00:00`,
        who: `C${i}`,
      })),
      [],
      NOW,
      5
    );
    expect(stats.scans).toBe(0);
    expect(days.flatMap((d) => d.events).length).toBe(5);
  });

  it('nomme « Client » les événements anonymes et porte les points', () => {
    const { days } = buildTimeline(
      [{ scanned_at: '2026-06-10T09:00:00', who: null, points_added: 3 }],
      [],
      [],
      NOW
    );
    expect(days[0].events[0].who).toBe('Client');
    expect(days[0].events[0].points).toBe(3);
  });
});

describe('dayLabel', () => {
  it('aujourd’hui / hier / date longue', () => {
    expect(dayLabel('2026-06-10', NOW)).toBe("Aujourd'hui");
    expect(dayLabel('2026-06-09', NOW)).toBe('Hier');
    expect(dayLabel('2026-06-01', NOW)).toContain('juin');
  });
});

describe('parseActivityRange', () => {
  it('accepte 7/30/90, retombe sur 30 sinon', () => {
    expect(parseActivityRange('7')).toBe(7);
    expect(parseActivityRange('90')).toBe(90);
    expect(parseActivityRange('14')).toBe(30);
    expect(parseActivityRange(undefined)).toBe(30);
  });
});
