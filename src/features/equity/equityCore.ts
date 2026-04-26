import type {
  CompanyEquityState,
  EquityCapTableRow,
  EquityIssuance,
  EquitySafeInstrument,
  EquityShareClass,
  EquityStakeholder,
} from '../../../types';

export const todayIso = () => new Date().toISOString().split('T')[0];

const safeNumber = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const defaultShareClass = (): EquityShareClass => ({
  id: 'eq_cls_common',
  name: 'Common Stock',
  authorizedShares: 10000000,
  parValue: 0.0001,
  description: 'Founder/common shares',
});

export const createDefaultCompanyEquityState = (businessName = ''): CompanyEquityState => ({
  profile: {
    legalName: businessName || '',
    stateOfIncorporation: '',
    authorizedShares: 10000000,
    parValue: 0.0001,
    fiscalYearEnd: '12-31',
    notes: '',
  },
  shareClasses: [defaultShareClass()],
  stakeholders: [],
  issuances: [],
  safes: [],
});

export const normalizeCompanyEquityState = (raw: unknown, businessName = ''): CompanyEquityState => {
  const base = createDefaultCompanyEquityState(businessName);
  const obj = (raw && typeof raw === 'object') ? (raw as Partial<CompanyEquityState>) : {};
  const shareClasses = Array.isArray(obj.shareClasses) && obj.shareClasses.length
    ? obj.shareClasses.map((c, index) => ({
        id: String(c.id || `eq_cls_${index + 1}`),
        name: String(c.name || (index === 0 ? 'Common Stock' : `Share Class ${index + 1}`)),
        authorizedShares: safeNumber(c.authorizedShares, index === 0 ? base.profile.authorizedShares : 0),
        parValue: safeNumber(c.parValue, base.profile.parValue),
        description: c.description || '',
      }))
    : base.shareClasses;

  return {
    profile: {
      ...base.profile,
      ...(obj.profile || {}),
      legalName: String(obj.profile?.legalName || businessName || base.profile.legalName || ''),
      authorizedShares: safeNumber(obj.profile?.authorizedShares, base.profile.authorizedShares),
      parValue: safeNumber(obj.profile?.parValue, base.profile.parValue),
    },
    shareClasses,
    stakeholders: Array.isArray(obj.stakeholders) ? obj.stakeholders.map((s, index) => ({
      id: String(s.id || `eq_holder_${index + 1}`),
      name: String(s.name || 'Unnamed stakeholder'),
      email: s.email || '',
      address: s.address || '',
      type: s.type || 'founder',
      notes: s.notes || '',
      createdAt: s.createdAt || new Date().toISOString(),
      updatedAt: s.updatedAt || s.createdAt || new Date().toISOString(),
    })) : [],
    issuances: Array.isArray(obj.issuances) ? obj.issuances.map((i, index) => ({
      id: String(i.id || `eq_issue_${index + 1}`),
      issueDate: i.issueDate || todayIso(),
      stakeholderId: i.stakeholderId || '',
      shareClassId: i.shareClassId || shareClasses[0]?.id || 'eq_cls_common',
      shares: safeNumber(i.shares, 0),
      pricePerShare: safeNumber(i.pricePerShare, 0),
      considerationType: i.considerationType || 'cash',
      considerationDescription: i.considerationDescription || '',
      boardApprovalDate: i.boardApprovalDate || '',
      certificateNumber: i.certificateNumber || '',
      vestingTerms: i.vestingTerms || '',
      restrictionLegend: i.restrictionLegend || '',
      status: i.status || 'issued',
      notes: i.notes || '',
      createdAt: i.createdAt || new Date().toISOString(),
      updatedAt: i.updatedAt || i.createdAt || new Date().toISOString(),
    })) : [],
    safes: Array.isArray(obj.safes) ? obj.safes.map((s, index) => ({
      id: String(s.id || `eq_safe_${index + 1}`),
      investorId: s.investorId || '',
      investorName: s.investorName || '',
      date: s.date || todayIso(),
      amount: safeNumber(s.amount, 0),
      valuationCap: s.valuationCap === undefined || s.valuationCap === null ? undefined : safeNumber(s.valuationCap, 0),
      discountRate: s.discountRate === undefined || s.discountRate === null ? undefined : safeNumber(s.discountRate, 0),
      mfn: !!s.mfn,
      type: s.type || 'unknown',
      status: s.status || 'active',
      notes: s.notes || '',
    })) : [],
  };
};

export const getOutstandingIssuances = (issuances: EquityIssuance[]) =>
  issuances.filter(i => i.status === 'issued' && safeNumber(i.shares) > 0);

