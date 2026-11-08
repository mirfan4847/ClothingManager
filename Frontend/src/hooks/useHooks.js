import { useState, useEffect } from 'react';
import { getSizes, getColors, getMachines, getLots, getEntries, getMaterials, getBagTypes } from '../services/api';

// Module-level cache — survives page navigation, refreshes after 5 minutes
const _cache = { data: null, ts: 0 };
const CACHE_TTL = 5 * 60 * 1000;

export function clearDropdownsCache() {
  _cache.data = null;
  _cache.ts = 0;
}

async function fetchDropdowns() {
  const now = Date.now();
  if (_cache.data && now - _cache.ts < CACHE_TTL) return _cache.data;
  const [sizes, colors, machines, lots, materials, bagTypes] = await Promise.all([
    getSizes(),
    getColors(),
    getMachines(),
    getLots(),
    getMaterials().catch(() => []),
    getBagTypes().catch(() => []),
  ]);
  _cache.data = { sizes, colors, machines, lots, materials, bagTypes };
  _cache.ts   = now;
  return _cache.data;
}

export function useDropdowns() {
  const [data, setData] = useState(_cache.data || { sizes: [], colors: [], machines: [], lots: [], materials: [], bagTypes: [] });

  useEffect(() => {
    fetchDropdowns().then(setData).catch(() => {});
  }, []);

  return data;
}

export function useWorkerEntries(workerId) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    getEntries(workerId)
      .then(setEntries)
      .catch(setError)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [workerId]);

  return { entries, loading, error, reload: load };
}
