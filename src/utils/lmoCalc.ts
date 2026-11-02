export interface CalibrationRow {
  mmwc: number;
  litresLox: number;
  m3O2: number;
}

export const VIE_CALIBRATION_TABLE: CalibrationRow[] = [
  { mmwc: 0,    litresLox: 0,   m3O2: 0 },
  { mmwc: 100,  litresLox: 20,  m3O2: 17 },
  { mmwc: 200,  litresLox: 67,  m3O2: 59 },
  { mmwc: 400,  litresLox: 212, m3O2: 186 },
  { mmwc: 600,  litresLox: 331, m3O2: 291 },
  { mmwc: 800,  litresLox: 451, m3O2: 396 },
  { mmwc: 1000, litresLox: 570, m3O2: 501 },
  { mmwc: 1200, litresLox: 689, m3O2: 605 },
  { mmwc: 1400, litresLox: 809, m3O2: 710 },
  { mmwc: 1636, litresLox: 946, m3O2: 831 },
];

export const EMPTY_REFILL_POINT_MMWC = 400; // Empty (refill point)
export const MAX_FILL_MMWC = 1600;          // Maximum fill
export const LOX_DENSITY_KG_PER_L = 1.141;  // kg = litres * 1.141
export const READING_TOLERANCE_MMWC = 15;   // ±15 mmWC

/**
 * Linearly interpolates value between rows of calibration table
 */
export function interpolateCalibration(mmwc: number): { litresLox: number; m3O2: number; slopeM3PerMmwc: number } {
  const clamped = Math.max(0, Math.min(1636, mmwc));
  const table = VIE_CALIBRATION_TABLE;

  if (clamped <= table[0].mmwc) {
    const slope = (table[1].m3O2 - table[0].m3O2) / (table[1].mmwc - table[0].mmwc);
    return { litresLox: table[0].litresLox, m3O2: table[0].m3O2, slopeM3PerMmwc: slope };
  }

  for (let i = 0; i < table.length - 1; i++) {
    const lower = table[i];
    const upper = table[i + 1];

    if (clamped >= lower.mmwc && clamped <= upper.mmwc) {
      const fraction = (clamped - lower.mmwc) / (upper.mmwc - lower.mmwc);
      const litresLox = lower.litresLox + fraction * (upper.litresLox - lower.litresLox);
      const m3O2 = lower.m3O2 + fraction * (upper.m3O2 - lower.m3O2);
      const slopeM3PerMmwc = (upper.m3O2 - lower.m3O2) / (upper.mmwc - lower.mmwc);
      return { litresLox, m3O2, slopeM3PerMmwc };
    }
  }

  const last = table[table.length - 1];
  const secondLast = table[table.length - 2];
  const slope = (last.m3O2 - secondLast.m3O2) / (last.mmwc - secondLast.mmwc);
  return { litresLox: last.litresLox, m3O2: last.m3O2, slopeM3PerMmwc: slope };
}

export function mmwcToLoxLitres(mmwc: number): number {
  return interpolateCalibration(mmwc).litresLox;
}

export function mmwcToOxygenM3(mmwc: number): number {
  return interpolateCalibration(mmwc).m3O2;
}

export function getSlopeM3PerMmwc(mmwc: number): number {
  return interpolateCalibration(mmwc).slopeM3PerMmwc;
}

export interface RefillCalcResult {
  litresReceived: number;
  kgReceived: number;
  percentDiffVsChallan: number | null;
}

export function calculateRefill(beforeMmwc: number, afterMmwc: number, challanKg?: number): RefillCalcResult {
  const loxBefore = mmwcToLoxLitres(beforeMmwc);
  const loxAfter = mmwcToLoxLitres(afterMmwc);
  const litresReceived = Math.max(0, loxAfter - loxBefore);
  const kgReceived = litresReceived * LOX_DENSITY_KG_PER_L;

  let percentDiffVsChallan: number | null = null;
  if (challanKg && challanKg > 0) {
    percentDiffVsChallan = ((kgReceived - challanKg) / challanKg) * 100;
  }

  return {
    litresReceived: Math.round(litresReceived * 10) / 10,
    kgReceived: Math.round(kgReceived * 10) / 10,
    percentDiffVsChallan: percentDiffVsChallan !== null ? Math.round(percentDiffVsChallan * 10) / 10 : null,
  };
}

export interface FlowCalculationResult {
  lpm: number;
  m3PerHour: number;
  m3PerDay: number;
  m3Used: number;
  minutes: number;
  hours: number;
  toleranceLpm: number;
  warningShortInterval: boolean;
  unloggedRefillDetected: boolean;
  unloggedRefillTank?: 'A' | 'B';
  hoursUntilOnlineEmpty: number | null;
  hoursUntilTotalDepleted: number | null;
}