export const calculateEquityTotals = (state: CompanyEquityState) => {
  const outstandingIssuances = getOutstandingIssuances(state.issuances);
  const issuedShares = outstandingIssuances.reduce((sum, i) => sum + safeNumber(i.shares), 0);
  const authorizedByClasses = state.shareClasses.reduce((sum, c) => sum + safeNumber(c.authorizedShares), 0);
  const authorizedShares = safeNumber(state.profile.authorizedShares, authorizedByClasses || 0) || authorizedByClasses;
  const activeSafeAmount = state.safes
    .filter(s => s.status === 'active')
    .reduce((sum, s) => sum + safeNumber(s.amount), 0);
  return {
    authorizedShares,
    issuedShares,
    unissuedShares: Math.max(authorizedShares - issuedShares, 0),
    stakeholderCount: state.stakeholders.length,
    issuanceCount: state.issuances.length,
    activeSafeAmount,
    activeSafeCount: state.safes.filter(s => s.status === 'active').length,
  };
};

export const buildCapTableRows = (state: CompanyEquityState): EquityCapTableRow[] => {
  const outstanding = getOutstandingIssuances(state.issuances);
  const totalOutstanding = outstanding.reduce((sum, i) => sum + safeNumber(i.shares), 0);
  const rows = new Map<string, EquityCapTableRow>();

  for (const issuance of outstanding) {
    const stakeholder = state.stakeholders.find(s => s.id === issuance.stakeholderId);
    const shareClass = state.shareClasses.find(c => c.id === issuance.shareClassId);
    const key = `${issuance.stakeholderId || 'unknown'}::${issuance.shareClassId || 'unknown'}`;
    const existing = rows.get(key) || {
      stakeholderId: issuance.stakeholderId,
      stakeholderName: stakeholder?.name || 'Unassigned holder',
      stakeholderType: stakeholder?.type || 'other',
      shareClassId: issuance.shareClassId,
      shareClassName: shareClass?.name || 'Unassigned class',
      shares: 0,
      ownershipPct: 0,
      cashPaid: 0,
    };
    existing.shares += safeNumber(issuance.shares);
    existing.cashPaid += safeNumber(issuance.shares) * safeNumber(issuance.pricePerShare);
    rows.set(key, existing);
  }

  return Array.from(rows.values())
    .map(row => ({ ...row, ownershipPct: totalOutstanding > 0 ? (row.shares / totalOutstanding) * 100 : 0 }))
    .sort((a, b) => b.shares - a.shares || a.stakeholderName.localeCompare(b.stakeholderName));
};

export const formatShares = (value: unknown) => safeNumber(value).toLocaleString(undefined, { maximumFractionDigits: 4 });

export const csvEscape = (value: unknown) => {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

export const toCsv = (rows: unknown[][]) => rows.map(row => row.map(csvEscape).join(',')).join('\n');

export const createDemoEquityState = (businessName = 'MONIEZI Demo Studio'): CompanyEquityState => {
  const now = new Date().toISOString();
  const state = createDefaultCompanyEquityState(businessName);
  const founder: EquityStakeholder = {
    id: 'eq_holder_demo_founder',
    name: 'Founder',
    email: '',
    address: '',
    type: 'founder',
    notes: 'Demo founder record',
    createdAt: now,
    updatedAt: now,
  };
  const advisor: EquityStakeholder = {
    id: 'eq_holder_demo_advisor',
    name: 'Advisor Example',
    email: '',
    address: '',
    type: 'advisor',
    notes: 'Demo advisory equity placeholder',
    createdAt: now,
    updatedAt: now,
  };

  return {
    ...state,
    stakeholders: [founder, advisor],
    issuances: [
      {
        id: 'eq_issue_demo_1',
        issueDate: `${new Date().getFullYear()}-01-05`,
        stakeholderId: founder.id,
        shareClassId: state.shareClasses[0].id,
        shares: 8000000,
        pricePerShare: 0.0001,
        considerationType: 'services',
        considerationDescription: 'Founder services and assignment of startup work product',
        boardApprovalDate: `${new Date().getFullYear()}-01-05`,
        certificateNumber: 'CS-001',
        vestingTerms: 'Founder vesting placeholder — confirm with counsel.',
        restrictionLegend: 'Restricted securities legend placeholder.',
        status: 'issued',
        notes: 'Demo issuance only.',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'eq_issue_demo_2',
        issueDate: `${new Date().getFullYear()}-02-01`,
        stakeholderId: advisor.id,
        shareClassId: state.shareClasses[0].id,
        shares: 100000,
        pricePerShare: 0.0001,
        considerationType: 'services',
        considerationDescription: 'Advisory services placeholder',
        boardApprovalDate: `${new Date().getFullYear()}-02-01`,
        certificateNumber: 'CS-002',
        vestingTerms: 'Monthly vesting placeholder.',
        restrictionLegend: 'Restricted securities legend placeholder.',
        status: 'issued',
        notes: 'Demo issuance only.',
        createdAt: now,
        updatedAt: now,
      },
    ],
    safes: [
      {
        id: 'eq_safe_demo_1',
        investorName: 'Investor Example',
        date: `${new Date().getFullYear()}-03-15`,
        amount: 25000,
        valuationCap: 5000000,
        discountRate: 20,
        mfn: false,
        type: 'post-money',
        status: 'active',
        notes: 'Demo SAFE record only.',
      },
    ],
  };
};
