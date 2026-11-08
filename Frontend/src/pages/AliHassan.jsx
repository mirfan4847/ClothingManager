import { useWorkerEntries, useDropdowns } from '../hooks/useHooks';
import WorkerTable from '../components/WorkerTable';

const WORKER_ID = 1;

const COLUMNS = [
  { key: 'lotNumber',      label: 'Lot Number' },
  { key: 'front',          label: 'Front' },
  { key: 'bazo',           label: 'Bazo' },
  { key: 'quantity',       label: 'Quantity' },
  { key: 'completed',      label: 'Completed' },
  { key: 'dateCompleted',  label: 'Date Completed' },
  { key: 'totalPiece',     label: 'Total Piece' },
];

export default function AliHassan() {
  const { entries, loading, reload } = useWorkerEntries(WORKER_ID);
  const dropdowns = useDropdowns();

  if (loading) return <div style={loadStyle}>Loading...</div>;

  return (
    <div>
      <div style={headerStyle}><h1 style={h1Style}>Ali Hassan</h1></div>
      <WorkerTable workerId={WORKER_ID} columns={COLUMNS} entries={entries} reload={reload} dropdowns={dropdowns} />
    </div>
  );
}

const headerStyle = { background: '#2E75B6', padding: '1rem 1.5rem' };
const h1Style = { color: '#fff', margin: 0, fontSize: '1.3rem', fontWeight: 500 };
const loadStyle = { padding: '2rem', color: '#888' };
