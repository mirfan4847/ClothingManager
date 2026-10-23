import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { createEntry, updateEntry } from '../services/api';

export default function EntryForm({ workerId, columns, entry, dropdowns, onSaved, onCancel }) {
  const { register, handleSubmit, reset, setValue, control, getValues } = useForm();
  const [saveError, setSaveError] = useState('');
  const watchedSizeId = useWatch({ control, name: 'sizeId' });
  const initialized = useRef(false);

  useEffect(() => {
    initialized.current = false;
    reset(entry
      ? { ...entry, lotId: entry.lotId, sizeId: entry.sizeId, colorId: entry.colorId, machineId: entry.machineId }
      : { workerId }
    );
    // mark initialized after reset settles
    setTimeout(() => { initialized.current = true; }, 0);
  }, [entry]);

  const filteredLots = watchedSizeId
    ? dropdowns.lots.filter(l => l.sizeId === Number(watchedSizeId))
    : dropdowns.lots;

  useEffect(() => {
    if (!initialized.current) return;
    // Clear lotId if the currently selected lot doesn't belong to the new size
    const currentLotId = getValues('lotId');
    const stillValid = filteredLots.some(l => String(l.id) === String(currentLotId));
    if (!stillValid) setValue('lotId', '');
  }, [watchedSizeId]);

  const onSubmit = async (data) => {
    setSaveError('');
    const payload = {
      workerId: Number(workerId),
      lotId: Number(data.lotId),
      sizeId: data.sizeId ? Number(data.sizeId) : null,
      colorId: data.colorId ? Number(data.colorId) : null,
      machineId: data.machineId ? Number(data.machineId) : null,
      front: data.front ? Number(data.front) : null,
      bazo: data.bazo ? Number(data.bazo) : null,
      tape: data.tape ? Number(data.tape) : null,
      pocket: data.pocket ? Number(data.pocket) : null,
      gala: data.gala ? Number(data.gala) : null,
      lable: data.lable ? Number(data.lable) : null,
      moda: data.moda ? Number(data.moda) : null,
      quantity: data.quantity ? Number(data.quantity) : null,
      totalPiece: data.totalPiece ? Number(data.totalPiece) : null,
      completed: !!data.completed,
      dateCompleted: data.dateCompleted || null,
    };
    try {
      entry ? await updateEntry(entry.id, payload) : await createEntry(payload);
      onSaved();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Save failed.';
      setSaveError(msg);
    }
  };

  const fieldByKey = (key) => {
    if (key === 'lotNumber') {
      const hasSize = !!watchedSizeId;
      return (
        <select key={key} {...register('lotId', { required: true })} style={inputStyle} disabled={!hasSize}>
          <option value="">{hasSize ? '-- Select Lot --' : '-- Select size first --'}</option>
          {filteredLots.map(l => (
        <option key={l.id} value={l.id}>
          {l.lotNumber}{l.material ? ` — ${l.material}` : ''}
        </option>
      ))}
        </select>
      );
    }
    if (key === 'size') return (
      <select key={key} {...register('sizeId')} style={inputStyle}>
        <option value="">-- Size --</option>
        {dropdowns.sizes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    );
    if (key === 'color') return (
      <select key={key} {...register('colorId')} style={inputStyle}>
        <option value="">-- Color --</option>
        {dropdowns.colors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    );
    if (key === 'machine') return (
      <select key={key} {...register('machineId')} style={inputStyle}>
        <option value="">-- Machine --</option>
        {dropdowns.machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
    );
    if (key === 'completed') return <input type="checkbox" {...register('completed')} style={{ marginTop: 4 }} />;
    if (key === 'dateCompleted') return <input type="date" {...register('dateCompleted')} style={inputStyle} />;
    return <input type="number" {...register(key)} style={inputStyle} min={0} />;
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={formStyle}>
      {saveError && (
        <div style={{ background: '#FBEAEA', color: '#BE0000', padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
          ⚠️ {saveError}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
        {columns.map(col => (
          <div key={col.key} style={{ display: 'flex', flexDirection: 'column', minWidth: 140 }}>
            <label style={labelStyle}>{col.label}</label>
            {fieldByKey(col.key)}
          </div>
        ))}
      </div>
      <div style={{ marginTop: '1rem', display: 'flex', gap: 8 }}>
        <button type="submit" style={{ background: '#2E75B6', color: '#fff', border: 'none', borderRadius: 4, padding: '8px 20px', cursor: 'pointer' }}>
          {entry ? 'Update' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} style={{ background: '#888', color: '#fff', border: 'none', borderRadius: 4, padding: '8px 16px', cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </form>
  );
}

const formStyle = { background: '#f5f7fa', borderRadius: 8, padding: '1rem', marginBottom: '1rem', border: '1px solid #dde3ec' };
const labelStyle = { fontSize: 12, color: '#555', marginBottom: 3, fontWeight: 500 };
const inputStyle = { padding: '6px 8px', borderRadius: 4, border: '1px solid #ccc', fontSize: 13, width: '100%' };
