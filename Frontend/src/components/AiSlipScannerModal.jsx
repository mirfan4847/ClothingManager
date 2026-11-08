import { useState, useRef, useEffect, useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';
import {
  scanProductionSlip,
  bulkCreateEntries,
  getAiConfig,
  saveAiKey,
  testAiKey
} from '../services/api';

export default function AiSlipScannerModal({
  isOpen,
  onClose,
  initialWorkerId,
  workers = [],
  dropdowns = { sizes: [], colors: [], machines: [], lots: [] },
  onEntriesImported
}) {
  const { isDark } = useTheme();

  // State
  const [file, setFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [selectedWorkerId, setSelectedWorkerId] = useState(initialWorkerId || '');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [extractedRows, setExtractedRows] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Gemini API Key config modal / drawer state
  const [aiConfig, setAiConfig] = useState({ isConfigured: false, apiKey: '', model: 'gemini-1.5-flash' });
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [customKeyInput, setCustomKeyInput] = useState('');
  const [keyTesting, setKeyTesting] = useState(false);
  const [keyTestStatus, setKeyTestStatus] = useState(null); // { success: bool, message: string }

  // Slip Image zoom state
  const [zoomLevel, setZoomLevel] = useState(1);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      getAiConfig()
        .then(cfg => {
          setAiConfig(cfg);
          if (!cfg.isConfigured) {
            const localKey = localStorage.getItem('cm_gemini_key') || '';
            if (localKey) setCustomKeyInput(localKey);
          }
        })
        .catch(() => {});
      if (initialWorkerId) {
        setSelectedWorkerId(initialWorkerId);
      }
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [isOpen, initialWorkerId]);

  if (!isOpen) return null;

  const handleFileChange = (selectedFile) => {
    if (!selectedFile) return;
    if (!selectedFile.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (JPEG, PNG, WebP).');
      return;
    }
    setFile(selectedFile);
    setImagePreview(URL.createObjectURL(selectedFile));
    setScanResult(null);
    setExtractedRows([]);
    setErrorMsg('');
    setSuccessMsg('');
    setZoomLevel(1);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleStartScan = async () => {
    if (!file) {
      setErrorMsg('Please upload an image of the slip first.');
      return;
    }

    const effectiveKey = customKeyInput.trim() || localStorage.getItem('cm_gemini_key') || undefined;

    setIsScanning(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await scanProductionSlip(file, selectedWorkerId || undefined, effectiveKey);
      if (!res || !res.success) {
        throw new Error(res?.message || 'Could not detect any rows in this image.');
      }

      setScanResult(res);

      // Auto-set matched worker if not already chosen
      if (!selectedWorkerId && res.MatchedWorkerId) {
        setSelectedWorkerId(res.MatchedWorkerId);
      }

      // Map rows with selection and lot matching
      const mapped = (res.rows || []).map((r, idx) => ({
        id: idx + 1,
        isSelected: true,
        lotNumber: r.lotNumber || '',
        lotId: r.matchedLotId || '',
        sizeId: r.matchedSizeId || '',
        colorId: r.matchedColorId || '',
        machineId: r.matchedMachineId || '',
        front: r.front ?? '',
        bazo: r.bazo ?? '',
        tape: r.tape ?? '',
        pocket: r.pocket ?? '',
        gala: r.gala ?? '',
        lable: r.lable ?? '',
        moda: r.moda ?? '',
        quantity: r.quantity ?? '',
        totalPiece: r.totalPiece ?? '',
        completed: r.completed !== false,
        dateCompleted: r.dateCompleted ? r.dateCompleted.split('T')[0] : (res.slipDate || new Date().toISOString().split('T')[0]),
        confidence: r.confidence || 'high',
        notes: r.notes || '',
      }));

      setExtractedRows(mapped);
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Scanning failed.';
      if (err?.response?.data?.isKeyMissing) {
        setShowKeyModal(true);
      }
      setErrorMsg(msg);
    } finally {
      setIsScanning(false);
    }
  };

  const handleRowChange = (id, field, value) => {
    setExtractedRows(rows =>
      rows.map(r => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value };

        // If lotId changed, sync lotNumber
        if (field === 'lotId') {
          const matched = dropdowns.lots.find(l => String(l.id) === String(value));
          if (matched) updated.lotNumber = matched.lotNumber;
        }

        // Recalculate totalPiece if task quantity updated
        if (['front', 'bazo', 'tape', 'pocket', 'gala', 'lable', 'moda', 'quantity'].includes(field)) {
          const nums = [
            Number(field === 'front' ? value : updated.front) || 0,
            Number(field === 'bazo' ? value : updated.bazo) || 0,
            Number(field === 'tape' ? value : updated.tape) || 0,
            Number(field === 'pocket' ? value : updated.pocket) || 0,
            Number(field === 'gala' ? value : updated.gala) || 0,
            Number(field === 'lable' ? value : updated.lable) || 0,
            Number(field === 'moda' ? value : updated.moda) || 0,
            Number(field === 'quantity' ? value : updated.quantity) || 0,
          ].filter(n => n > 0);
          if (nums.length > 0 && (!updated.totalPiece || updated.totalPiece === 0)) {
            updated.totalPiece = Math.max(...nums);
          }
        }

        return updated;
      })
    );
  };

  const handleAddEmptyRow = () => {
    const newId = extractedRows.length > 0 ? Math.max(...extractedRows.map(r => r.id)) + 1 : 1;
    setExtractedRows([
      ...extractedRows,
      {
        id: newId,
        isSelected: true,
        lotNumber: '',
        lotId: dropdowns.lots[0]?.id || '',
        sizeId: '',
        colorId: '',
        machineId: '',
        front: '',
        bazo: '',
        tape: '',
        pocket: '',
        gala: '',
        lable: '',
        moda: '',
        quantity: '',
        totalPiece: '',
        completed: true,
        dateCompleted: new Date().toISOString().split('T')[0],
        confidence: 'manual',
        notes: '',
      }
    ]);
  };

  const handleDeleteRow = (id) => {
    setExtractedRows(rows => rows.filter(r => r.id !== id));
  };

  const handleToggleSelectAll = (checked) => {
    setExtractedRows(rows => rows.map(r => ({ ...r, isSelected: checked })));
  };

  const handleConfirmAndInsert = async () => {
    if (!selectedWorkerId) {
      setErrorMsg('Please select a Worker before inserting the records.');
      return;
    }

    const selectedRows = extractedRows.filter(r => r.isSelected);
    if (selectedRows.length === 0) {
      setErrorMsg('Please select at least one row to insert.');
      return;
    }

    // Validate that every selected row has a valid Lot
    for (let i = 0; i < selectedRows.length; i++) {
      const r = selectedRows[i];
      if (!r.lotId) {
        // Try to find matching lot by number
        const matched = dropdowns.lots.find(l => l.lotNumber.toLowerCase() === (r.lotNumber || '').trim().toLowerCase());
        if (matched) {
          r.lotId = matched.id;
        } else {
          setErrorMsg(`Row #${i + 1} with Lot "${r.lotNumber || 'empty'}" is not matched to an existing Lot. Please select a valid Lot.`);
          return;
        }
      }
    }

    setIsSaving(true);
    setErrorMsg('');
    try {
      const payloadEntries = selectedRows.map(r => ({
        workerId: Number(selectedWorkerId),
        lotId: Number(r.lotId),
        sizeId: r.sizeId ? Number(r.sizeId) : null,
        colorId: r.colorId ? Number(r.colorId) : null,
        machineId: r.machineId ? Number(r.machineId) : null,
        front: r.front ? Number(r.front) : null,
        bazo: r.bazo ? Number(r.bazo) : null,
        tape: r.tape ? Number(r.tape) : null,
        pocket: r.pocket ? Number(r.pocket) : null,
        gala: r.gala ? Number(r.gala) : null,
        lable: r.lable ? Number(r.lable) : null,
        moda: r.moda ? Number(r.moda) : null,
        quantity: r.quantity ? Number(r.quantity) : null,
        totalPiece: r.totalPiece ? Number(r.totalPiece) : null,
        completed: !!r.completed,
        dateCompleted: r.dateCompleted || null,
      }));

      const res = await bulkCreateEntries(Number(selectedWorkerId), payloadEntries);
      setSuccessMsg(`✓ Successfully inserted ${res.count || payloadEntries.length} production entries into the database!`);
      if (onEntriesImported) {
        onEntriesImported(res.entries);
      }
      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || err.message || 'Bulk insertion failed.');
    } finally {
      setIsSaving(false);
    }
  };

  // Test and save key logic
  const handleTestKey = async () => {
    if (!customKeyInput.trim()) return;
    setKeyTesting(true);
    setKeyTestStatus(null);
    try {
      const r = await testAiKey(customKeyInput.trim());
      setKeyTestStatus({ success: true, message: r.message || 'Key connected successfully!' });
    } catch (err) {
      setKeyTestStatus({ success: false, message: err?.response?.data?.message || 'Connection test failed.' });
    } finally {
      setKeyTesting(false);
    }
  };

  const handleSaveKey = async () => {
    if (!customKeyInput.trim()) return;
    setKeyTesting(true);
    try {
      await saveAiKey(customKeyInput.trim());
      localStorage.setItem('cm_gemini_key', customKeyInput.trim());
      setAiConfig(prev => ({ ...prev, isConfigured: true, apiKey: customKeyInput.trim() }));
      setKeyTestStatus({ success: true, message: 'Key saved and activated!' });
      setTimeout(() => setShowKeyModal(false), 900);
    } catch (err) {
      localStorage.setItem('cm_gemini_key', customKeyInput.trim());
      setAiConfig(prev => ({ ...prev, isConfigured: true, apiKey: customKeyInput.trim() }));
      setKeyTestStatus({ success: true, message: 'Saved to local browser storage.' });
      setTimeout(() => setShowKeyModal(false), 900);
    } finally {
      setKeyTesting(false);
    }
  };

  const selectedCount = extractedRows.filter(r => r.isSelected).length;
  const totalPieces = extractedRows
    .filter(r => r.isSelected)
    .reduce((sum, r) => sum + (Number(r.totalPiece) || 0), 0);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modalCard(isDark)} onClick={e => e.stopPropagation()}>
        {/* ── Modal Header ── */}
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={styles.headerIcon}>⚡</div>
            <div>
              <div style={styles.headerTitle}>AI Production Slip Scanner &amp; Importer</div>
              <div style={styles.headerSubtitle}>
                Extract handwritten or printed factory slips · Preview &amp; edit rows before database insert
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={() => setShowKeyModal(true)}
              style={styles.keyBadge(aiConfig.isConfigured)}
              title="Configure Google Gemini Vision API Key"
            >
              {aiConfig.isConfigured ? '🟢 Gemini Vision Active' : '🔑 Setup Gemini Key'}
            </button>
            <button type="button" onClick={onClose} style={styles.closeBtn}>✕</button>
          </div>
        </div>

        {/* ── Modal Body ── */}
        <div style={styles.body(isDark)}>
          {errorMsg && (
            <div style={styles.alertError}>
              <span>⚠️</span>
              <div style={{ flex: 1 }}>{errorMsg}</div>
              <button type="button" onClick={() => setErrorMsg('')} style={styles.alertClose}>✕</button>
            </div>
          )}

          {successMsg && (
            <div style={styles.alertSuccess}>
              <span>🎉</span>
              <div>{successMsg}</div>
            </div>
          )}

          {/* ── Top Bar: Worker Selection & Action Controls ── */}
          <div style={styles.topControlBar(isDark)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <label style={styles.miniLabel(isDark)}>Target Worker / Staff *</label>
                <select
                  style={styles.select(isDark)}
                  value={selectedWorkerId}
                  onChange={e => setSelectedWorkerId(e.target.value)}
                >
                  <option value="">— Select Worker to Credit —</option>
                  {workers.map(w => (
                    <option key={w.id} value={w.id}>
                      #{w.id} · {w.name} {w.sheetType ? `(${w.sheetType})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {scanResult?.workerNameHint && (
                <div style={styles.hintBadge}>
                  <span style={{ opacity: 0.7 }}>Slip header hint:</span>
                  <strong>{scanResult.workerNameHint}</strong>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={e => handleFileChange(e.target.files[0])}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={styles.btnSecondary}
              >
                📷 {file ? 'Change Slip Image' : 'Choose / Capture Slip'}
              </button>

              {file && (
                <button
                  type="button"
                  onClick={handleStartScan}
                  disabled={isScanning}
                  style={styles.btnScan}
                >
                  {isScanning ? '⚡ Processing with Gemini…' : '⚡ Extract Slip Data (AI)'}
                </button>
              )}
            </div>
          </div>

          {/* ── Main Layout: Split Screen (Left: Slip Photo, Right: Interactive Grid) ── */}
          <div style={styles.splitGrid}>
            {/* Left: Image Viewer */}
            <div style={styles.imageColumn(isDark)}>
              <div style={styles.columnHeader(isDark)}>
                <span>Original Slip Image</span>
                {imagePreview && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setZoomLevel(z => Math.max(0.6, z - 0.2))}
                      style={styles.zoomBtn(isDark)}
                      title="Zoom Out"
                    >
                      －
                    </button>
                    <span style={{ fontSize: 11, fontWeight: 700 }}>{Math.round(zoomLevel * 100)}%</span>
                    <button
                      type="button"
                      onClick={() => setZoomLevel(z => Math.min(2.5, z + 0.2))}
                      style={styles.zoomBtn(isDark)}
                      title="Zoom In"
                    >
                      ＋
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoomLevel(1)}
                      style={styles.zoomBtn(isDark)}
                      title="Reset Zoom"
                    >
                      ↺
                    </button>
                  </div>
                )}
              </div>

              {imagePreview ? (
                <div style={styles.imageViewerWrap}>
                  {isScanning && (
                    <div style={styles.scanningOverlay}>
                      <div style={styles.scanLine} />
                      <div style={styles.scanningLabel}>Analyzing handwritten slip with Gemini Vision…</div>
                    </div>
                  )}
                  <img
                    src={imagePreview}
                    alt="Uploaded slip"
                    style={{
                      ...styles.slipImage,
                      transform: `scale(${zoomLevel})`,
                      transformOrigin: 'top left',
                    }}
                  />
                </div>
              ) : (
                <div
                  onDragOver={e => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={styles.dropZone(isDark)}
                >
                  <div style={{ fontSize: 48, marginBottom: 8 }}>📄</div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                    Drop production slip photo here
                  </div>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 14 }}>
                    Supports JPG, PNG, WebP · Mobile Camera Snapshots Supported
                  </div>
                  <button type="button" style={styles.btnSecondarySm}>
                    Browse Files
                  </button>
                </div>
              )}
            </div>

            {/* Right: Verification & Edit Table */}
            <div style={styles.gridColumn(isDark)}>
              <div style={styles.columnHeader(isDark)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>Extracted Records Verification</span>
                  <span style={styles.badgeCount}>
                    {extractedRows.length} Row{extractedRows.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {extractedRows.length > 0 && (
                  <button
                    type="button"
                    onClick={handleAddEmptyRow}
                    style={styles.btnAddRow}
                  >
                    ＋ Add Row
                  </button>
                )}
              </div>

              {extractedRows.length === 0 ? (
                <div style={styles.emptyGridState(isDark)}>
                  {isScanning ? (
                    <div>
                      <div style={styles.spinner} />
                      <div style={{ marginTop: 14, fontWeight: 700 }}>Reading slip table and numbers…</div>
                      <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                        Detecting lot numbers, task piece counts, and dates...
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 36, opacity: 0.6 }}>📋</div>
                      <div style={{ fontWeight: 600, marginTop: 10 }}>No records extracted yet</div>
                      <div style={{ fontSize: 12.5, color: '#888', marginTop: 4 }}>
                        Upload a slip photo on the left and click &quot;Extract Slip Data (AI)&quot;
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={styles.tableScrollWrapper}>
                  <table style={styles.previewTable(isDark)}>
                    <thead>
                      <tr>
                        <th style={{ width: 34, textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={extractedRows.length > 0 && extractedRows.every(r => r.isSelected)}
                            onChange={e => handleToggleSelectAll(e.target.checked)}
                          />
                        </th>
                        <th>#</th>
                        <th>Lot Number *</th>
                        <th>Size</th>
                        <th>Color</th>
                        <th>Machine</th>
                        <th style={{ width: 65, textAlign: 'right' }}>Front</th>
                        <th style={{ width: 65, textAlign: 'right' }}>Bazo</th>
                        <th style={{ width: 65, textAlign: 'right' }}>Tape</th>
                        <th style={{ width: 65, textAlign: 'right' }}>Pocket</th>
                        <th style={{ width: 65, textAlign: 'right' }}>Gala</th>
                        <th style={{ width: 75, textAlign: 'right' }}>Total Pcs</th>
                        <th style={{ width: 110 }}>Date</th>
                        <th style={{ width: 36 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {extractedRows.map((r, idx) => {
                        const hasLotMatch = !!r.lotId;
                        return (
                          <tr
                            key={r.id}
                            style={{
                              ...styles.tableRow(r.isSelected, isDark),
                              opacity: r.isSelected ? 1 : 0.45,
                            }}
                          >
                            <td style={{ textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={r.isSelected}
                                onChange={e => handleRowChange(r.id, 'isSelected', e.target.checked)}
                              />
                            </td>
                            <td style={{ fontSize: 11, color: '#888', fontWeight: 700 }}>{idx + 1}</td>

                            {/* Lot selection */}
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <select
                                  style={{
                                    ...styles.tableSelect(isDark),
                                    borderColor: hasLotMatch ? '#22c55e' : '#f59e0b',
                                    fontWeight: 700,
                                  }}
                                  value={r.lotId}
                                  onChange={e => handleRowChange(r.id, 'lotId', e.target.value)}
                                >
                                  <option value="">— Select Lot —</option>
                                  {dropdowns.lots.map(l => (
                                    <option key={l.id} value={l.id}>
                                      {l.lotNumber} {l.material ? `(${l.material})` : ''}
                                    </option>
                                  ))}
                                </select>
                                <span style={styles.detectedHint(hasLotMatch)}>
                                  {hasLotMatch ? '✓ Matched' : `Extracted: "${r.lotNumber}"`}
                                </span>
                              </div>
                            </td>

                            {/* Size */}
                            <td>
                              <select
                                style={styles.tableSelect(isDark)}
                                value={r.sizeId}
                                onChange={e => handleRowChange(r.id, 'sizeId', e.target.value)}
                              >
                                <option value="">— Size —</option>
                                {dropdowns.sizes.map(s => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </select>
                            </td>

                            {/* Color */}
                            <td>
                              <select
                                style={styles.tableSelect(isDark)}
                                value={r.colorId}
                                onChange={e => handleRowChange(r.id, 'colorId', e.target.value)}
                              >
                                <option value="">— Color —</option>
                                {dropdowns.colors.map(c => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>
                            </td>

                            {/* Machine */}
                            <td>
                              <select
                                style={styles.tableSelect(isDark)}
                                value={r.machineId}
                                onChange={e => handleRowChange(r.id, 'machineId', e.target.value)}
                              >
                                <option value="">— Machine —</option>
                                {dropdowns.machines.map(m => (
                                  <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                              </select>
                            </td>

                            {/* Front */}
                            <td>
                              <input
                                type="number"
                                min={0}
                                style={styles.tableInputNumber(isDark)}
                                value={r.front}
                                onChange={e => handleRowChange(r.id, 'front', e.target.value)}
                              />
                            </td>

                            {/* Bazo */}
                            <td>
                              <input
                                type="number"
                                min={0}
                                style={styles.tableInputNumber(isDark)}
                                value={r.bazo}
                                onChange={e => handleRowChange(r.id, 'bazo', e.target.value)}
                              />
                            </td>

                            {/* Tape */}
                            <td>
                              <input
                                type="number"
                                min={0}
                                style={styles.tableInputNumber(isDark)}
                                value={r.tape}
                                onChange={e => handleRowChange(r.id, 'tape', e.target.value)}
                              />
                            </td>

                            {/* Pocket */}
                            <td>
                              <input
                                type="number"
                                min={0}
                                style={styles.tableInputNumber(isDark)}
                                value={r.pocket}
                                onChange={e => handleRowChange(r.id, 'pocket', e.target.value)}
                              />
                            </td>

                            {/* Gala */}
                            <td>
                              <input
                                type="number"
                                min={0}
                                style={styles.tableInputNumber(isDark)}
                                value={r.gala}
                                onChange={e => handleRowChange(r.id, 'gala', e.target.value)}
                              />
                            </td>

                            {/* Total Pieces */}
                            <td>
                              <input
                                type="number"
                                min={0}
                                style={{ ...styles.tableInputNumber(isDark), fontWeight: 800, color: '#10b981' }}
                                value={r.totalPiece}
                                onChange={e => handleRowChange(r.id, 'totalPiece', e.target.value)}
                              />
                            </td>

                            {/* Date */}
                            <td>
                              <input
                                type="date"
                                style={styles.tableInputDate(isDark)}
                                value={r.dateCompleted}
                                onChange={e => handleRowChange(r.id, 'dateCompleted', e.target.value)}
                              />
                            </td>

                            {/* Delete */}
                            <td>
                              <button
                                type="button"
                                onClick={() => handleDeleteRow(r.id)}
                                style={styles.btnRowDelete}
                                title="Remove this row"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Modal Footer ── */}
        <div style={styles.footer(isDark)}>
          <div style={styles.footerStats}>
            {extractedRows.length > 0 && (
              <>
                <span>Selected: <strong>{selectedCount} of {extractedRows.length}</strong> rows</span>
                <span>•</span>
                <span>Total Output: <strong>{totalPieces.toLocaleString()}</strong> pcs</span>
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose} style={styles.btnSecondary}>
              Cancel
            </button>
            <button
              type="button"
              disabled={isSaving || extractedRows.length === 0 || selectedCount === 0}
              onClick={handleConfirmAndInsert}
              style={{
                ...styles.btnSave,
                opacity: (isSaving || extractedRows.length === 0 || selectedCount === 0) ? 0.6 : 1,
              }}
            >
              {isSaving ? 'Inserting to Database…' : `✓ Confirm & Insert ${selectedCount} Entries`}
            </button>
          </div>
        </div>

        {/* ── Gemini Key Config Sub-Modal ── */}
        {showKeyModal && (
          <div style={styles.subModalOverlay} onClick={() => setShowKeyModal(false)}>
            <div style={styles.subModalCard(isDark)} onClick={e => e.stopPropagation()}>
              <div style={styles.subModalHeader}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>🔑 Google Gemini API Key Configuration</div>
                <button type="button" onClick={() => setShowKeyModal(false)} style={styles.closeBtn}>✕</button>
              </div>
              <div style={{ padding: '16px 20px' }}>
                <p style={{ fontSize: 13, color: isDark ? '#cbd5e1' : '#475569', margin: '0 0 14px' }}>
                  Gemini 1.5 Flash Vision delivers fast, highly accurate OCR extraction for factory production sheets.
                  Enter your key below. You can obtain a free key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 700 }}>Google AI Studio</a>.
                </p>

                <label style={styles.miniLabel(isDark)}>Gemini API Key</label>
                <input
                  type="password"
                  value={customKeyInput}
                  onChange={e => setCustomKeyInput(e.target.value)}
                  placeholder="AIzaSy..."
                  style={styles.keyInput(isDark)}
                />

                {keyTestStatus && (
                  <div style={keyTestStatus.success ? styles.alertSuccessSm : styles.alertErrorSm}>
                    {keyTestStatus.message}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                  <button
                    type="button"
                    onClick={handleTestKey}
                    disabled={keyTesting || !customKeyInput.trim()}
                    style={styles.btnSecondarySm}
                  >
                    {keyTesting ? 'Testing…' : 'Test Key'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveKey}
                    disabled={keyTesting || !customKeyInput.trim()}
                    style={styles.btnSaveSm}
                  >
                    Save Key
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Beautiful Styles ──
const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.75)',
    backdropFilter: 'blur(5px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100,
    padding: 16,
  },
  modalCard: (isDark) => ({
    background: isDark ? 'var(--bg-card, #0f172a)' : '#ffffff',
    borderRadius: 16,
    width: '95vw',
    maxWidth: 1300,
    height: '92vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
    border: `1px solid ${isDark ? 'var(--border-color, #334155)' : '#e2e8f0'}`,
    overflow: 'hidden',
  }),
  header: {
    background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 55%, #0284c7 100%)',
    padding: '14px 22px',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    background: 'rgba(255,255,255,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
  },
  headerTitle: {
    fontSize: '1.15rem',
    fontWeight: 800,
    letterSpacing: '-0.01em',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  keyBadge: (active) => ({
    background: active ? 'rgba(34, 197, 94, 0.25)' : 'rgba(245, 158, 11, 0.25)',
    border: `1px solid ${active ? '#4ade80' : '#fbbf24'}`,
    color: '#ffffff',
    padding: '4px 12px',
    borderRadius: 20,
    fontSize: 11.5,
    fontWeight: 700,
    cursor: 'pointer',
  }),
  closeBtn: {
    background: 'rgba(255,255,255,0.18)',
    border: 'none',
    color: '#fff',
    width: 32,
    height: 32,
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: (isDark) => ({
    padding: '16px 20px',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    overflow: 'hidden',
    background: isDark ? 'var(--bg-main, #0b1120)' : '#f8fafc',
  }),
  topControlBar: (isDark) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    background: isDark ? '#1e293b' : '#ffffff',
    padding: '10px 16px',
    borderRadius: 10,
    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
    flexShrink: 0,
  }),
  miniLabel: (isDark) => ({
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: isDark ? '#94a3b8' : '#64748b',
    display: 'block',
    marginBottom: 4,
  }),
  select: (isDark) => ({
    padding: '7px 12px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    border: `1.5px solid ${isDark ? '#475569' : '#cbd5e1'}`,
    background: isDark ? '#0f172a' : '#ffffff',
    color: isDark ? '#f8fafc' : '#0f172a',
    outline: 'none',
    minWidth: 240,
  }),
  hintBadge: {
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    color: '#1d4ed8',
    padding: '5px 10px',
    borderRadius: 8,
    fontSize: 12,
    display: 'flex',
    gap: 6,
    alignItems: 'center',
  },
  splitGrid: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '380px 1fr',
    gap: 14,
    overflow: 'hidden',
    minHeight: 0,
  },
  imageColumn: (isDark) => ({
    background: isDark ? '#1e293b' : '#ffffff',
    borderRadius: 12,
    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  }),
  gridColumn: (isDark) => ({
    background: isDark ? '#1e293b' : '#ffffff',
    borderRadius: 12,
    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  }),
  columnHeader: (isDark) => ({
    padding: '10px 14px',
    borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
    fontWeight: 700,
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: isDark ? '#0f172a' : '#f8fafc',
    flexShrink: 0,
  }),
  imageViewerWrap: {
    flex: 1,
    overflow: 'auto',
    position: 'relative',
    background: '#090d16',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: 10,
  },
  slipImage: {
    maxWidth: '100%',
    transition: 'transform 0.12s ease',
    borderRadius: 4,
    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
  },
  dropZone: (isDark) => ({
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    border: `2px dashed ${isDark ? '#334155' : '#cbd5e1'}`,
    borderRadius: 10,
    margin: 14,
    cursor: 'pointer',
    textAlign: 'center',
    background: isDark ? 'rgba(30, 41, 59, 0.4)' : '#fafafa',
  }),
  tableScrollWrapper: {
    flex: 1,
    overflow: 'auto',
  },
  previewTable: (isDark) => ({
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 12.5,
  }),
  tableRow: (isSelected, isDark) => ({
    borderBottom: `1px solid ${isDark ? '#334155' : '#f1f5f9'}`,
    background: isSelected ? 'transparent' : (isDark ? 'rgba(0,0,0,0.3)' : '#f8fafc'),
  }),
  tableSelect: (isDark) => ({
    padding: '5px 8px',
    borderRadius: 6,
    fontSize: 12,
    border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
    background: isDark ? '#0f172a' : '#ffffff',
    color: isDark ? '#f8fafc' : '#0f172a',
    outline: 'none',
    width: '100%',
    minWidth: 120,
  }),
  tableInputNumber: (isDark) => ({
    padding: '5px 6px',
    borderRadius: 6,
    fontSize: 12,
    textAlign: 'right',
    border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
    background: isDark ? '#0f172a' : '#ffffff',
    color: isDark ? '#f8fafc' : '#0f172a',
    outline: 'none',
    width: '100%',
  }),
  tableInputDate: (isDark) => ({
    padding: '4px 6px',
    borderRadius: 6,
    fontSize: 11.5,
    border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
    background: isDark ? '#0f172a' : '#ffffff',
    color: isDark ? '#f8fafc' : '#0f172a',
    outline: 'none',
    width: '100%',
  }),
  detectedHint: (matched) => ({
    fontSize: 10,
    color: matched ? '#16a34a' : '#ea580c',
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  btnRowDelete: {
    background: 'none',
    border: 'none',
    color: '#ef4444',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 800,
    padding: '2px 6px',
  },
  footer: (isDark) => ({
    padding: '12px 20px',
    borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
    background: isDark ? '#0f172a' : '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  }),
  footerStats: {
    fontSize: 13,
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    color: '#64748b',
  },
  btnSecondary: {
    padding: '7px 14px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    color: '#334155',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
  },
  btnSecondarySm: {
    padding: '4px 10px',
    borderRadius: 6,
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    color: '#334155',
    fontWeight: 700,
    fontSize: 12,
    cursor: 'pointer',
  },
  zoomBtn: (isDark) => ({
    background: isDark ? '#334155' : '#f1f5f9',
    border: 'none',
    color: isDark ? '#f8fafc' : '#0f172a',
    width: 24,
    height: 24,
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),
  btnScan: {
    padding: '7px 16px',
    borderRadius: 8,
    border: 'none',
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    color: '#ffffff',
    fontWeight: 800,
    fontSize: 13,
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
  },
  btnSave: {
    padding: '8px 20px',
    borderRadius: 8,
    border: 'none',
    background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
    color: '#ffffff',
    fontWeight: 800,
    fontSize: 13.5,
    cursor: 'pointer',
    boxShadow: '0 3px 10px rgba(22, 163, 74, 0.35)',
  },
  btnAddRow: {
    background: 'none',
    border: '1px dashed #2563eb',
    color: '#2563eb',
    padding: '3px 10px',
    borderRadius: 6,
    fontSize: 11.5,
    fontWeight: 700,
    cursor: 'pointer',
  },
  badgeCount: {
    background: '#dbeafe',
    color: '#1d4ed8',
    borderRadius: 12,
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 800,
  },
  scanningOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.6)',
    backdropFilter: 'blur(2px)',
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    color: '#fff',
    overflow: 'hidden',
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    background: '#38bdf8',
    boxShadow: '0 0 16px #38bdf8, 0 0 24px #0284c7',
    animation: 'scanAnimation 2s linear infinite',
  },
  scanningLabel: {
    background: 'rgba(0,0,0,0.75)',
    padding: '8px 16px',
    borderRadius: 20,
    fontWeight: 700,
    fontSize: 13,
    boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
  },
  spinner: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: '3px solid rgba(37,99,235,0.2)',
    borderTopColor: '#2563eb',
    animation: 'spin 0.8s linear infinite',
    margin: '0 auto',
  },
  emptyGridState: (isDark) => ({
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: 24,
    color: isDark ? '#94a3b8' : '#64748b',
  }),
  alertError: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#b91c1c',
    padding: '8px 14px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  alertSuccess: {
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    color: '#15803d',
    padding: '8px 14px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  alertClose: {
    background: 'none',
    border: 'none',
    color: '#b91c1c',
    fontSize: 12,
    cursor: 'pointer',
  },
  subModalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.65)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1200,
  },
  subModalCard: (isDark) => ({
    background: isDark ? '#0f172a' : '#ffffff',
    borderRadius: 14,
    width: '90vw',
    maxWidth: 480,
    boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
    border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
    overflow: 'hidden',
  }),
  subModalHeader: {
    padding: '14px 18px',
    background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  keyInput: (isDark) => ({
    width: '100%',
    padding: '8px 12px',
    borderRadius: 8,
    border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
    background: isDark ? '#1e293b' : '#ffffff',
    color: isDark ? '#f8fafc' : '#0f172a',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
  }),
  alertSuccessSm: {
    background: '#f0fdf4',
    color: '#15803d',
    padding: '6px 10px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    marginTop: 10,
  },
  alertErrorSm: {
    background: '#fef2f2',
    color: '#b91c1c',
    padding: '6px 10px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    marginTop: 10,
  },
  btnSaveSm: {
    padding: '6px 16px',
    borderRadius: 6,
    border: 'none',
    background: '#16a34a',
    color: '#fff',
    fontWeight: 700,
    fontSize: 12,
    cursor: 'pointer',
  },
};
