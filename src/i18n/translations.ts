import { Language } from '../types';

export const TRANSLATIONS = {
  // Common
  app_title: { en: 'MGPS Plant Console', hi: 'एमजीपीएस प्लांट कंसोल' },
  subtitle: { en: '250-Bed Hospital Medical Gas Plant', hi: '250-बेड अस्पताल मेडिकल गैस प्लांट' },
  online: { en: 'Online', hi: 'ऑनलाइन' },
  offline: { en: 'Offline (Basement mode)', hi: 'ऑफलाइन (बेसमेंट मोड)' },
  tab_lmo: { en: 'LMO Flow', hi: 'एलएमओ फ्लो' },
  tab_cylinders: { en: 'Cylinders', hi: 'सिलेंडर' },
  confirm: { en: 'Confirm', hi: 'पुष्टि करें' },
  cancel: { en: 'Cancel', hi: 'रद्द करें' },
  save: { en: 'Save', hi: 'सहेजें' },
  close: { en: 'Close', hi: 'बंद करें' },
  finish: { en: 'Finish', hi: 'समाप्त करें' },
  back: { en: 'Back', hi: 'वापस' },
  correct_record: { en: '✓ Correct, record it', hi: '✓ सही है, दर्ज करें' },
  retake: { en: 'Retake', hi: 'पुनः फोटो लें' },
  edit: { en: 'Edit', hi: 'संपादित करें' },
  delete: { en: 'Delete', hi: 'हटाएं' },
  hours: { en: 'hours', hi: 'घंटे' },
  days: { en: 'days', hi: 'दिन' },
  mins: { en: 'mins', hi: 'मिनट' },
  just_now: { en: 'Just now', hi: 'अभी' },
  search: { en: 'Search serial number...', hi: 'सीरियल नंबर खोजें...' },
  example_data_banner: { 
    en: 'Showing initial example data. Will disappear when you save your first real entry.',
    hi: 'प्रारंभिक उदाहरण डेटा दिखाया जा रहा है। आपकी पहली प्रविष्टि सहेजने पर यह स्वतः हट जाएगा।'
  },
  clear_example_data: { en: 'Clear Example Data', hi: 'उदाहरण डेटा हटाएं' },
  run_acceptance_tests: { en: 'Run Acceptance Tests', hi: 'स्वीकृति परीक्षण चलाएं' },

  // Roles & Auth
  role_admin: { en: 'Admin', hi: 'एडमिन' },
  role_staff: { en: 'Plant Staff', hi: 'प्लांट स्टाफ' },
  sign_in_google: { en: 'Sign in with Google', hi: 'गूगल से साइन इन करें' },
  sign_out: { en: 'Sign Out', hi: 'साइन आउट' },
  demo_mode: { en: 'Staff Demo Mode', hi: 'स्टाफ डेमो मोड' },
  unauthorized_msg: { 
    en: 'Access restricted: Contact plant administrator to add your email.', 
    hi: 'पहुंच प्रतिबंधित: कृपया अपने ईमेल को जोड़ने के लिए प्लांट एडमिनिस्ट्रेटर से संपर्क करें।' 
  },

  // Tab 1: LMO Flow
  lmo_live_summary: {
    en: 'Current Flow: {lpm} LPM · Online Tank reaches empty in {hours}h',
    hi: 'वर्तमान फ्लो: {lpm} एलपीएम · ऑनलाइन टैंक {hours} घंटे में खाली होगा'
  },
  new_reading: { en: '+ New Reading', hi: '+ नई रीडिंग लें' },
  log_refill: { en: '+ Log Refill', hi: '+ रिफिल दर्ज करें' },
  tank_a: { en: 'Tank A (VIE-1)', hi: 'टैंक ए (VIE-1)' },
  tank_b: { en: 'Tank B (VIE-2)', hi: 'टैंक बी (VIE-2)' },
  online_tank: { en: 'Online (सक्रिय)', hi: 'ऑनलाइन (सक्रिय)' },
  standby_tank: { en: 'Standby (स्टैंडबाय)', hi: 'स्टैंडबाय' },
  level_mmwc: { en: 'Level (mmWC)', hi: 'लेवल (mmWC)' },
  litres_lox: { en: 'Litres LOX', hi: 'लीटर लिक्विड O₂' },
  o2_m3: { en: 'm³ O₂ Gas', hi: 'घन मीटर O₂ गैस' },
  usable_pct: { en: 'Usable', hi: 'उपयोगी' },
  empty_point: { en: 'Refill point: 400 mmWC', hi: 'रिफिल बिंदु: 400 mmWC' },
  max_point: { en: 'Max fill: 1600 mmWC', hi: 'अधिकतम: 1600 mmWC' },
  order_refill_alert: { en: '⚠️ Order Refill — Tank level below 600 mmWC', hi: '⚠️ रिफिल का ऑर्डर दें — टैंक 600 mmWC से नीचे है' },
  critical_alert: { en: '🚨 CRITICAL — Tank reached 400 mmWC refill limit!', hi: '🚨 गंभीर चेतावनी — टैंक 400 mmWC रिफिल सीमा पर पहुंच गया!' },
  hours_until_online_empty: { en: 'Hours until online tank reaches 400 mmWC', hi: 'ऑनलाइन टैंक 400 mmWC तक पहुंचने में शेष घंटे' },
  hours_until_both_depleted: { en: 'Hours until both tanks are used up', hi: 'दोनों टैंक पूरी तरह समाप्त होने में शेष घंटे' },
  flow_dial_label: { en: 'Hospital Consumption Rate', hi: 'अस्पताल ऑक्सीजन खपत दर' },
  tolerance_label: { en: 'Accuracy tolerance', hi: 'सटीकता सहिष्णुता' },
  short_interval_warn: { 
    en: '⚠️ Notice: Readings are less than 6 hours apart. Rate accuracy improves over longer intervals.',
    hi: '⚠️ सूचना: रीडिंग 6 घंटे से कम अंतर पर है। लंबे अंतराल पर सटीकता बेहतर होती है।'
  },
  unlogged_refill_warn: {
    en: '⚠️ Tank level rose by >30 mmWC without a refill logged! Please log the tanker refill to calculate flow rate.',
    hi: '⚠️ बिना रिफिल दर्ज किए टैंक का स्तर 30 mmWC से अधिक बढ़ गया! फ्लो दर की गणना के लिए कृपया टैंकर रिफिल दर्ज करें।'
  },
  period_since_last: { en: 'Since last reading', hi: 'पिछली रीडिंग से' },
  period_12h: { en: '12 Hours', hi: '12 घंटे' },
  period_24h: { en: '24 Hours', hi: '24 घंटे' },
  period_7d: { en: '7 Days', hi: '7 दिन' },
  chart_title_30d: { en: '30-Day Daily Average Flow (LPM)', hi: '30-दिन दैनिक औसत फ्लो (LPM)' },

  // New Reading Modal
  step_tank_a_photo: { en: 'Photo of Tank A Level Gauge', hi: 'टैंक ए के लेवल गेज की फोटो' },
  step_tank_b_photo: { en: 'Photo of Tank B Level Gauge', hi: 'टैंक बी के लेवल गेज की फोटो' },
  which_is_online: { en: 'Which tank is currently ONLINE?', hi: 'वर्तमान में कौन सा टैंक ऑनलाइन है?' },
  reading_time: { en: 'Reading Time', hi: 'रीडिंग का समय' },
  gemini_reading_gauge: { en: 'Reading level gauge photo with AI...', hi: 'एआई द्वारा गेज फोटो पढ़ी जा रही है...' },
  reading_confirmed: { en: 'Correct / सही है', hi: 'सही है / Confirm' },

  // Log Refill Modal
  refill_tank: { en: 'Which tank received the refill?', hi: 'किस टैंक में रिफिल डाला गया?' },
  gauge_before: { en: 'Gauge Before (mmWC)', hi: 'रिफिल से पहले गेज (mmWC)' },
  gauge_after: { en: 'Gauge After (mmWC)', hi: 'रिफिल के बाद गेज (mmWC)' },
  challan_kg: { en: 'Challan Weight (kg, optional)', hi: 'चालान वजन (किग्रा, वैकल्पिक)' },
  litres_received: { en: 'Litres LOX Received', hi: 'प्राप्त लिक्विड ऑक्सीजन (लीटर)' },
  kg_received: { en: 'Calculated Weight (kg)', hi: 'गणना किया गया वजन (किग्रा)' },
  challan_diff: { en: 'Difference vs Challan', hi: 'चालान की तुलना में अंतर' },

  // Tab 2: Cylinders
  cylinders_live_summary: {
    en: '{full} full · {wards} in wards · {empty} empty · {missing} missing',
    hi: '{full} भरे · {wards} वार्डों में · {empty} खाली · {missing} गायब'
  },
  place_plant_full: { en: 'Plant full', hi: 'प्लांट में भरे' },
  place_in_ward: { en: 'In ward', hi: 'वार्ड में' },
  place_plant_empty: { en: 'Plant empty', hi: 'प्लांट में खाली' },
  place_at_supplier: { en: 'At supplier', hi: 'सप्लायर के पास' },
  place_faulty: { en: 'Faulty', hi: 'खराब / फॉल्टी' },

  // Movements
  receive_from_supplier: { en: '1. Receive from supplier', hi: '1. सप्लायर से प्राप्त करें' },
  receive_sub: { en: 'At supplier → Plant full', hi: 'सप्लायर → प्लांट में भरे' },
  issue_to_ward: { en: '2. Issue to ward', hi: '2. वार्ड में जारी करें' },
  issue_sub: { en: 'Plant full → Ward', hi: 'प्लांट फुल → वार्ड' },
  return_from_ward: { en: '3. Return from ward', hi: '3. वार्ड से वापसी' },
  return_sub: { en: 'Ward → Plant empty', hi: 'वार्ड → प्लांट खाली' },
  send_to_supplier: { en: '4. Send to supplier', hi: '4. सप्लायर को भेजें' },
  send_sub: { en: 'Plant empty or Faulty → Supplier', hi: 'खाली या खराब → सप्लायर' },
  exchange_at_ward: { en: '⇄ Exchange at ward', hi: '⇄ वार्ड पर एक्सचेंज करें' },
  exchange_sub: { en: 'Scan EMPTY first, then scan FULL', hi: 'पहले खाली स्कैन करें, फिर भरा' },
  mark_faulty: { en: 'Mark faulty', hi: 'खराब चिह्नित करें' },
  stock_check: { en: 'Stock check', hi: 'स्टॉक सत्यापन (चेक)' },
  add_ward_button: { en: '+ Add ward', hi: '+ नया वार्ड जोड़ें' },
  new_serials_kind: { en: 'New numbers are added as:', hi: 'नए नंबर इस प्रकार जुड़ेंगे:' },

  // Scanner
  open_camera: { en: 'Open Camera', hi: 'कैमरा खोलें' },
  take_photo: { en: 'Snap Photo', hi: 'फोटो खींचें' },
  gallery: { en: 'Gallery', hi: 'गैलरी' },
  type_instead: { en: 'Type instead', hi: 'टाइप करें' },
  scanning_badge: { en: 'Scanning QR / Barcode / Shoulder...', hi: 'क्यूआर / बारकोड / शोल्डर स्कैन हो रहा है...' },
  wrong_place_warning: {
    en: '⚠️ App expected this cylinder at "{expected}", but scanning here. Move will still be recorded with a note.',
    hi: '⚠️ सिस्टम में यह सिलेंडर "{expected}" पर दर्ज था, लेकिन यहाँ स्कैन हुआ। नोट के साथ दर्ज किया जाएगा।'
  },
  already_scanned_batch: {
    en: '⚠️ This cylinder ({serial}) was already scanned in this batch!',
    hi: '⚠️ यह सिलेंडर ({serial}) इस बैच में पहले ही स्कैन हो चुका है!'
  },
  exchange_same_serial_error: {
    en: '❌ Cannot exchange: FULL cylinder cannot have the same serial as the EMPTY cylinder!',
    hi: '❌ एक्सचेंज नहीं हो सकता: भरा सिलेंडर खाली सिलेंडर के समान सीरियल नहीं हो सकता!'
  },
  hydrotest_blocked_error: {
    en: '❌ BLOCKED: Hydrotest is overdue ({date}). Cannot issue this cylinder to patients/wards!',
    hi: '❌ अवरुद्ध: हाइड्रो-टेस्ट की समयसीमा समाप्त हो चुकी है ({date})। इसे वार्ड में जारी नहीं किया जा सकता!'
  },
  recorded_this_batch: { en: 'Recorded this time ({n})', hi: 'इस बार दर्ज किए गए ({n})' },

  // Sections
  where_every_cylinder_is: { en: 'Where every cylinder is', hi: 'हर सिलेंडर कहाँ है' },
  days_of_stock: { en: 'Days of full stock', hi: 'भरे स्टॉक के शेष दिन' },
  issue_first: { en: 'Issue first (oldest):', hi: 'पहले जारी करें (सबसे पुराना):' },
  find_cylinder: { en: 'Find a cylinder', hi: 'सिलेंडर खोजें' },
  cylinders_in_wards: { en: 'Cylinders in wards', hi: 'वार्डों में सिलेंडर' },
  needs_attention: { en: 'Needs attention', hi: 'तत्काल ध्यान दें' },
  reports: { en: 'Reports & Audit Registers', hi: 'रिपोर्ट्स एवं ऑडिट रजिस्टर' },
  setup: { en: 'Setup & Ward Management', hi: 'सेटिंग्स एवं वार्ड प्रबंधन' },
  export_csv: { en: 'Export CSV', hi: 'सीएसवी डाउनलोड करें' },
  print_report: { en: 'Print / Save PDF', hi: 'प्रिंट / पीडीएफ' },
  
  // Alerts
  alert_missing: { en: 'Missing cylinders', hi: 'गायब सिलेंडर' },
  alert_overdue_test: { en: 'Hydrotest overdue / due within 60 days', hi: 'हाइड्रो-टेस्ट देय या 60 दिन में समाप्त' },
  alert_faulty: { en: 'Faulty cylinders', hi: 'खराब सिलेंडर' },
  alert_ward_stale: { en: 'In ward 14+ days without scan', hi: '14+ दिनों से वार्ड में बिना स्कैन' },
  alert_ward_unknown: { en: 'Unknown ward', hi: 'अज्ञात वार्ड' },
  alert_no_test_date: { en: 'Missing hydrotest date', hi: 'हाइड्रो-टेस्ट तिथि अनुपलब्ध' },
  alert_low_stock: { en: 'Full stock below minimum threshold', hi: 'भरा स्टॉक न्यूनतम स्तर से नीचे' },
  
  // Stock Check
  stock_check_title: { en: 'Physical Stock Check', hi: 'भौतिक स्टॉक सत्यापन' },
  stock_check_progress: { 
    en: 'App expects {expected} · Counted {counted} · Matching {matching}',
    hi: 'सिस्टम में अपेक्षित {expected} · गिने गए {counted} · मेल खाते {matching}'
  },
  uncounted_cylinders: { en: 'Cylinders expected but not scanned:', hi: 'अपेक्षित सिलेंडर जो नहीं मिले:' },
  mark_as_missing: { en: 'Mark as Missing', hi: 'गायब चिह्नित करें' },
};

export function t(key: keyof typeof TRANSLATIONS, lang: Language, params?: Record<string, string | number>): string {
  const item = TRANSLATIONS[key];
  if (!item) return key;
  let str = item[lang] || item['en'] || key;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    });
  }
  return str;
}
