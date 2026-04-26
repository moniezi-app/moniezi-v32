import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle,
  Download,
  Edit3,
  FileText,
  Landmark,
  Plus,
  Shield,
  Trash2,
  Users,
} from 'lucide-react';
import type {
  CompanyEquityState,
  EquityConsiderationType,
  EquityInvestmentReservation,
  EquityIssuance,
  EquityIssuanceStatus,
  EquityReservationInstrument,
  EquityReservationStatus,
  EquitySafeInstrument,
  EquitySafeStatus,
  EquityShareClass,
  EquityStakeholder,
  EquityStakeholderType,
} from '../../../types';
import {
  buildCapTableRows,
  calculateEquityTotals,
  createDemoEquityState,
  formatShares,
  normalizeCompanyEquityState,
  todayIso,
  toCsv,
} from './equityCore';

type ToastType = 'success' | 'error' | 'info';
type EquitySection = 'guide' | 'settings' | 'stakeholders' | 'issuance' | 'captable' | 'reservations' | 'safes';

type Props = {
  equity: CompanyEquityState;
  onChange: React.Dispatch<React.SetStateAction<CompanyEquityState>>;
  currencySymbol: string;
  defaultBusinessName: string;
  showToast: (message: string, type: ToastType) => void;
};

const newId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
};

