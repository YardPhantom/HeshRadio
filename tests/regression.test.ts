/**
 * HeshRadio radio-math regression tests.
 *
 * Locks in the bug fixes from c61742c:
 *  - geodesy.ts: Maidenhead 6-char subsquares used half the standard step,
 *    placing every locator ~65 km off (distance/bearing were wrong).
 *  - solarPropagation.ts: the terminator used a GHA missing the 180-degree
 *    offset with the wrong sign, shifting the greyline except at 06/18 UTC.
 *  - fmRadioService.ts: extractFmFrequency missed 108.0, two-decimal and
 *    digit-adjacent frequencies ("99.9MHz"), falling back to a hash slot.
 *  - adifLogger.ts: the band ladder mislabeled 15m/17m/12m/30m/6m.
 *  - bandPlans.ts: the mw-am plan must cover 535-1705 kHz in AM mode without
 *    shadowing 160m, and keep 11m-cb as the default band.
 *
 * Run with: npm test  (bundled by esbuild, executed via `node --test`)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { maidenheadToLatLon } from '../src/radio/geodesy';
import {
  maidenheadToLatLon as referenceMaidenheadToLatLon,
  latLonToMaidenhead,
} from '../src/radio/maidenheadGeodesy';
import { calculateSolarTerminator } from '../src/radio/solarPropagation';
import { extractFmFrequency, AM_STATIONS } from '../src/radio/fmRadioService';
import { bandForFrequency } from '../src/radio/adifLogger';
import { MASTER_BAND_PLANS, findBandPlanForFrequency } from '../src/radio/bandPlans';

const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

describe('geodesy.maidenheadToLatLon (6-char subsquare scale)', () => {
  it('matches the reference implementation (5.0\'/2.5\' subsquares)', () => {
    for (const grid of ['CN87uq', 'FN31pr', 'EM73aa', 'JO65uu', 'AA00aa']) {
      const ours = maidenheadToLatLon(grid);
      const ref = referenceMaidenheadToLatLon(grid);
      assert.ok(ours, `${grid} should decode`);
      assert.ok(near(ours!.lat, ref.lat, 1e-9), `${grid} lat ${ours!.lat} != ${ref.lat}`);
      assert.ok(near(ours!.lon, ref.lon, 1e-9), `${grid} lon ${ours!.lon} != ${ref.lon}`);
    }
  });

  it('decodes known grids to exact subsquare centers', () => {
    const cn87 = maidenheadToLatLon('CN87uq');
    assert.ok(cn87);
    assert.ok(near(cn87!.lat, 47.6875, 1e-9), `CN87uq lat was ${cn87!.lat}`);
    assert.ok(near(cn87!.lon, -124 + 20.5 / 12, 1e-9), `CN87uq lon was ${cn87!.lon}`);

    const fn31 = maidenheadToLatLon('FN31pr');
    assert.ok(fn31);
    assert.ok(near(fn31!.lat, 41 + 17.5 / 24, 1e-9), `FN31pr lat was ${fn31!.lat}`);
    assert.ok(near(fn31!.lon, -74 + 15.5 / 12, 1e-9), `FN31pr lon was ${fn31!.lon}`);
  });

  it('decodes 4-char locators to the square center', () => {
    assert.deepEqual(maidenheadToLatLon('CN87'), { lat: 47.5, lon: -123 });
  });

  it('round-trips through the reference encoder', () => {
    for (const grid of ['CN87uq', 'FN31pr', 'JO65uu']) {
      const ll = maidenheadToLatLon(grid);
      assert.ok(ll);
      assert.equal(latLonToMaidenhead(ll!.lat, ll!.lon), grid);
    }
  });

  it('rejects invalid locators', () => {
    assert.equal(maidenheadToLatLon(''), null);
    assert.equal(maidenheadToLatLon('CN9'), null);
    assert.equal(maidenheadToLatLon('ZZ99'), null);
    assert.equal(maidenheadToLatLon('CNAB'), null);
  });
});

describe('solarPropagation.calculateSolarTerminator (GHA convention)', () => {
  const terminatorAt = (pts: { lat: number; lon: number }[], lon: number) =>
    pts.find((p) => p.lon === lon)!.lat;

  it('computes solar declination at solstices and equinox', () => {
    const jun = calculateSolarTerminator(new Date(Date.UTC(2026, 5, 21, 12)));
    assert.ok(near(jun.solarDeclinationDeg, 23.44, 0.1), `June declination ${jun.solarDeclinationDeg}`);
    const dec = calculateSolarTerminator(new Date(Date.UTC(2026, 11, 21, 12)));
    assert.ok(near(dec.solarDeclinationDeg, -23.44, 0.1), `December declination ${dec.solarDeclinationDeg}`);
    const eq = calculateSolarTerminator(new Date(Date.UTC(2026, 2, 20, 12)));
    assert.ok(near(eq.solarDeclinationDeg, 0, 1), `Equinox declination ${eq.solarDeclinationDeg}`);
  });

  it("sets the sun's GHA to 0 at 12:00 UT, 180 at 00:00 UT, 270 at 06:00 UT", () => {
    const gha = (h: number) => calculateSolarTerminator(new Date(Date.UTC(2026, 5, 21, h))).greenwichHourAngleDeg;
    assert.ok(near(gha(12), 0, 0.01), `GHA at 12 UT was ${gha(12)}`);
    assert.ok(near(gha(0), 180, 0.01), `GHA at 0 UT was ${gha(0)}`);
    assert.ok(near(gha(6), 270, 0.01), `GHA at 6 UT was ${gha(6)}`);
  });

  it('places the June-solstice terminator at the polar circles, flipping with UT', () => {
    const juneNoon = calculateSolarTerminator(new Date(Date.UTC(2026, 5, 21, 12)));
    // Noon meridian (lon 0): sun at +23.44, darkness reaches 66.56 S
    const atNoon = terminatorAt(juneNoon.greylinePoints, 0);
    assert.ok(near(atNoon, -66.56, 0.5), `terminator lon 0 at noon UT was ${atNoon}`);
    // Midnight meridian: 66.56 N (polar day north of it in June)
    const atMidnightSide = terminatorAt(juneNoon.greylinePoints, -180);
    assert.ok(near(atMidnightSide, 66.56, 0.5), `terminator lon -180 at noon UT was ${atMidnightSide}`);
    // At 00:00 UT the sides swap
    const juneMidnight = calculateSolarTerminator(new Date(Date.UTC(2026, 5, 21, 0)));
    const atMidnight = terminatorAt(juneMidnight.greylinePoints, 0);
    assert.ok(near(atMidnight, 66.56, 0.5), `terminator lon 0 at 00 UT was ${atMidnight}`);
  });

  it('emits 73 points spanning -180..180 in 5-degree steps', () => {
    const jun = calculateSolarTerminator(new Date(Date.UTC(2026, 5, 21, 12)));
    assert.equal(jun.greylinePoints.length, 73);
    assert.equal(jun.greylinePoints[0].lon, -180);
    assert.equal(jun.greylinePoints[72].lon, 180);
  });
});

describe('fmRadioService.extractFmFrequency', () => {
  it('parses FM frequencies out of station titles and tags', () => {
    assert.equal(extractFmFrequency('KEXP 90.3 FM'), 90.3);
    assert.equal(extractFmFrequency('WQXR 101.5'), 101.5);
    assert.equal(extractFmFrequency('107.9 The Eagle'), 107.9);
    // Regression: 108.0 and two-decimal frequencies were missed entirely
    assert.equal(extractFmFrequency('Radio 108.0'), 108.0);
    assert.equal(extractFmFrequency('Jazz 101.55'), 101.6);
    // Regression: digit-then-letter ("99.9MHz") broke the old word boundary
    assert.equal(extractFmFrequency('Rock 99.9MHz'), 99.9);
  });

  it('falls back to a deterministic in-band slot when no frequency is present', () => {
    for (const name of ['Random Station Name', '198.1 should not match']) {
      const freq = extractFmFrequency(name);
      assert.ok(freq >= 88.1 && freq <= 107.9, `${name} -> ${freq}`);
    }
  });
});

describe('adifLogger.bandForFrequency', () => {
  it('maps exact band allocations to ADIF BAND values', () => {
    const cases: [number, string][] = [
      [1.9, '160m'], [3.6, '80m'], [5.358, '60m'], [7.17, '40m'], [10.136, '30m'],
      [14.074, '20m'], [18.1, '17m'], [21.07, '15m'], [24.94, '12m'], [27.185, '11m'],
      [27.555, '11m'], [28.5, '10m'], [50.125, '6m'], [146.52, '2m'], [446.0, '70cm'],
      [144.0, '2m'], [29.7, '10m'], [462.5625, '70cm'],
    ];
    for (const [mhz, band] of cases) {
      assert.equal(bandForFrequency(mhz), band, `bandForFrequency(${mhz})`);
    }
  });

  it('keeps the legacy fallback ladder for out-of-band frequencies', () => {
    assert.equal(bandForFrequency(0.6), '160m');  // MW: no ADIF band exists
    assert.equal(bandForFrequency(121.5), '2m');  // airband: closest VHF bucket
    assert.equal(bandForFrequency(NaN), '160m');
    assert.equal(bandForFrequency(0), '160m');
  });
});

describe('bandPlans wiring (mw-am Medium Wave plan)', () => {
  it('maps 535-1705 kHz to mw-am in AM mode', () => {
    for (const f of [0.535, 0.6, 1.0, 1.6, 1.705]) {
      const plan = findBandPlanForFrequency(f);
      assert.equal(plan?.id, 'mw-am', `${f} MHz mapped to ${plan?.id}`);
    }
    assert.equal(findBandPlanForFrequency(0.6)?.defaultMode, 'AM');
  });

  it('does not shadow adjacent bands', () => {
    assert.equal(findBandPlanForFrequency(1.8)?.id, 'ham-160m');
    assert.equal(findBandPlanForFrequency(98.7)?.id, 'fm-broadcast');
    assert.equal(findBandPlanForFrequency(27.185)?.id, '11m-cb');
    assert.equal(findBandPlanForFrequency(462.5625)?.id, 'gmrs-frs');
  });

  it('keeps 11m-cb as the default band and sources MW presets from AM_STATIONS', () => {
    assert.equal(MASTER_BAND_PLANS[0].id, '11m-cb');
    const mw = MASTER_BAND_PLANS.find((b) => b.id === 'mw-am');
    assert.ok(mw, 'mw-am plan exists');
    assert.equal(mw!.presets.length, 12);
    assert.equal(mw!.presets.length, AM_STATIONS.length);
    assert.ok(
      mw!.presets.every((p) => p.mode === 'AM' && p.frequencyMhz >= 0.535 && p.frequencyMhz <= 1.705),
      'MW presets are AM-mode and in-band'
    );
    assert.ok(
      AM_STATIONS.every((st) => st.band === 'am' && st.frequencyMhz <= 1.705),
      'AM_STATIONS are in-band MW sources'
    );
  });
});
