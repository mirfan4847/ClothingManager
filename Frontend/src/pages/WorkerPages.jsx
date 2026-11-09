import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useWorkerEntries, useDropdowns } from '../hooks/useHooks';
import WorkerTable from '../components/WorkerTable';
import { getWorkers } from '../services/api';

// ---- Generic worker page (used for any worker via /worker/:id) ----
const GENERIC_COLS = [
  { key: 'lotNumber',     label: 'Lot Number' },
  { key: 'front',         label: 'Front' },
  { key: 'bazo',          label: 'Bazo' },
  { key: 'tape',          label: 'Tape' },
  { key: 'pocket',        label: 'Pocket' },
  { key: 'gala',          label: 'Gala' },
  { key: 'lable',         label: 'Lable' },
  { key: 'moda',          label: 'Moda' },
  { key: 'quantity',      label: 'Quantity' },
  { key: 'rate',          label: 'Rate' },
  { key: 'totalPrice',    label: 'Total Price' },
  { key: 'completed',     label: 'Completed' },
  { key: 'dateCompleted', label: 'Date Completed' },
  { key: 'totalPiece',    label: 'Total Piece' },
];

export function GenericWorker() {
  const { id } = useParams();
  const workerId = Number(id);
  const [workerName, setWorkerName] = useState('Worker');
  const { entries, loading, reload } = useWorkerEntries(workerId);
  const dropdowns = useDropdowns();

  useEffect(() => {
    getWorkers().then(ws => {
      const found = ws.find(w => w.id === workerId);
      if (found) setWorkerName(found.name);
    }).catch(() => {});
  }, [workerId]);

  if (loading) return <div style={load}>Loading...</div>;
  return (
    <Page title={workerName} color="#2E75B6">
      <WorkerTable workerId={workerId} columns={GENERIC_COLS} entries={entries} reload={reload} dropdowns={dropdowns} />
    </Page>
  );
}

// ---- Faizan (Machine Operator) ----
const FAIZAN_COLS = [
  { key: 'machine',       label: 'Machine Name' },
  { key: 'size',          label: 'Size' },
  { key: 'lotNumber',     label: 'Lot Number' },
  { key: 'color',         label: 'Color' },
  { key: 'front',         label: 'Front' },
  { key: 'bazo',          label: 'Bazo' },
  { key: 'tape',          label: 'Tape' },
  { key: 'rate',          label: 'Rate' },
  { key: 'totalPrice',    label: 'Total Price' },
  { key: 'completed',     label: 'Completed' },
  { key: 'dateCompleted', label: 'Date Completed' },
  { key: 'totalPiece',    label: 'Total Piece' },
];
export function Faizan() {
  const { entries, loading, reload } = useWorkerEntries(2);
  const dropdowns = useDropdowns();
  if (loading) return <div style={load}>Loading...</div>;
  return <Page title="Faizan" color="#375623"><WorkerTable workerId={2} columns={FAIZAN_COLS} entries={entries} reload={reload} dropdowns={dropdowns} /></Page>;
}

// ---- Gujjar Press ----
const GUJJAR_COLS = [
  { key: 'lotNumber',     label: 'Lot Number' },
  { key: 'front',         label: 'Front' },
  { key: 'bazo',          label: 'Bazo' },
  { key: 'tape',          label: 'Tape' },
  { key: 'rate',          label: 'Rate' },
  { key: 'totalPrice',    label: 'Total Price' },
  { key: 'completed',     label: 'Completed' },
  { key: 'dateCompleted', label: 'Date Completed' },
  { key: 'totalPiece',    label: 'Total Piece' },
];
export function GujjarPress() {
  const { entries, loading, reload } = useWorkerEntries(3);
  const dropdowns = useDropdowns();
  if (loading) return <div style={load}>Loading...</div>;
  return <Page title="Gujjar Press" color="#4472C4"><WorkerTable workerId={3} columns={GUJJAR_COLS} entries={entries} reload={reload} dropdowns={dropdowns} /></Page>;
}

