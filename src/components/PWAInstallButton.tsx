import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download } from 'lucide-react';
import { Language } from '../types';

interface Props {
  lang: Language;
}

export const PWAInstallButton: React.FC<Props> = ({ lang }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white px-3 py-1.5 text-xs font-semibold shadow-md transition touch-manipulation cursor-pointer"
        title="Install MGPS Console App"
      >
        <Download className="w-3.5 h-3.5" />
        <span>{lang === 'hi' ? 'ऐप इंस्टॉल करें' : 'Install App'}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 rounded-lg border border-sky-400/40 bg-sky-950/40 text-sky-200 px-3 py-1.5 text-xs font-semibold transition touch-manipulation cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{lang === 'hi' ? 'iOS पर इंस्टॉल' : 'Install iOS'}</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl text-slate-100">
              <h3 className="text-lg font-bold text-sky-400">
                {lang === 'hi' ? 'iPhone / iPad पर इंस्टॉल करें' : 'Install on iPhone / iPad'}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                {lang === 'hi' ? (
                  <>
                    1. सफारी के निचले भाग में <strong>Share</strong> (शेयर) बटन दबाएं।<br />
                    2. नीचे स्क्रॉल करके <strong>Add to Home Screen</strong> (होम स्क्रीन पर जोड़ें) चुनें।
                  </>
                ) : (
                  <>
                    1. Tap the <strong>Share</strong> button in Safari toolbar.<br />
                    2. Scroll down and tap <strong>Add to Home Screen</strong>.
                  </>
                )}
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full min-h-[48px] rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-white transition touch-manipulation"
              >
                {lang === 'hi' ? 'समझ गया (बंद करें)' : 'Close'}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