const toNumber = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const money = (value: unknown, symbol: string) =>
  `${symbol}${toNumber(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const percent = (value: unknown) => `${toNumber(value).toFixed(4)}%`;

const fieldClass = 'w-full px-3 py-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-950 dark:text-white font-semibold outline-none focus:ring-2 focus:ring-blue-500/40 placeholder:text-slate-400';
const labelClass = 'text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5 block';
const cardClass = 'bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm';
const subTextClass = 'text-sm font-medium text-slate-600 dark:text-slate-300';

const emptyStakeholder = (): Partial<EquityStakeholder> => ({
  type: 'investor',
  name: '',
  email: '',
  address: '',
  notes: '',
});

const emptyShareClass = (): Partial<EquityShareClass> => ({
  name: '',
  authorizedShares: 0,
  parValue: 0.0001,
  description: '',
});

const emptyIssuance = (shareClassId = ''): Partial<EquityIssuance> => ({
  issueDate: todayIso(),
  stakeholderId: '',
  shareClassId,
  shares: 0,
  pricePerShare: 0,
  considerationType: 'cash',
  considerationDescription: '',
  boardApprovalDate: '',
  certificateNumber: '',
  vestingTerms: '',
  restrictionLegend: '',
  status: 'issued',
  notes: '',
});

const emptySafe = (): Partial<EquitySafeInstrument> => ({
  investorId: '',
  investorName: '',
  date: todayIso(),
  amount: 0,
  valuationCap: undefined,
  discountRate: undefined,
  mfn: false,
  type: 'unknown',
  status: 'active',
  notes: '',
});

const emptyReservation = (): Partial<EquityInvestmentReservation> => ({
  date: todayIso(),
  investorName: '',
  email: '',
  phone: '',
  entityName: '',
  desiredAmount: 0,
  instrumentType: 'undecided',
  status: 'interested',
  followUpDate: '',
  signatureName: '',
  source: 'manual',
  notes: '',
});

const downloadText = (filename: string, content: string, mimeType = 'text/csv;charset=utf-8') => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const statusPillClass = (tone: 'blue' | 'green' | 'amber' | 'red' | 'slate') => {
  const tones = {
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
    green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    red: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  };
  return `inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wider ${tones[tone]}`;
};

const reservationTone = (status: EquityReservationStatus): 'blue' | 'green' | 'amber' | 'red' | 'slate' => {
  if (status === 'converted') return 'green';
  if (status === 'confirmed' || status === 'reserved') return 'blue';
  if (status === 'declined') return 'red';
  if (status === 'interested') return 'amber';
  return 'slate';
};

const issuanceTone = (status: EquityIssuanceStatus): 'blue' | 'green' | 'amber' | 'red' | 'slate' => {
  if (status === 'issued') return 'green';
  if (status === 'cancelled') return 'red';
  if (status === 'repurchased' || status === 'transferred') return 'amber';
  return 'slate';
};

const formatInstrument = (value: EquityReservationInstrument | undefined) => {
  if (value === 'common_stock') return 'Common stock';
  if (value === 'safe') return 'SAFE';
  if (value === 'convertible_note') return 'Convertible note';
  return 'Undecided';
};

function SummaryCard({ label, value, note, icon }: { label: string; value: string; note: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</div>
          <div className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{value}</div>
        </div>
        <div className="rounded-xl bg-blue-50 dark:bg-blue-500/10 p-2 text-blue-600 dark:text-blue-300">{icon}</div>
      </div>
      <div className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">{note}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

export function CompanyEquityModule({ equity, onChange, currencySymbol, defaultBusinessName, showToast }: Props) {
  const state = useMemo(() => normalizeCompanyEquityState(equity, defaultBusinessName), [equity, defaultBusinessName]);
  const totals = useMemo(() => calculateEquityTotals(state), [state]);
  const capRows = useMemo(() => buildCapTableRows(state), [state]);

  const [activeSection, setActiveSection] = useState<EquitySection>('guide');
  const [stakeholderDraft, setStakeholderDraft] = useState<Partial<EquityStakeholder>>(emptyStakeholder());
  const [editingStakeholderId, setEditingStakeholderId] = useState<string | null>(null);
  const [shareClassDraft, setShareClassDraft] = useState<Partial<EquityShareClass>>(emptyShareClass());
  const [editingShareClassId, setEditingShareClassId] = useState<string | null>(null);
  const [issuanceDraft, setIssuanceDraft] = useState<Partial<EquityIssuance>>(emptyIssuance(state.shareClasses[0]?.id));
  const [editingIssuanceId, setEditingIssuanceId] = useState<string | null>(null);
  const [safeDraft, setSafeDraft] = useState<Partial<EquitySafeInstrument>>(emptySafe());
  const [editingSafeId, setEditingSafeId] = useState<string | null>(null);
  const [reservationDraft, setReservationDraft] = useState<Partial<EquityInvestmentReservation>>(emptyReservation());
  const [editingReservationId, setEditingReservationId] = useState<string | null>(null);

  const selectedHolder = state.stakeholders.find(s => s.id === issuanceDraft.stakeholderId);
  const selectedShareClass = state.shareClasses.find(c => c.id === issuanceDraft.shareClassId);
  const issuancePaidAmount = toNumber(issuanceDraft.shares) * toNumber(issuanceDraft.pricePerShare);

  const updateProfile = (patch: Partial<CompanyEquityState['profile']>) => {
    onChange(prev => {
      const normalized = normalizeCompanyEquityState(prev, defaultBusinessName);
      return { ...normalized, profile: { ...normalized.profile, ...patch } };
    });
  };

  const loadDemoData = () => {
    if (state.stakeholders.length || state.issuances.length || state.safes.length || state.reservations.length) {
      if (!confirm('Load demo equity data? This replaces the current Equity module records only.')) return;
    }
    onChange(createDemoEquityState(defaultBusinessName || 'MONIEZI Demo Studio, Inc.'));
    setActiveSection('guide');
    setStakeholderDraft(emptyStakeholder());
    setShareClassDraft(emptyShareClass());
    setIssuanceDraft(emptyIssuance('eq_cls_common'));
    setSafeDraft(emptySafe());
    setReservationDraft(emptyReservation());
    showToast('Demo equity data loaded.', 'success');
  };

  const saveStakeholder = () => {
    const name = String(stakeholderDraft.name || '').trim();
    if (!name) return showToast('Stakeholder name is required.', 'error');
    const now = new Date().toISOString();
    onChange(prev => {
      const normalized = normalizeCompanyEquityState(prev, defaultBusinessName);
      if (editingStakeholderId) {
        return {
          ...normalized,
          stakeholders: normalized.stakeholders.map(s => s.id === editingStakeholderId ? {
            ...s,
            name,
            email: stakeholderDraft.email || '',
            address: stakeholderDraft.address || '',
            type: (stakeholderDraft.type || 'other') as EquityStakeholderType,
            notes: stakeholderDraft.notes || '',
            updatedAt: now,
          } : s),
        };
      }
      const created: EquityStakeholder = {
        id: newId('eq_holder'),
        name,
        email: stakeholderDraft.email || '',
        address: stakeholderDraft.address || '',
        type: (stakeholderDraft.type || 'other') as EquityStakeholderType,
        notes: stakeholderDraft.notes || '',
        createdAt: now,
        updatedAt: now,
      };
      return { ...normalized, stakeholders: [created, ...normalized.stakeholders] };
    });
    setStakeholderDraft(emptyStakeholder());
    setEditingStakeholderId(null);
    showToast(editingStakeholderId ? 'Stakeholder updated.' : 'Stakeholder added.', 'success');
  };

  const editStakeholder = (stakeholder: EquityStakeholder) => {
    setEditingStakeholderId(stakeholder.id);
    setStakeholderDraft(stakeholder);
    setActiveSection('stakeholders');
  };

  const deleteStakeholder = (id: string) => {
    const isUsed = state.issuances.some(i => i.stakeholderId === id) || state.safes.some(s => s.investorId === id);
    if (isUsed) return showToast('This stakeholder is linked to equity records. Delete or reassign those records first.', 'error');
    if (!confirm('Delete this stakeholder?')) return;
    onChange(prev => {
      const normalized = normalizeCompanyEquityState(prev, defaultBusinessName);
      return { ...normalized, stakeholders: normalized.stakeholders.filter(s => s.id !== id) };
    });
    showToast('Stakeholder deleted.', 'info');
  };

  const saveShareClass = () => {
    const name = String(shareClassDraft.name || '').trim();
    if (!name) return showToast('Share class name is required.', 'error');
    onChange(prev => {
      const normalized = normalizeCompanyEquityState(prev, defaultBusinessName);
      if (editingShareClassId) {
        return {
          ...normalized,
          shareClasses: normalized.shareClasses.map(c => c.id === editingShareClassId ? {
            ...c,
            name,
            authorizedShares: toNumber(shareClassDraft.authorizedShares),
            parValue: toNumber(shareClassDraft.parValue),
            description: shareClassDraft.description || '',
          } : c),
        };
      }
      const created: EquityShareClass = {
        id: newId('eq_cls'),
        name,
        authorizedShares: toNumber(shareClassDraft.authorizedShares),
        parValue: toNumber(shareClassDraft.parValue),
        description: shareClassDraft.description || '',
      };
      return { ...normalized, shareClasses: [...normalized.shareClasses, created] };
    });
    setShareClassDraft(emptyShareClass());
    setEditingShareClassId(null);
    showToast(editingShareClassId ? 'Share class updated.' : 'Share class added.', 'success');
  };

  const editShareClass = (shareClass: EquityShareClass) => {
    setEditingShareClassId(shareClass.id);
    setShareClassDraft(shareClass);
    setActiveSection('settings');
  };

  const deleteShareClass = (id: string) => {
    if (state.shareClasses.length <= 1) return showToast('At least one share class is required.', 'error');
    if (state.issuances.some(i => i.shareClassId === id)) return showToast('This share class has issuances. Delete or reassign those records first.', 'error');
    if (!confirm('Delete this share class?')) return;
    onChange(prev => {
      const normalized = normalizeCompanyEquityState(prev, defaultBusinessName);
      return { ...normalized, shareClasses: normalized.shareClasses.filter(c => c.id !== id) };
    });
    showToast('Share class deleted.', 'info');
  };

  const saveIssuance = () => {
    if (!issuanceDraft.stakeholderId) return showToast('Select who receives the shares.', 'error');
    if (!issuanceDraft.shareClassId) return showToast('Select a share class.', 'error');
    if (toNumber(issuanceDraft.shares) <= 0) return showToast('Shares issued must be greater than zero.', 'error');
    const now = new Date().toISOString();
    onChange(prev => {
      const normalized = normalizeCompanyEquityState(prev, defaultBusinessName);
      const payload: Omit<EquityIssuance, 'id' | 'createdAt' | 'updatedAt'> = {
        issueDate: issuanceDraft.issueDate || todayIso(),
        stakeholderId: issuanceDraft.stakeholderId || '',
        shareClassId: issuanceDraft.shareClassId || normalized.shareClasses[0]?.id || '',
        shares: toNumber(issuanceDraft.shares),
        pricePerShare: toNumber(issuanceDraft.pricePerShare),
        considerationType: (issuanceDraft.considerationType || 'cash') as EquityConsiderationType,
        considerationDescription: issuanceDraft.considerationDescription || '',
        boardApprovalDate: issuanceDraft.boardApprovalDate || '',
        certificateNumber: issuanceDraft.certificateNumber || '',
        vestingTerms: issuanceDraft.vestingTerms || '',
        restrictionLegend: issuanceDraft.restrictionLegend || '',
        status: (issuanceDraft.status || 'issued') as EquityIssuanceStatus,
        notes: issuanceDraft.notes || '',
      };
      if (editingIssuanceId) {
        return {
          ...normalized,
          issuances: normalized.issuances.map(i => i.id === editingIssuanceId ? { ...i, ...payload, updatedAt: now } : i),
        };
      }
      return {
        ...normalized,
        issuances: [{ id: newId('eq_issue'), ...payload, createdAt: now, updatedAt: now }, ...normalized.issuances],
      };
    });
    setIssuanceDraft(emptyIssuance(state.shareClasses[0]?.id));
    setEditingIssuanceId(null);
    showToast(editingIssuanceId ? 'Share issuance updated.' : 'Share issuance recorded.', 'success');
  };

  const editIssuance = (issuance: EquityIssuance) => {
    setEditingIssuanceId(issuance.id);
    setIssuanceDraft(issuance);
    setActiveSection('issuance');
  };

  const deleteIssuance = (id: string) => {
    if (!confirm('Delete this issuance record?')) return;
    onChange(prev => {
      const normalized = normalizeCompanyEquityState(prev, defaultBusinessName);
      return { ...normalized, issuances: normalized.issuances.filter(i => i.id !== id) };
    });
    showToast('Issuance deleted.', 'info');
  };

  const saveSafe = () => {
    const investorName = String(safeDraft.investorName || '').trim();
    const linkedInvestor = state.stakeholders.find(s => s.id === safeDraft.investorId);
    if (!investorName && !linkedInvestor) return showToast('Investor name is required for SAFE tracking.', 'error');
    if (toNumber(safeDraft.amount) <= 0) return showToast('SAFE amount must be greater than zero.', 'error');
    onChange(prev => {
      const normalized = normalizeCompanyEquityState(prev, defaultBusinessName);
      const linked = normalized.stakeholders.find(s => s.id === safeDraft.investorId);
      const payload: Omit<EquitySafeInstrument, 'id'> = {
        investorId: safeDraft.investorId || '',
        investorName: investorName || linked?.name || '',
        date: safeDraft.date || todayIso(),
        amount: toNumber(safeDraft.amount),
        valuationCap: safeDraft.valuationCap === undefined || safeDraft.valuationCap === null ? undefined : toNumber(safeDraft.valuationCap),
        discountRate: safeDraft.discountRate === undefined || safeDraft.discountRate === null ? undefined : toNumber(safeDraft.discountRate),
        mfn: !!safeDraft.mfn,
        type: safeDraft.type || 'unknown',
        status: (safeDraft.status || 'active') as EquitySafeStatus,
        notes: safeDraft.notes || '',
      };
      if (editingSafeId) {
        return { ...normalized, safes: normalized.safes.map(s => s.id === editingSafeId ? { id: s.id, ...payload } : s) };
      }
      return { ...normalized, safes: [{ id: newId('eq_safe'), ...payload }, ...normalized.safes] };
    });
    setSafeDraft(emptySafe());
    setEditingSafeId(null);
    showToast(editingSafeId ? 'SAFE record updated.' : 'SAFE record added.', 'success');
  };

  const deleteSafe = (id: string) => {
    if (!confirm('Delete this SAFE record?')) return;
    onChange(prev => {
      const normalized = normalizeCompanyEquityState(prev, defaultBusinessName);
      return { ...normalized, safes: normalized.safes.filter(s => s.id !== id) };
    });
    showToast('SAFE record deleted.', 'info');
  };

  const saveReservation = () => {
    const investorName = String(reservationDraft.investorName || '').trim();
    if (!investorName) return showToast('Investor/reservation name is required.', 'error');
    if (toNumber(reservationDraft.desiredAmount) <= 0) return showToast('Reservation amount must be greater than zero.', 'error');
    const now = new Date().toISOString();
    onChange(prev => {
      const normalized = normalizeCompanyEquityState(prev, defaultBusinessName);
      const payload: Omit<EquityInvestmentReservation, 'id' | 'createdAt' | 'updatedAt'> = {
        date: reservationDraft.date || todayIso(),
        investorName,
        email: reservationDraft.email || '',
        phone: reservationDraft.phone || '',
        entityName: reservationDraft.entityName || '',
        desiredAmount: toNumber(reservationDraft.desiredAmount),
        instrumentType: (reservationDraft.instrumentType || 'undecided') as EquityReservationInstrument,
        status: (reservationDraft.status || 'interested') as EquityReservationStatus,
        followUpDate: reservationDraft.followUpDate || '',
        signatureName: reservationDraft.signatureName || '',
        source: reservationDraft.source || 'manual',
        notes: reservationDraft.notes || '',
      };
      if (editingReservationId) {
        return {
          ...normalized,
          reservations: normalized.reservations.map(r => r.id === editingReservationId ? { ...r, ...payload, updatedAt: now } : r),
        };
      }
      return {
        ...normalized,
        reservations: [{ id: newId('eq_reservation'), ...payload, createdAt: now, updatedAt: now }, ...normalized.reservations],
      };
    });
    setReservationDraft(emptyReservation());
    setEditingReservationId(null);
    showToast(editingReservationId ? 'Reservation updated.' : 'Reservation recorded.', 'success');
  };

  const editReservation = (reservation: EquityInvestmentReservation) => {
    setEditingReservationId(reservation.id);
    setReservationDraft(reservation);
    setActiveSection('reservations');
  };

  const deleteReservation = (id: string) => {
    if (!confirm('Delete this reservation record?')) return;
    onChange(prev => {
      const normalized = normalizeCompanyEquityState(prev, defaultBusinessName);
      return { ...normalized, reservations: normalized.reservations.filter(r => r.id !== id) };
    });
    showToast('Reservation deleted.', 'info');
  };

  const exportCapTableCsv = () => {
    const rows = [
      ['Stakeholder', 'Type', 'Share Class', 'Shares', 'Ownership %', 'Cash Paid'],
      ...capRows.map(r => [r.stakeholderName, r.stakeholderType, r.shareClassName, r.shares, r.ownershipPct.toFixed(6), r.cashPaid]),
    ];
    downloadText(`moniezi_cap_table_${todayIso()}.csv`, toCsv(rows));
  };

  const exportLedgerCsv = () => {
    const rows = [
      ['Date', 'Stakeholder', 'Share Class', 'Shares', 'Price Per Share', 'Amount Paid', 'Consideration', 'Board Approval Date', 'Certificate', 'Status', 'Vesting', 'Restrictions', 'Notes'],
      ...state.issuances.map(i => {
        const holder = state.stakeholders.find(s => s.id === i.stakeholderId);
        const shareClass = state.shareClasses.find(c => c.id === i.shareClassId);
        return [i.issueDate, holder?.name || '', shareClass?.name || '', i.shares, i.pricePerShare, i.shares * i.pricePerShare, i.considerationType, i.boardApprovalDate || '', i.certificateNumber || '', i.status, i.vestingTerms || '', i.restrictionLegend || '', i.notes || ''];
      }),
    ];
    downloadText(`moniezi_stock_ledger_${todayIso()}.csv`, toCsv(rows));
  };

  const exportSafesCsv = () => {
    const rows = [
      ['Date', 'Investor', 'Amount', 'Valuation Cap', 'Discount %', 'MFN', 'Type', 'Status', 'Notes'],
      ...state.safes.map(s => [s.date, s.investorName, s.amount, s.valuationCap ?? '', s.discountRate ?? '', s.mfn ? 'Yes' : 'No', s.type || '', s.status, s.notes || '']),
    ];
    downloadText(`moniezi_safe_tracker_${todayIso()}.csv`, toCsv(rows));
  };

  const exportReservationsCsv = () => {
    const rows = [
      ['Date', 'Investor', 'Email', 'Phone', 'Entity', 'Desired Amount', 'Instrument', 'Status', 'Follow-up Date', 'Typed Signature', 'Source', 'Notes'],
      ...state.reservations.map(r => [r.date, r.investorName, r.email || '', r.phone || '', r.entityName || '', r.desiredAmount, formatInstrument(r.instrumentType), r.status, r.followUpDate || '', r.signatureName || '', r.source || 'manual', r.notes || '']),
    ];
    downloadText(`moniezi_investment_reservations_${todayIso()}.csv`, toCsv(rows));
  };

  const navItems: Array<{ id: EquitySection; label: string }> = [
    { id: 'guide', label: 'Guide' },
    { id: 'issuance', label: 'Issue Shares' },
    { id: 'reservations', label: 'Reservations' },
    { id: 'stakeholders', label: 'Stakeholders' },
    { id: 'captable', label: 'Cap Table' },
    { id: 'safes', label: 'SAFEs' },
    { id: 'settings', label: 'Equity Settings' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 pb-24">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300 flex-shrink-0">
            <Landmark size={24} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950 dark:text-white font-brand">Company Equity Register</h1>
            <p className={subTextClass}>Internal founder/business module for stakeholders, share issuances, investment reservations, SAFEs, and cap table summaries.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setActiveSection('settings')} className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-3 text-sm font-black text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-900 flex items-center gap-2">
            <Shield size={16} /> Equity Settings
          </button>
          <button onClick={loadDemoData} className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 text-sm font-black flex items-center gap-2 shadow-lg shadow-blue-600/20">
            <FileText size={16} /> Load Demo Equity
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        <SummaryCard label="Issued Shares" value={formatShares(totals.issuedShares)} note={`${formatShares(totals.unissuedShares)} unissued shares remain`} icon={<CheckCircle size={20} />} />
        <SummaryCard label="Stakeholders" value={String(totals.stakeholderCount)} note="People/entities in the register" icon={<Users size={20} />} />
        <SummaryCard label="Active SAFEs" value={money(totals.activeSafeAmount, currencySymbol)} note={`${totals.activeSafeCount} active SAFE records`} icon={<FileText size={20} />} />
        <SummaryCard label="Reservations" value={money(totals.reservationAmount, currencySymbol)} note={`${totals.reservationCount} open indications`} icon={<Building2 size={20} />} />
        <SummaryCard label="Authorized" value={formatShares(totals.authorizedShares)} note="Configured in Equity Settings" icon={<Landmark size={20} />} />
      </div>

      <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/20 p-4 flex items-start gap-3">
        <AlertTriangle className="text-amber-600 dark:text-amber-300 mt-0.5 flex-shrink-0" size={20} />
        <div className="text-sm font-semibold text-amber-900 dark:text-amber-100">
          This is an internal recordkeeping module. It tracks data and exports CSV records, but it does not replace board approvals, securities-law review, investor onboarding, payment processing, or lawyer-approved issuance documents.
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-2 shadow-sm">
        <div className="flex min-w-max gap-2">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`px-4 py-2.5 rounded-xl text-sm font-black transition-all ${
                activeSection === item.id
                  ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {activeSection === 'guide' && (
        <section className={`${cardClass} p-5 space-y-5`}>
          <div>
            <h2 className="text-xl font-black text-slate-950 dark:text-white">Plain-English Workflow</h2>
            <p className={subTextClass}>Use this order when you want to track who received shares and how much they paid.</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
            {[
              ['1', 'Add stakeholder', 'Create the person/entity first: founder, investor, advisor, employee, or LLC.'],
              ['2', 'Record issuance', 'Enter date, recipient, share class, shares, price/share, amount paid, certificate, and approval date.'],
              ['3', 'Review cap table', 'Ownership percentage updates only from active issued shares. Cancelled shares do not count.'],
              ['4', 'Track reservations separately', 'Reservations are interest/commitments only. They are not issued shares until you record an issuance.'],
            ].map(([num, title, body]) => (
              <div key={num} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4">
                <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-black">{num}</div>
                <div className="mt-3 text-base font-black text-slate-950 dark:text-white">{title}</div>
                <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">{body}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
              <h3 className="font-black text-slate-950 dark:text-white">Where do I record paid shares?</h3>
              <p className={subTextClass}>Use <b>Issue Shares</b>. The amount paid is calculated as <b>shares × price per share</b>. Example: 200,000 shares × $0.25 = $50,000 paid.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
              <h3 className="font-black text-slate-950 dark:text-white">Are investors equal stakeholders?</h3>
              <p className={subTextClass}>Only if they hold the same share class and the same number of outstanding shares. Same cash amount at the same price/share usually creates equal ownership; different amounts create different ownership.</p>
            </div>
          </div>
        </section>
      )}

      {activeSection === 'settings' && (
        <section className={`${cardClass} p-5 space-y-6`}>
          <div>
            <h2 className="text-xl font-black text-slate-950 dark:text-white">Equity Settings</h2>
            <p className={subTextClass}>Company profile and share classes. This is the setup area you asked for.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <Field label="Legal company name"><input className={fieldClass} value={state.profile.legalName || ''} onChange={e => updateProfile({ legalName: e.target.value })} placeholder="Company legal name" /></Field>
            <Field label="State of incorporation"><input className={fieldClass} value={state.profile.stateOfIncorporation || ''} onChange={e => updateProfile({ stateOfIncorporation: e.target.value })} placeholder="Wyoming" /></Field>
            <Field label="Authorized shares"><input className={fieldClass} type="number" inputMode="numeric" value={state.profile.authorizedShares || ''} onChange={e => updateProfile({ authorizedShares: toNumber(e.target.value) })} /></Field>
            <Field label="Par value"><input className={fieldClass} type="number" inputMode="decimal" step="0.0001" value={state.profile.parValue || ''} onChange={e => updateProfile({ parValue: toNumber(e.target.value) })} /></Field>
            <div className="md:col-span-2 lg:col-span-4"><Field label="Company equity notes"><textarea className={fieldClass} rows={3} value={state.profile.notes || ''} onChange={e => updateProfile({ notes: e.target.value })} placeholder="Internal notes about the equity setup." /></Field></div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-lg font-black text-slate-950 dark:text-white">Share Classes</h3>
                <p className={subTextClass}>Start with common stock. Add preferred stock only if your company actually uses it.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              <Field label="Class name"><input className={fieldClass} value={shareClassDraft.name || ''} onChange={e => setShareClassDraft(p => ({ ...p, name: e.target.value }))} placeholder="Common Stock" /></Field>
              <Field label="Authorized shares"><input className={fieldClass} type="number" inputMode="numeric" value={shareClassDraft.authorizedShares || ''} onChange={e => setShareClassDraft(p => ({ ...p, authorizedShares: toNumber(e.target.value) }))} /></Field>
              <Field label="Par value"><input className={fieldClass} type="number" inputMode="decimal" step="0.0001" value={shareClassDraft.parValue || ''} onChange={e => setShareClassDraft(p => ({ ...p, parValue: toNumber(e.target.value) }))} /></Field>
              <div className="flex items-end"><button onClick={saveShareClass} className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-4 py-3 flex items-center justify-center gap-2"><Plus size={16}/>{editingShareClassId ? 'Update Class' : 'Add Class'}</button></div>
              <div className="md:col-span-4"><Field label="Description"><input className={fieldClass} value={shareClassDraft.description || ''} onChange={e => setShareClassDraft(p => ({ ...p, description: e.target.value }))} placeholder="Founder/common shares, preferred investor class, etc." /></Field></div>
            </div>
            <div className="space-y-2">
              {state.shareClasses.map(c => (
                <div key={c.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-black text-slate-950 dark:text-white">{c.name}</div>
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{formatShares(c.authorizedShares)} authorized • par {money(c.parValue, currencySymbol)}</div>
                    {c.description && <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">{c.description}</div>}
                  </div>
                  <div className="flex gap-1"><button onClick={() => editShareClass(c)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><Edit3 size={16}/></button><button onClick={() => deleteShareClass(c.id)} className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"><Trash2 size={16}/></button></div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {activeSection === 'stakeholders' && (
        <section className={`${cardClass} p-5 space-y-5`}>
          <div>
            <h2 className="text-xl font-black text-slate-950 dark:text-white">Stakeholders</h2>
            <p className={subTextClass}>A stakeholder is a person/entity record. They become a shareholder only after you record an issued-share transaction.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <Field label="Name"><input className={fieldClass} value={stakeholderDraft.name || ''} onChange={e => setStakeholderDraft(p => ({ ...p, name: e.target.value }))} placeholder="Investor or founder name" /></Field>
            <Field label="Type"><select className={fieldClass} value={stakeholderDraft.type || 'investor'} onChange={e => setStakeholderDraft(p => ({ ...p, type: e.target.value as EquityStakeholderType }))}><option value="founder">Founder</option><option value="investor">Investor</option><option value="advisor">Advisor</option><option value="employee">Employee/Contractor</option><option value="entity">Entity/LLC</option><option value="other">Other</option></select></Field>
            <Field label="Email"><input className={fieldClass} value={stakeholderDraft.email || ''} onChange={e => setStakeholderDraft(p => ({ ...p, email: e.target.value }))} placeholder="email@example.com" /></Field>
            <Field label="Address"><input className={fieldClass} value={stakeholderDraft.address || ''} onChange={e => setStakeholderDraft(p => ({ ...p, address: e.target.value }))} placeholder="Optional" /></Field>
            <div className="flex items-end"><button onClick={saveStakeholder} className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-4 py-3 flex items-center justify-center gap-2"><Plus size={16}/>{editingStakeholderId ? 'Update' : 'Add'}</button></div>
            <div className="md:col-span-5"><Field label="Notes"><input className={fieldClass} value={stakeholderDraft.notes || ''} onChange={e => setStakeholderDraft(p => ({ ...p, notes: e.target.value }))} placeholder="Internal notes about this stakeholder" /></Field></div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {state.stakeholders.length === 0 ? <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-4 text-sm font-semibold text-slate-500 dark:text-slate-400">No stakeholders yet. Add at least one stakeholder before recording shares.</div> : state.stakeholders.map(s => (
              <div key={s.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-start justify-between gap-3">
                <div>
                  <div className="font-black text-slate-950 dark:text-white">{s.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2"><span className={statusPillClass('slate')}>{s.type}</span>{s.email && <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{s.email}</span>}</div>
                  {s.notes && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{s.notes}</p>}
                </div>
                <div className="flex gap-1"><button onClick={() => editStakeholder(s)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><Edit3 size={16}/></button><button onClick={() => deleteStakeholder(s.id)} className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"><Trash2 size={16}/></button></div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeSection === 'issuance' && (
        <section className={`${cardClass} p-5 space-y-5`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-950 dark:text-white">Guided Share Issuance</h2>
              <p className={subTextClass}>This is the exact place to record who received shares, how many shares, and what they paid.</p>
            </div>
            <button onClick={exportLedgerCsv} className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-extrabold flex items-center gap-2"><Download size={16}/> Stock Ledger CSV</button>
          </div>

          <div className="rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><div className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Selected recipient</div><div className="mt-1 font-black text-slate-950 dark:text-white">{selectedHolder?.name || 'Not selected'}</div></div>
            <div><div className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Share class</div><div className="mt-1 font-black text-slate-950 dark:text-white">{selectedShareClass?.name || 'Not selected'}</div></div>
            <div><div className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Amount paid calculation</div><div className="mt-1 font-black text-slate-950 dark:text-white">{money(issuancePaidAmount, currencySymbol)}</div><div className="text-xs font-semibold text-slate-500 dark:text-slate-400">shares × price/share</div></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Field label="Issue date"><input className={fieldClass} type="date" value={issuanceDraft.issueDate || todayIso()} onChange={e => setIssuanceDraft(p => ({ ...p, issueDate: e.target.value }))} /></Field>
            <Field label="Who receives shares?"><select className={fieldClass} value={issuanceDraft.stakeholderId || ''} onChange={e => setIssuanceDraft(p => ({ ...p, stakeholderId: e.target.value }))}><option value="">Select stakeholder</option>{state.stakeholders.map(s => <option key={s.id} value={s.id}>{s.name} — {s.type}</option>)}</select></Field>
            <Field label="Share class"><select className={fieldClass} value={issuanceDraft.shareClassId || state.shareClasses[0]?.id || ''} onChange={e => setIssuanceDraft(p => ({ ...p, shareClassId: e.target.value }))}>{state.shareClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <Field label="Status"><select className={fieldClass} value={issuanceDraft.status || 'issued'} onChange={e => setIssuanceDraft(p => ({ ...p, status: e.target.value as EquityIssuanceStatus }))}><option value="issued">Issued</option><option value="cancelled">Cancelled</option><option value="transferred">Transferred</option><option value="repurchased">Repurchased</option></select></Field>
            <Field label="Shares issued"><input className={fieldClass} type="number" inputMode="decimal" value={issuanceDraft.shares || ''} onChange={e => setIssuanceDraft(p => ({ ...p, shares: toNumber(e.target.value) }))} placeholder="200000" /></Field>
            <Field label="Price per share"><input className={fieldClass} type="number" inputMode="decimal" step="0.0001" value={issuanceDraft.pricePerShare || ''} onChange={e => setIssuanceDraft(p => ({ ...p, pricePerShare: toNumber(e.target.value) }))} placeholder="0.25" /></Field>
            <Field label="Amount paid"><input className={fieldClass} readOnly value={money(issuancePaidAmount, currencySymbol)} /></Field>
            <Field label="Consideration"><select className={fieldClass} value={issuanceDraft.considerationType || 'cash'} onChange={e => setIssuanceDraft(p => ({ ...p, considerationType: e.target.value as EquityConsiderationType }))}><option value="cash">Cash</option><option value="services">Services</option><option value="ip">IP / property</option><option value="note_conversion">Note conversion</option><option value="safe_conversion">SAFE conversion</option><option value="other">Other</option></select></Field>
            <Field label="Board approval date"><input className={fieldClass} type="date" value={issuanceDraft.boardApprovalDate || ''} onChange={e => setIssuanceDraft(p => ({ ...p, boardApprovalDate: e.target.value }))} /></Field>
            <Field label="Certificate number"><input className={fieldClass} value={issuanceDraft.certificateNumber || ''} onChange={e => setIssuanceDraft(p => ({ ...p, certificateNumber: e.target.value }))} placeholder="CS-001" /></Field>
            <div className="md:col-span-2"><Field label="Consideration description"><input className={fieldClass} value={issuanceDraft.considerationDescription || ''} onChange={e => setIssuanceDraft(p => ({ ...p, considerationDescription: e.target.value }))} placeholder="Cash investment: $50,000 at $0.25/share" /></Field></div>
            <div className="md:col-span-2"><Field label="Vesting terms"><input className={fieldClass} value={issuanceDraft.vestingTerms || ''} onChange={e => setIssuanceDraft(p => ({ ...p, vestingTerms: e.target.value }))} placeholder="No vesting, or four-year vesting placeholder" /></Field></div>
            <div className="md:col-span-2"><Field label="Restriction legend"><input className={fieldClass} value={issuanceDraft.restrictionLegend || ''} onChange={e => setIssuanceDraft(p => ({ ...p, restrictionLegend: e.target.value }))} placeholder="Restricted securities legend placeholder" /></Field></div>
            <div className="md:col-span-3"><Field label="Notes"><input className={fieldClass} value={issuanceDraft.notes || ''} onChange={e => setIssuanceDraft(p => ({ ...p, notes: e.target.value }))} placeholder="Internal record note" /></Field></div>
            <div className="flex items-end"><button onClick={saveIssuance} className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-4 py-3 flex items-center justify-center gap-2"><Plus size={16}/>{editingIssuanceId ? 'Update Issuance' : 'Record Issuance'}</button></div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900"><tr>{['Date','Holder','Class','Shares','Price','Amount Paid','Certificate','Status',''].map(h => <th key={h} className="px-3 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {state.issuances.length === 0 ? <tr><td colSpan={9} className="px-3 py-6 text-center font-semibold text-slate-500">No issuances recorded yet.</td></tr> : state.issuances.map(i => {
                  const holder = state.stakeholders.find(s => s.id === i.stakeholderId);
                  const cls = state.shareClasses.find(c => c.id === i.shareClassId);
                  return <tr key={i.id}><td className="px-3 py-3 font-semibold">{i.issueDate}</td><td className="px-3 py-3 font-bold text-slate-950 dark:text-white">{holder?.name || 'Unassigned'}</td><td className="px-3 py-3">{cls?.name || 'Unassigned'}</td><td className="px-3 py-3">{formatShares(i.shares)}</td><td className="px-3 py-3">{money(i.pricePerShare, currencySymbol)}</td><td className="px-3 py-3 font-bold">{money(i.shares * i.pricePerShare, currencySymbol)}</td><td className="px-3 py-3">{i.certificateNumber || '—'}</td><td className="px-3 py-3"><span className={statusPillClass(issuanceTone(i.status))}>{i.status}</span></td><td className="px-3 py-3 text-right"><button onClick={() => editIssuance(i)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><Edit3 size={16}/></button><button onClick={() => deleteIssuance(i.id)} className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"><Trash2 size={16}/></button></td></tr>;
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeSection === 'captable' && (
        <section className={`${cardClass} p-5 space-y-4`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div><h2 className="text-xl font-black text-slate-950 dark:text-white">Cap Table Summary</h2><p className={subTextClass}>Calculated from active issued share records. SAFE records and reservations are not counted until converted into shares.</p></div>
            <button onClick={exportCapTableCsv} className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-extrabold flex items-center gap-2"><Download size={16}/> Cap Table CSV</button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800"><table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-50 dark:bg-slate-900"><tr>{['Stakeholder','Type','Class','Shares','Ownership','Cash Paid'].map(h => <th key={h} className="px-3 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-200 dark:divide-slate-800">{capRows.length === 0 ? <tr><td colSpan={6} className="px-3 py-6 text-center font-semibold text-slate-500">No outstanding issued shares yet.</td></tr> : capRows.map(row => <tr key={`${row.stakeholderId}-${row.shareClassId}`}><td className="px-3 py-3 font-black text-slate-950 dark:text-white">{row.stakeholderName}</td><td className="px-3 py-3 capitalize">{row.stakeholderType}</td><td className="px-3 py-3">{row.shareClassName}</td><td className="px-3 py-3">{formatShares(row.shares)}</td><td className="px-3 py-3 font-bold">{percent(row.ownershipPct)}</td><td className="px-3 py-3">{money(row.cashPaid, currencySymbol)}</td></tr>)}</tbody></table></div>
        </section>
      )}

      {activeSection === 'reservations' && (
        <section className={`${cardClass} p-5 space-y-5`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div><h2 className="text-xl font-black text-slate-950 dark:text-white">Investment Reservation Tracker</h2><p className={subTextClass}>Internal tracker for indications of interest. These are not issued shares and are not counted in ownership.</p></div>
            <button onClick={exportReservationsCsv} className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-extrabold flex items-center gap-2"><Download size={16}/> Reservations CSV</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Field label="Reservation date"><input className={fieldClass} type="date" value={reservationDraft.date || todayIso()} onChange={e => setReservationDraft(p => ({ ...p, date: e.target.value }))} /></Field>
            <Field label="Investor name"><input className={fieldClass} value={reservationDraft.investorName || ''} onChange={e => setReservationDraft(p => ({ ...p, investorName: e.target.value }))} placeholder="Investor name" /></Field>
            <Field label="Email"><input className={fieldClass} value={reservationDraft.email || ''} onChange={e => setReservationDraft(p => ({ ...p, email: e.target.value }))} placeholder="email@example.com" /></Field>
            <Field label="Phone"><input className={fieldClass} value={reservationDraft.phone || ''} onChange={e => setReservationDraft(p => ({ ...p, phone: e.target.value }))} placeholder="Optional" /></Field>
            <Field label="Entity/LLC"><input className={fieldClass} value={reservationDraft.entityName || ''} onChange={e => setReservationDraft(p => ({ ...p, entityName: e.target.value }))} placeholder="Optional entity name" /></Field>
            <Field label="Desired amount"><input className={fieldClass} type="number" inputMode="decimal" value={reservationDraft.desiredAmount || ''} onChange={e => setReservationDraft(p => ({ ...p, desiredAmount: toNumber(e.target.value) }))} placeholder="25000" /></Field>
            <Field label="Instrument"><select className={fieldClass} value={reservationDraft.instrumentType || 'undecided'} onChange={e => setReservationDraft(p => ({ ...p, instrumentType: e.target.value as EquityReservationInstrument }))}><option value="undecided">Undecided</option><option value="common_stock">Common stock</option><option value="safe">SAFE</option><option value="convertible_note">Convertible note</option></select></Field>
            <Field label="Status"><select className={fieldClass} value={reservationDraft.status || 'interested'} onChange={e => setReservationDraft(p => ({ ...p, status: e.target.value as EquityReservationStatus }))}><option value="interested">Interested</option><option value="reserved">Reserved</option><option value="confirmed">Confirmed</option><option value="declined">Declined</option><option value="converted">Converted</option></select></Field>
            <Field label="Follow-up date"><input className={fieldClass} type="date" value={reservationDraft.followUpDate || ''} onChange={e => setReservationDraft(p => ({ ...p, followUpDate: e.target.value }))} /></Field>
            <Field label="Typed signature/name"><input className={fieldClass} value={reservationDraft.signatureName || ''} onChange={e => setReservationDraft(p => ({ ...p, signatureName: e.target.value }))} placeholder="Optional" /></Field>
            <div className="md:col-span-2"><Field label="Notes"><input className={fieldClass} value={reservationDraft.notes || ''} onChange={e => setReservationDraft(p => ({ ...p, notes: e.target.value }))} placeholder="What did they commit/reserve? Follow-up notes." /></Field></div>
            <div className="md:col-span-4"><button onClick={saveReservation} className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-4 py-3 flex items-center justify-center gap-2"><Plus size={16}/>{editingReservationId ? 'Update Reservation' : 'Record Reservation'}</button></div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {state.reservations.length === 0 ? <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-4 text-sm font-semibold text-slate-500 dark:text-slate-400">No reservations yet.</div> : state.reservations.map(r => (
              <div key={r.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-start justify-between gap-3">
                <div>
                  <div className="font-black text-slate-950 dark:text-white">{r.investorName} • {money(r.desiredAmount, currencySymbol)}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2"><span className={statusPillClass(reservationTone(r.status))}>{r.status}</span><span className={statusPillClass('slate')}>{formatInstrument(r.instrumentType)}</span>{r.email && <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{r.email}</span>}</div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-2">{r.date}{r.followUpDate ? ` • follow up ${r.followUpDate}` : ''}{r.entityName ? ` • ${r.entityName}` : ''}</div>
                  {r.notes && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{r.notes}</p>}
                </div>
                <div className="flex gap-1"><button onClick={() => editReservation(r)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><Edit3 size={16}/></button><button onClick={() => deleteReservation(r.id)} className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"><Trash2 size={16}/></button></div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeSection === 'safes' && (
        <section className={`${cardClass} p-5 space-y-5`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><h2 className="text-xl font-black text-slate-950 dark:text-white">SAFE / Convertible Instrument Tracker</h2><p className={subTextClass}>SAFEs are investments that do not become issued shares until conversion. Keep them separate from the stock ledger.</p></div><button onClick={exportSafesCsv} className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-extrabold flex items-center gap-2"><Download size={16}/> SAFE CSV</button></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Field label="Date"><input className={fieldClass} type="date" value={safeDraft.date || todayIso()} onChange={e => setSafeDraft(p => ({ ...p, date: e.target.value }))} /></Field>
            <Field label="Linked stakeholder"><select className={fieldClass} value={safeDraft.investorId || ''} onChange={e => { const investor = state.stakeholders.find(s => s.id === e.target.value); setSafeDraft(p => ({ ...p, investorId: e.target.value, investorName: investor?.name || p.investorName || '' })); }}><option value="">No linked stakeholder</option>{state.stakeholders.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
            <Field label="Investor name"><input className={fieldClass} value={safeDraft.investorName || ''} onChange={e => setSafeDraft(p => ({ ...p, investorName: e.target.value }))} placeholder="Investor name" /></Field>
            <Field label="Amount"><input className={fieldClass} type="number" inputMode="decimal" value={safeDraft.amount || ''} onChange={e => setSafeDraft(p => ({ ...p, amount: toNumber(e.target.value) }))} placeholder="25000" /></Field>
            <Field label="Valuation cap"><input className={fieldClass} type="number" inputMode="decimal" value={safeDraft.valuationCap ?? ''} onChange={e => setSafeDraft(p => ({ ...p, valuationCap: e.target.value === '' ? undefined : toNumber(e.target.value) }))} placeholder="5000000" /></Field>
            <Field label="Discount %"><input className={fieldClass} type="number" inputMode="decimal" value={safeDraft.discountRate ?? ''} onChange={e => setSafeDraft(p => ({ ...p, discountRate: e.target.value === '' ? undefined : toNumber(e.target.value) }))} placeholder="20" /></Field>
            <Field label="Type"><select className={fieldClass} value={safeDraft.type || 'unknown'} onChange={e => setSafeDraft(p => ({ ...p, type: e.target.value as EquitySafeInstrument['type'] }))}><option value="unknown">Type unknown</option><option value="post-money">Post-money SAFE</option><option value="pre-money">Pre-money SAFE</option></select></Field>
            <Field label="Status"><select className={fieldClass} value={safeDraft.status || 'active'} onChange={e => setSafeDraft(p => ({ ...p, status: e.target.value as EquitySafeStatus }))}><option value="active">Active</option><option value="converted">Converted</option><option value="cancelled">Cancelled</option></select></Field>
            <label className="rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-3 flex items-center gap-2 font-bold"><input type="checkbox" checked={!!safeDraft.mfn} onChange={e => setSafeDraft(p => ({ ...p, mfn: e.target.checked }))}/> MFN</label>
            <div className="md:col-span-2"><Field label="Notes"><input className={fieldClass} value={safeDraft.notes || ''} onChange={e => setSafeDraft(p => ({ ...p, notes: e.target.value }))} placeholder="Internal notes" /></Field></div>
            <div className="flex items-end"><button onClick={saveSafe} className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-4 py-3 flex items-center justify-center gap-2"><Plus size={16}/>{editingSafeId ? 'Update SAFE' : 'Add SAFE'}</button></div>
          </div>
          <div className="space-y-2">{state.safes.length === 0 ? <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-4 text-sm font-semibold text-slate-500 dark:text-slate-400">No SAFE records yet.</div> : state.safes.map(s => <div key={s.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex items-center justify-between gap-3"><div><div className="font-black text-slate-950 dark:text-white">{s.investorName} • {money(s.amount, currencySymbol)}</div><div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{s.date} • {s.type || 'unknown'} • {s.status}{s.valuationCap ? ` • Cap ${money(s.valuationCap, currencySymbol)}` : ''}</div>{s.notes && <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{s.notes}</p>}</div><div className="flex gap-1"><button onClick={() => { setEditingSafeId(s.id); setSafeDraft(s); }} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><Edit3 size={16}/></button><button onClick={() => deleteSafe(s.id)} className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"><Trash2 size={16}/></button></div></div>)}</div>
        </section>
      )}
    </div>
  );
}
