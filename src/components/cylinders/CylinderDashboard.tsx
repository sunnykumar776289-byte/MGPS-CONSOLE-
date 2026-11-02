import React, { useState, useMemo } from 'react';
import { 
  ArrowRight, 
  Search, 
  AlertTriangle, 
  ShieldAlert, 
  Clock, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  Download, 
  Printer, 
  Settings as SettingsIcon, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  ArrowUpDown, 
  RotateCcw, 
  Building2, 
  Truck, 
  FileSpreadsheet, 
  FileText,
  Boxes,
  Layers,
  HelpCircle
} from 'lucide-react';
import { 
  Language, 
  Role, 
  Cylinder, 
  CylinderEvent, 
  CylinderKind, 
  CYLINDER_KINDS, 
  CylinderStatus 
} from '../../types';
import { t } from '../../i18n/translations';
import { MovementModal, MovementMode } from './MovementModal';

interface Props {
  lang: Language;
  role: Role;
  userEmail: string;
  cylinders: Cylinder[];
  events: CylinderEvent[];
  wards: string[];
  stockMin: Record<CylinderKind, number>;
  onAddWard: (ward: string) => Promise<void>;
  onRemoveWard: (ward: string) => Promise<void>;
  onUpdateStockMin: (kind: CylinderKind, min: number) => Promise<void>;
  onSaveBatch: (updatedCylinders: Cylinder[], newEvents: Omit<CylinderEvent, 'id'>[]) => Promise<void>;
  onUpdateCylinder: (cylinder: Cylinder) => Promise<void>;
  authorizedEmails: string[];
  onAddAuthorizedEmail: (email: string) => Promise<void>;
  onRemoveAuthorizedEmail: (email: string) => Promise<void>;
}

