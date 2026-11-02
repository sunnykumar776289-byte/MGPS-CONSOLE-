import React, { useState } from 'react';
import { Camera, Check, X, Clock, HelpCircle, Loader2 } from 'lucide-react';
import { Language, LmoEntry } from '../../types';
import { t } from '../../i18n/translations';
import { CameraViewfinder } from '../CameraViewfinder';

interface Props {
  lang: Language;
  userEmail: string;
  onSave: (entry: Omit<LmoEntry, 'id'>) => Promise<void>;
  onClose: () => void;
  lastReading?: LmoEntry;
}

export const NewReadingModal: React.FC<Props> = ({
  lang,
  userEmail,
  onSave,
  onClose,
  lastReading,
}) => {
  const [tankAPhoto, setTankAPhoto] = useState<string | null>(null);
  const [tankBPhoto, setTankBPhoto] = useState<string | null>(null);
  const [readingA, setReadingA] = useState<number | ''>(lastReading ? lastReading.a : 1200);
  const [readingB, setReadingB] = useState<number | ''>(lastReading ? lastReading.b : 1200);
  const [onlineTank, setOnlineTank] = useState<'A' | 'B'>(lastReading ? lastReading.online : 'A');
  const [timestamp, setTimestamp] = useState<string>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [note, setNote] = useState('');
  
  // Camera state
  const [activeCameraTarget, setActiveCameraTarget] = useState<'A' | 'B' | null>(null);
  const [analyzingTarget, setAnalyzingTarget] = useState<'A' | 'B' | null>(null);
  const [aiNotes, setAiNotes] = useState<{ A?: string; B?: string }>({});
  const [isSaving, setIsSaving] = useState(false);

  // Send gauge photo to server Gemini OCR
  const handlePhotoCaptured = async (target: 'A' | 'B', photoDataUrl: string) => {
    setActiveCameraTarget(null);
    if (target === 'A') setTankAPhoto(photoDataUrl);
    else setTankBPhoto(photoDataUrl);

    setAnalyzingTarget(target);
    try {
      const response = await fetch('/api/gemini/gauge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: photoDataUrl }),
      });

      if (response.ok) {
        const data = await response.json();
        if (typeof data.reading_mmwc === 'number') {
          if (target === 'A') setReadingA(data.reading_mmwc);
          else setReadingB(data.reading_mmwc);
        }
        if (data.note) {
          setAiNotes(prev => ({ ...prev, [target]: data.note }));
        }
      }
    } catch (err) {
      console.warn('Gemini gauge read failed, manual input ready:', err);
    } finally {
      setAnalyzingTarget(null);
    }
  };

  const handleConfirmSubmit = async () => {
    if (readingA === '' || readingB === '') return;
    setIsSaving(true);
    try {
      await onSave({
        kind: 'reading',
        ts: new Date(timestamp).toISOString(),
        a: Number(readingA),
        b: Number(readingB),
        online: onlineTank,
        photoA: tankAPhoto || undefined,
        photoB: tankBPhoto || undefined,
        by: userEmail,
        note: note.trim() || undefined,
      });
      onClose();
    } catch (error) {
      console.error('Failed to save reading:', error);
      alert('Error saving reading. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 overflow-y-auto">
      <div className="w-full max-w-lg bg-slate-900 border-2 border-slate-700 rounded-3xl p-5 text-slate-100 shadow-2xl flex flex-col gap-5 my-auto max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-black text-white">{t('new_reading', lang)}</h2>
            <p className="text-xs text-sky-400 font-semibold">
              {lang === 'hi' ? 'दोनों टैंकों के लेवल गेज (mmWC) की रीडिंग लें' : 'Record Tank A & B Level Gauge (mmWC)'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 min-w-[48px] min-h-[48px] flex items-center justify-center"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tank A Level Gauge Section */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-extrabold text-sky-400 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-sky-500 text-black flex items-center justify-center text-xs font-black">A</span>
              {t('tank_a', lang)}
            </span>
            {analyzingTarget === 'A' && (
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('gemini_reading_gauge', lang)}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 items-center">
            {/* Photo button */}
            <button
              onClick={() => setActiveCameraTarget('A')}
              className="flex flex-col items-center justify-center min-h-[90px] rounded-xl bg-slate-900 hover:bg-slate-800 border-2 border-dashed border-sky-400/50 p-2 text-center transition cursor-pointer touch-manipulation"
            >
              {tankAPhoto ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  <img src={tankAPhoto} alt="Tank A" className="max-h-[74px] rounded object-cover" />
                  <span className="absolute bottom-1 bg-black/70 text-[10px] text-sky-300 px-1.5 py-0.5 rounded font-bold">
                    {t('retake', lang)}
                  </span>
                </div>
              ) : (
                <>
                  <Camera className="w-7 h-7 text-sky-400 mb-1" />
                  <span className="text-xs font-bold text-slate-200">{t('step_tank_a_photo', lang)}</span>
                </>
              )}
            </button>

            {/* Reading Input (Large 56px touch target) */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">
                {t('level_mmwc', lang)} (0–1636)
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={2000}
                value={readingA}
                onChange={e => setReadingA(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full min-h-[56px] text-2xl font-black text-center bg-slate-900 border-2 border-slate-700 rounded-xl focus:border-sky-400 text-white outline-none"
                placeholder="mmWC"
              />
            </div>
          </div>
          {aiNotes.A && (
            <p className="text-[11px] text-sky-300/80 bg-sky-950/30 p-2 rounded-lg font-medium">
              💡 AI: {aiNotes.A}
            </p>
          )}
        </div>

        {/* Tank B Level Gauge Section */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-extrabold text-teal-400 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-teal-500 text-black flex items-center justify-center text-xs font-black">B</span>
              {t('tank_b', lang)}
            </span>
            {analyzingTarget === 'B' && (
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('gemini_reading_gauge', lang)}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 items-center">
            {/* Photo button */}
            <button
              onClick={() => setActiveCameraTarget('B')}
              className="flex flex-col items-center justify-center min-h-[90px] rounded-xl bg-slate-900 hover:bg-slate-800 border-2 border-dashed border-teal-400/50 p-2 text-center transition cursor-pointer touch-manipulation"
            >
              {tankBPhoto ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  <img src={tankBPhoto} alt="Tank B" className="max-h-[74px] rounded object-cover" />
                  <span className="absolute bottom-1 bg-black/70 text-[10px] text-teal-300 px-1.5 py-0.5 rounded font-bold">
                    {t('retake', lang)}
                  </span>
                </div>
              ) : (
                <>
                  <Camera className="w-7 h-7 text-teal-400 mb-1" />
                  <span className="text-xs font-bold text-slate-200">{t('step_tank_b_photo', lang)}</span>
                </>
              )}
            </button>

            {/* Reading Input (Large 56px touch target) */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">
                {t('level_mmwc', lang)} (0–1636)
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={2000}
                value={readingB}
                onChange={e => setReadingB(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full min-h-[56px] text-2xl font-black text-center bg-slate-900 border-2 border-slate-700 rounded-xl focus:border-teal-400 text-white outline-none"
                placeholder="mmWC"
              />
            </div>
          </div>
          {aiNotes.B && (
            <p className="text-[11px] text-teal-300/80 bg-teal-950/30 p-2 rounded-lg font-medium">
              💡 AI: {aiNotes.B}
            </p>
          )}
        </div>

        {/* Online Tank Selection (Big 56px buttons) */}
        <div>
          <label className="text-xs font-bold text-slate-300 block mb-2">
            {t('which_is_online', lang)}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setOnlineTank('A')}
              className={`min-h-[56px] rounded-2xl font-black text-base transition flex items-center justify-center gap-2 cursor-pointer touch-manipulation ${
                onlineTank === 'A'
                  ? 'bg-sky-500 text-slate-950 shadow-lg shadow-sky-500/30 ring-2 ring-sky-300'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs">A</span>
              <span>{t('tank_a', lang)} {onlineTank === 'A' ? '✓' : ''}</span>
            </button>

            <button
              type="button"
              onClick={() => setOnlineTank('B')}
              className={`min-h-[56px] rounded-2xl font-black text-base transition flex items-center justify-center gap-2 cursor-pointer touch-manipulation ${
                onlineTank === 'B'
                  ? 'bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/30 ring-2 ring-teal-300'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs">B</span>
              <span>{t('tank_b', lang)} {onlineTank === 'B' ? '✓' : ''}</span>
            </button>
          </div>
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

        {/* Big Submit Button: 56px minimum touch target */}
        <button
          onClick={handleConfirmSubmit}
          disabled={readingA === '' || readingB === '' || isSaving}
          className="min-h-[56px] w-full rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-40 text-slate-950 font-black text-lg shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 transition cursor-pointer touch-manipulation"
        >
          {isSaving ? (
            <Loader2 className="w-6 h-6 animate-spin text-slate-950" />
          ) : (
            <>
              <Check className="w-6 h-6" />
              <span>{t('reading_confirmed', lang)}</span>
            </>
          )}
        </button>
      </div>

      {/* Camera Viewfinder Overlay */}
      {activeCameraTarget && (
        <CameraViewfinder
          lang={lang}
          title={activeCameraTarget === 'A' ? t('step_tank_a_photo', lang) : t('step_tank_b_photo', lang)}
          subtitle={lang === 'hi' ? 'लेवल गेज (mmWC) की स्पष्ट फोटो लें' : 'Point camera at level gauge in mmWC'}
          onCaptured={(dataUrl) => handlePhotoCaptured(activeCameraTarget, dataUrl)}
          onManualInput={() => setActiveCameraTarget(null)}
          onClose={() => setActiveCameraTarget(null)}
        />
      )}
    </div>
  );
};
