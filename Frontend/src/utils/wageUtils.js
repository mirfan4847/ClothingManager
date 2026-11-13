// Wage and task calculation utilities synced with Payroll Wage Rates

export const TASK_KEYS = [
  'quantity',
  'totalPiece',
  'front',
  'bazo',
  'tape',
  'pocket',
  'gala',
  'lable',
  'moda',
];

export const STANDARD_TASK_FIELD_MAP = {
  front: { key: 'front', label: 'Front' },
  bazo: { key: 'bazo', label: 'Bazo' },
  tape: { key: 'tape', label: 'Tape' },
  pocket: { key: 'pocket', label: 'Pocket' },
  gala: { key: 'gala', label: 'Gala' },
  lable: { key: 'lable', label: 'Lable' },
  moda: { key: 'moda', label: 'Moda' },
  quantity: { key: 'quantity', label: 'Quantity' },
  totalpiece: { key: 'totalPiece', label: 'Total Piece' },
};

/**
 * Builds ordered task column/field definitions from a worker's assigned Payroll wage rates.
 */
export function buildAssignedTaskColumns(wageRates = []) {
  const cols = [];
  const seenKeys = new Set(['lotnumber', 'rate', 'totalprice', 'completed', 'datecompleted']);

  if (Array.isArray(wageRates) && wageRates.length > 0) {
    wageRates.forEach(r => {
      const rawName = (r.taskType || '').trim();
      if (!rawName) return;
      const norm = rawName.toLowerCase().replace(/\s+/g, '');
      if (seenKeys.has(norm)) return;
      seenKeys.add(norm);

      if (STANDARD_TASK_FIELD_MAP[norm]) {
        cols.push(STANDARD_TASK_FIELD_MAP[norm]);
      } else {
        cols.push({
          key: `customTask_${rawName}`,
          label: rawName,
          isCustomTask: true,
          rawTaskType: rawName,
        });
      }
    });
  }

  return cols;
}

/**
 * Returns matched task breakdowns for a row based on configured Payroll taskRatesMap.
 * Each item contains { key, label, qty, rate }.
 */
export function getEntryRateBreakdown(row, taskRatesMap = {}, customTasksForRow = null) {
  if (!row || !taskRatesMap || Object.keys(taskRatesMap).length === 0) return [];

  const breakdown = [];
  let customQtySum = 0;

  // 1. Check custom tasks recorded for this entry (e.g. Jarsy, Sando)
  if (customTasksForRow && typeof customTasksForRow === 'object') {
    for (const [taskName, val] of Object.entries(customTasksForRow)) {
      const numVal = Number(val);
      const rate = taskRatesMap[taskName.trim().toLowerCase()];
      if (numVal > 0 && rate != null && Number(rate) > 0) {
        breakdown.push({
          key: taskName.trim().toLowerCase(),
          label: taskName.trim(),
          qty: numVal,
          rate: Number(rate),
        });
        customQtySum += numVal;
      }
    }
  }

  // 2. Check standard backend columns (avoid double-counting totalPiece if auto-filled from custom tasks)
  for (const key of TASK_KEYS) {
    if (key === 'totalPiece' && customQtySum > 0 && Number(row[key]) === customQtySum) continue;
    const val = Number(row[key]);
    const rate = taskRatesMap[key.toLowerCase()];
    if (val > 0 && rate != null && Number(rate) > 0) {
      breakdown.push({
        key: key.toLowerCase(),
        label: STANDARD_TASK_FIELD_MAP[key.toLowerCase()]?.label || key,
        qty: val,
        rate: Number(rate),
      });
    }
  }

  return breakdown;
}

/**
 * Computes total pieces on a row (preferring entered task pieces when present).
 */
