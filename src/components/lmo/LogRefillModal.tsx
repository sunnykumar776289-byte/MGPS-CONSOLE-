import React, { useState, useMemo } from 'react';
import { Truck, Check, X, Calculator, Clock, Loader2 } from 'lucide-react';
import { Language, LmoEntry } from '../../types';
import { t } from '../../i18n/translations';
import { calculateRefill } from '../../utils/lmoCalc';

interface Props {
  lang: Language;
  userEmail: string;
  onSave: (entry: Omit<LmoEntry, 'id'>) => Promise<void>;
  onClose: () => void;
  defaultTank?: 'A' | 'B';
  latestA: number;
  latestB: number;
}

export const LogRefillModal: React.FC<Props> = ({
  lang,
  userEmail,
  onSave,
  onClose,
  defaultTank = 'A',
  latestA,
  latestB,
}) => {
  const [tank, setTank] = useState<'A' | 'B'>(defaultTank);
  const [beforeMmwc, setBeforeMmwc] = useState<number | ''>(defaultTank === 'A' ? latestA : latestB);
  const [afterMmwc, setAfterMmwc] = useState<number | ''>(1580);
  const [challanKg, setChallanKg] = useState<number | ''>('');
  const [timestamp, setTimestamp] = useState<string>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [isSaving, setIsSaving] = useState(false);

  // Compute live refill values
  const calc = useMemo(() => {
    if (beforeMmwc === '' || afterMmwc === '') {
      return { litresReceived: 0, kgReceived: 0, percentDiffVsChallan: null };
    }
    return calculateRefill(Number(beforeMmwc), Number(afterMmwc), challanKg === '' ? undefined : Number(challanKg));
  }, [beforeMmwc, afterMmwc, challanKg]);

  const handleSubmit = async () => {
    if (beforeMmwc === '' || afterMmwc === '') return;
    setIsSaving(true);
    try {
      await onSave({
        kind: 'refill',
        ts: new Date(timestamp).toISOString(),
        tank,
        before: Number(beforeMmwc),
        after: Number(afterMmwc),
        challanKg: challanKg === '' ? undefined : Number(challanKg),
        a: tank === 'A' ? Number(afterMmwc) : latestA,
        b: tank === 'B' ? Number(afterMmwc) : latestB,
        online: 'A', // placeholder or retain current
        by: userEmail,
        note: challanKg ? `Challan: ${challanKg} kg (${calc.percentDiffVsChallan}% diff)` : 'Refill logged',
      });
      onClose();
    } catch (error) {
      console.error('Error logging refill:', error);
      alert('Failed to log refill. Please check connection.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 overflow-y-auto">
      <div className="w-full max-w-lg bg-slate-900 border-2 border-slate-700 rounded-3xl p-5 text-slate-100 shadow-2xl flex flex-col gap-4 my-auto max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-black flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">{t('log_refill', lang)}</h2>
              <p className="text-xs text-amber-400 font-semibold">
                {lang === 'hi' ? 'टैंकर द्वारा ऑक्सीजन डिलीवरी दर्ज करें' : 'Record Cryogenic Tanker LOX Refill'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 min-w-[48px] min-h-[48px] flex items-center justify-center"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tank Picker (Big 56px buttons) */}
        <div>
          <label className="text-xs font-bold text-slate-300 block mb-2">
            {t('refill_tank', lang)}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setTank('A');
                setBeforeMmwc(latestA);
              }}
              className={`min-h-[56px] rounded-2xl font-black text-base transition flex items-center justify-center gap-2 cursor-pointer touch-manipulation ${
                tank === 'A'
                  ? 'bg-sky-500 text-slate-950 shadow-lg shadow-sky-500/30 ring-2 ring-sky-300'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs">A</span>
              <span>{t('tank_a', lang)}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTank('B');
                setBeforeMmwc(latestB);
              }}
              className={`min-h-[56px] rounded-2xl font-black text-base transition flex items-center justify-center gap-2 cursor-pointer touch-manipulation ${
                tank === 'B'
                  ? 'bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/30 ring-2 ring-teal-300'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs">B</span>
              <span>{t('tank_b', lang)}</span>
            </button>
          </div>
        </div>

        {/* Gauge Before & Gauge After Inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3">
            <label className="text-[11px] font-bold text-slate-400 block mb-1">
              {t('gauge_before', lang)}
            </label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={2000}
              value={beforeMmwc}
              onChange={e => setBeforeMmwc(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full min-h-[56px] text-2xl font-black text-center bg-slate-900 border-2 border-slate-700 rounded-xl focus:border-amber-400 text-white outline-none"
              placeholder="e.g. 978"
            />
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3">
            <label className="text-[11px] font-bold text-slate-400 block mb-1">
              {t('gauge_after', lang)}
            </label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={2000}
              value={afterMmwc}
              onChange={e => setAfterMmwc(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full min-h-[56px] text-2xl font-black text-center bg-slate-900 border-2 border-slate-700 rounded-xl focus:border-emerald-400 text-white outline-none"
              placeholder="e.g. 1590"
            />
          </div>
        </div>

        {/* Challan weight */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3">
          <label className="text-xs font-bold text-slate-300 block mb-1">
            {t('challan_kg', lang)}
          </label>
          <input
            type="number"
            inputMode="numeric"
            value={challanKg}
            onChange={e => setChallanKg(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full min-h-[50px] text-lg font-bold bg-slate-900 border border-slate-700 rounded-xl px-3 text-white outline-none"
            placeholder="e.g. 410"
          />
        </div>

        {/* Live Calculation Display Box */}
        <div className="bg-emerald-950/40 border-2 border-emerald-500/50 rounded-2xl p-4 text-emerald-100 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-black text-emerald-400 uppercase tracking-wider">
            <Calculator className="w-4 h-4" />
            <span>{lang === 'hi' ? 'रिफिल गणना परिणाम' : 'Calculated Delivery'}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <p className="text-[11px] text-emerald-300/80 font-bold">{t('litres_received', lang)}</p>
              <p className="text-2xl font-black text-white">{calc.litresReceived} <span className="text-sm font-semibold">L</span></p>
            </div>
            <div>
              <p className="text-[11px] text-emerald-300/80 font-bold">{t('kg_received', lang)}</p>
              <p className="text-2xl font-black text-white">{calc.kgReceived} <span className="text-sm font-semibold">kg</span></p>
            </div>
          </div>

          {calc.percentDiffVsChallan !== null && (
            <div className="pt-2 border-t border-emerald-500/30 flex items-center justify-between text-xs font-bold">
              <span className="text-slate-300">{t('challan_diff', lang)}:</span>
              <span className={`px-2 py-0.5 rounded ${
                Math.abs(calc.percentDiffVsChallan) > 5 ? 'bg-amber-500 text-black' : 'bg-emerald-500/30 text-emerald-300'
              }`}>
                {calc.percentDiffVsChallan > 0 ? `+${calc.percentDiffVsChallan}%` : `${calc.percentDiffVsChallan}%`}
              </span>
            </div>
          )}
        </div>

        {/* Timestamp */}
        <div>
          <label className="text-xs font-bold text-slate-400 block mb-1 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-slate-400" />
            {t('reading_time', lang)}
          </label>
          <input
            type="datetime-local"
            value={timestamp}
            onChange={e => setTimestamp(e.target.value)}
            className="w-full min-h-[48px] bg-slate-800 border border-slate-700 rounded-xl px-3 text-sm text-slate-200 outline-none"
          />
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={beforeMmwc === '' || afterMmwc === '' || isSaving}
          className="min-h-[56px] w-full rounded-2xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:opacity-40 text-slate-950 font-black text-lg shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2 transition cursor-pointer touch-manipulation"
        >
          {isSaving ? (
            <Loader2 className="w-6 h-6 animate-spin text-slate-950" />
          ) : (
            <>
              <Check className="w-6 h-6" />
              <span>{lang === 'hi' ? 'रिफिल दर्ज करें' : 'Log Tank Refill'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
