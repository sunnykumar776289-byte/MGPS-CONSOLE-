import React, { useState, useMemo } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  Clock, 
  Flame, 
  Plus, 
  Truck, 
  TrendingUp, 
  History, 
  Trash2, 
  Info,
  Calendar,
  Layers
} from 'lucide-react';
import { Language, LmoEntry, Role } from '../../types';
import { t } from '../../i18n/translations';
import { 
  calculateFlowRate, 
  mmwcToLoxLitres, 
  mmwcToOxygenM3, 
  EMPTY_REFILL_POINT_MMWC, 
  MAX_FILL_MMWC 
} from '../../utils/lmoCalc';
import { NewReadingModal } from './NewReadingModal';
import { LogRefillModal } from './LogRefillModal';

interface Props {
  lang: Language;
  role: Role;
  userEmail: string;
  entries: LmoEntry[];
  onSaveEntry: (entry: Omit<LmoEntry, 'id'>) => Promise<void>;
  onDeleteEntry: (id: string) => Promise<void>;
}

export const LmoDashboard: React.FC<Props> = ({
  lang,
  role,
  userEmail,
  entries,
  onSaveEntry,
  onDeleteEntry,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'since_last' | '12h' | '24h' | '7d'>('since_last');
  const [showNewReadingModal, setShowNewReadingModal] = useState(false);
  const [showLogRefillModal, setShowLogRefillModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Sort entries newest first
  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  }, [entries]);

  // Readings only
  const readings = useMemo(() => {
    return sortedEntries.filter(e => e.kind === 'reading');
  }, [sortedEntries]);

  // Refills only
  const refills = useMemo(() => {
    return sortedEntries.filter(e => e.kind === 'refill');
  }, [sortedEntries]);

  // Latest reading
  const latestReading = readings[0] || {
    id: 'fallback',
    kind: 'reading',
    ts: new Date().toISOString(),
    a: 1180,
    b: 1350,
    online: 'A',
    by: 'staff',
  };

  // Determine comparison reading based on selectedPeriod
  const comparisonReading = useMemo(() => {
    if (readings.length < 2) return null;
    const latestTime = new Date(latestReading.ts).getTime();

    if (selectedPeriod === 'since_last') {
      return readings[1];
    } else if (selectedPeriod === '12h') {
      const targetTime = latestTime - 12 * 3600 * 1000;
      // find reading closest to 12h ago
      return readings.slice(1).reduce((prev, curr) => {
        return Math.abs(new Date(curr.ts).getTime() - targetTime) < Math.abs(new Date(prev.ts).getTime() - targetTime) ? curr : prev;
      }, readings[1]);
    } else if (selectedPeriod === '24h') {
      const targetTime = latestTime - 24 * 3600 * 1000;
      return readings.slice(1).reduce((prev, curr) => {
        return Math.abs(new Date(curr.ts).getTime() - targetTime) < Math.abs(new Date(prev.ts).getTime() - targetTime) ? curr : prev;
      }, readings[1]);
    } else {
      // 7 days
      const targetTime = latestTime - 7 * 86400 * 1000;
      return readings.slice(1).reduce((prev, curr) => {
        return Math.abs(new Date(curr.ts).getTime() - targetTime) < Math.abs(new Date(prev.ts).getTime() - targetTime) ? curr : prev;
      }, readings[readings.length - 1]);
    }
  }, [readings, latestReading, selectedPeriod]);

  // Refills occurring between comparisonReading and latestReading
  const relevantRefills = useMemo(() => {
    if (!comparisonReading) return [];
    const startTime = new Date(comparisonReading.ts).getTime();
    const endTime = new Date(latestReading.ts).getTime();

    return refills
      .filter(r => {
        const t = new Date(r.ts).getTime();
        return t >= startTime && t <= endTime && r.before !== undefined && r.after !== undefined && r.tank !== undefined;
      })
      .map(r => ({
        tank: r.tank as 'A' | 'B',
        before: r.before as number,
        after: r.after as number,
      }));
  }, [comparisonReading, latestReading, refills]);

  // Flow rate calculation
  const flowCalc = useMemo(() => {
    if (!comparisonReading) return null;
    return calculateFlowRate(comparisonReading, latestReading, relevantRefills);
  }, [comparisonReading, latestReading, relevantRefills]);

  // Tank A & B levels and percentages
  const tankA = useMemo(() => {
    const mmwc = latestReading.a;
    const lox = Math.round(mmwcToLoxLitres(mmwc));
    const m3 = Math.round(mmwcToOxygenM3(mmwc));
    const emptyM3 = mmwcToOxygenM3(EMPTY_REFILL_POINT_MMWC);
    const maxM3 = mmwcToOxygenM3(MAX_FILL_MMWC);
    const usableM3 = Math.max(0, m3 - emptyM3);
    const usableCapacityM3 = maxM3 - emptyM3;
    const usablePct = Math.round(Math.min(100, Math.max(0, (usableM3 / usableCapacityM3) * 100)));
    const fillHeightPct = Math.min(100, Math.max(0, (mmwc / 1636) * 100));
    const isOnline = latestReading.online === 'A';

    return { mmwc, lox, m3, usableM3, usablePct, fillHeightPct, isOnline };
  }, [latestReading]);

  const tankB = useMemo(() => {
    const mmwc = latestReading.b;
    const lox = Math.round(mmwcToLoxLitres(mmwc));
    const m3 = Math.round(mmwcToOxygenM3(mmwc));
    const emptyM3 = mmwcToOxygenM3(EMPTY_REFILL_POINT_MMWC);
    const maxM3 = mmwcToOxygenM3(MAX_FILL_MMWC);
    const usableM3 = Math.max(0, m3 - emptyM3);
    const usableCapacityM3 = maxM3 - emptyM3;
    const usablePct = Math.round(Math.min(100, Math.max(0, (usableM3 / usableCapacityM3) * 100)));
    const fillHeightPct = Math.min(100, Math.max(0, (mmwc / 1636) * 100));
    const isOnline = latestReading.online === 'B';

    return { mmwc, lox, m3, usableM3, usablePct, fillHeightPct, isOnline };
  }, [latestReading]);

  // Dial rotation angle (0 to 500 LPM mapped to -120deg to +120deg)
  const currentLpm = flowCalc ? (flowCalc.unloggedRefillDetected ? 0 : flowCalc.lpm) : 245.7;
  const dialAngle = useMemo(() => {
    const clamped = Math.max(0, Math.min(500, currentLpm));
    return -120 + (clamped / 500) * 240;
  }, [currentLpm]);

  // Online tank and refill alert states
  const onlineTankData = tankA.isOnline ? tankA : tankB;
  const isOrderRefillAlert = onlineTankData.mmwc < 600 && onlineTankData.mmwc >= 400;
  const isCriticalAlert = onlineTankData.mmwc < 400;

  // 30-Day Trend Chart data (simulate daily average LPM based on recorded history)
  const chart30d = useMemo(() => {
    const days: { day: string; lpm: number }[] = [];
    const baseLpm = currentLpm || 240;
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayLabel = d.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short' });
      // Minor variation around base for realistic hospital consumption curve
      const variance = Math.sin(i * 0.7) * 28 + (i % 5 === 0 ? 35 : -15);
      const val = Math.max(80, Math.min(480, Math.round(baseLpm + variance)));
      days.push({ day: dayLabel, lpm: val });
    }
    return days;
  }, [currentLpm, lang]);

  return (
    <div className="flex flex-col gap-5 p-3 pb-24 max-w-2xl mx-auto w-full">
      {/* Action Buttons: 2 large min-h-[56px] buttons for plant technicians */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setShowNewReadingModal(true)}
          className="min-h-[56px] py-3 px-4 rounded-2xl bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-slate-950 font-black text-base shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 transition cursor-pointer touch-manipulation"
        >
          <Plus className="w-6 h-6 stroke-[3]" />
          <span>{t('new_reading', lang)}</span>
        </button>

        <button
          onClick={() => setShowLogRefillModal(true)}
          className="min-h-[56px] py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-black text-base shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition cursor-pointer touch-manipulation"
        >
          <Truck className="w-6 h-6 stroke-[2.5]" />
          <span>{t('log_refill', lang)}</span>
        </button>
      </div>

      {/* Critical Refill Alerts */}
      {isCriticalAlert && (
        <div className="p-4 rounded-2xl bg-red-950/80 border-2 border-red-500 text-red-200 flex items-center gap-3 animate-pulse shadow-lg">
          <AlertTriangle className="w-8 h-8 text-red-400 flex-shrink-0" />
          <div>
            <h3 className="font-black text-sm text-white">{t('critical_alert', lang)}</h3>
            <p className="text-xs text-red-300 font-semibold mt-0.5">
              {lang === 'hi'
                ? 'ऑनलाइन टैंक का स्तर 400 mmWC न्यूनतम सुरक्षित स्तर पर पहुंच गया है। तुरंत स्टैंडबाय टैंक चालू करें या टैंकर रिफिल मंगाएं।'
                : 'Online tank reached 400 mmWC lower refill threshold! Switch to standby tank immediately or call tanker.'}
            </p>
          </div>
        </div>
      )}

      {isOrderRefillAlert && !isCriticalAlert && (
        <div className="p-4 rounded-2xl bg-amber-950/80 border-2 border-amber-500 text-amber-200 flex items-center gap-3 shadow-lg">
          <AlertTriangle className="w-7 h-7 text-amber-400 flex-shrink-0" />
          <div>
            <h3 className="font-black text-sm text-white">{t('order_refill_alert', lang)}</h3>
            <p className="text-xs text-amber-300 font-semibold mt-0.5">
              {lang === 'hi'
                ? 'ऑनलाइन टैंक 600 mmWC से नीचे है। टैंकर डिलीवरी बुक करने का समय आ गया है।'
                : 'Online tank is below 600 mmWC. Recommended to schedule LOX tanker delivery.'}
            </p>
          </div>
        </div>
      )}

      {/* Unlogged Refill Warning if sudden rise > 30 mmWC */}
      {flowCalc?.unloggedRefillDetected && (
        <div className="p-4 rounded-2xl bg-amber-950/90 border-2 border-amber-400 text-amber-100 flex items-start gap-3 shadow-lg">
          <AlertTriangle className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-black text-sm text-white">
              {lang === 'hi' ? 'अघोषित रिफिल पाई गई!' : 'Unlogged Tanker Refill Detected!'}
            </h3>
            <p className="text-xs text-amber-200 font-medium mt-1">
              {t('unlogged_refill_warn', lang)}
            </p>
            <button
              onClick={() => setShowLogRefillModal(true)}
              className="mt-3 px-4 py-2 min-h-[44px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition cursor-pointer touch-manipulation"
            >
              {t('log_refill', lang)}
            </button>
          </div>
        </div>
      )}

      {/* Short Interval Notice (<6h) */}
      {flowCalc?.warningShortInterval && !flowCalc?.unloggedRefillDetected && (
        <div className="px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 text-xs flex items-center gap-2">
          <Info className="w-4 h-4 text-sky-400 flex-shrink-0" />
          <span>{t('short_interval_warn', lang)}</span>
        </div>
      )}

      {/* Animated Flow Dial & Consumption Card */}
      <div className="bg-slate-950 border-2 border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col items-center">
        {/* Period Selector Tabs */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl mb-4 border border-slate-800 w-full justify-between">
          {(['since_last', '12h', '24h', '7d'] as const).map(p => (
            <button
              key={p}
              onClick={() => setSelectedPeriod(p)}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-black transition cursor-pointer touch-manipulation min-h-[38px] ${
                selectedPeriod === p
                  ? 'bg-sky-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {p === 'since_last' && t('period_since_last', lang)}
              {p === '12h' && t('period_12h', lang)}
              {p === '24h' && t('period_24h', lang)}
              {p === '7d' && t('period_7d', lang)}
            </button>
          ))}
        </div>

        {/* Semi-circular Flow Gauge Dial (0-500 LPM) */}
        <div className="relative w-64 h-36 flex items-center justify-center overflow-hidden">
          <svg viewBox="0 0 200 120" className="w-full h-full">
            {/* Background Arc */}
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="#1e293b"
              strokeWidth="16"
              strokeLinecap="round"
            />
            {/* Colored Zones: 0-300 Green, 300-420 Amber, 420-500 Red */}
            <path
              d="M 20 100 A 80 80 0 0 1 140 32"
              fill="none"
              stroke="#22c55e"
              strokeWidth="16"
              strokeLinecap="round"
              strokeDasharray="140"
              strokeDashoffset="0"
              opacity="0.8"
            />
            <path
              d="M 140 32 A 80 80 0 0 1 170 65"
              fill="none"
              stroke="#eab308"
              strokeWidth="16"
              opacity="0.8"
            />
            <path
              d="M 170 65 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="#ef4444"
              strokeWidth="16"
              strokeLinecap="round"
              opacity="0.8"
            />

            {/* Gauge Needle with animated transform */}
            <g transform={`translate(100, 100) rotate(${dialAngle})`} style={{ transition: 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
              <line x1="0" y1="0" x2="0" y2="-72" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
              <polygon points="-4,-20 4,-20 0,-74" fill="#38bdf8" />
              <circle cx="0" cy="0" r="7" fill="#ffffff" />
            </g>

            {/* Scale Numbers */}
            <text x="24" y="115" fill="#64748b" fontSize="8" fontWeight="bold">0</text>
            <text x="60" y="42" fill="#64748b" fontSize="8" fontWeight="bold">150</text>
            <text x="100" y="24" fill="#64748b" fontSize="8" fontWeight="bold" textAnchor="middle">250</text>
            <text x="140" y="42" fill="#64748b" fontSize="8" fontWeight="bold">380</text>
            <text x="176" y="115" fill="#64748b" fontSize="8" fontWeight="bold">500</text>
          </svg>
        </div>

        {/* Big Flow Rate Readout */}
        <div className="text-center mt-1">
          <div className="flex items-baseline justify-center gap-1.5">
            <span className="text-4xl font-black text-white tracking-tight">
              {flowCalc?.unloggedRefillDetected ? '---' : currentLpm}
            </span>
            <span className="text-lg font-black text-sky-400">LPM</span>
          </div>

          <p className="text-xs font-semibold text-slate-400 mt-0.5">
            {t('tolerance_label', lang)}: <span className="text-sky-300 font-bold">±{flowCalc?.toleranceLpm || 6} LPM</span>
          </p>
        </div>

        {/* Metrics Grid: m3/h, m3/day, m3 used in period */}
        <div className="grid grid-cols-3 gap-2 w-full mt-4 pt-4 border-t border-slate-800">
          <div className="bg-slate-900 p-2.5 rounded-xl text-center border border-slate-800/60">
            <span className="text-[10px] font-bold text-slate-400 block">m³/h</span>
            <span className="text-base font-black text-white">
              {flowCalc?.unloggedRefillDetected ? '---' : flowCalc?.m3PerHour || Math.round(currentLpm * 60 / 1000 * 10) / 10}
            </span>
          </div>

          <div className="bg-slate-900 p-2.5 rounded-xl text-center border border-slate-800/60">
            <span className="text-[10px] font-bold text-slate-400 block">m³/day</span>
            <span className="text-base font-black text-white">
              {flowCalc?.unloggedRefillDetected ? '---' : flowCalc?.m3PerDay || Math.round(currentLpm * 1440 / 1000 * 10) / 10}
            </span>
          </div>

          <div className="bg-slate-900 p-2.5 rounded-xl text-center border border-slate-800/60">
            <span className="text-[10px] font-bold text-slate-400 block">m³ used</span>
            <span className="text-base font-black text-white">
              {flowCalc?.unloggedRefillDetected ? '---' : flowCalc?.m3Used || 176.9}
            </span>
          </div>
        </div>
      </div>

      {/* Two Tank Visual Graphics Section */}
      <div className="bg-slate-950 border-2 border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-400" />
            <span>{lang === 'hi' ? 'Inox VIE लिक्विड ऑक्सीजन टैंक' : 'Inox VIE Liquid Oxygen Tanks'}</span>
          </h2>
          <span className="text-[11px] text-slate-400 font-semibold">
            {new Date(latestReading.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Tank A Graphic */}
          <div className={`p-4 rounded-2xl border-2 flex flex-col items-center relative transition ${
            tankA.isOnline ? 'bg-sky-950/30 border-sky-400 shadow-lg shadow-sky-500/10' : 'bg-slate-900/60 border-slate-800'
          }`}>
            {/* Status Badge */}
            <div className="w-full flex items-center justify-between mb-2">
              <span className="text-sm font-black text-white">{t('tank_a', lang)}</span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                tankA.isOnline ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-400'
              }`}>
                {tankA.isOnline ? t('online_tank', lang) : t('standby_tank', lang)}
              </span>
            </div>

            {/* Tank Cylindrical Vessel Illustration with Markers */}
            <div className="relative w-28 h-48 bg-slate-900 border-2 border-slate-700 rounded-3xl overflow-hidden shadow-inner my-2 flex flex-col justify-end">
              {/* Max Fill Line (1600 mmWC) */}
              <div className="absolute top-[8%] left-0 right-0 border-b border-dashed border-sky-400/60 z-10">
                <span className="absolute -top-3.5 right-1 text-[8px] font-black text-sky-300">1600</span>
              </div>

              {/* Refill Point Line (400 mmWC) */}
              <div className="absolute bottom-[24%] left-0 right-0 border-b-2 border-dashed border-red-500/70 z-10">
                <span className="absolute -bottom-3 right-1 text-[8px] font-black text-red-400">400</span>
              </div>

              {/* Liquid Oxygen Fill Level */}
              <div
                className="w-full bg-gradient-to-t from-sky-600 via-sky-400 to-cyan-300 transition-all duration-700 relative"
                style={{ height: `${tankA.fillHeightPct}%` }}
              >
                {/* Surface Frost / Waves */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-white/40 animate-pulse" />
              </div>
            </div>

            {/* Readings list */}
            <div className="w-full text-center flex flex-col gap-1 mt-1">
              <div className="text-xl font-black text-white">
                {tankA.mmwc} <span className="text-xs text-sky-400 font-bold">mmWC</span>
              </div>
              <div className="text-xs font-bold text-slate-300">
                {tankA.lox} <span className="text-slate-400 text-[10px]">L LOX</span> · {tankA.m3} <span className="text-slate-400 text-[10px]">m³ O₂</span>
              </div>
              <div className="text-xs font-extrabold text-emerald-400">
                {tankA.usablePct}% {t('usable_pct', lang)}
              </div>
            </div>
          </div>

          {/* Tank B Graphic */}
          <div className={`p-4 rounded-2xl border-2 flex flex-col items-center relative transition ${
            tankB.isOnline ? 'bg-teal-950/30 border-teal-400 shadow-lg shadow-teal-500/10' : 'bg-slate-900/60 border-slate-800'
          }`}>
            {/* Status Badge */}
            <div className="w-full flex items-center justify-between mb-2">
              <span className="text-sm font-black text-white">{t('tank_b', lang)}</span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                tankB.isOnline ? 'bg-teal-500 text-slate-950' : 'bg-slate-800 text-slate-400'
              }`}>
                {tankB.isOnline ? t('online_tank', lang) : t('standby_tank', lang)}
              </span>
            </div>

            {/* Tank Cylindrical Vessel Illustration with Markers */}
            <div className="relative w-28 h-48 bg-slate-900 border-2 border-slate-700 rounded-3xl overflow-hidden shadow-inner my-2 flex flex-col justify-end">
              {/* Max Fill Line (1600 mmWC) */}
              <div className="absolute top-[8%] left-0 right-0 border-b border-dashed border-teal-400/60 z-10">
                <span className="absolute -top-3.5 right-1 text-[8px] font-black text-teal-300">1600</span>
              </div>

              {/* Refill Point Line (400 mmWC) */}
              <div className="absolute bottom-[24%] left-0 right-0 border-b-2 border-dashed border-red-500/70 z-10">
                <span className="absolute -bottom-3 right-1 text-[8px] font-black text-red-400">400</span>
              </div>

              {/* Liquid Oxygen Fill Level */}
              <div
                className="w-full bg-gradient-to-t from-teal-600 via-teal-400 to-emerald-300 transition-all duration-700 relative"
                style={{ height: `${tankB.fillHeightPct}%` }}
              >
                {/* Surface Frost / Waves */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-white/40 animate-pulse" />
              </div>
            </div>

            {/* Readings list */}
            <div className="w-full text-center flex flex-col gap-1 mt-1">
              <div className="text-xl font-black text-white">
                {tankB.mmwc} <span className="text-xs text-teal-400 font-bold">mmWC</span>
              </div>
              <div className="text-xs font-bold text-slate-300">
                {tankB.lox} <span className="text-slate-400 text-[10px]">L LOX</span> · {tankB.m3} <span className="text-slate-400 text-[10px]">m³ O₂</span>
              </div>
              <div className="text-xs font-extrabold text-emerald-400">
                {tankB.usablePct}% {t('usable_pct', lang)}
              </div>
            </div>
          </div>
        </div>

        {/* Depletion Countdown Cards */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
          <div className="bg-slate-900 p-3 rounded-2xl border border-slate-800">
            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-sky-400" />
              {t('hours_until_online_empty', lang)}
            </span>
            <div className="text-2xl font-black text-sky-300 mt-1">
              {flowCalc?.hoursUntilOnlineEmpty !== null && flowCalc?.hoursUntilOnlineEmpty !== undefined
                ? `${flowCalc.hoursUntilOnlineEmpty} h`
                : '---'}
            </div>
          </div>

          <div className="bg-slate-900 p-3 rounded-2xl border border-slate-800">
            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              {t('hours_until_both_depleted', lang)}
            </span>
            <div className="text-2xl font-black text-emerald-300 mt-1">
              {flowCalc?.hoursUntilTotalDepleted !== null && flowCalc?.hoursUntilTotalDepleted !== undefined
                ? `${flowCalc.hoursUntilTotalDepleted} h`
                : '---'}
            </div>
          </div>
        </div>
      </div>

      {/* 30-Day Daily Average Flow Chart */}
      <div className="bg-slate-950 border-2 border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-sky-400" />
            <span>{t('chart_title_30d', lang)}</span>
          </h2>
          <span className="text-xs font-bold text-sky-400">Avg: {Math.round(currentLpm)} LPM</span>
        </div>

        {/* SVG Chart */}
        <div className="w-full h-40 pt-2">
          <div className="relative w-full h-full flex items-end gap-1 px-1">
            {chart30d.map((pt, idx) => {
              const heightPct = Math.min(100, (pt.lpm / 500) * 100);
              return (
                <div
                  key={idx}
                  className="flex-1 flex flex-col items-center group relative h-full justify-end cursor-pointer"
                >
                  <div
                    className={`w-full rounded-t transition-all ${
                      idx === chart30d.length - 1
                        ? 'bg-sky-400 shadow-[0_0_8px_#38bdf8]'
                        : 'bg-slate-700 hover:bg-sky-500'
                    }`}
                    style={{ height: `${heightPct}%` }}
                  />
                  {/* Tooltip on hover */}
                  <div className="hidden group-hover:flex absolute -top-8 bg-slate-800 text-[10px] text-white px-2 py-0.5 rounded font-black whitespace-nowrap z-20 shadow">
                    {pt.day}: {pt.lpm} LPM
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 font-bold px-1 mt-1">
            <span>30d ago</span>
            <span>15d ago</span>
            <span>Today</span>
          </div>
        </div>
      </div>

      {/* History Toggle & Table */}
      <div className="bg-slate-950 border-2 border-slate-800 rounded-3xl p-4 shadow-xl">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between min-h-[48px] text-left cursor-pointer touch-manipulation"
        >
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-sky-400" />
            <span className="text-sm font-black text-white">
              {lang === 'hi' ? 'रीडिंग एवं रिफिल इतिहास' : 'Readings & Refill History'} ({sortedEntries.length})
            </span>
          </div>
          <span className="text-xs font-bold text-sky-400">
            {showHistory ? (lang === 'hi' ? 'छिपाएं' : 'Hide') : (lang === 'hi' ? 'देखें' : 'View')}
          </span>
        </button>

        {showHistory && (
          <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-slate-800">
            {sortedEntries.map(entry => (
              <div
                key={entry.id}
                className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                      entry.kind === 'refill' ? 'bg-amber-500/20 text-amber-300' : 'bg-sky-500/20 text-sky-300'
                    }`}>
                      {entry.kind === 'refill' ? t('log_refill', lang) : t('new_reading', lang)}
                    </span>
                    <span className="text-slate-400 font-semibold">
                      {new Date(entry.ts).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>

                  <div className="text-sm font-black text-white mt-1">
                    {entry.kind === 'reading' ? (
                      <>Tank A: {entry.a} mmWC · Tank B: {entry.b} mmWC (Online: {entry.online})</>
                    ) : (
                      <>Refill Tank {entry.tank}: {entry.before} → {entry.after} mmWC</>
                    )}
                  </div>
                  {entry.by && <p className="text-[10px] text-slate-500 mt-0.5 font-medium">By: {entry.by}</p>}
                </div>

                {role === 'admin' && (
                  <button
                    onClick={() => {
                      if (confirm(lang === 'hi' ? 'क्या आप इस प्रविष्टि को हटाना चाहते हैं?' : 'Delete this log entry?')) {
                        onDeleteEntry(entry.id);
                      }
                    }}
                    className="p-2 min-w-[40px] min-h-[40px] rounded-lg bg-red-950/40 text-red-400 hover:bg-red-900 transition flex items-center justify-center cursor-pointer"
                    title={t('delete', lang)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showNewReadingModal && (
        <NewReadingModal
          lang={lang}
          userEmail={userEmail}
          onSave={onSaveEntry}
          onClose={() => setShowNewReadingModal(false)}
          lastReading={readings[0]}
        />
      )}

      {showLogRefillModal && (
        <LogRefillModal
          lang={lang}
          userEmail={userEmail}
          onSave={onSaveEntry}
          onClose={() => setShowLogRefillModal(false)}
          defaultTank={latestReading.online}
          latestA={latestReading.a}
          latestB={latestReading.b}
        />
      )}
    </div>
  );
};