export function getEntryTotalPieces(row, customTasksForRow = null) {
  if (!row) return 0;
  if (customTasksForRow && typeof customTasksForRow === 'object') {
    const customSum = Object.values(customTasksForRow).reduce((s, v) => s + (Number(v) || 0), 0);
    if (customSum > 0) return customSum;
  }
  return Number(row.quantity != null && row.quantity !== ''
    ? row.quantity
    : (row.totalPiece != null && row.totalPiece !== '' ? row.totalPiece : 0))
    || Number(row.front || 0)
    || Number(row.pocket || 0)
    || Number(row.bazo || 0)
    || 0;
}

/**
 * Calculates the total earned wage for a single production entry row.
 * Uses task-specific rates configured in Payroll & Wage Accounting first,
 * unless an explicit manual row rate override was set, or falls back to worker fallback rate.
 */
export function calculateEntryTotalPrice(row, taskRatesMap = {}, fallbackRate = 0, customTasksForRow = null, manualRowRate = null) {
  if (!row) return 0;

  // Explicit manual row override (if set by user on the grid row or backend row.rate)
  const explicitRate = manualRowRate != null && manualRowRate !== ''
    ? Number(manualRowRate)
    : (row.rate != null && row.rate !== '' ? Number(row.rate) : null);

  if (explicitRate != null && explicitRate > 0) {
    return explicitRate * getEntryTotalPieces(row, customTasksForRow);
  }

  const breakdown = getEntryRateBreakdown(row, taskRatesMap, customTasksForRow);
  if (breakdown.length > 0) {
    return breakdown.reduce((sum, item) => sum + item.qty * item.rate, 0);
  }

  const effectiveRate = Number(fallbackRate) || 0;
  if (effectiveRate <= 0) return 0;

  return effectiveRate * getEntryTotalPieces(row, customTasksForRow);
}

/**
 * Determines the display rate for an entry row.
 */
export function getEntryDisplayRate(row, taskRatesMap = {}, fallbackRate = 0, customTasksForRow = null, manualRowRate = null) {
  if (!row) return fallbackRate || 0;
  if (manualRowRate != null && manualRowRate !== '' && Number(manualRowRate) > 0) return Number(manualRowRate);
  if (row.rate != null && row.rate !== '') return Number(row.rate);

  const breakdown = getEntryRateBreakdown(row, taskRatesMap, customTasksForRow);
  if (breakdown.length > 0) {
    return breakdown[0].rate;
  }

  if (taskRatesMap && Object.keys(taskRatesMap).length > 0) {
    if (taskRatesMap['quantity']) return Number(taskRatesMap['quantity']);
    if (taskRatesMap['totalpiece']) return Number(taskRatesMap['totalpiece']);
    const firstRate = Object.values(taskRatesMap)[0];
    if (firstRate != null && Number(firstRate) > 0) return Number(firstRate);
  }

  return Number(fallbackRate) || 0;
}

/**
 * Calculates exact wages & per-task breakdown for a worker from their production entries,
 * matching StaffModule & WorkerTable calculations 1:1 (including task-specific rates
 * such as Jarsy vs Sando, custom tasks, and manual row overrides).
 */
