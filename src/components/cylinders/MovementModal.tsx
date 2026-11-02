import React, { useState, useMemo } from 'react';
import { 
  Camera, 
  Check, 
  X, 
  ArrowRight, 
  RefreshCw, 
  AlertTriangle, 
  Plus, 
  Trash2, 
  ListCheck, 
  ShieldAlert, 
  Sparkles, 
  CheckCircle2,
  FileText
} from 'lucide-react';
import { 
  Language, 
  Cylinder, 
  CylinderEvent, 
  CylinderKind, 
  CylinderStatus, 
  CYLINDER_KINDS 
} from '../../types';
import { t } from '../../i18n/translations';
import { CameraViewfinder } from '../CameraViewfinder';

export type MovementMode = 
  | 'receive' 
  | 'issue' 
  | 'return' 
  | 'send' 
  | 'exchange' 
  | 'faulty' 
  | 'stock_check';

interface Props {
  lang: Language;
  mode: MovementMode;
  userEmail: string;
  wards: string[];
  cylinders: Cylinder[];
  onAddWard: (ward: string) => Promise<void>;
  onSaveBatch: (
    updatedCylinders: Cylinder[], 
    events: Omit<CylinderEvent, 'id'>[]
  ) => Promise<void>;
  onClose: () => void;
  preselectedWard?: string;
  preselectedLocation?: string;
  stockMin?: Record<CylinderKind, number>;
}

