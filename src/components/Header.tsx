import React from 'react';
import { 
  Languages, 
  Sun, 
  Moon, 
  Activity, 
  Boxes, 
  ShieldCheck, 
  UserCheck, 
  LogIn, 
  LogOut, 
  WifiOff, 
  CheckCircle2, 
  FlaskConical 
} from 'lucide-react';
import { Language, Role } from '../types';
import { t } from '../i18n/translations';
import { PWAInstallButton } from './PWAInstallButton';

interface Props {
  lang: Language;
  onToggleLang: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  activeTab: 'lmo' | 'cylinders';
  onTabChange: (tab: 'lmo' | 'cylinders') => void;
  lmoSummaryText: string;
  cylinderSummaryText: string;
  isOnline: boolean;
  userEmail: string | null;
  role: Role;
  onSignIn: () => void;
  onSignOut: () => void;
  onOpenAcceptanceTests: () => void;
}

export const Header: React.FC<Props> = ({
  lang,
  onToggleLang,
  isDark,
  onToggleTheme,
  activeTab,
  onTabChange,
  lmoSummaryText,
  cylinderSummaryText,
  isOnline,
  userEmail,
  role,
  onSignIn,
  onSignOut,
  onOpenAcceptanceTests,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b-2 border-slate-700 shadow-md">
      {/* Top Utility Bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          {/* Logo Badge */}
          <div className="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center text-white font-extrabold text-sm shadow">
            O₂
          </div>
          <div>
            <h1 className="text-sm font-black text-white tracking-tight flex items-center gap-1.5">
              <span>{t('app_title', lang)}</span>
              {role === 'admin' ? (
                <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded">
                  {t('role_admin', lang)}
                </span>
              ) : (
                <span className="text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40 px-1.5 py-0.5 rounded">
                  {t('role_staff', lang)}
                </span>
              )}
            </h1>
            <p className="text-[10px] text-slate-400 font-medium leading-none">
              {t('subtitle', lang)}
            </p>
          </div>
        </div>

        {/* Right Utility Buttons */}
        <div className="flex items-center gap-1.5">
          {/* Offline indicator */}
          {!isOnline && (
            <div className="flex items-center gap-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-1 rounded-lg text-[11px] font-bold animate-pulse">
              <WifiOff className="w-3.5 h-3.5" />
              <span>{t('offline', lang)}</span>
            </div>
          )}

          {/* Acceptance Test Runner Button */}
          <button
            onClick={onOpenAcceptanceTests}
            className="flex items-center gap-1 px-2.5 py-1.5 min-h-[38px] rounded-lg bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 text-xs font-bold transition cursor-pointer touch-manipulation"
            title="Run Acceptance Tests 1-4"
          >
            <FlaskConical className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Tests</span>
            <span className="bg-emerald-500 text-black text-[10px] px-1 rounded font-black">1-4</span>
          </button>

          {/* PWA Install Button */}
          <PWAInstallButton lang={lang} />

          {/* English / हिन्दी Toggle: prominent min 44px */}
          <button
            onClick={onToggleLang}
            className="flex items-center justify-center gap-1 px-3 py-1.5 min-h-[44px] min-w-[56px] rounded-lg bg-sky-950 hover:bg-sky-900 active:bg-sky-800 border-2 border-sky-400 text-white font-black text-xs transition cursor-pointer touch-manipulation shadow-sm"
            title="Switch Language / भाषा बदलें"
          >
            <Languages className="w-4 h-4 text-sky-400" />
            <span>{lang === 'en' ? 'हिन्दी' : 'English'}</span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer touch-manipulation"
            title="Toggle Light/Dark Theme"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-300" />}
          </button>

          {/* Auth Login/User */}
          {userEmail ? (
            <button
              onClick={onSignOut}
              className="p-2 min-h-[44px] flex items-center justify-center rounded-lg bg-slate-800 hover:bg-red-950 border border-slate-700 text-slate-300 hover:text-red-300 transition cursor-pointer touch-manipulation"
              title={`Signed in as ${userEmail} (${t('sign_out', lang)})`}
            >
              <LogOut className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onSignIn}
              className="flex items-center gap-1.5 px-2.5 py-1.5 min-h-[44px] rounded-lg bg-sky-700 hover:bg-sky-600 text-white font-bold text-xs transition cursor-pointer touch-manipulation shadow"
              title={t('sign_in_google', lang)}
            >
              <LogIn className="w-4 h-4" />
              <span className="hidden xs:inline">{t('sign_in_google', lang)}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Two Navigation Tabs: Minimum touch target 56px */}
      <div className="grid grid-cols-2 bg-slate-950">
        {/* Tab 1: LMO Flow */}
        <button
          onClick={() => onTabChange('lmo')}
          className={`flex flex-col items-center justify-center min-h-[64px] px-2 py-2 text-center transition cursor-pointer touch-manipulation relative border-r border-slate-800 ${
            activeTab === 'lmo'
              ? 'bg-slate-900 text-sky-400 font-black'
              : 'bg-slate-950 text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Activity className={`w-5 h-5 ${activeTab === 'lmo' ? 'text-sky-400 animate-pulse' : 'text-slate-500'}`} />
            <span className="text-sm font-black tracking-wide uppercase">{t('tab_lmo', lang)}</span>
          </div>
          {/* Live Summary */}
          <div className="text-[11px] font-semibold text-sky-200 truncate max-w-full px-1">
            {lmoSummaryText}
          </div>
          {/* Active Indicator Underline */}
          {activeTab === 'lmo' && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-sky-400 shadow-[0_0_10px_#38bdf8]" />
          )}
        </button>

        {/* Tab 2: Cylinders */}
        <button
          onClick={() => onTabChange('cylinders')}
          className={`flex flex-col items-center justify-center min-h-[64px] px-2 py-2 text-center transition cursor-pointer touch-manipulation relative ${
            activeTab === 'cylinders'
              ? 'bg-slate-900 text-emerald-400 font-black'
              : 'bg-slate-950 text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Boxes className={`w-5 h-5 ${activeTab === 'cylinders' ? 'text-emerald-400' : 'text-slate-500'}`} />
            <span className="text-sm font-black tracking-wide uppercase">{t('tab_cylinders', lang)}</span>
          </div>
          {/* Live Summary */}
          <div className="text-[11px] font-semibold text-emerald-200 truncate max-w-full px-1">
            {cylinderSummaryText}
          </div>
          {/* Active Indicator Underline */}
          {activeTab === 'cylinders' && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-400 shadow-[0_0_10px_#34d399]" />
          )}
        </button>
      </div>
    </header>
  );
};