export function calculateWorkerWagesFromEntries(workerId, entries = [], wageRates = [], dateFilter = null) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  const safeRates = Array.isArray(wageRates) ? wageRates : [];

  const taskRatesMap = {};
  safeRates.forEach(r => {
    if (r.taskType && r.ratePerPiece != null && Number(r.ratePerPiece) > 0) {
      taskRatesMap[r.taskType.trim().toLowerCase()] = Number(r.ratePerPiece);
    }
  });

  let fallbackRate = 0;
  if (taskRatesMap['quantity']) {
    fallbackRate = taskRatesMap['quantity'];
  } else if (safeRates.length > 0 && safeRates[0]?.ratePerPiece != null) {
    fallbackRate = Number(safeRates[0].ratePerPiece);
  } else if (workerId != null) {
    try {
      const savedRate = localStorage.getItem(`cm_worker_rate_${workerId}`);
      if (savedRate) fallbackRate = Number(savedRate) || 0;
    } catch {}
  }

  let customTasksByEntry = {};
  let manualRatesByEntry = {};
  if (workerId != null) {
    try {
      customTasksByEntry = JSON.parse(localStorage.getItem(`cm_entry_custom_tasks_${workerId}`) || '{}');
    } catch {}
    try {
      manualRatesByEntry = JSON.parse(localStorage.getItem(`cm_entry_manual_rates_${workerId}`) || '{}');
    } catch {}
  }

  const fromYmd = dateFilter?.from ? String(dateFilter.from).split('T')[0] : null;
  const toYmd   = dateFilter?.to   ? String(dateFilter.to).split('T')[0]   : null;

  const filteredEntries = (fromYmd && toYmd)
    ? safeEntries.filter(e => {
        const rawDate = e.dateCompleted || e.createdAt || '';
        const ymd = String(rawDate).split('T')[0];
        if (!ymd) return true;
        return ymd >= fromYmd && ymd <= toYmd;
      })
    : safeEntries;

  let grossAmount = 0;
  const breakdownMap = new Map();

  filteredEntries.forEach(e => {
    const customForRow = customTasksByEntry[e.id] || null;
    const rawManual = manualRatesByEntry[e.id];
    const manualRate = rawManual != null && rawManual !== '' && Number(rawManual) > 0 ? Number(rawManual) : null;

    const rowTotal = calculateEntryTotalPrice(e, taskRatesMap, fallbackRate, customForRow, manualRate);
    grossAmount += rowTotal;

    if (rowTotal <= 0) return;

    if (manualRate != null) {
      const pcs = getEntryTotalPieces(e, customForRow);
      const key = `custom-override::${manualRate}`;
      const existing = breakdownMap.get(key) || { taskType: 'Custom Rate', totalPieces: 0, ratePerPiece: manualRate, amount: 0 };
      existing.totalPieces += pcs;
      existing.amount += rowTotal;
      breakdownMap.set(key, existing);
      return;
    }

    const rowBreakdown = getEntryRateBreakdown(e, taskRatesMap, customForRow);
    if (rowBreakdown.length > 0) {
      rowBreakdown.forEach(item => {
        const key = `${item.label.toLowerCase()}::${item.rate}`;
        const existing = breakdownMap.get(key) || { taskType: item.label, totalPieces: 0, ratePerPiece: item.rate, amount: 0 };
        existing.totalPieces += item.qty;
        existing.amount += item.qty * item.rate;
        breakdownMap.set(key, existing);
      });
    } else if (fallbackRate > 0) {
      const pcs = getEntryTotalPieces(e, customForRow);
      const primaryLabel = safeRates[0]?.taskType || 'Piece Rate';
      const key = `${primaryLabel.toLowerCase()}::${fallbackRate}`;
      const existing = breakdownMap.get(key) || { taskType: primaryLabel, totalPieces: 0, ratePerPiece: fallbackRate, amount: 0 };
      existing.totalPieces += pcs;
      existing.amount += rowTotal;
      breakdownMap.set(key, existing);
    }
  });

  return {
    grossAmount,
    breakdown: Array.from(breakdownMap.values()),
  };
}

/**
 * Computes effective net amount paid for a payment record, falling back to
 * (grossAmount - deductions) when older records have netAmount stored as 0.
 */
export function getEffectiveNetAmount(payment) {
  if (!payment) return 0;
  const net = Number(payment.netAmount);
  if (net > 0) return net;
  return Math.max(0, (Number(payment.grossAmount) || 0) - (Number(payment.deductions) || 0));
}

/**
 * Returns the effective payment date for a payment record, falling back to
 * periodTo for older disbursements where paidAt defaulted to creation time.
 */
export function getEffectivePaidDate(payment) {
  if (!payment) return null;
  if (!(Number(payment.netAmount) > 0) && payment.periodTo) {
    return payment.periodTo;
  }
  return payment.paidAt || payment.periodTo || null;
}