export const MovementModal: React.FC<Props> = ({
  lang,
  mode,
  userEmail,
  wards,
  cylinders,
  onAddWard,
  onSaveBatch,
  onClose,
  preselectedWard,
  preselectedLocation,
}) => {
  // Movement configuration state
  const [selectedWard, setSelectedWard] = useState<string>(preselectedWard || wards[0] || 'ICU');
  const [stockCheckPlace, setStockCheckPlace] = useState<string>(preselectedLocation || 'Plant full');
  const [challanNumber, setChallanNumber] = useState('');
  const [faultReason, setFaultReason] = useState('valve leak');
  const [faultDetails, setFaultDetails] = useState('');

  // Remembered default kind for unknown serials in localStorage
  const [defaultNewKind, setDefaultNewKind] = useState<CylinderKind>(() => {
    return (localStorage.getItem('mgps_default_kind') as CylinderKind) || 'O₂ A';
  });

  // Current batch records
  const [batchItems, setBatchItems] = useState<Array<{
    serial: string;
    kind: CylinderKind;
    photo?: string;
    note?: string;
    fromLocation?: string;
    toLocation: string;
    fromStatus: CylinderStatus;
    toStatus: CylinderStatus;
    action: any;
    isExchangeEmpty?: boolean;
    isExchangeFull?: boolean;
    linkedWard?: string;
  }>>([]);

  // Exchange state machine: step 1 empty, step 2 full
  const [exchangeStep, setExchangeStep] = useState<'scan_empty' | 'scan_full'>('scan_empty');
  const [currentExchangeEmptySerial, setCurrentExchangeEmptySerial] = useState<string | null>(null);
  const [currentExchangeWard, setCurrentExchangeWard] = useState<string | null>(null);

  // Scanner & Confirmation state
  const [isViewfinderOpen, setIsViewfinderOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [confirmPendingItem, setConfirmPendingItem] = useState<{
    serial: string;
    rawSerial: string;
    photo?: string;
    gas: string;
    kind: CylinderKind;
    hydrotest?: string;
    expectedStatus?: CylinderStatus;
    expectedLocation?: string;
    warningMismatch?: string;
    blockError?: string;
  } | null>(null);

  // Manual input state
  const [manualSerialInput, setManualSerialInput] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  // Add ward dialog inside movement
  const [showAddWardDialog, setShowAddWardDialog] = useState(false);
  const [newWardName, setNewWardName] = useState('');

  // Submitting
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Uncounted in stock check
  const [uncountedMissingMarked, setUncountedMissingMarked] = useState<string[]>([]);

  // Map of existing cylinders by normalised serial
  const cylinderMap = useMemo(() => {
    const map = new Map<string, Cylinder>();
    cylinders.forEach(c => map.set(c.serial.toUpperCase(), c));
    return map;
  }, [cylinders]);

  // Expected cylinders for stock check
  const expectedForStockCheck = useMemo(() => {
    if (mode !== 'stock_check') return [];
    if (stockCheckPlace === 'Plant full') {
      return cylinders.filter(c => c.status === 'plant_full' && !c.missing);
    } else if (stockCheckPlace === 'Plant empty') {
      return cylinders.filter(c => c.status === 'plant_empty' && !c.missing);
    } else {
      return cylinders.filter(c => c.status === 'in_ward' && c.location === stockCheckPlace && !c.missing);
    }
  }, [mode, stockCheckPlace, cylinders]);

  // Handle scanned/captured photo or barcode
  const handlePhotoCaptured = async (photoDataUrl: string, detectedBarcode?: string) => {
    setIsViewfinderOpen(false);
    setIsAnalyzing(true);

    let extractedSerial = detectedBarcode ? detectedBarcode.toUpperCase() : '';
    let extractedGas = 'O₂';
    let extractedHydrotest = '';

    // If no client barcode detected, call Gemini server OCR
    if (!extractedSerial) {
      try {
        const res = await fetch('/api/gemini/cylinder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: photoDataUrl }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.serial) extractedSerial = data.serial.toUpperCase();
          if (data.gas) extractedGas = data.gas;
          if (data.hydrotest) extractedHydrotest = data.hydrotest;
        }
      } catch (err) {
        console.warn('Gemini cylinder OCR failed:', err);
      }
    }

    processPendingSerial(extractedSerial || 'OX', photoDataUrl, extractedGas, extractedHydrotest);
    setIsAnalyzing(false);
  };

  // Process and validate pending serial
  const processPendingSerial = (
    serial: string, 
    photo?: string, 
    detectedGas: string = 'O₂', 
    hydrotest?: string
  ) => {
    const norm = serial.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const existing = cylinderMap.get(norm);

    // Check duplicate in current batch
    const alreadyInBatch = batchItems.some(b => b.serial === norm);
    if (alreadyInBatch) {
      alert(t('already_scanned_batch', lang, { serial: norm }));
      return;
    }

    // Exchange validation: reject full with same serial as empty
    if (mode === 'exchange' && exchangeStep === 'scan_full') {
      if (norm === currentExchangeEmptySerial) {
        alert(t('exchange_same_serial_error', lang));
        return;
      }
    }

    // Determine target gas & kind
    let targetKind = existing ? existing.type : defaultNewKind;
    let targetGas = existing ? existing.gas : (detectedGas as any);

    // Warnings and error checks
    let warningMismatch: string | undefined = undefined;
    let blockError: string | undefined = undefined;

    // Hydrotest check on issue / exchange full: block if overdue!
    if ((mode === 'issue' || (mode === 'exchange' && exchangeStep === 'scan_full')) && existing?.nextTest) {
      const today = new Date().toISOString().slice(0, 7);
      if (existing.nextTest < today) {
        blockError = t('hydrotest_blocked_error', lang, { date: existing.nextTest });
      }
    }

    // Location mismatch check
    if (existing) {
      if (mode === 'receive' && existing.status !== 'at_supplier') {
        warningMismatch = t('wrong_place_warning', lang, { expected: existing.location });
      } else if (mode === 'issue' && existing.status !== 'plant_full') {
        warningMismatch = t('wrong_place_warning', lang, { expected: existing.location });
      } else if (mode === 'return' && existing.status !== 'in_ward') {
        warningMismatch = t('wrong_place_warning', lang, { expected: existing.location });
      } else if (mode === 'send' && existing.status !== 'plant_empty' && existing.status !== 'faulty') {
        warningMismatch = t('wrong_place_warning', lang, { expected: existing.location });
      } else if (mode === 'exchange' && exchangeStep === 'scan_empty' && existing.status !== 'in_ward') {
        warningMismatch = t('wrong_place_warning', lang, { expected: existing.location });
      } else if (mode === 'exchange' && exchangeStep === 'scan_full' && existing.status !== 'plant_full') {
        warningMismatch = t('wrong_place_warning', lang, { expected: existing.location });
      }
    }

    setConfirmPendingItem({
      serial: norm,
      rawSerial: norm,
      photo,
      gas: targetGas,
      kind: targetKind,
      hydrotest: hydrotest || existing?.nextTest,
      expectedStatus: existing?.status,
      expectedLocation: existing?.location,
      warningMismatch,
      blockError,
    });
  };

  // Add confirmed item to batch
  const handleConfirmAdd = () => {
    if (!confirmPendingItem) return;
    const { serial, kind, photo, warningMismatch } = confirmPendingItem;
    const existing = cylinderMap.get(serial);

    if (mode === 'receive') {
      setBatchItems(prev => [
        ...prev,
        {
          serial,
          kind,
          photo,
          fromStatus: existing ? existing.status : 'at_supplier',
          toStatus: 'plant_full',
          fromLocation: existing ? existing.location : 'Supplier',
          toLocation: 'Plant full',
          action: existing ? 'receive_full' : 'register',
          note: warningMismatch || (challanNumber ? `Challan: ${challanNumber}` : undefined),
        }
      ]);
    } else if (mode === 'issue') {
      setBatchItems(prev => [
        ...prev,
        {
          serial,
          kind,
          photo,
          fromStatus: existing ? existing.status : 'plant_full',
          toStatus: 'in_ward',
          fromLocation: existing ? existing.location : 'Plant full',
          toLocation: selectedWard,
          action: 'issue',
          note: warningMismatch,
        }
      ]);
    } else if (mode === 'return') {
      const wardOrigin = existing?.location || 'Ward';
      setBatchItems(prev => [
        ...prev,
        {
          serial,
          kind,
          photo,
          fromStatus: existing ? existing.status : 'in_ward',
          toStatus: 'plant_empty',
          fromLocation: wardOrigin,
          toLocation: 'Plant empty',
          action: 'return_empty',
          note: warningMismatch,
        }
      ]);
    } else if (mode === 'send') {
      setBatchItems(prev => [
        ...prev,
        {
          serial,
          kind,
          photo,
          fromStatus: existing ? existing.status : 'plant_empty',
          toStatus: 'at_supplier',
          fromLocation: existing ? existing.location : 'Plant empty',
          toLocation: 'At supplier',
          action: 'send_refill',
          note: warningMismatch || (challanNumber ? `Challan: ${challanNumber}` : undefined),
        }
      ]);
    } else if (mode === 'exchange') {
      if (exchangeStep === 'scan_empty') {
        const detectedWard = existing?.location || selectedWard;
        setCurrentExchangeEmptySerial(serial);
        setCurrentExchangeWard(detectedWard);

        // Record returned empty
        setBatchItems(prev => [
          ...prev,
          {
            serial,
            kind,
            photo,
            fromStatus: existing ? existing.status : 'in_ward',
            toStatus: 'plant_empty',
            fromLocation: detectedWard,
            toLocation: 'Plant empty',
            action: 'return_empty',
            isExchangeEmpty: true,
            linkedWard: detectedWard,
            note: `Exchange at ${detectedWard}`,
          }
        ]);
        // Switch to step 2: scan full
        setExchangeStep('scan_full');
      } else {
        // Step 2: Full cylinder issued to same ward
        const ward = currentExchangeWard || selectedWard;
        setBatchItems(prev => [
          ...prev,
          {
            serial,
            kind,
            photo,
            fromStatus: existing ? existing.status : 'plant_full',
            toStatus: 'in_ward',
            fromLocation: existing ? existing.location : 'Plant full',
            toLocation: ward,
            action: 'issue',
            isExchangeFull: true,
            linkedWard: ward,
            note: `Exchange at ${ward}`,
          }
        ]);
        // Reset for next pair
        setExchangeStep('scan_empty');
        setCurrentExchangeEmptySerial(null);
        setCurrentExchangeWard(null);
      }
    } else if (mode === 'faulty') {
      setBatchItems(prev => [
        ...prev,
        {
          serial,
          kind,
          photo,
          fromStatus: existing ? existing.status : 'plant_full',
          toStatus: 'faulty',
          fromLocation: existing ? existing.location : 'Plant',
          toLocation: 'Faulty Bay',
          action: 'flag',
          note: `Reason: ${faultReason}. ${faultDetails}`.trim(),
        }
      ]);
    } else if (mode === 'stock_check') {
      const match = expectedForStockCheck.some(c => c.serial === serial);
      setBatchItems(prev => [
        ...prev,
        {
          serial,
          kind,
          photo,
          fromStatus: existing ? existing.status : (stockCheckPlace === 'Plant full' ? 'plant_full' : (stockCheckPlace === 'Plant empty' ? 'plant_empty' : 'in_ward')),
          toStatus: stockCheckPlace === 'Plant full' ? 'plant_full' : (stockCheckPlace === 'Plant empty' ? 'plant_empty' : 'in_ward'),
          toLocation: stockCheckPlace,
          action: match ? 'count' : 'found',
          note: match ? 'Stock check verified' : `Found unexpectedly during stock check at ${stockCheckPlace}`,
        }
      ]);
    }

    setConfirmPendingItem(null);
  };

  // Finish movement and commit batch to Firestore
  const handleFinishBatch = async () => {
    if (batchItems.length === 0 && uncountedMissingMarked.length === 0) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedCylinders: Cylinder[] = [];
      const events: Omit<CylinderEvent, 'id'>[] = [];
      const nowIso = new Date().toISOString();

      // Process batch items
      batchItems.forEach(item => {
        const existing = cylinderMap.get(item.serial);
        const meta = CYLINDER_KINDS[item.kind];

        const updated: Cylinder = {
          serial: item.serial,
          gas: meta.gas,
          type: item.kind,
          valve: meta.valve,
          owner: meta.owner,
          status: item.toStatus,
          location: item.toLocation,
          nextTest: existing?.nextTest || (confirmPendingItem?.hydrotest || '2028-12'),
          lastTs: nowIso,
          missing: false,
          faultNote: item.toStatus === 'faulty' ? item.note : existing?.faultNote,
          faultPhoto: item.toStatus === 'faulty' ? item.photo : existing?.faultPhoto,
        };
        updatedCylinders.push(updated);

        events.push({
          cylinderId: item.serial,
          serial: item.serial,
          gas: meta.gas,
          type: item.kind,
          action: item.action,
          from: item.fromStatus,
          to: item.toStatus,
          fromLocation: item.fromLocation,
          location: item.toLocation,
          doc: challanNumber.trim() || undefined,
          note: item.note,
          ts: nowIso,
          by: userEmail,
          photo: item.photo,
        });
      });

      // In stock check, mark uncounted missing cylinders
      uncountedMissingMarked.forEach(serial => {
        const existing = cylinderMap.get(serial);
        if (existing) {
          updatedCylinders.push({
            ...existing,
            missing: true,
            lastTs: nowIso,
          });
          events.push({
            cylinderId: serial,
            serial: serial,
            gas: existing.gas,
            type: existing.type,
            action: 'missing',
            from: existing.status,
            to: existing.status,
            fromLocation: existing.location,
            location: existing.location,
            note: `Marked missing during physical stock check at ${stockCheckPlace}`,
            ts: nowIso,
            by: userEmail,
          });
        }
      });

      await onSaveBatch(updatedCylinders, events);
      onClose();
    } catch (err) {
      console.error('Error committing batch:', err);
      alert('Error saving records. Please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add new ward inline
  const handleAddNewWard = async () => {
    if (!newWardName.trim()) return;
    try {
      await onAddWard(newWardName.trim());
      setSelectedWard(newWardName.trim());
      setShowAddWardDialog(false);
      setNewWardName('');
    } catch (err) {
      console.error('Failed to add ward:', err);
    }
  };

  // Stock check stats
  const stockCheckStats = useMemo(() => {
    if (mode !== 'stock_check') return null;
    const expected = expectedForStockCheck.length;
    const counted = batchItems.length;
    const matching = batchItems.filter(b => expectedForStockCheck.some(e => e.serial === b.serial)).length;
    const uncounted = expectedForStockCheck.filter(e => !batchItems.some(b => b.serial === e.serial) && !uncountedMissingMarked.includes(e.serial));
    return { expected, counted, matching, uncounted };
  }, [mode, expectedForStockCheck, batchItems, uncountedMissingMarked]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 overflow-y-auto">
      <div className="w-full max-w-lg bg-slate-900 border-2 border-slate-700 rounded-3xl p-5 text-slate-100 shadow-2xl flex flex-col gap-4 my-auto max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-black text-white">
              {mode === 'receive' && t('receive_from_supplier', lang)}
              {mode === 'issue' && t('issue_to_ward', lang)}
              {mode === 'return' && t('return_from_ward', lang)}
              {mode === 'send' && t('send_to_supplier', lang)}
              {mode === 'exchange' && t('exchange_at_ward', lang)}
              {mode === 'faulty' && t('mark_faulty', lang)}
              {mode === 'stock_check' && t('stock_check', lang)}
            </h2>
            <p className="text-xs text-sky-400 font-semibold">
              {mode === 'receive' && t('receive_sub', lang)}
              {mode === 'issue' && t('issue_sub', lang)}
              {mode === 'return' && t('return_sub', lang)}
              {mode === 'send' && t('send_sub', lang)}
              {mode === 'exchange' && (exchangeStep === 'scan_empty' ? 'Step 1: Scan EMPTY cylinder' : 'Step 2: Scan replacement FULL cylinder')}
              {mode === 'stock_check' && `Verifying: ${stockCheckPlace}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 min-w-[48px] min-h-[48px] flex items-center justify-center"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Mode-Specific Context Selection */}
        {/* 1. Issue: Tap ward once, then scan cylinders */}
        {mode === 'issue' && (
          <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-300">
                {lang === 'hi' ? 'गंतव्य वार्ड चुनें:' : 'Select Destination Ward:'}
              </label>
              <button
                onClick={() => setShowAddWardDialog(true)}
                className="text-xs font-bold text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('add_ward_button', lang)}</span>
              </button>
            </div>

            {/* Ward list with 30-day activity sort */}
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
              {wards.map(w => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setSelectedWard(w)}
                  className={`px-3 py-2 rounded-xl text-xs font-black transition cursor-pointer touch-manipulation min-h-[44px] ${
                    selectedWard === w
                      ? 'bg-sky-500 text-slate-950 shadow-md ring-2 ring-sky-300'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 2. Stock Check: Choose location */}
        {mode === 'stock_check' && (
          <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-300">
              {lang === 'hi' ? 'सत्यापन स्थान चुनें:' : 'Choose Location to Check:'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setStockCheckPlace('Plant full')}
                className={`py-2 px-3 rounded-xl text-xs font-black min-h-[44px] transition ${
                  stockCheckPlace === 'Plant full' ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-slate-300'
                }`}
              >
                {t('place_plant_full', lang)}
              </button>
              <button
                onClick={() => setStockCheckPlace('Plant empty')}
                className={`py-2 px-3 rounded-xl text-xs font-black min-h-[44px] transition ${
                  stockCheckPlace === 'Plant empty' ? 'bg-amber-500 text-black' : 'bg-slate-800 text-slate-300'
                }`}
              >
                {t('place_plant_empty', lang)}
              </button>
            </div>
            {/* Wards selector for stock check */}
            <div className="mt-1">
              <span className="text-[10px] font-bold text-slate-400 block mb-1">
                {lang === 'hi' ? 'या किसी वार्ड का चेक करें:' : 'Or Select Ward to Check:'}
              </span>
              <select
                value={stockCheckPlace}
                onChange={e => setStockCheckPlace(e.target.value)}
                className="w-full min-h-[44px] bg-slate-800 border border-slate-700 rounded-xl px-3 text-xs font-bold text-white outline-none"
              >
                <option value="Plant full">{t('place_plant_full', lang)}</option>
                <option value="Plant empty">{t('place_plant_empty', lang)}</option>
                {wards.map(w => (
                  <option key={w} value={w}>Ward: {w}</option>
                ))}
              </select>
            </div>

            {/* Live Counter Display */}
            {stockCheckStats && (
              <div className="mt-2 p-3 rounded-xl bg-slate-900 border border-slate-800 flex justify-around text-center">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">App Expects</span>
                  <span className="text-lg font-black text-sky-400">{stockCheckStats.expected}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">Counted</span>
                  <span className="text-lg font-black text-emerald-400">{stockCheckStats.counted}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">Matching</span>
                  <span className="text-lg font-black text-white">{stockCheckStats.matching}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. Challan input for Receive or Send */}
        {(mode === 'receive' || mode === 'send') && (
          <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
            <label className="text-xs font-bold text-slate-300 block mb-1 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-sky-400" />
              {lang === 'hi' ? 'चालान / गेट पास नंबर (वैकल्पिक):' : 'Challan / Gate Pass No (Optional):'}
            </label>
            <input
              type="text"
              value={challanNumber}
              onChange={e => setChallanNumber(e.target.value.toUpperCase())}
              className="w-full min-h-[48px] bg-slate-900 border border-slate-700 rounded-xl px-3 text-sm font-bold text-white outline-none"
              placeholder="e.g. CH-2026-9042"
            />
          </div>
        )}

        {/* 4. Fault Reason for Faulty */}
        {mode === 'faulty' && (
          <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex flex-col gap-2">
            <label className="text-xs font-bold text-amber-400 block">
              {lang === 'hi' ? 'खराबी का कारण चुनें:' : 'Fault Reason:'}
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                'valve leak',
                'damaged valve',
                'seal missing',
                'dent or corrosion',
                'hydrotest due',
                'wrong colour',
                'other'
              ].map(reason => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setFaultReason(reason)}
                  className={`px-2 py-2 rounded-xl text-xs font-bold capitalize min-h-[44px] transition ${
                    faultReason === reason ? 'bg-amber-500 text-black font-black' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={faultDetails}
              onChange={e => setFaultDetails(e.target.value)}
              className="w-full min-h-[44px] bg-slate-900 border border-slate-700 rounded-xl px-3 text-xs text-white outline-none mt-1"
              placeholder="Observation notes..."
            />
          </div>
        )}

        {/* Dropdown: "New numbers are added as: <kind>" remembered on phone */}
        <div className="flex items-center justify-between px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs">
          <span className="text-slate-400 font-bold">{t('new_serials_kind', lang)}</span>
          <select
            value={defaultNewKind}
            onChange={e => {
              const k = e.target.value as CylinderKind;
              setDefaultNewKind(k);
              localStorage.setItem('mgps_default_kind', k);
            }}
            className="bg-slate-800 border border-slate-700 text-sky-400 font-black rounded-lg px-2 py-1 text-xs outline-none"
          >
            {Object.keys(CYLINDER_KINDS).map(k => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>

        {/* Big Scan Button (Min 56px touch target) */}
        <div className="flex gap-2">
          <button
            onClick={() => setIsViewfinderOpen(true)}
            className={`flex-1 min-h-[56px] py-3 px-4 rounded-2xl font-black text-base shadow-xl flex items-center justify-center gap-2 transition cursor-pointer touch-manipulation ${
              mode === 'exchange'
                ? (exchangeStep === 'scan_empty' ? 'bg-amber-500 hover:bg-amber-400 text-black' : 'bg-emerald-500 hover:bg-emerald-400 text-black')
                : 'bg-sky-500 hover:bg-sky-400 text-black'
            }`}
          >
            <Camera className="w-6 h-6 stroke-[2.5]" />
            <span>
              {mode === 'exchange'
                ? (exchangeStep === 'scan_empty' ? (lang === 'hi' ? 'खाली स्कैन करें' : 'Scan EMPTY') : (lang === 'hi' ? 'भरा स्कैन करें' : 'Scan FULL'))
                : (lang === 'hi' ? 'सिलेंडर स्कैन करें' : 'Scan Cylinder')}
            </span>
          </button>

          <button
            onClick={() => setShowManualInput(!showManualInput)}
            className="min-h-[56px] min-w-[56px] rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center cursor-pointer touch-manipulation"
            title={t('type_instead', lang)}
          >
            <span className="text-xs font-bold">123</span>
          </button>
        </div>

        {/* Manual Serial Input Row */}
        {showManualInput && (
          <div className="flex gap-2 bg-slate-950 p-2 rounded-2xl border border-slate-800">
            <input
              type="text"
              value={manualSerialInput}
              onChange={e => setManualSerialInput(e.target.value.toUpperCase())}
              placeholder="Enter serial (e.g. O2A-F01)"
              className="flex-1 min-h-[48px] bg-slate-900 border border-slate-700 rounded-xl px-3 font-mono font-black text-base text-white uppercase outline-none"
            />
            <button
              onClick={() => {
                if (manualSerialInput.trim()) {
                  processPendingSerial(manualSerialInput.trim());
                  setManualSerialInput('');
                }
              }}
              className="min-h-[48px] px-4 rounded-xl bg-sky-600 text-white font-black text-sm"
            >
              Add
            </button>
          </div>
        )}

        {/* Running Batch List: "Recorded this time (N)" */}
        <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-white flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{t('recorded_this_batch', lang, { n: batchItems.length })}</span>
            </span>
            {batchItems.length > 0 && (
              <button
                onClick={() => setBatchItems([])}
                className="text-[11px] text-red-400 hover:text-red-300 font-bold"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
            {batchItems.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center">
                {lang === 'hi' ? 'अभी तक कोई सिलेंडर स्कैन नहीं किया गया।' : 'No cylinders scanned yet in this batch.'}
              </p>
            ) : (
              batchItems.map((item, idx) => (
                <div
                  key={idx}
                  className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-white text-sm">{item.serial}</span>
                    <span className="text-[10px] bg-slate-800 text-sky-300 px-1.5 py-0.5 rounded font-bold">
                      {item.kind}
                    </span>
                    {item.isExchangeEmpty && (
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1 rounded font-bold">EMPTY</span>
                    )}
                    {item.isExchangeFull && (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1 rounded font-bold">FULL</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 font-medium">{item.toLocation}</span>
                    <button
                      onClick={() => setBatchItems(prev => prev.filter((_, i) => i !== idx))}
                      className="text-slate-500 hover:text-red-400 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Stock check uncounted serials on Finish */}
        {mode === 'stock_check' && stockCheckStats && stockCheckStats.uncounted.length > 0 && (
          <div className="bg-red-950/40 border border-red-500/50 rounded-2xl p-3 flex flex-col gap-2">
            <span className="text-xs font-black text-red-300">
              {t('uncounted_cylinders', lang)} ({stockCheckStats.uncounted.length})
            </span>
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
              {stockCheckStats.uncounted.map(c => (
                <span key={c.serial} className="px-2 py-0.5 rounded bg-slate-900 text-red-200 font-mono text-[11px] font-bold">
                  {c.serial}
                </span>
              ))}
            </div>
            <button
              onClick={() => {
                const uncountedSerials = stockCheckStats.uncounted.map(c => c.serial);
                setUncountedMissingMarked(prev => [...prev, ...uncountedSerials]);
              }}
              className="mt-1 py-2 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs transition"
            >
              {t('mark_as_missing', lang)} ({stockCheckStats.uncounted.length})
            </button>
          </div>
        )}

        {/* Big Finish Button: Minimum 56px */}
        <button
          onClick={handleFinishBatch}
          disabled={isSubmitting || (batchItems.length === 0 && uncountedMissingMarked.length === 0)}
          className="min-h-[56px] w-full rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-40 text-slate-950 font-black text-lg shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 transition cursor-pointer touch-manipulation"
        >
          {isSubmitting ? (
            <RefreshCw className="w-6 h-6 animate-spin text-slate-950" />
          ) : (
            <>
              <Check className="w-6 h-6 stroke-[3]" />
              <span>{t('finish', lang)} ({batchItems.length})</span>
            </>
          )}
        </button>
      </div>

      {/* Confirmation Step Modal */}
      {confirmPendingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border-2 border-slate-700 p-5 text-slate-100 shadow-2xl flex flex-col gap-4">
            <h3 className="text-base font-black text-white text-center">
              {lang === 'hi' ? 'सिलेंडर की पुष्टि करें' : 'Confirm Cylinder'}
            </h3>

            {/* Photo preview if captured */}
            {confirmPendingItem.photo && (
              <div className="w-full h-32 rounded-xl overflow-hidden bg-black flex items-center justify-center">
                <img src={confirmPendingItem.photo} alt="Scanned" className="h-full object-contain" />
              </div>
            )}

            {/* Large Editable Serial */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">
                {lang === 'hi' ? 'सीरियल नंबर (संपादन योग्य):' : 'Serial Number (Editable):'}
              </label>
              <input
                type="text"
                value={confirmPendingItem.serial}
                onChange={e => setConfirmPendingItem({
                  ...confirmPendingItem,
                  serial: e.target.value.toUpperCase()
                })}
                className="w-full min-h-[56px] text-3xl font-mono font-black text-center bg-slate-950 border-2 border-sky-400 rounded-2xl text-white uppercase outline-none"
              />
            </div>

            {/* Kind & Gas Selector */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Kind</label>
                <select
                  value={confirmPendingItem.kind}
                  onChange={e => setConfirmPendingItem({
                    ...confirmPendingItem,
                    kind: e.target.value as CylinderKind
                  })}
                  className="w-full min-h-[44px] bg-slate-800 border border-slate-700 rounded-xl px-2 text-xs font-bold text-sky-400 outline-none"
                >
                  {Object.keys(CYLINDER_KINDS).map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Next Hydrotest</label>
                <input
                  type="month"
                  value={confirmPendingItem.hydrotest || '2028-12'}
                  onChange={e => setConfirmPendingItem({
                    ...confirmPendingItem,
                    hydrotest: e.target.value
                  })}
                  className="w-full min-h-[44px] bg-slate-800 border border-slate-700 rounded-xl px-2 text-xs font-bold text-white outline-none"
                >
                </input>
              </div>
            </div>

            {/* Orange Warning if in different place than expected */}
            {confirmPendingItem.warningMismatch && (
              <div className="p-3 rounded-xl bg-amber-950/80 border border-amber-500 text-amber-200 text-xs font-semibold flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <span>{confirmPendingItem.warningMismatch}</span>
              </div>
            )}

            {/* Block Error (e.g. Overdue hydrotest) */}
            {confirmPendingItem.blockError && (
              <div className="p-3 rounded-xl bg-red-950/90 border border-red-500 text-red-200 text-xs font-bold flex items-start gap-2">
                <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <span>{confirmPendingItem.blockError}</span>
              </div>
            )}

            {/* Buttons: Big 56px Confirm & Retake */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setConfirmPendingItem(null)}
                className="flex-1 min-h-[56px] rounded-2xl bg-slate-800 hover:bg-slate-700 font-bold text-sm text-slate-300"
              >
                {t('retake', lang)}
              </button>

              <button
                onClick={handleConfirmAdd}
                disabled={!confirmPendingItem.serial.trim() || !!confirmPendingItem.blockError}
                className="flex-[2] min-h-[56px] rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black text-base shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-1.5"
              >
                <Check className="w-5 h-5 stroke-[3]" />
                <span>{t('correct_record', lang)}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Ward Inline Dialog */}
      {showAddWardDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-xs rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl flex flex-col gap-3">
            <h3 className="text-sm font-black text-white">{t('add_ward_button', lang)}</h3>
            <input
              type="text"
              value={newWardName}
              onChange={e => setNewWardName(e.target.value)}
              placeholder="e.g. 6th Floor Oncology"
              className="w-full min-h-[48px] bg-slate-800 border border-slate-700 rounded-xl px-3 text-sm text-white outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddWardDialog(false)}
                className="flex-1 min-h-[44px] rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleAddNewWard}
                disabled={!newWardName.trim()}
                className="flex-1 min-h-[44px] rounded-xl bg-sky-500 text-slate-950 text-xs font-black disabled:opacity-40"
              >
                Add Ward
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Rear Camera Viewfinder */}
      {isViewfinderOpen && (
        <CameraViewfinder
          lang={lang}
          title={lang === 'hi' ? 'सिलेंडर स्कैन करें' : 'Scan Cylinder'}
          subtitle={lang === 'hi' ? 'क्यूआर, बारकोड या शोल्डर सीरियल पर फोकस करें' : 'Focus on QR tag, barcode, or stamped shoulder'}
          onCaptured={(dataUrl, barcode) => handlePhotoCaptured(dataUrl, barcode)}
          onManualInput={() => {
            setIsViewfinderOpen(false);
            setShowManualInput(true);
          }}
          onClose={() => setIsViewfinderOpen(false)}
        />
      )}
    </div>
  );
};
