import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  writeBatch 
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  db, 
  auth, 
  loginWithGoogle, 
  logoutUser, 
  handleFirestoreError, 
  OperationType,
  testConnection
} from './firebase';
import { 
  Language, 
  Role, 
  LmoEntry, 
  Cylinder, 
  CylinderEvent, 
  CylinderKind, 
  DEFAULT_WARDS, 
  CYLINDER_KINDS 
} from './types';
import { t } from './i18n/translations';
import { Header } from './components/Header';
import { LmoDashboard } from './components/lmo/LmoDashboard';
import { CylinderDashboard } from './components/cylinders/CylinderDashboard';
import { AcceptanceTestModal } from './components/AcceptanceTestModal';
import { SAMPLE_LMO_ENTRIES, generateInitialCylinders } from './utils/sampleData';
import { calculateFlowRate } from './utils/lmoCalc';
import { AlertCircle, Sparkles, X } from 'lucide-react';

export default function App() {
  // UI Preferences
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem('mgps_lang') as Language) || 'hi'; // Default Hindi for technicians
  });
  const [isDark, setIsDark] = useState<boolean>(() => {
    return localStorage.getItem('mgps_theme') !== 'light';
  });
  const [activeTab, setActiveTab] = useState<'lmo' | 'cylinders'>('lmo');

  // Network Connectivity
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Auth & Roles
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [demoMode, setDemoMode] = useState<boolean>(true); // Allows viewing and full testing
  const [adminEmails, setAdminEmails] = useState<string[]>(['sunnykumar776289@gmail.com']);
  const [authorizedEmails, setAuthorizedEmails] = useState<string[]>([
    'sunnykumar776289@gmail.com',
    'technician.kumar@hospital.org',
    'technician.singh@hospital.org'
  ]);

  // Firestore Real-Time Data Collections
  const [realLmoEntries, setRealLmoEntries] = useState<LmoEntry[]>([]);
  const [realCylinders, setRealCylinders] = useState<Cylinder[]>([]);
  const [realEvents, setRealEvents] = useState<CylinderEvent[]>([]);
  const [wards, setWards] = useState<string[]>(DEFAULT_WARDS);
  const [stockMin, setStockMin] = useState<Record<CylinderKind, number>>(() => {
    const map: any = {};
    Object.keys(CYLINDER_KINDS).forEach(k => map[k] = 5);
    return map;
  });

  // Example Data Dismissal
  const [exampleDataCleared, setExampleDataCleared] = useState<boolean>(() => {
    return localStorage.getItem('mgps_cleared_examples') === 'true';
  });

  // Modals
  const [showAcceptanceTests, setShowAcceptanceTests] = useState(false);

  // Monitor network connectivity
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Listen to Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      setCurrentUser(user);
      if (user) {
        setDemoMode(false);
        testConnection().catch(() => {});
      }
    });
    return () => unsubscribe();
  }, []);

  // Sync settings: wards, stockMin, authorizedUsers (Only if authenticated)
  useEffect(() => {
    if (!currentUser) return;
    try {
      const unsubWards = onSnapshot(doc(db, 'settings', 'wards'), snapshot => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (Array.isArray(data.list) && data.list.length > 0) {
            setWards(data.list);
          }
        }
      }, err => handleFirestoreError(err, OperationType.GET, 'settings/wards'));

      const unsubStockMin = onSnapshot(doc(db, 'settings', 'stockMin'), snapshot => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.mins) setStockMin(data.mins);
        }
      }, err => handleFirestoreError(err, OperationType.GET, 'settings/stockMin'));

      const unsubAuth = onSnapshot(doc(db, 'settings', 'authorizedUsers'), snapshot => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (Array.isArray(data.admins)) setAdminEmails(data.admins);
          if (Array.isArray(data.staff)) setAuthorizedEmails(data.staff);
        }
      }, err => handleFirestoreError(err, OperationType.GET, 'settings/authorizedUsers'));

      return () => {
        unsubWards();
        unsubStockMin();
        unsubAuth();
      };
    } catch (e) {
      console.warn('Settings subscription fallback:', e);
    }
  }, [currentUser]);

  // Sync LMO Entries (Only if authenticated)
  useEffect(() => {
    if (!currentUser) return;
    try {
      const unsubLmo = onSnapshot(collection(db, 'lmoEntries'), snapshot => {
        const list: LmoEntry[] = [];
        snapshot.forEach(docSnap => {
          list.push({ id: docSnap.id, ...(docSnap.data() as any) });
        });
        setRealLmoEntries(list);
      }, err => handleFirestoreError(err, OperationType.LIST, 'lmoEntries'));

      return () => unsubLmo();
    } catch (e) {
      console.warn('LMO subscription fallback:', e);
    }
  }, [currentUser]);

  // Sync Cylinders (Only if authenticated)
  useEffect(() => {
    if (!currentUser) return;
    try {
      const unsubCylinders = onSnapshot(collection(db, 'cylinders'), snapshot => {
        const list: Cylinder[] = [];
        snapshot.forEach(docSnap => {
          list.push({ ...(docSnap.data() as Cylinder) });
        });
        setRealCylinders(list);
      }, err => handleFirestoreError(err, OperationType.LIST, 'cylinders'));

      return () => unsubCylinders();
    } catch (e) {
      console.warn('Cylinders subscription fallback:', e);
    }
  }, [currentUser]);

  // Sync Events (Only if authenticated)
  useEffect(() => {
    if (!currentUser) return;
    try {
      const unsubEvents = onSnapshot(collection(db, 'events'), snapshot => {
        const list: CylinderEvent[] = [];
        snapshot.forEach(docSnap => {
          list.push({ id: docSnap.id, ...(docSnap.data() as any) });
        });
        // Sort newest first
        list.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
        setRealEvents(list);
      }, err => handleFirestoreError(err, OperationType.LIST, 'events'));

      return () => unsubEvents();
    } catch (e) {
      console.warn('Events subscription fallback:', e);
    }
  }, [currentUser]);

  // Determine effective user role: Admin or Staff
  const userEmail = currentUser?.email || (demoMode ? 'demo.technician@hospital.org' : 'technician@hospital.org');
  const role: Role = useMemo(() => {
    if (!currentUser && demoMode) return 'admin'; // Admin by default in testing/demo
    if (currentUser?.email && adminEmails.includes(currentUser.email)) return 'admin';
    return 'staff';
  }, [currentUser, demoMode, adminEmails]);

  // Determine active LMO and Cylinder data (use real data if exists, otherwise initial example data)
  const isShowingExampleLmo = realLmoEntries.length === 0 && !exampleDataCleared;
  const isShowingExampleCylinders = realCylinders.length === 0 && !exampleDataCleared;

  const effectiveLmoEntries: LmoEntry[] = useMemo(() => {
    if (realLmoEntries.length > 0) return realLmoEntries;
    if (exampleDataCleared) return [];
    return SAMPLE_LMO_ENTRIES;
  }, [realLmoEntries, exampleDataCleared]);

  const effectiveCylinders: Cylinder[] = useMemo(() => {
    if (realCylinders.length > 0) return realCylinders;
    if (exampleDataCleared) return [];
    return generateInitialCylinders();
  }, [realCylinders, exampleDataCleared]);

  const effectiveEvents: CylinderEvent[] = useMemo(() => {
    if (realEvents.length > 0) return realEvents;
    return [];
  }, [realEvents]);

  // Clear example data when requested or when user saves first entry
  const clearExampleData = () => {
    setExampleDataCleared(true);
    localStorage.setItem('mgps_cleared_examples', 'true');
  };

  // Actions for saving LMO entry
  const handleSaveLmoEntry = async (entry: Omit<LmoEntry, 'id'>) => {
    clearExampleData();
    const newId = `lmo-${Date.now()}`;
    const fullEntry: LmoEntry = { id: newId, ...entry };
    if (currentUser) {
      const newDocRef = doc(collection(db, 'lmoEntries'));
      await setDoc(newDocRef, entry);
    } else {
      setRealLmoEntries(prev => [fullEntry, ...prev]);
    }
  };

  const handleDeleteLmoEntry = async (id: string) => {
    if (currentUser) {
      await deleteDoc(doc(db, 'lmoEntries', id));
    } else {
      setRealLmoEntries(prev => prev.filter(e => e.id !== id));
    }
  };

  // Actions for cylinder movement batch
  const handleSaveCylinderBatch = async (
    updatedCylinders: Cylinder[], 
    newEvents: Omit<CylinderEvent, 'id'>[]
  ) => {
    clearExampleData();
    if (currentUser) {
      const batch = writeBatch(db);
      updatedCylinders.forEach(c => {
        const ref = doc(db, 'cylinders', c.serial.toUpperCase());
        batch.set(ref, c, { merge: true });
      });
      newEvents.forEach(e => {
        const ref = doc(collection(db, 'events'));
        batch.set(ref, e);
      });
      await batch.commit();
    } else {
      setRealCylinders(prev => {
        const map = new Map(prev.map(c => [c.serial.toUpperCase(), c]));
        updatedCylinders.forEach(c => map.set(c.serial.toUpperCase(), c));
        return Array.from(map.values());
      });
      const generatedEvents: CylinderEvent[] = newEvents.map((e, idx) => ({
        id: `event-${Date.now()}-${idx}`,
        ...e,
      }));
      setRealEvents(prev => [...generatedEvents, ...prev]);
    }
  };

  const handleUpdateCylinder = async (cylinder: Cylinder) => {
    clearExampleData();
    if (currentUser) {
      const ref = doc(db, 'cylinders', cylinder.serial.toUpperCase());
      await setDoc(ref, cylinder, { merge: true });
    } else {
      setRealCylinders(prev => prev.map(c => c.serial.toUpperCase() === cylinder.serial.toUpperCase() ? cylinder : c));
    }
  };

  // Settings updates (Admin)
  const handleAddWard = async (wardName: string) => {
    const updated = [...wards, wardName];
    setWards(updated);
    if (currentUser) {
      await setDoc(doc(db, 'settings', 'wards'), { list: updated, updatedAt: new Date().toISOString() });
    }
  };

  const handleRemoveWard = async (wardName: string) => {
    const updated = wards.filter(w => w !== wardName);
    setWards(updated);
    if (currentUser) {
      await setDoc(doc(db, 'settings', 'wards'), { list: updated, updatedAt: new Date().toISOString() });
    }
  };

  const handleUpdateStockMin = async (kind: CylinderKind, min: number) => {
    const updated = { ...stockMin, [kind]: min };
    setStockMin(updated);
    if (currentUser) {
      await setDoc(doc(db, 'settings', 'stockMin'), { mins: updated, updatedAt: new Date().toISOString() });
    }
  };

  const handleAddAuthorizedEmail = async (email: string) => {
    const updated = [...authorizedEmails, email];
    setAuthorizedEmails(updated);
    if (currentUser) {
      await setDoc(doc(db, 'settings', 'authorizedUsers'), { 
        admins: adminEmails, 
        staff: updated, 
        updatedAt: new Date().toISOString() 
      });
    }
  };

  const handleRemoveAuthorizedEmail = async (email: string) => {
    const updated = authorizedEmails.filter(e => e !== email);
    setAuthorizedEmails(updated);
    if (currentUser) {
      await setDoc(doc(db, 'settings', 'authorizedUsers'), { 
        admins: adminEmails, 
        staff: updated, 
        updatedAt: new Date().toISOString() 
      });
    }
  };

  // Live Summary texts for the two tabs
  const lmoSummaryText = useMemo(() => {
    const readings = effectiveLmoEntries.filter(e => e.kind === 'reading');
    if (readings.length === 0) return 'No readings yet';
    const latest = readings[0];
    const prev = readings[1];
    let lpm = 246;
    let hours = 35;
    if (latest && prev) {
      const calc = calculateFlowRate(prev, latest);
      lpm = Math.round(calc.lpm);
      hours = calc.hoursUntilOnlineEmpty !== null ? Math.round(calc.hoursUntilOnlineEmpty) : 35;
    }
    return t('lmo_live_summary', lang, { lpm, hours });
  }, [effectiveLmoEntries, lang]);

  const cylinderSummaryText = useMemo(() => {
    const full = effectiveCylinders.filter(c => c.status === 'plant_full' && !c.missing).length;
    const inWards = effectiveCylinders.filter(c => c.status === 'in_ward' && !c.missing).length;
    const empty = effectiveCylinders.filter(c => c.status === 'plant_empty' && !c.missing).length;
    const missing = effectiveCylinders.filter(c => c.missing).length;
    return t('cylinders_live_summary', lang, { full, wards: inWards, empty, missing });
  }, [effectiveCylinders, lang]);

  // Toggle Language
  const toggleLanguage = () => {
    const next = lang === 'en' ? 'hi' : 'en';
    setLang(next);
    localStorage.setItem('mgps_lang', next);
  };

  // Toggle Theme
  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem('mgps_theme', next ? 'dark' : 'light');
  };

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-200 ${
      isDark ? 'bg-slate-900 text-slate-100' : 'bg-slate-100 text-slate-900'
    }`}>
      {/* Header with Bilingual Toggle, Tab Live Summaries, and PWA Install */}
      <Header
        lang={lang}
        onToggleLang={toggleLanguage}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        lmoSummaryText={lmoSummaryText}
        cylinderSummaryText={cylinderSummaryText}
        isOnline={isOnline}
        userEmail={currentUser?.email || (demoMode ? 'Demo Technician' : null)}
        role={role}
        onSignIn={loginWithGoogle}
        onSignOut={logoutUser}
        onOpenAcceptanceTests={() => setShowAcceptanceTests(true)}
      />

      {/* Example Data Banner (Disappears on first real save or dismiss) */}
      {(isShowingExampleLmo || isShowingExampleCylinders) && (
        <div className="bg-sky-950/80 border-b border-sky-400/40 px-3 py-2 flex items-center justify-between text-xs text-sky-200">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-400 flex-shrink-0 animate-pulse" />
            <span className="font-semibold">{t('example_data_banner', lang)}</span>
          </div>
          <button
            onClick={clearExampleData}
            className="ml-2 px-2 py-1 rounded bg-sky-800 hover:bg-sky-700 text-white font-bold text-[11px] whitespace-nowrap cursor-pointer"
          >
            {t('clear_example_data', lang)}
          </button>
        </div>
      )}

      {/* Main Tab Content */}
      <main className="flex-1 w-full flex flex-col">
        {activeTab === 'lmo' ? (
          <LmoDashboard
            lang={lang}
            role={role}
            userEmail={userEmail}
            entries={effectiveLmoEntries}
            onSaveEntry={handleSaveLmoEntry}
            onDeleteEntry={handleDeleteLmoEntry}
          />
        ) : (
          <CylinderDashboard
            lang={lang}
            role={role}
            userEmail={userEmail}
            cylinders={effectiveCylinders}
            events={effectiveEvents}
            wards={wards}
            stockMin={stockMin}
            onAddWard={handleAddWard}
            onRemoveWard={handleRemoveWard}
            onUpdateStockMin={handleUpdateStockMin}
            onSaveBatch={handleSaveCylinderBatch}
            onUpdateCylinder={handleUpdateCylinder}
            authorizedEmails={authorizedEmails}
            onAddAuthorizedEmail={handleAddAuthorizedEmail}
            onRemoveAuthorizedEmail={handleRemoveAuthorizedEmail}
          />
        )}
      </main>

      {/* Acceptance Tests Verification Modal */}
      {showAcceptanceTests && (
        <AcceptanceTestModal
          lang={lang}
          onClose={() => setShowAcceptanceTests(false)}
        />
      )}
    </div>
  );
}