// ---- Arslan ----
const ARSLAN_COLS = [
  { key: 'lotNumber',     label: 'Lot Number' },
  { key: 'pocket',        label: 'Pocket' },
  { key: 'gala',          label: 'Gala' },
  { key: 'lable',         label: 'Lable' },
  { key: 'moda',          label: 'Moda' },
  { key: 'rate',          label: 'Rate' },
  { key: 'totalPrice',    label: 'Total Price' },
  { key: 'completed',     label: 'Completed' },
  { key: 'dateCompleted', label: 'Date Completed' },
  { key: 'totalPiece',    label: 'Total Piece' },
];
export function Arslan() {
  const { entries, loading, reload } = useWorkerEntries(4);
  const dropdowns = useDropdowns();
  if (loading) return <div style={load}>Loading...</div>;
  return <Page title="Arslan" color="#BE0000"><WorkerTable workerId={4} columns={ARSLAN_COLS} entries={entries} reload={reload} dropdowns={dropdowns} /></Page>;
}

// ---- Nazir ---- (same columns as Arslan)
export function Nazir() {
  const { entries, loading, reload } = useWorkerEntries(5);
  const dropdowns = useDropdowns();
  if (loading) return <div style={load}>Loading...</div>;
  return <Page title="Nazir" color="#7030A0"><WorkerTable workerId={5} columns={ARSLAN_COLS} entries={entries} reload={reload} dropdowns={dropdowns} /></Page>;
}

// ---- Umer Safty ----
const SAFTY_COLS = [
  { key: 'lotNumber',     label: 'Lot Number' },
  { key: 'quantity',      label: 'Quantity' },
  { key: 'rate',          label: 'Rate' },
  { key: 'totalPrice',    label: 'Total Price' },
  { key: 'completed',     label: 'Completed' },
  { key: 'dateCompleted', label: 'Date Completed' },
  { key: 'totalPiece',    label: 'Total Piece' },
];
export function UmerSafty() {
  const { entries, loading, reload } = useWorkerEntries(6);
  const dropdowns = useDropdowns();
  if (loading) return <div style={load}>Loading...</div>;
  return <Page title="Umer Safty" color="#1F7391"><WorkerTable workerId={6} columns={SAFTY_COLS} entries={entries} reload={reload} dropdowns={dropdowns} /></Page>;
}

// ---- Naveed Rafo ---- (same as Umer Safty)
export function NaveedRafo() {
  const { entries, loading, reload } = useWorkerEntries(7);
  const dropdowns = useDropdowns();
  if (loading) return <div style={load}>Loading...</div>;
  return <Page title="Naveed Rafo" color="#1F6B3A"><WorkerTable workerId={7} columns={SAFTY_COLS} entries={entries} reload={reload} dropdowns={dropdowns} /></Page>;
}

// ---- Bhatti Kaj ----
const BHATTI_COLS = [
  { key: 'lotNumber',     label: 'Lot Number' },
  { key: 'quantity',      label: 'Quantity' },
  { key: 'rate',          label: 'Rate' },
  { key: 'totalPrice',    label: 'Total Price' },
  { key: 'completed',     label: 'Completed' },
  { key: 'dateCompleted', label: 'Date Completed' },
  { key: 'totalPiece',    label: 'Total Piece' },
];
export function BhattiKaj() {
  const { entries, loading, reload } = useWorkerEntries(8);
  const dropdowns = useDropdowns();
  if (loading) return <div style={load}>Loading...</div>;
  return <Page title="Bhatti Kaj" color="#843C0C"><WorkerTable workerId={8} columns={BHATTI_COLS} entries={entries} reload={reload} dropdowns={dropdowns} /></Page>;
}

// ---- Button ---- (same as Bhatti Kaj)
export function Button() {
  const { entries, loading, reload } = useWorkerEntries(9);
  const dropdowns = useDropdowns();
  if (loading) return <div style={load}>Loading...</div>;
  return <Page title="Button" color="#4472C4"><WorkerTable workerId={9} columns={BHATTI_COLS} entries={entries} reload={reload} dropdowns={dropdowns} /></Page>;
}

// Shared page wrapper
function Page({ title, color, children }) {
  return (
    <div>
      <div style={{ background: color, padding: '1rem 1.5rem' }}>
        <h1 style={{ color: '#fff', margin: 0, fontSize: '1.3rem', fontWeight: 500 }}>{title}</h1>
      </div>
      {children}
    </div>
  );
}

const load = { padding: '2rem', color: '#888' };
