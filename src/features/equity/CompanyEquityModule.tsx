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
  EquityIssuance,
  EquityIssuanceStatus,
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

const fieldClass = 'w-full px-3 py-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-semibold outline-none focus:ring-2 focus:ring-blue-500/40';
const labelClass = 'text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 block';
const cardClass = 'bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm';

const emptyStakeholder = (): Partial<EquityStakeholder> => ({ type: 'founder', name: '', email: '', address: '', notes: '' });
const emptyShareClass = (): Partial<EquityShareClass> => ({ name: '', authorizedShares: 0, parValue: 0.0001, description: '' });
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

export function CompanyEquityModule({ equity, onChange, currencySymbol, defaultBusinessName, showToast }: Props) {
  const state = useMemo(() => normalizeCompanyEquityState(equity, defaultBusinessName), [equity, defaultBusinessName]);
  const totals = useMemo(() => calculateEquityTotals(state), [state]);
  const capRows = useMemo(() => buildCapTableRows(state), [state]);

  const [stakeholderDraft, setStakeholderDraft] = useState<Partial<EquityStakeholder>>(emptyStakeholder());
  const [editingStakeholderId, setEditingStakeholderId] = useState<string | null>(null);
  const [shareClassDraft, setShareClassDraft] = useState<Partial<EquityShareClass>>(emptyShareClass());
  const [editingShareClassId, setEditingShareClassId] = useState<string | null>(null);
  const [issuanceDraft, setIssuanceDraft] = useState<Partial<EquityIssuance>>(emptyIssuance(state.shareClasses[0]?.id));
  const [editingIssuanceId, setEditingIssuanceId] = useState<string | null>(null);
  const [safeDraft, setSafeDraft] = useState<Partial<EquitySafeInstrument>>(emptySafe());
  const [editingSafeId, setEditingSafeId] = useState<string | null>(null);

  const updateProfile = (patch: Partial<CompanyEquityState['profile']>) => {
    onChange(prev => {
      const normalized = normalizeCompanyEquityState(prev, defaultBusinessName);
      return { ...normalized, profile: { ...normalized.profile, ...patch } };
    });
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
  };

  const deleteStakeholder = (id: string) => {
    const isUsed = state.issuances.some(i => i.stakeholderId === id) || state.safes.some(s => s.investorId === id);
    if (isUsed) return showToast('This stakeholder is linked to equity records. Delete or reassign those records first.', 'error');
    if (!confirm('Delete this stakeholder?')) return;
    onChange(prev => ({ ...normalizeCompanyEquityState(prev, defaultBusinessName), stakeholders: normalizeCompanyEquityState(prev, defaultBusinessName).stakeholders.filter(s => s.id !== id) }));
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

  const deleteShareClass = (id: string) => {
    if (state.shareClasses.length <= 1) return showToast('At least one share class is required.', 'error');
    if (state.issuances.some(i => i.shareClassId === id)) return showToast('This share class has issuances. Delete or reassign those records first.', 'error');
    if (!confirm('Delete this share class?')) return;
    onChange(prev => ({ ...normalizeCompanyEquityState(prev, defaultBusinessName), shareClasses: normalizeCompanyEquityState(prev, defaultBusinessName).shareClasses.filter(c => c.id !== id) }));
    showToast('Share class deleted.', 'info');
  };

  const saveIssuance = () => {
    if (!issuanceDraft.stakeholderId) return showToast('Select a stakeholder before saving an issuance.', 'error');
    if (!issuanceDraft.shareClassId) return showToast('Select a share class before saving an issuance.', 'error');
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
        considerationType: issuanceDraft.considerationType || 'cash',
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
        valuationCap: safeDraft.valuationCap === undefined ? undefined : toNumber(safeDraft.valuationCap),
        discountRate: safeDraft.discountRate === undefined ? undefined : toNumber(safeDraft.discountRate),
        mfn: !!safeDraft.mfn,
        type: safeDraft.type || 'unknown',
        status: (safeDraft.status || 'active') as EquitySafeStatus,
        notes: safeDraft.notes || '',
      };
      if (editingSafeId) return { ...normalized, safes: normalized.safes.map(s => s.id === editingSafeId ? { id: s.id, ...payload } : s) };
      return { ...normalized, safes: [{ id: newId('eq_safe'), ...payload }, ...normalized.safes] };
    });
    setSafeDraft(emptySafe());
    setEditingSafeId(null);
    showToast(editingSafeId ? 'SAFE record updated.' : 'SAFE record added.', 'success');
  };

  const exportCapTableCsv = () => {
    const rows = [
      ['Stakeholder', 'Type', 'Share Class', 'Outstanding Shares', 'Ownership %', 'Cash Paid'],
      ...capRows.map(row => [row.stakeholderName, row.stakeholderType, row.shareClassName, row.shares, row.ownershipPct.toFixed(6), row.cashPaid.toFixed(2)]),
    ];
    downloadText('MONIEZI_Company_Equity_Cap_Table.csv', toCsv(rows));
    showToast('Cap table CSV exported.', 'success');
  };

  const exportStockLedgerCsv = () => {
    const rows = [
      ['Issue Date', 'Board Approval Date', 'Certificate #', 'Stakeholder', 'Share Class', 'Shares', 'Price/Share', 'Total Consideration', 'Consideration Type', 'Status', 'Vesting Terms', 'Restriction Legend', 'Notes'],
      ...state.issuances.map(i => {
        const holder = state.stakeholders.find(s => s.id === i.stakeholderId);
        const cls = state.shareClasses.find(c => c.id === i.shareClassId);
        return [i.issueDate, i.boardApprovalDate || '', i.certificateNumber || '', holder?.name || 'Unassigned holder', cls?.name || 'Unassigned class', i.shares, i.pricePerShare, (i.shares * i.pricePerShare).toFixed(2), i.considerationType, i.status, i.vestingTerms || '', i.restrictionLegend || '', i.notes || ''];
      }),
    ];
    downloadText('MONIEZI_Company_Equity_Stock_Ledger.csv', toCsv(rows));
    showToast('Stock ledger CSV exported.', 'success');
  };

  const exportSafesCsv = () => {
    const rows = [
      ['Date', 'Investor', 'Amount', 'Valuation Cap', 'Discount %', 'MFN', 'Type', 'Status', 'Notes'],
      ...state.safes.map(s => [s.date, s.investorName, s.amount, s.valuationCap ?? '', s.discountRate ?? '', s.mfn ? 'Yes' : 'No', s.type || 'unknown', s.status, s.notes || '']),
    ];
    downloadText('MONIEZI_Company_Equity_SAFEs.csv', toCsv(rows));
    showToast('SAFE CSV exported.', 'success');
  };

  const loadDemoEquity = () => {
    if (state.issuances.length > 0 || state.stakeholders.length > 0 || state.safes.length > 0) {
      if (!confirm('Replace current equity demo records? This only affects the Company Equity module.')) return;
    }
    onChange(createDemoEquityState(defaultBusinessName || 'MONIEZI Demo Company'));
    showToast('Demo equity records loaded.', 'success');
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-8">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-300 text-xs font-black uppercase tracking-[0.2em] mb-2">
            <Landmark size={16} /> Internal Founder Business Module
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-950 dark:text-white">Company Equity Register</h1>
          <p className="mt-2 text-sm sm:text-base font-medium text-slate-600 dark:text-slate-300 max-w-2xl">
            Track authorized shares, share classes, stakeholders, stock issuances, SAFE notes, and cap table summaries for internal recordkeeping.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportCapTableCsv} className="px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-extrabold flex items-center gap-2 shadow-lg shadow-blue-500/20"><Download size={16}/> Cap Table CSV</button>
          <button onClick={exportStockLedgerCsv} className="px-4 py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-sm font-extrabold flex items-center gap-2"><Download size={16}/> Stock Ledger CSV</button>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-950/30 p-4 flex items-start gap-3">
        <AlertTriangle className="text-amber-600 dark:text-amber-300 mt-0.5" size={20}/>
        <div className="text-sm text-amber-950 dark:text-amber-100 font-semibold leading-relaxed">
          This module is an internal register only. It does not replace board approvals, securities filings, investor disclosures, e-signatures, tax advice, or attorney-reviewed issuance documents.
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <SummaryCard label="Authorized" value={formatShares(totals.authorizedShares)} note="Company-level authorized shares" icon={<Shield size={20}/>} />
        <SummaryCard label="Outstanding" value={formatShares(totals.issuedShares)} note="Issued records with active issued status" icon={<CheckCircle size={20}/>} />
        <SummaryCard label="Unissued" value={formatShares(totals.unissuedShares)} note="Authorized less outstanding" icon={<FileText size={20}/>} />
        <SummaryCard label="Active SAFEs" value={money(totals.activeSafeAmount, currencySymbol)} note={`${totals.activeSafeCount} active SAFE record${totals.activeSafeCount === 1 ? '' : 's'}`} icon={<Landmark size={20}/>} />
      </div>

      <section className={`${cardClass} p-5`}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-black text-slate-950 dark:text-white flex items-center gap-2"><Building2 size={20}/> Company Setup</h2>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">Set the basic corporation/equity profile used by the register.</p>
          </div>
          <button onClick={loadDemoEquity} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-extrabold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">Load Demo Equity</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <div><label className={labelClass}>Legal company name</label><input className={fieldClass} value={state.profile.legalName} onChange={e => updateProfile({ legalName: e.target.value })} placeholder="EMYRGEN GROUP INC." /></div>
          <div><label className={labelClass}>State of incorporation</label><input className={fieldClass} value={state.profile.stateOfIncorporation || ''} onChange={e => updateProfile({ stateOfIncorporation: e.target.value })} placeholder="Wyoming" /></div>
          <div><label className={labelClass}>Authorized shares</label><input className={fieldClass} type="number" inputMode="decimal" value={state.profile.authorizedShares || ''} onChange={e => updateProfile({ authorizedShares: toNumber(e.target.value) })} /></div>
          <div><label className={labelClass}>Default par value</label><input className={fieldClass} type="number" step="0.0001" inputMode="decimal" value={state.profile.parValue || ''} onChange={e => updateProfile({ parValue: toNumber(e.target.value) })} /></div>
        </div>
        <div className="mt-3"><label className={labelClass}>Internal notes</label><textarea className={`${fieldClass} min-h-[76px]`} value={state.profile.notes || ''} onChange={e => updateProfile({ notes: e.target.value })} placeholder="Corporate approvals, counsel notes, transfer restrictions, or due diligence reminders." /></div>
      </section>

      <section className={`${cardClass} p-5`}>
        <h2 className="text-xl font-black text-slate-950 dark:text-white flex items-center gap-2 mb-1"><Users size={20}/> Stakeholders</h2>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-4">Founders, investors, advisors, employees, and entities tied to equity records.</p>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
          <input className={`${fieldClass} md:col-span-2`} value={stakeholderDraft.name || ''} onChange={e => setStakeholderDraft(p => ({ ...p, name: e.target.value }))} placeholder="Name or entity" />
          <select className={fieldClass} value={stakeholderDraft.type || 'founder'} onChange={e => setStakeholderDraft(p => ({ ...p, type: e.target.value as EquityStakeholderType }))}>
            <option value="founder">Founder</option><option value="investor">Investor</option><option value="advisor">Advisor</option><option value="employee">Employee</option><option value="entity">Entity</option><option value="other">Other</option>
          </select>
          <input className={fieldClass} value={stakeholderDraft.email || ''} onChange={e => setStakeholderDraft(p => ({ ...p, email: e.target.value }))} placeholder="Email" />
          <button onClick={saveStakeholder} className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-4 py-3 flex items-center justify-center gap-2"><Plus size={16}/>{editingStakeholderId ? 'Update' : 'Add'}</button>
        </div>
        <div className="space-y-2">
          {state.stakeholders.length === 0 ? <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-4 text-sm font-semibold text-slate-500 dark:text-slate-400">No stakeholders yet.</div> : state.stakeholders.map(s => (
            <div key={s.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex items-center justify-between gap-3">
              <div className="min-w-0"><div className="font-black text-slate-950 dark:text-white truncate">{s.name}</div><div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{s.type}{s.email ? ` • ${s.email}` : ''}</div></div>
              <div className="flex gap-1"><button onClick={() => editStakeholder(s)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><Edit3 size={16}/></button><button onClick={() => deleteStakeholder(s.id)} className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"><Trash2 size={16}/></button></div>
            </div>
          ))}
        </div>
      </section>

      <section className={`${cardClass} p-5`}>
        <h2 className="text-xl font-black text-slate-950 dark:text-white mb-1">Share Classes</h2>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-4">Common, preferred, founder common, or other internal classes.</p>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
          <input className={`${fieldClass} md:col-span-2`} value={shareClassDraft.name || ''} onChange={e => setShareClassDraft(p => ({ ...p, name: e.target.value }))} placeholder="Common Stock" />
          <input className={fieldClass} type="number" inputMode="decimal" value={shareClassDraft.authorizedShares || ''} onChange={e => setShareClassDraft(p => ({ ...p, authorizedShares: toNumber(e.target.value) }))} placeholder="Authorized" />
          <input className={fieldClass} type="number" step="0.0001" inputMode="decimal" value={shareClassDraft.parValue || ''} onChange={e => setShareClassDraft(p => ({ ...p, parValue: toNumber(e.target.value) }))} placeholder="Par value" />
          <button onClick={saveShareClass} className="rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-extrabold px-4 py-3 flex items-center justify-center gap-2"><Plus size={16}/>{editingShareClassId ? 'Update' : 'Add'}</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {state.shareClasses.map(c => (
            <div key={c.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-start justify-between gap-3"><div><div className="font-black text-slate-950 dark:text-white">{c.name}</div><div className="text-sm font-semibold text-slate-500 dark:text-slate-400">Authorized {formatShares(c.authorizedShares)} • Par {c.parValue}</div></div><div className="flex gap-1"><button onClick={() => { setEditingShareClassId(c.id); setShareClassDraft(c); }} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><Edit3 size={16}/></button><button onClick={() => deleteShareClass(c.id)} className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"><Trash2 size={16}/></button></div></div>
            </div>
          ))}
        </div>
      </section>

      <section className={`${cardClass} p-5`}>
        <h2 className="text-xl font-black text-slate-950 dark:text-white mb-1">Share Issuance Ledger</h2>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-4">Record each stock issuance with approval date, certificate number, consideration, vesting, and restrictions.</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <input className={fieldClass} type="date" value={issuanceDraft.issueDate || todayIso()} onChange={e => setIssuanceDraft(p => ({ ...p, issueDate: e.target.value }))} />
          <select className={fieldClass} value={issuanceDraft.stakeholderId || ''} onChange={e => setIssuanceDraft(p => ({ ...p, stakeholderId: e.target.value }))}><option value="">Select stakeholder</option>{state.stakeholders.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <select className={fieldClass} value={issuanceDraft.shareClassId || state.shareClasses[0]?.id || ''} onChange={e => setIssuanceDraft(p => ({ ...p, shareClassId: e.target.value }))}>{state.shareClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <input className={fieldClass} type="number" inputMode="decimal" value={issuanceDraft.shares || ''} onChange={e => setIssuanceDraft(p => ({ ...p, shares: toNumber(e.target.value) }))} placeholder="Shares" />
          <input className={fieldClass} type="number" step="0.0001" inputMode="decimal" value={issuanceDraft.pricePerShare || ''} onChange={e => setIssuanceDraft(p => ({ ...p, pricePerShare: toNumber(e.target.value) }))} placeholder="Price/share" />
          <select className={fieldClass} value={issuanceDraft.considerationType || 'cash'} onChange={e => setIssuanceDraft(p => ({ ...p, considerationType: e.target.value as any }))}><option value="cash">Cash</option><option value="services">Services</option><option value="ip">IP/property</option><option value="note_conversion">Note conversion</option><option value="safe_conversion">SAFE conversion</option><option value="other">Other</option></select>
          <input className={fieldClass} type="date" value={issuanceDraft.boardApprovalDate || ''} onChange={e => setIssuanceDraft(p => ({ ...p, boardApprovalDate: e.target.value }))} placeholder="Board approval" />
          <input className={fieldClass} value={issuanceDraft.certificateNumber || ''} onChange={e => setIssuanceDraft(p => ({ ...p, certificateNumber: e.target.value }))} placeholder="Certificate #" />
          <select className={fieldClass} value={issuanceDraft.status || 'issued'} onChange={e => setIssuanceDraft(p => ({ ...p, status: e.target.value as EquityIssuanceStatus }))}><option value="issued">Issued</option><option value="cancelled">Cancelled</option><option value="transferred">Transferred</option><option value="repurchased">Repurchased</option></select>
          <input className={`${fieldClass} md:col-span-3`} value={issuanceDraft.considerationDescription || ''} onChange={e => setIssuanceDraft(p => ({ ...p, considerationDescription: e.target.value }))} placeholder="Consideration description" />
          <input className={`${fieldClass} md:col-span-2`} value={issuanceDraft.vestingTerms || ''} onChange={e => setIssuanceDraft(p => ({ ...p, vestingTerms: e.target.value }))} placeholder="Vesting terms" />
          <input className={`${fieldClass} md:col-span-2`} value={issuanceDraft.restrictionLegend || ''} onChange={e => setIssuanceDraft(p => ({ ...p, restrictionLegend: e.target.value }))} placeholder="Restriction legend" />
          <button onClick={saveIssuance} className="md:col-span-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-4 py-3 flex items-center justify-center gap-2"><Plus size={16}/>{editingIssuanceId ? 'Update Issuance' : 'Record Issuance'}</button>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[850px] text-sm"><thead className="bg-slate-50 dark:bg-slate-900"><tr>{['Date','Holder','Class','Shares','Price','Certificate','Status',''].map(h => <th key={h} className="px-3 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-200 dark:divide-slate-800">{state.issuances.length === 0 ? <tr><td colSpan={8} className="px-3 py-6 text-center font-semibold text-slate-500">No issuances recorded yet.</td></tr> : state.issuances.map(i => { const holder = state.stakeholders.find(s => s.id === i.stakeholderId); const cls = state.shareClasses.find(c => c.id === i.shareClassId); return <tr key={i.id}><td className="px-3 py-3 font-semibold">{i.issueDate}</td><td className="px-3 py-3 font-bold text-slate-950 dark:text-white">{holder?.name || 'Unassigned'}</td><td className="px-3 py-3">{cls?.name || 'Unassigned'}</td><td className="px-3 py-3">{formatShares(i.shares)}</td><td className="px-3 py-3">{money(i.pricePerShare, currencySymbol)}</td><td className="px-3 py-3">{i.certificateNumber || '—'}</td><td className="px-3 py-3"><span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-1 text-xs font-black uppercase">{i.status}</span></td><td className="px-3 py-3 text-right"><button onClick={() => { setEditingIssuanceId(i.id); setIssuanceDraft(i); }} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><Edit3 size={16}/></button><button onClick={() => { if (!confirm('Delete this issuance record?')) return; onChange(prev => ({ ...normalizeCompanyEquityState(prev, defaultBusinessName), issuances: normalizeCompanyEquityState(prev, defaultBusinessName).issuances.filter(x => x.id !== i.id) })); showToast('Issuance deleted.', 'info'); }} className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"><Trash2 size={16}/></button></td></tr>; })}</tbody></table>
        </div>
      </section>

      <section className={`${cardClass} p-5`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4"><div><h2 className="text-xl font-black text-slate-950 dark:text-white">Cap Table Summary</h2><p className="text-sm font-medium text-slate-500 dark:text-slate-400">Calculated from active issued share records. SAFE records are tracked separately until converted.</p></div><button onClick={exportCapTableCsv} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-extrabold flex items-center gap-2"><Download size={16}/> Export</button></div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800"><table className="w-full min-w-[720px] text-sm"><thead className="bg-slate-50 dark:bg-slate-900"><tr>{['Stakeholder','Type','Class','Shares','Ownership','Cash Paid'].map(h => <th key={h} className="px-3 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-200 dark:divide-slate-800">{capRows.length === 0 ? <tr><td colSpan={6} className="px-3 py-6 text-center font-semibold text-slate-500">No outstanding issued shares yet.</td></tr> : capRows.map(row => <tr key={`${row.stakeholderId}-${row.shareClassId}`}><td className="px-3 py-3 font-black text-slate-950 dark:text-white">{row.stakeholderName}</td><td className="px-3 py-3 capitalize">{row.stakeholderType}</td><td className="px-3 py-3">{row.shareClassName}</td><td className="px-3 py-3">{formatShares(row.shares)}</td><td className="px-3 py-3 font-bold">{percent(row.ownershipPct)}</td><td className="px-3 py-3">{money(row.cashPaid, currencySymbol)}</td></tr>)}</tbody></table></div>
      </section>

      <section className={`${cardClass} p-5`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4"><div><h2 className="text-xl font-black text-slate-950 dark:text-white">SAFE / Convertible Instrument Tracker</h2><p className="text-sm font-medium text-slate-500 dark:text-slate-400">Track investor amount, valuation cap, discount, MFN, type, and conversion status.</p></div><button onClick={exportSafesCsv} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-extrabold flex items-center gap-2"><Download size={16}/> SAFE CSV</button></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <input className={fieldClass} type="date" value={safeDraft.date || todayIso()} onChange={e => setSafeDraft(p => ({ ...p, date: e.target.value }))} />
          <select className={fieldClass} value={safeDraft.investorId || ''} onChange={e => { const investor = state.stakeholders.find(s => s.id === e.target.value); setSafeDraft(p => ({ ...p, investorId: e.target.value, investorName: investor?.name || p.investorName || '' })); }}><option value="">No linked stakeholder</option>{state.stakeholders.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <input className={fieldClass} value={safeDraft.investorName || ''} onChange={e => setSafeDraft(p => ({ ...p, investorName: e.target.value }))} placeholder="Investor name" />
          <input className={fieldClass} type="number" inputMode="decimal" value={safeDraft.amount || ''} onChange={e => setSafeDraft(p => ({ ...p, amount: toNumber(e.target.value) }))} placeholder="Amount" />
          <input className={fieldClass} type="number" inputMode="decimal" value={safeDraft.valuationCap ?? ''} onChange={e => setSafeDraft(p => ({ ...p, valuationCap: e.target.value === '' ? undefined : toNumber(e.target.value) }))} placeholder="Valuation cap" />
          <input className={fieldClass} type="number" inputMode="decimal" value={safeDraft.discountRate ?? ''} onChange={e => setSafeDraft(p => ({ ...p, discountRate: e.target.value === '' ? undefined : toNumber(e.target.value) }))} placeholder="Discount %" />
          <select className={fieldClass} value={safeDraft.type || 'unknown'} onChange={e => setSafeDraft(p => ({ ...p, type: e.target.value as any }))}><option value="unknown">Type unknown</option><option value="post-money">Post-money SAFE</option><option value="pre-money">Pre-money SAFE</option></select>
          <select className={fieldClass} value={safeDraft.status || 'active'} onChange={e => setSafeDraft(p => ({ ...p, status: e.target.value as EquitySafeStatus }))}><option value="active">Active</option><option value="converted">Converted</option><option value="cancelled">Cancelled</option></select>
          <label className="rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-3 flex items-center gap-2 font-bold"><input type="checkbox" checked={!!safeDraft.mfn} onChange={e => setSafeDraft(p => ({ ...p, mfn: e.target.checked }))}/> MFN</label>
          <input className={`${fieldClass} md:col-span-2`} value={safeDraft.notes || ''} onChange={e => setSafeDraft(p => ({ ...p, notes: e.target.value }))} placeholder="Notes" />
          <button onClick={saveSafe} className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-4 py-3 flex items-center justify-center gap-2"><Plus size={16}/>{editingSafeId ? 'Update SAFE' : 'Add SAFE'}</button>
        </div>
        <div className="space-y-2">{state.safes.length === 0 ? <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-4 text-sm font-semibold text-slate-500 dark:text-slate-400">No SAFE records yet.</div> : state.safes.map(s => <div key={s.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex items-center justify-between gap-3"><div><div className="font-black text-slate-950 dark:text-white">{s.investorName} • {money(s.amount, currencySymbol)}</div><div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{s.date} • {s.type || 'unknown'} • {s.status}{s.valuationCap ? ` • Cap ${money(s.valuationCap, currencySymbol)}` : ''}</div></div><div className="flex gap-1"><button onClick={() => { setEditingSafeId(s.id); setSafeDraft(s); }} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><Edit3 size={16}/></button><button onClick={() => { if (!confirm('Delete this SAFE record?')) return; onChange(prev => ({ ...normalizeCompanyEquityState(prev, defaultBusinessName), safes: normalizeCompanyEquityState(prev, defaultBusinessName).safes.filter(x => x.id !== s.id) })); showToast('SAFE record deleted.', 'info'); }} className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"><Trash2 size={16}/></button></div></div>)}</div>
      </section>
    </div>
  );
}
