export type Language = 'en' | 'hi';

export type Role = 'admin' | 'staff';

export type CylinderStatus = 'plant_full' | 'in_ward' | 'plant_empty' | 'at_supplier' | 'faulty';

export type GasType = 'O₂' | 'N₂O' | 'CO₂';

export type CylinderKind = 
  | 'O₂ AA' 
  | 'O₂ A' 
  | 'O₂ B' 
  | 'O₂ D' 
  | 'N₂O A' 
  | 'N₂O D' 
  | 'CO₂ B' 
  | 'CO₂ D';

export interface CylinderKindMeta {
  kind: CylinderKind;
  gas: GasType;
  valve: 'pin index' | 'bullnose';
  owner: 'hospital' | 'supplier';
  isSupplierOwned: boolean;
}

export const CYLINDER_KINDS: Record<CylinderKind, CylinderKindMeta> = {
  'O₂ AA': { kind: 'O₂ AA', gas: 'O₂', valve: 'pin index', owner: 'hospital', isSupplierOwned: false },
  'O₂ A':  { kind: 'O₂ A',  gas: 'O₂', valve: 'pin index', owner: 'hospital', isSupplierOwned: false },
  'O₂ B':  { kind: 'O₂ B',  gas: 'O₂', valve: 'bullnose',  owner: 'hospital', isSupplierOwned: false },
  'O₂ D':  { kind: 'O₂ D',  gas: 'O₂', valve: 'bullnose',  owner: 'supplier', isSupplierOwned: true },
  'N₂O A': { kind: 'N₂O A', gas: 'N₂O', valve: 'pin index', owner: 'hospital', isSupplierOwned: false },
  'N₂O D': { kind: 'N₂O D', gas: 'N₂O', valve: 'bullnose',  owner: 'supplier', isSupplierOwned: true },
  'CO₂ B': { kind: 'CO₂ B', gas: 'CO₂', valve: 'pin index', owner: 'hospital', isSupplierOwned: false },
  'CO₂ D': { kind: 'CO₂ D', gas: 'CO₂', valve: 'bullnose',  owner: 'supplier', isSupplierOwned: true },
};

export const DEFAULT_WARDS: string[] = [
  '2nd Floor IPD',
  '3rd Floor IPD',
  '4th Floor IPD',
  '5th Floor IPD',
  '2nd Floor C Side',
  '5th Floor Mark Area',
  'Dialysis Ward',
  'Gastro',
  'KTP',
  'LTP',
  'CCU',
  'BMT',
  'Daycare Basement -2',
  'ICU',
  'OT',
  'Emergency',
  'Manifold O₂ bank A',
  'Manifold O₂ bank B',
  'Manifold N₂O',
  'Manifold CO₂',
];

export interface LmoEntry {
  id: string;
  kind: 'reading' | 'refill';
  ts: string; // ISO 8601
  a: number; // mmWC
  b: number; // mmWC
  online: 'A' | 'B';
  tank?: 'A' | 'B'; // For refill: which tank was refilled
  before?: number; // mmWC
  after?: number; // mmWC
  challanKg?: number;
  photoA?: string;
  photoB?: string;
  by: string;
  note?: string;
  isExample?: boolean;
}

export interface Cylinder {
  serial: string;
  gas: GasType;
  type: CylinderKind;
  valve: string;
  owner: 'hospital' | 'supplier';
  status: CylinderStatus;
  location: string; // Ward name, or 'Plant full', 'Plant empty', 'Supplier XYZ', 'Faulty Bay'
  nextTest?: string; // YYYY-MM
  lastTs: string;
  missing?: boolean;
  faultNote?: string;
  faultPhoto?: string;
  isExample?: boolean;
}

export interface CylinderEvent {
  id: string;
  cylinderId: string;
  serial: string;
  gas: GasType;
  type: CylinderKind;
  action: 
    | 'register' 
    | 'receive_full' 
    | 'issue' 
    | 'return_empty' 
    | 'send_refill' 
    | 'flag' 
    | 'found' 
    | 'count' 
    | 'missing';
  from: CylinderStatus;
  to: CylinderStatus;
  fromLocation?: string;
  location: string;
  doc?: string; // Challan number or invoice
  note?: string;
  ts: string;
  by: string;
  photo?: string;
  isExample?: boolean;
}

export interface AppSettings {
  wards: string[];
  stockMin: Record<CylinderKind, number>;
  authorizedEmails: string[];
  adminEmails: string[];
}