export function calculateFlowRate(
  startReading: { a: number; b: number; ts: string; online: 'A' | 'B' },
  endReading: { a: number; b: number; ts: string; online: 'A' | 'B' },
  refillsInPeriod: Array<{ tank: 'A' | 'B'; before: number; after: number }> = []
): FlowCalculationResult {
  const startTime = new Date(startReading.ts).getTime();
  const endTime = new Date(endReading.ts).getTime();
  const diffMs = Math.abs(endTime - startTime);
  const minutes = Math.max(1, diffMs / (1000 * 60));
  const hours = minutes / 60;
  const warningShortInterval = hours < 6;

  // Check for sudden rise > 30 mmWC without refill logged
  const refillSumA = refillsInPeriod
    .filter(r => r.tank === 'A')
    .reduce((sum, r) => sum + (r.after - r.before), 0);
  const refillSumB = refillsInPeriod
    .filter(r => r.tank === 'B')
    .reduce((sum, r) => sum + (r.after - r.before), 0);

  const netRiseA = endReading.a - startReading.a - refillSumA;
  const netRiseB = endReading.b - startReading.b - refillSumB;

  let unloggedRefillDetected = false;
  let unloggedRefillTank: 'A' | 'B' | undefined = undefined;

  if (netRiseA > 30) {
    unloggedRefillDetected = true;
    unloggedRefillTank = 'A';
  } else if (netRiseB > 30) {
    unloggedRefillDetected = true;
    unloggedRefillTank = 'B';
  }

  // Inventory calculation:
  // inventory = O2(A) + O2(B)
  const invStart = mmwcToOxygenM3(startReading.a) + mmwcToOxygenM3(startReading.b);
  const invEnd = mmwcToOxygenM3(endReading.a) + mmwcToOxygenM3(endReading.b);

  // Σ[O2(after) - O2(before)] for refills
  const refillO2Total = refillsInPeriod.reduce((acc, r) => {
    return acc + (mmwcToOxygenM3(r.after) - mmwcToOxygenM3(r.before));
  }, 0);

  // used m³ = inventory(start) - inventory(end) + refills
  const m3Used = Math.max(0, invStart - invEnd + refillO2Total);
  const lpm = (m3Used * 1000) / minutes;
  const m3PerHour = (lpm * 60) / 1000;
  const m3PerDay = (lpm * 1440) / 1000;

  // Tolerance: ±15 mmWC per reading
  // Convert with table slope at each level, combine in quadrature
  // sigma_m3 = sqrt((slope_start_A * 15)^2 + (slope_end_A * 15)^2 + ...)
  // For online tank or active usage:
  const slopeStartA = getSlopeM3PerMmwc(startReading.a);
  const slopeEndA = getSlopeM3PerMmwc(endReading.a);
  const slopeStartB = getSlopeM3PerMmwc(startReading.b);
  const slopeEndB = getSlopeM3PerMmwc(endReading.b);

  const varianceM3 = 
    Math.pow(slopeStartA * READING_TOLERANCE_MMWC, 2) +
    Math.pow(slopeEndA * READING_TOLERANCE_MMWC, 2) +
    Math.pow(slopeStartB * READING_TOLERANCE_MMWC, 2) +
    Math.pow(slopeEndB * READING_TOLERANCE_MMWC, 2);

  const sigmaM3 = Math.sqrt(varianceM3);
  const toleranceLpm = Math.round((sigmaM3 * 1000) / minutes);

  // Remaining hours calculation based on latest reading:
  const onlineTank = endReading.online;
  const onlineMmwc = onlineTank === 'A' ? endReading.a : endReading.b;
  const emptyO2 = mmwcToOxygenM3(EMPTY_REFILL_POINT_MMWC);
  const onlineCurrentO2 = mmwcToOxygenM3(onlineMmwc);
  const onlineUsableM3 = Math.max(0, onlineCurrentO2 - emptyO2);

  const totalCurrentO2 = mmwcToOxygenM3(endReading.a) + mmwcToOxygenM3(endReading.b);
  const totalUsableM3 = Math.max(0, totalCurrentO2 - (2 * emptyO2));

  let hoursUntilOnlineEmpty: number | null = null;
  let hoursUntilTotalDepleted: number | null = null;

  if (lpm > 0) {
    hoursUntilOnlineEmpty = (onlineUsableM3 * 1000) / lpm / 60;
    hoursUntilTotalDepleted = (totalUsableM3 * 1000) / lpm / 60;
  }

  return {
    lpm: Math.round(lpm * 10) / 10,
    m3PerHour: Math.round(m3PerHour * 10) / 10,
    m3PerDay: Math.round(m3PerDay * 10) / 10,
    m3Used: Math.round(m3Used * 10) / 10,
    minutes: Math.round(minutes),
    hours: Math.round(hours * 10) / 10,
    toleranceLpm: Math.max(1, toleranceLpm),
    warningShortInterval,
    unloggedRefillDetected,
    unloggedRefillTank,
    hoursUntilOnlineEmpty: hoursUntilOnlineEmpty !== null ? Math.round(hoursUntilOnlineEmpty * 10) / 10 : null,
    hoursUntilTotalDepleted: hoursUntilTotalDepleted !== null ? Math.round(hoursUntilTotalDepleted * 10) / 10 : null,
  };
}