export const CylinderDashboard: React.FC<Props> = ({
  lang,
  role,
  userEmail,
  cylinders,
  events,
  wards,
  stockMin,
  onAddWard,
  onRemoveWard,
  onUpdateStockMin,
  onSaveBatch,
  onUpdateCylinder,
  authorizedEmails,
  onAddAuthorizedEmail,
  onRemoveAuthorizedEmail,
}) => {
  // Selected kind filter (all or specific kind)
  const [selectedKind, setSelectedKind] = useState<CylinderKind | 'ALL'>('ALL');

  // Loop modal inspector: tap box in loop to inspect its serials
  const [inspectBox, setInspectBox] = useState<CylinderStatus | null>(null);

  // Active movement modal
  const [activeMovementMode, setActiveMovementMode] = useState<MovementMode | null>(null);
  const [movementPreselectedWard, setMovementPreselectedWard] = useState<string | undefined>();
  const [movementPreselectedPlace, setMovementPreselectedPlace] = useState<string | undefined>();

  // Cylinder finder search query
  const [searchQuery, setSearchQuery] = useState('');
  const [editingHydrotestSerial, setEditingHydrotestSerial] = useState<string | null>(null);
  const [editHydrotestValue, setEditHydrotestValue] = useState('');

  // Selected ward drill-down in "Cylinders in wards"
  const [inspectedWard, setInspectedWard] = useState<string | null>(null);

  // Collapsed sections
  const [reportsExpanded, setReportsExpanded] = useState(false);
  const [setupExpanded, setSetupExpanded] = useState(false);

  // Admin new ward / email input
  const [adminNewWard, setAdminNewWard] = useState('');
  const [adminNewEmail, setAdminNewEmail] = useState('');

  // Filter cylinders by selected kind
  const filteredCylinders = useMemo(() => {
    if (selectedKind === 'ALL') return cylinders;
    return cylinders.filter(c => c.type === selectedKind);
  }, [cylinders, selectedKind]);

  // Counts by loop location
  const loopCounts = useMemo(() => {
    const full = filteredCylinders.filter(c => c.status === 'plant_full' && !c.missing).length;
    const inWard = filteredCylinders.filter(c => c.status === 'in_ward' && !c.missing).length;
    const empty = filteredCylinders.filter(c => c.status === 'plant_empty' && !c.missing).length;
    const atSupplier = filteredCylinders.filter(c => c.status === 'at_supplier' && !c.missing).length;
    const faulty = filteredCylinders.filter(c => c.status === 'faulty' && !c.missing).length;
    const missing = filteredCylinders.filter(c => c.missing).length;
    return { full, inWard, empty, atSupplier, faulty, missing };
  }, [filteredCylinders]);

  // Oldest full cylinder to issue first
  const oldestFullCylinder = useMemo(() => {
    const fulls = filteredCylinders
      .filter(c => c.status === 'plant_full' && !c.missing)
      .sort((a, b) => new Date(a.lastTs).getTime() - new Date(b.lastTs).getTime());
    return fulls[0] || null;
  }, [filteredCylinders]);

  // Days of full stock: full / average issued per day over last 14 days
  const daysOfFullStock = useMemo(() => {
    if (selectedKind === 'ALL') return null;
    const fourteenDaysAgo = Date.now() - 14 * 86400 * 1000;
    const issueEventsIn14d = events.filter(e => {
      return e.type === selectedKind && e.action === 'issue' && new Date(e.ts).getTime() >= fourteenDaysAgo;
    });
    const avgDailyIssued = Math.max(0.5, issueEventsIn14d.length / 14);
    const fullCount = loopCounts.full;
    return Math.round((fullCount / avgDailyIssued) * 10) / 10;
  }, [selectedKind, events, loopCounts.full]);

  // Ward 30-day cylinder activity calculation for sorting ward buttons
  const wardActivityMap = useMemo(() => {
    const thirtyDaysAgo = Date.now() - 30 * 86400 * 1000;
    const counts: Record<string, number> = {};
    wards.forEach(w => counts[w] = 0);

    events.forEach(e => {
      if (e.action === 'issue' && e.location && new Date(e.ts).getTime() >= thirtyDaysAgo) {
        counts[e.location] = (counts[e.location] || 0) + 1;
      }
    });
    return counts;
  }, [wards, events]);

  // Sorted wards (highest 30-day issued count first)
  const sortedWards = useMemo(() => {
    return [...wards].sort((a, b) => (wardActivityMap[b] || 0) - (wardActivityMap[a] || 0));
  }, [wards, wardActivityMap]);

  // Cylinders per ward stats
  const wardStats = useMemo(() => {
    const stats: Record<string, { count: number; oldestDays: number; missing: number; serials: Cylinder[] }> = {};
    wards.forEach(w => {
      stats[w] = { count: 0, oldestDays: 0, missing: 0, serials: [] };
    });

    cylinders.forEach(c => {
      if (c.status === 'in_ward' && c.location) {
        if (!stats[c.location]) {
          stats[c.location] = { count: 0, oldestDays: 0, missing: 0, serials: [] };
        }
        if (c.missing) {
          stats[c.location].missing++;
        } else {
          stats[c.location].count++;
          stats[c.location].serials.push(c);
          const daysHeld = Math.max(0, Math.floor((Date.now() - new Date(c.lastTs).getTime()) / 86400000));
          if (daysHeld > stats[c.location].oldestDays) {
            stats[c.location].oldestDays = daysHeld;
          }
        }
      }
    });
    return stats;
  }, [wards, cylinders]);

  // "Needs Attention" Alerts Calculation
  const attentionAlerts = useMemo(() => {
    const today = new Date().toISOString().slice(0, 7);
    const in60Days = new Date(Date.now() + 60 * 86400 * 1000).toISOString().slice(0, 7);
    const fourteenDaysAgo = Date.now() - 14 * 86400 * 1000;

    const missingList = cylinders.filter(c => c.missing);
    const overdueHydrotest = cylinders.filter(c => c.nextTest && c.nextTest < today && !c.missing);
    const dueSoonHydrotest = cylinders.filter(c => c.nextTest && c.nextTest >= today && c.nextTest <= in60Days && !c.missing);
    const faultyList = cylinders.filter(c => c.status === 'faulty');
    const staleInWard = cylinders.filter(c => c.status === 'in_ward' && !c.missing && new Date(c.lastTs).getTime() < fourteenDaysAgo);
    const unknownWard = cylinders.filter(c => c.status === 'in_ward' && (!c.location || !wards.includes(c.location)));
    const missingHydrotestDate = cylinders.filter(c => !c.nextTest);

    // Low stock checks per kind
    const lowStockKinds: Array<{ kind: CylinderKind; full: number; min: number }> = [];
    Object.keys(CYLINDER_KINDS).forEach(k => {
      const kind = k as CylinderKind;
      const min = stockMin[kind] || 5;
      const full = cylinders.filter(c => c.type === kind && c.status === 'plant_full' && !c.missing).length;
      if (full < min) {
        lowStockKinds.push({ kind, full, min });
      }
    });

    return {
      missingList,
      overdueHydrotest,
      dueSoonHydrotest,
      faultyList,
      staleInWard,
      unknownWard,
      missingHydrotestDate,
      lowStockKinds,
      totalCount: missingList.length + overdueHydrotest.length + faultyList.length + staleInWard.length + lowStockKinds.length
    };
  }, [cylinders, wards, stockMin]);

  // Search Results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.trim().toUpperCase();
    return cylinders.filter(c => c.serial.toUpperCase().includes(q));
  }, [searchQuery, cylinders]);

  // Supplier D-type holding rental report
  const supplierRentalHolding = useMemo(() => {
    const dTypes = cylinders.filter(c => (c.type === 'O₂ D' || c.type === 'N₂O D' || c.type === 'CO₂ D') && c.status !== 'at_supplier');
    const onSiteCount = dTypes.length;
    let oldestDays = 0;
    dTypes.forEach(c => {
      const days = Math.floor((Date.now() - new Date(c.lastTs).getTime()) / 86400000);
      if (days > oldestDays) oldestDays = days;
    });
    return { onSiteCount, oldestDays, dTypes };
  }, [cylinders]);

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Serial', 'Kind', 'Gas', 'Valve', 'Owner', 'Status', 'Location', 'Next Hydrotest', 'Last Updated', 'Missing', 'Fault Note'];
    const rows = cylinders.map(c => [
      c.serial,
      c.type,
      c.gas,
      c.valve,
      c.owner,
      c.status,
      `"${c.location || ''}"`,
      c.nextTest || '',
      c.lastTs,
      c.missing ? 'YES' : 'NO',
      `"${c.faultNote || ''}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `mgps_cylinders_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-5 p-3 pb-24 max-w-2xl mx-auto w-full">
      {/* 1. "Where every cylinder is": The 4-State Loop Diagram */}
      <div className="bg-slate-950 border-2 border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-emerald-400" />
            <span>{t('where_every_cylinder_is', lang)}</span>
          </h2>

          {/* Kind Filter Pill */}
          <select
            value={selectedKind}
            onChange={e => setSelectedKind(e.target.value as any)}
            className="bg-slate-900 border border-slate-700 text-sky-400 font-black rounded-xl px-2.5 py-1 text-xs outline-none"
          >
            <option value="ALL">All Types ({cylinders.length})</option>
            {Object.keys(CYLINDER_KINDS).map(k => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>

        {/* 4 Big Boxes Loop with Arrows */}
        <div className="grid grid-cols-2 gap-3 relative">
          {/* Box 1: Plant full */}
          <button
            onClick={() => setInspectBox(inspectBox === 'plant_full' ? null : 'plant_full')}
            className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center text-center transition cursor-pointer touch-manipulation min-h-[96px] ${
              inspectBox === 'plant_full' ? 'bg-sky-950 border-sky-400 ring-2 ring-sky-300' : 'bg-slate-900 border-slate-800 hover:border-sky-500'
            }`}
          >
            <span className="text-xs font-black text-sky-400 uppercase tracking-wide">1. {t('place_plant_full', lang)}</span>
            <span className="text-3xl font-black text-white mt-1">{loopCounts.full}</span>
            <span className="text-[10px] text-slate-400 font-semibold">{lang === 'hi' ? 'भरे सिलेंडर' : 'Ready to issue'}</span>
          </button>

          {/* Box 2: In wards */}
          <button
            onClick={() => setInspectBox(inspectBox === 'in_ward' ? null : 'in_ward')}
            className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center text-center transition cursor-pointer touch-manipulation min-h-[96px] ${
              inspectBox === 'in_ward' ? 'bg-emerald-950 border-emerald-400 ring-2 ring-emerald-300' : 'bg-slate-900 border-slate-800 hover:border-emerald-500'
            }`}
          >
            <span className="text-xs font-black text-emerald-400 uppercase tracking-wide">2. {t('place_in_ward', lang)}</span>
            <span className="text-3xl font-black text-white mt-1">{loopCounts.inWard}</span>
            <span className="text-[10px] text-slate-400 font-semibold">{lang === 'hi' ? 'वार्डों में सक्रिय' : 'Active in wards'}</span>
          </button>

          {/* Box 4: At supplier (Left bottom in loop) */}
          <button
            onClick={() => setInspectBox(inspectBox === 'at_supplier' ? null : 'at_supplier')}
            className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center text-center transition cursor-pointer touch-manipulation min-h-[96px] ${
              inspectBox === 'at_supplier' ? 'bg-indigo-950 border-indigo-400 ring-2 ring-indigo-300' : 'bg-slate-900 border-slate-800 hover:border-indigo-500'
            }`}
          >
            <span className="text-xs font-black text-indigo-400 uppercase tracking-wide">4. {t('place_at_supplier', lang)}</span>
            <span className="text-3xl font-black text-white mt-1">{loopCounts.atSupplier}</span>
            <span className="text-[10px] text-slate-400 font-semibold">{lang === 'hi' ? 'रिफिलिंग हेतु सप्लायर' : 'Out for refilling'}</span>
          </button>

          {/* Box 3: Plant empty (Right bottom in loop) */}
          <button
            onClick={() => setInspectBox(inspectBox === 'plant_empty' ? null : 'plant_empty')}
            className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center text-center transition cursor-pointer touch-manipulation min-h-[96px] ${
              inspectBox === 'plant_empty' ? 'bg-amber-950 border-amber-400 ring-2 ring-amber-300' : 'bg-slate-900 border-slate-800 hover:border-amber-500'
            }`}
          >
            <span className="text-xs font-black text-amber-400 uppercase tracking-wide">3. {t('place_plant_empty', lang)}</span>
            <span className="text-3xl font-black text-white mt-1">{loopCounts.empty}</span>
            <span className="text-[10px] text-slate-400 font-semibold">{lang === 'hi' ? 'खाली प्लांट में' : 'Empty awaiting send'}</span>
          </button>
        </div>

        {/* 5th Place: Faulty Pill */}
        <div className="flex items-center justify-between px-3 py-2 bg-slate-900 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-xs font-bold text-slate-300">5. {t('place_faulty', lang)}:</span>
            <span className="text-xs font-black text-red-400">{loopCounts.faulty}</span>
          </div>

          {loopCounts.missing > 0 && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{loopCounts.missing} {t('alert_missing', lang)}</span>
            </div>
          )}
        </div>

        {/* Selected Type Guidance: Days of full stock and Issue First */}
        {selectedKind !== 'ALL' && (
          <div className="bg-sky-950/40 border border-sky-400/50 rounded-2xl p-3.5 flex flex-col gap-1 text-xs">
            <div className="flex items-center justify-between font-black">
              <span className="text-sky-300">{t('days_of_stock', lang)}:</span>
              <span className="text-base text-white">{daysOfFullStock !== null ? `${daysOfFullStock} days` : 'N/A'}</span>
            </div>
            {oldestFullCylinder && (
              <div className="flex items-center justify-between pt-1 border-t border-sky-500/20">
                <span className="text-slate-300 font-semibold">{t('issue_first', lang)}</span>
                <span className="font-mono font-black text-amber-400 text-sm bg-slate-900 px-2 py-0.5 rounded">
                  {oldestFullCylinder.serial}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Inspected Serials in Tapped Loop Box (Oldest first) */}
        {inspectBox && (
          <div className="p-3 bg-slate-900 border border-slate-700 rounded-2xl flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-white uppercase">
                {inspectBox === 'plant_full' && t('place_plant_full', lang)}
                {inspectBox === 'in_ward' && t('place_in_ward', lang)}
                {inspectBox === 'plant_empty' && t('place_plant_empty', lang)}
                {inspectBox === 'at_supplier' && t('place_at_supplier', lang)}
                {' '} ({filteredCylinders.filter(c => c.status === inspectBox && !c.missing).length}) — Oldest First
              </span>
              <button onClick={() => setInspectBox(null)} className="text-xs text-slate-400 hover:text-white font-bold">
                ✕
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
              {filteredCylinders
                .filter(c => c.status === inspectBox && !c.missing)
                .sort((a, b) => new Date(a.lastTs).getTime() - new Date(b.lastTs).getTime())
                .map(c => {
                  const daysHeld = Math.floor((Date.now() - new Date(c.lastTs).getTime()) / 86400000);
                  return (
                    <div
                      key={c.serial}
                      className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono flex items-center gap-1.5"
                    >
                      <span className="font-black text-white">{c.serial}</span>
                      <span className="text-[9px] text-slate-500">({daysHeld}d)</span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Stock Table per kind (Full, Wards, Empty, Supplier with 'S' marker) */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-bold text-[10px] uppercase">
                <th className="py-2 px-1">Kind</th>
                <th className="py-2 px-1 text-center text-sky-400">Full</th>
                <th className="py-2 px-1 text-center text-emerald-400">Wards</th>
                <th className="py-2 px-1 text-center text-amber-400">Empty</th>
                <th className="py-2 px-1 text-center text-indigo-400">Supplier</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(CYLINDER_KINDS).map(k => {
                const kind = k as CylinderKind;
                const meta = CYLINDER_KINDS[kind];
                const kindCyls = cylinders.filter(c => c.type === kind);
                const full = kindCyls.filter(c => c.status === 'plant_full' && !c.missing).length;
                const ward = kindCyls.filter(c => c.status === 'in_ward' && !c.missing).length;
                const empty = kindCyls.filter(c => c.status === 'plant_empty' && !c.missing).length;
                const supplier = kindCyls.filter(c => c.status === 'at_supplier' && !c.missing).length;

                return (
                  <tr
                    key={kind}
                    onClick={() => setSelectedKind(selectedKind === kind ? 'ALL' : kind)}
                    className={`border-b border-slate-800/60 cursor-pointer transition ${
                      selectedKind === kind ? 'bg-sky-950/40 font-black' : 'hover:bg-slate-900/60'
                    }`}
                  >
                    <td className="py-2 px-1 font-bold flex items-center gap-1">
                      <span className="text-white">{kind}</span>
                      {meta.isSupplierOwned && (
                        <span className="text-[9px] font-black bg-indigo-500/30 text-indigo-300 px-1 rounded" title="Supplier Owned">
                          S
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-1 text-center font-mono font-bold text-sky-300">{full}</td>
                    <td className="py-2 px-1 text-center font-mono font-bold text-emerald-300">{ward}</td>
                    <td className="py-2 px-1 text-center font-mono font-bold text-amber-300">{empty}</td>
                    <td className="py-2 px-1 text-center font-mono font-bold text-indigo-300">{supplier}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. "Record a movement": Four Numbered Buttons + Exchange + Faulty + Stock Check */}
      <div className="bg-slate-950 border-2 border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col gap-3">
        <h2 className="text-sm font-black text-white uppercase tracking-wider">
          {lang === 'hi' ? 'सिलेंडर मूवमेंट दर्ज करें' : 'Record a Movement'}
        </h2>

        {/* 4 Loop Numbered Buttons (Min 56px touch target) */}
        <div className="grid grid-cols-2 gap-3">
          {/* 1. Receive from supplier */}
          <button
            onClick={() => {
              setMovementPreselectedWard(undefined);
              setActiveMovementMode('receive');
            }}
            className="min-h-[58px] p-3 rounded-2xl bg-indigo-950/60 hover:bg-indigo-900 border-2 border-indigo-500/60 text-white flex flex-col justify-center text-left transition cursor-pointer touch-manipulation shadow-md"
          >
            <span className="text-xs font-black text-indigo-300">{t('receive_from_supplier', lang)}</span>
            <span className="text-[10px] text-slate-400 font-semibold">{t('receive_sub', lang)}</span>
          </button>

          {/* 2. Issue to ward */}
          <button
            onClick={() => {
              setMovementPreselectedWard(undefined);
              setActiveMovementMode('issue');
            }}
            className="min-h-[58px] p-3 rounded-2xl bg-sky-950/60 hover:bg-sky-900 border-2 border-sky-500/60 text-white flex flex-col justify-center text-left transition cursor-pointer touch-manipulation shadow-md"
          >
            <span className="text-xs font-black text-sky-300">{t('issue_to_ward', lang)}</span>
            <span className="text-[10px] text-slate-400 font-semibold">{t('issue_sub', lang)}</span>
          </button>

          {/* 3. Return from ward */}
          <button
            onClick={() => {
              setMovementPreselectedWard(undefined);
              setActiveMovementMode('return');
            }}
            className="min-h-[58px] p-3 rounded-2xl bg-amber-950/60 hover:bg-amber-900 border-2 border-amber-500/60 text-white flex flex-col justify-center text-left transition cursor-pointer touch-manipulation shadow-md"
          >
            <span className="text-xs font-black text-amber-300">{t('return_from_ward', lang)}</span>
            <span className="text-[10px] text-slate-400 font-semibold">{t('return_sub', lang)}</span>
          </button>

          {/* 4. Send to supplier */}
          <button
            onClick={() => {
              setMovementPreselectedWard(undefined);
              setActiveMovementMode('send');
            }}
            className="min-h-[58px] p-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border-2 border-slate-700 text-white flex flex-col justify-center text-left transition cursor-pointer touch-manipulation shadow-md"
          >
            <span className="text-xs font-black text-slate-200">{t('send_to_supplier', lang)}</span>
            <span className="text-[10px] text-slate-400 font-semibold">{t('send_sub', lang)}</span>
          </button>
        </div>

        {/* Big Button: "⇄ Exchange at ward" (Min 64px) */}
        <button
          onClick={() => {
            setMovementPreselectedWard(undefined);
            setActiveMovementMode('exchange');
          }}
          className="min-h-[64px] py-3.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-black text-base shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2.5 transition cursor-pointer touch-manipulation"
        >
          <ArrowUpDown className="w-6 h-6 stroke-[3]" />
          <div className="text-left">
            <span className="block leading-tight">{t('exchange_at_ward', lang)}</span>
            <span className="text-[11px] font-bold text-slate-900/80">{t('exchange_sub', lang)}</span>
          </div>
        </button>

        {/* Small Buttons: Mark Faulty & Stock Check */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            onClick={() => setActiveMovementMode('faulty')}
            className="min-h-[50px] py-2 px-3 rounded-xl bg-red-950/60 hover:bg-red-900 border border-red-500/50 text-red-200 text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer touch-manipulation"
          >
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span>{t('mark_faulty', lang)}</span>
          </button>

          <button
            onClick={() => setActiveMovementMode('stock_check')}
            className="min-h-[50px] py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-sky-300 text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer touch-manipulation"
          >
            <Boxes className="w-4 h-4 text-sky-400" />
            <span>{t('stock_check', lang)}</span>
          </button>
        </div>
      </div>

      {/* 3. "Find a cylinder": Serial Search with History & Hydrotest Editor */}
      <div className="bg-slate-950 border-2 border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col gap-3">
        <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
          <Search className="w-4 h-4 text-sky-400" />
          <span>{t('find_cylinder', lang)}</span>
        </h2>

        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t('search', lang)}
            className="w-full min-h-[54px] bg-slate-900 border-2 border-slate-700 rounded-2xl pl-11 pr-4 font-mono font-bold text-base text-white uppercase outline-none focus:border-sky-400"
          />
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-4" />
        </div>

        {/* Search Results Display */}
        {searchResults.length > 0 && (
          <div className="flex flex-col gap-2 mt-2">
            {searchResults.map(c => {
              const daysHeld = Math.floor((Date.now() - new Date(c.lastTs).getTime()) / 86400000);
              const cylEvents = events.filter(e => e.cylinderId === c.serial);

              return (
                <div
                  key={c.serial}
                  className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-2.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black font-mono text-white">{c.serial}</span>
                      <span className="px-2 py-0.5 rounded bg-sky-950 text-sky-300 font-bold">{c.type}</span>
                      {c.missing && <span className="px-2 py-0.5 rounded bg-red-500 text-black font-black">MISSING</span>}
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-slate-800 text-slate-200">
                      {c.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-slate-300">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Current Location</span>
                      <span className="font-bold text-white">{c.location || 'Unknown'} ({daysHeld} days)</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 block">Next Hydrotest</span>
                      {editingHydrotestSerial === c.serial ? (
                        <div className="flex gap-1 items-center mt-0.5">
                          <input
                            type="month"
                            value={editHydrotestValue}
                            onChange={e => setEditHydrotestValue(e.target.value)}
                            className="bg-slate-950 border border-sky-400 rounded px-1.5 py-0.5 text-xs text-white"
                          />
                          <button
                            onClick={async () => {
                              await onUpdateCylinder({ ...c, nextTest: editHydrotestValue });
                              setEditingHydrotestSerial(null);
                            }}
                            className="p-1 bg-emerald-500 text-black rounded"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 font-bold text-white">
                          <span>{c.nextTest || 'Not Set'}</span>
                          {role === 'admin' && (
                            <button
                              onClick={() => {
                                setEditingHydrotestSerial(c.serial);
                                setEditHydrotestValue(c.nextTest || '2028-12');
                              }}
                              className="text-sky-400 p-0.5"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Complete History Log */}
                  {cylEvents.length > 0 && (
                    <div className="pt-2 border-t border-slate-800/80">
                      <span className="text-[10px] font-bold text-slate-400 block mb-1">Movement History</span>
                      <div className="flex flex-col gap-1 max-h-24 overflow-y-auto">
                        {cylEvents.map((ev, i) => (
                          <div key={i} className="text-[10px] text-slate-400 flex justify-between">
                            <span>{ev.action} → {ev.location}</span>
                            <span>{new Date(ev.ts).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. "Cylinders in wards": Each Ward Count & Stock Check Here */}
      <div className="bg-slate-950 border-2 border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col gap-3">
        <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
          <Building2 className="w-4 h-4 text-emerald-400" />
          <span>{t('cylinders_in_wards', lang)}</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {sortedWards.map(w => {
            const data = wardStats[w] || { count: 0, oldestDays: 0, missing: 0, serials: [] };
            const isInspected = inspectedWard === w;

            return (
              <div
                key={w}
                className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs">{w}</span>
                  <span className="text-base font-black text-emerald-400 font-mono">
                    {data.count} <span className="text-[10px] text-slate-400">cyl</span>
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                  <span>Oldest held: <strong className="text-slate-200">{data.oldestDays}d</strong></span>
                  {data.missing > 0 && (
                    <span className="text-red-400 font-bold">{data.missing} missing</span>
                  )}
                </div>

                {/* Ward actions: View Serials / Stock check here */}
                <div className="flex gap-2 pt-1 border-t border-slate-800/80">
                  <button
                    onClick={() => setInspectedWard(isInspected ? null : w)}
                    className="flex-1 py-1.5 rounded-lg bg-slate-800 text-[11px] font-bold text-slate-300 hover:text-white"
                  >
                    {isInspected ? 'Hide' : `Serials (${data.serials.length})`}
                  </button>
                  <button
                    onClick={() => {
                      setMovementPreselectedPlace(w);
                      setActiveMovementMode('stock_check');
                    }}
                    className="flex-1 py-1.5 rounded-lg bg-sky-950 text-[11px] font-bold text-sky-300 hover:bg-sky-900"
                  >
                    Stock check here
                  </button>
                </div>

                {/* Drilldown serials list */}
                {isInspected && (
                  <div className="flex flex-wrap gap-1 pt-1.5">
                    {data.serials.length === 0 ? (
                      <span className="text-[10px] text-slate-500">No cylinders currently in this ward</span>
                    ) : (
                      data.serials.map(s => (
                        <span key={s.serial} className="px-2 py-0.5 rounded bg-slate-950 text-white font-mono text-[10px] font-bold">
                          {s.serial}
                        </span>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. "Needs attention" Alerts */}
      <div className="bg-slate-950 border-2 border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>{t('needs_attention', lang)} ({attentionAlerts.totalCount})</span>
          </h2>
        </div>

        <div className="flex flex-col gap-2">
          {/* Missing Cylinders Alert */}
          {attentionAlerts.missingList.length > 0 && (
            <div className="p-3 rounded-2xl bg-red-950/60 border border-red-500 text-xs text-red-200">
              <span className="font-black text-white block mb-1">
                🚨 {t('alert_missing', lang)} ({attentionAlerts.missingList.length})
              </span>
              <div className="flex flex-wrap gap-1">
                {attentionAlerts.missingList.map(c => (
                  <span key={c.serial} className="px-1.5 py-0.5 rounded bg-black font-mono text-[10px] font-bold">
                    {c.serial} ({c.location})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Overdue Hydrotest Alert */}
          {attentionAlerts.overdueHydrotest.length > 0 && (
            <div className="p-3 rounded-2xl bg-red-950/60 border border-red-500 text-xs text-red-200">
              <span className="font-black text-white block mb-1">
                ⛔ Hydrotest Overdue ({attentionAlerts.overdueHydrotest.length}) — Issues blocked!
              </span>
              <div className="flex flex-wrap gap-1">
                {attentionAlerts.overdueHydrotest.map(c => (
                  <span key={c.serial} className="px-1.5 py-0.5 rounded bg-black font-mono text-[10px] font-bold">
                    {c.serial} ({c.nextTest})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Faulty Cylinders Alert */}
          {attentionAlerts.faultyList.length > 0 && (
            <div className="p-3 rounded-2xl bg-amber-950/60 border border-amber-500 text-xs text-amber-200">
              <span className="font-black text-white block mb-1">
                ⚠️ {t('alert_faulty', lang)} ({attentionAlerts.faultyList.length})
              </span>
              <div className="flex flex-wrap gap-1">
                {attentionAlerts.faultyList.map(c => (
                  <span key={c.serial} className="px-1.5 py-0.5 rounded bg-black font-mono text-[10px] font-bold">
                    {c.serial}: {c.faultNote || 'Faulty'}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Stale in ward 14+ days */}
          {attentionAlerts.staleInWard.length > 0 && (
            <div className="p-3 rounded-2xl bg-slate-900 border border-slate-700 text-xs text-slate-300">
              <span className="font-black text-amber-300 block mb-1">
                🕒 {t('alert_ward_stale', lang)} ({attentionAlerts.staleInWard.length})
              </span>
              <div className="flex flex-wrap gap-1">
                {attentionAlerts.staleInWard.slice(0, 10).map(c => (
                  <span key={c.serial} className="px-1.5 py-0.5 rounded bg-slate-950 font-mono text-[10px] font-bold">
                    {c.serial} ({c.location})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Low Stock Alerts */}
          {attentionAlerts.lowStockKinds.map(l => (
            <div key={l.kind} className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-xs text-amber-200 flex items-center justify-between">
              <span>{t('alert_low_stock', lang)}: <strong>{l.kind}</strong></span>
              <span className="font-mono font-black">{l.full} full / {l.min} min</span>
            </div>
          ))}
        </div>
      </div>

      {/* 6. Reports (Collapsed) */}
      <div className="bg-slate-950 border-2 border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col gap-3">
        <button
          onClick={() => setReportsExpanded(!reportsExpanded)}
          className="flex items-center justify-between min-h-[48px] text-left cursor-pointer touch-manipulation"
        >
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-sky-400" />
            <h2 className="text-sm font-black text-white uppercase tracking-wider">{t('reports', lang)}</h2>
          </div>
          {reportsExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </button>

        {reportsExpanded && (
          <div className="flex flex-col gap-4 pt-3 border-t border-slate-800">
            {/* Action Bar: Export CSV & Print */}
            <div className="flex gap-2">
              <button
                onClick={handleExportCSV}
                className="flex-1 py-2.5 px-3 min-h-[48px] rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation"
              >
                <Download className="w-4 h-4" />
                <span>{t('export_csv', lang)}</span>
              </button>

              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 px-3 min-h-[48px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation"
              >
                <Printer className="w-4 h-4" />
                <span>{t('print_report', lang)}</span>
              </button>
            </div>

            {/* Supplier D-Type Holding Report */}
            <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/40 flex flex-col gap-1.5 text-xs">
              <span className="font-black text-indigo-300 text-sm">Supplier D-Type Rental Bill Check</span>
              <p className="text-slate-300">
                Total supplier cylinders on hospital site: <strong className="text-white text-base font-mono">{supplierRentalHolding.onSiteCount}</strong>
              </p>
              <p className="text-slate-400">
                Oldest days held on site: <strong className="text-amber-400">{supplierRentalHolding.oldestDays} days</strong>
              </p>
            </div>

            {/* Daily Movement Register Log */}
            <div>
              <span className="text-xs font-black text-white block mb-2">Recent Movement Audit Log</span>
              <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                {events.slice(0, 15).map(ev => (
                  <div key={ev.id} className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-[11px] flex justify-between items-center">
                    <div>
                      <span className="font-mono font-black text-white">{ev.serial}</span>
                      <span className="text-sky-300 ml-1.5 font-bold">{ev.action}</span>
                      <span className="text-slate-400 ml-1">→ {ev.location}</span>
                    </div>
                    <span className="text-slate-500 font-medium">{new Date(ev.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 7. Setup & Ward Management (Admin Role) */}
      <div className="bg-slate-950 border-2 border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col gap-3">
        <button
          onClick={() => setSetupExpanded(!setupExpanded)}
          className="flex items-center justify-between min-h-[48px] text-left cursor-pointer touch-manipulation"
        >
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-black text-white uppercase tracking-wider">{t('setup', lang)}</h2>
          </div>
          {setupExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </button>

        {setupExpanded && (
          <div className="flex flex-col gap-4 pt-3 border-t border-slate-800 text-xs">
            {role !== 'admin' ? (
              <p className="text-slate-400 py-2">
                {lang === 'hi' ? 'केवल प्लांट एडमिनिस्ट्रेटर सेटिंग्स बदल सकते हैं।' : 'Only plant administrators can edit wards and thresholds.'}
              </p>
            ) : (
              <>
                {/* Wards Manager */}
                <div>
                  <span className="font-black text-white block mb-2">Hospital Wards Master List</span>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={adminNewWard}
                      onChange={e => setAdminNewWard(e.target.value)}
                      placeholder="Add new ward..."
                      className="flex-1 min-h-[44px] bg-slate-900 border border-slate-700 rounded-xl px-3 text-white outline-none"
                    />
                    <button
                      onClick={async () => {
                        if (adminNewWard.trim()) {
                          await onAddWard(adminNewWard.trim());
                          setAdminNewWard('');
                        }
                      }}
                      className="px-4 min-h-[44px] rounded-xl bg-sky-500 text-black font-black"
                    >
                      Add
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                    {wards.map(w => (
                      <span key={w} className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 font-bold flex items-center gap-1.5">
                        {w}
                        <button onClick={() => onRemoveWard(w)} className="text-slate-500 hover:text-red-400">
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Stock Minimums per Kind */}
                <div className="pt-2 border-t border-slate-800">
                  <span className="font-black text-white block mb-2">Minimum Full Stock Thresholds</span>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.keys(CYLINDER_KINDS).map(k => {
                      const kind = k as CylinderKind;
                      const val = stockMin[kind] || 5;
                      return (
                        <div key={kind} className="p-2 bg-slate-900 rounded-xl flex items-center justify-between">
                          <span className="font-bold text-white">{kind}</span>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={val}
                            onChange={e => onUpdateStockMin(kind, Number(e.target.value))}
                            className="w-14 bg-slate-950 border border-slate-700 rounded text-center text-sky-400 font-bold"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Authorized Technicians Emails */}
                <div className="pt-2 border-t border-slate-800">
                  <span className="font-black text-white block mb-2">Authorized Technician Emails</span>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="email"
                      value={adminNewEmail}
                      onChange={e => setAdminNewEmail(e.target.value)}
                      placeholder="technician@hospital.org"
                      className="flex-1 min-h-[44px] bg-slate-900 border border-slate-700 rounded-xl px-3 text-white outline-none"
                    />
                    <button
                      onClick={async () => {
                        if (adminNewEmail.trim()) {
                          await onAddAuthorizedEmail(adminNewEmail.trim());
                          setAdminNewEmail('');
                        }
                      }}
                      className="px-4 min-h-[44px] rounded-xl bg-emerald-500 text-black font-black"
                    >
                      Authorize
                    </button>
                  </div>

                  <div className="flex flex-col gap-1 max-h-28 overflow-y-auto">
                    {authorizedEmails.map(em => (
                      <div key={em} className="p-2 rounded bg-slate-900 flex items-center justify-between text-slate-300">
                        <span>{em}</span>
                        {em !== 'sunnykumar776289@gmail.com' && (
                          <button onClick={() => onRemoveAuthorizedEmail(em)} className="text-red-400">
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Movement Modal */}
      {activeMovementMode && (
        <MovementModal
          lang={lang}
          mode={activeMovementMode}
          userEmail={userEmail}
          wards={sortedWards}
          cylinders={cylinders}
          onAddWard={onAddWard}
          onSaveBatch={onSaveBatch}
          onClose={() => setActiveMovementMode(null)}
          preselectedWard={movementPreselectedWard}
          preselectedLocation={movementPreselectedPlace}
        />
      )}
    </div>
  );
};
