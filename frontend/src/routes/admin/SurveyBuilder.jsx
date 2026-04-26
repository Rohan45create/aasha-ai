import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';

const FIELD_TYPES = [
  { type: 'text',        icon: 'text_fields',    label: 'Text' },
  { type: 'number',      icon: 'numbers',         label: 'Number' },
  { type: 'date',        icon: 'calendar_today',  label: 'Date' },
  { type: 'select',      icon: 'menu',            label: 'Dropdown' },
  { type: 'boolean',     icon: 'toggle_on',       label: 'Yes/No' },
  { type: 'gps',         icon: 'location_on',     label: 'GPS Location' },
  { type: 'aadhaar',     icon: 'fingerprint',     label: 'Aadhaar Scan' },
  { type: 'photo',       icon: 'photo_camera',    label: 'Photo' },
  { type: 'conditional', icon: 'account_tree',    label: 'Conditional' },
];

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || '';

export default function SurveyBuilder() {
  const [title, setTitle] = useState('');
  const [fields, setFields] = useState([]);
  const [expandedField, setExpandedField] = useState(null);
  const [language, setLanguage] = useState('EN');
  const [publishing, setPublishing] = useState(false);
  const [translating, setTranslating] = useState(null); // field id being translated
  const { user, headId } = useAuthStore();

  const addField = (type) => {
    const defaults = {
      text:        { placeholder_en: '', placeholder_mr: '', placeholder_hi: '', maxLength: '' },
      number:      { min: '', max: '', unit: '' },
      date:        { minDate: '', maxDate: '' },
      select:      { options_en: '', options_mr: '', options_hi: '', allowMultiple: false },
      boolean:     {},
      gps:         { captureAuto: true },
      aadhaar:     {},
      photo:       { maxPhotos: 1 },
      conditional: { condition: { field: '', value: '' } },
    };
    setFields(prev => [...prev, {
      id: Date.now(),
      type,
      label_en: 'New Question',
      label_mr: 'नवीन प्रश्न',
      label_hi: 'नया सवाल',
      required: false,
      ...defaults[type],
    }]);
  };

  const updateField = (id, updates) =>
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));

  const deleteField = (id) => {
    setFields(prev => prev.filter(f => f.id !== id));
    if (expandedField === id) setExpandedField(null);
  };

  const moveField = (id, dir) => {
    setFields(prev => {
      const i = prev.findIndex(f => f.id === id);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const autoTranslate = async (field) => {
    if (!field.label_en || translating) return;
    setTranslating(field.id);
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`${BACKEND_URL}/api/admin/translate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: field.label_en })
      });
      if (res.ok) {
        const data = await res.json();
        updateField(field.id, { label_mr: data.mr || field.label_mr, label_hi: data.hi || field.label_hi });
      }
    } catch (err) {
      console.warn('[SurveyBuilder] Auto-translate failed:', err);
    } finally {
      setTranslating(null);
    }
  };

  const handlePublish = async () => {
    if (!title.trim() || fields.length === 0) {
      alert('Please enter a title and add at least one field');
      return;
    }
    setPublishing(true);
    try {
      const token = await user?.getIdToken();
      // Auto-assign to ALL workers under this head
      const response = await fetch(`${BACKEND_URL}/api/admin/supervisor/surveys/publish`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, fields, headId, assignedTo: 'all', createdBy: user?.uid })
      });
      if (response.ok) {
        alert('✓ Survey published to all workers!');
        setTitle('');
        setFields([]);
        setExpandedField(null);
      } else {
        const err = await response.json().catch(() => ({}));
        alert(`Failed: ${err.detail || response.status}`);
      }
    } catch (err) {
      alert(`Network error: ${err.message}`);
    } finally {
      setPublishing(false);
    }
  };

  const getLabel = (field) =>
    language === 'MR' ? field.label_mr : language === 'HI' ? field.label_hi : field.label_en;

  // ── Per-field config panel ─────────────────────────────────────────────────
  const FieldConfig = ({ field }) => (
    <div className="mt-3 pt-3 border-t border-[#D3D1C7] space-y-3">
      {/* Labels row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {[['label_en', 'Label (English)', ''], ['label_mr', 'Label (Marathi)', ''], ['label_hi', 'Label (Hindi)', '']].map(([key, placeholder]) => (
          <div key={key}>
            <label className="text-[10px] text-[#5F5E5A] font-medium uppercase tracking-wide">{placeholder}</label>
            <div className="flex items-center gap-1">
              <input
                value={field[key] || ''}
                onChange={e => updateField(field.id, { [key]: e.target.value })}
                onBlur={() => key === 'label_en' && autoTranslate(field)}
                className="w-full mt-1 p-2 border border-[#D3D1C7] rounded-lg text-sm focus:outline-none focus:border-[#1D9E75]"
                placeholder={placeholder}
              />
              {key === 'label_en' && translating === field.id && (
                <span className="material-symbols-outlined text-sm animate-spin text-[#1D9E75] flex-shrink-0">refresh</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Required toggle */}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <div
          className={`w-10 h-5 rounded-full transition-colors ${field.required ? 'bg-[#1D9E75]' : 'bg-gray-300'}`}
          onClick={() => updateField(field.id, { required: !field.required })}
        >
          <div className={`w-4 h-4 bg-white rounded-full shadow mt-0.5 transition-transform ${field.required ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </div>
        <span className="text-sm text-[#5F5E5A]">Required field</span>
      </label>

      {/* Type-specific config */}
      {field.type === 'text' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-[#5F5E5A] font-medium uppercase">Placeholder (English)</label>
            <input value={field.placeholder_en || ''} onChange={e => updateField(field.id, { placeholder_en: e.target.value })} className="w-full mt-1 p-2 border border-[#D3D1C7] rounded-lg text-sm focus:outline-none focus:border-[#1D9E75]" placeholder="e.g. Enter full name" />
          </div>
          <div>
            <label className="text-[10px] text-[#5F5E5A] font-medium uppercase">Max Length</label>
            <input type="number" value={field.maxLength || ''} onChange={e => updateField(field.id, { maxLength: e.target.value })} className="w-full mt-1 p-2 border border-[#D3D1C7] rounded-lg text-sm focus:outline-none focus:border-[#1D9E75]" placeholder="250" />
          </div>
        </div>
      )}

      {field.type === 'number' && (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] text-[#5F5E5A] font-medium uppercase">Min</label>
            <input type="number" value={field.min || ''} onChange={e => updateField(field.id, { min: e.target.value })} className="w-full mt-1 p-2 border border-[#D3D1C7] rounded-lg text-sm focus:outline-none focus:border-[#1D9E75]" placeholder="0" />
          </div>
          <div>
            <label className="text-[10px] text-[#5F5E5A] font-medium uppercase">Max</label>
            <input type="number" value={field.max || ''} onChange={e => updateField(field.id, { max: e.target.value })} className="w-full mt-1 p-2 border border-[#D3D1C7] rounded-lg text-sm focus:outline-none focus:border-[#1D9E75]" placeholder="999" />
          </div>
          <div>
            <label className="text-[10px] text-[#5F5E5A] font-medium uppercase">Unit</label>
            <input value={field.unit || ''} onChange={e => updateField(field.id, { unit: e.target.value })} className="w-full mt-1 p-2 border border-[#D3D1C7] rounded-lg text-sm focus:outline-none focus:border-[#1D9E75]" placeholder="kg, cm…" />
          </div>
        </div>
      )}

      {field.type === 'date' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-[#5F5E5A] font-medium uppercase">Min Date</label>
            <input type="date" value={field.minDate || ''} onChange={e => updateField(field.id, { minDate: e.target.value })} className="w-full mt-1 p-2 border border-[#D3D1C7] rounded-lg text-sm focus:outline-none focus:border-[#1D9E75]" />
          </div>
          <div>
            <label className="text-[10px] text-[#5F5E5A] font-medium uppercase">Max Date</label>
            <input type="date" value={field.maxDate || ''} onChange={e => updateField(field.id, { maxDate: e.target.value })} className="w-full mt-1 p-2 border border-[#D3D1C7] rounded-lg text-sm focus:outline-none focus:border-[#1D9E75]" />
          </div>
        </div>
      )}

      {field.type === 'select' && (
        <div className="space-y-2">
          <div>
            <label className="text-[10px] text-[#5F5E5A] font-medium uppercase">Options (English, comma-separated)</label>
            <input value={field.options_en || ''} onChange={e => updateField(field.id, { options_en: e.target.value })} className="w-full mt-1 p-2 border border-[#D3D1C7] rounded-lg text-sm focus:outline-none focus:border-[#1D9E75]" placeholder="Option 1, Option 2, Option 3" />
          </div>
          <div>
            <label className="text-[10px] text-[#5F5E5A] font-medium uppercase">Options (Marathi)</label>
            <input value={field.options_mr || ''} onChange={e => updateField(field.id, { options_mr: e.target.value })} className="w-full mt-1 p-2 border border-[#D3D1C7] rounded-lg text-sm focus:outline-none focus:border-[#1D9E75]" placeholder="पर्याय १, पर्याय २" />
          </div>
          <label className="flex items-center gap-2 text-sm text-[#5F5E5A] cursor-pointer">
            <input type="checkbox" checked={field.allowMultiple || false} onChange={e => updateField(field.id, { allowMultiple: e.target.checked })} className="w-4 h-4" />
            Allow multiple selections
          </label>
        </div>
      )}

      {field.type === 'number' && field.unit && (
        <p className="text-xs text-[#1D9E75]">Preview: "Enter value in {field.unit}" ({field.min || '0'} – {field.max || '∞'})</p>
      )}

      {field.type === 'conditional' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-[#5F5E5A] font-medium uppercase">Show when field (ID)</label>
            <input value={field.condition?.field || ''} onChange={e => updateField(field.id, { condition: { ...field.condition, field: e.target.value } })} className="w-full mt-1 p-2 border border-[#D3D1C7] rounded-lg text-sm focus:outline-none focus:border-[#1D9E75]" placeholder="field_id" />
          </div>
          <div>
            <label className="text-[10px] text-[#5F5E5A] font-medium uppercase">Equals value</label>
            <input value={field.condition?.value || ''} onChange={e => updateField(field.id, { condition: { ...field.condition, value: e.target.value } })} className="w-full mt-1 p-2 border border-[#D3D1C7] rounded-lg text-sm focus:outline-none focus:border-[#1D9E75]" placeholder="yes" />
          </div>
        </div>
      )}

      {field.type === 'photo' && (
        <div>
          <label className="text-[10px] text-[#5F5E5A] font-medium uppercase">Max Photos</label>
          <input type="number" min={1} max={5} value={field.maxPhotos || 1} onChange={e => updateField(field.id, { maxPhotos: parseInt(e.target.value) })} className="w-24 mt-1 p-2 border border-[#D3D1C7] rounded-lg text-sm focus:outline-none focus:border-[#1D9E75]" />
        </div>
      )}

      {field.type === 'gps' && (
        <label className="flex items-center gap-2 text-sm text-[#5F5E5A] cursor-pointer">
          <input type="checkbox" checked={field.captureAuto !== false} onChange={e => updateField(field.id, { captureAuto: e.target.checked })} className="w-4 h-4" />
          Auto-capture GPS on form open
        </label>
      )}

      {field.type === 'boolean' && (
        <p className="text-xs text-[#5F5E5A]">Will render as Yes/No toggle. No extra config needed.</p>
      )}

      {field.type === 'aadhaar' && (
        <p className="text-xs text-[#5F5E5A]">Will open camera for Aadhaar card scan via OCR.</p>
      )}

      {/* Auto-translate hint */}
      <p className="text-[10px] text-[#1D9E75] italic">💡 Blur the English label to auto-translate to Marathi & Hindi</p>
    </div>
  );

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full" style={{ minHeight: 'calc(100vh - 64px)' }}>
      {/* Left Sidebar — Field Types */}
      <div className="w-48 flex-shrink-0 bg-[#F1EFE8] border-r border-[#D3D1C7] p-4 overflow-y-auto">
        <h3 className="text-xs font-bold text-[#5F5E5A] uppercase tracking-wide mb-3">Field Types</h3>
        <div className="space-y-1">
          {FIELD_TYPES.map(ft => (
            <button
              key={ft.type}
              onClick={() => addField(ft.type)}
              className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-[#EAF3DE] text-[#1A1A18] transition-colors text-sm"
            >
              <span className="material-symbols-outlined text-lg text-[#1D9E75]">{ft.icon}</span>
              <span>{ft.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Builder Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="text-2xl font-bold bg-transparent border-b-2 border-dashed border-[#D3D1C7] focus:border-[#1D9E75] focus:outline-none flex-1 min-w-0 pr-4"
            placeholder="Survey Title…"
          />
          <div className="flex items-center gap-2">
            {/* Language Toggle */}
            {['EN', 'MR', 'HI'].map(l => (
              <button
                key={l}
                onClick={() => setLanguage(l)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${language === l ? 'bg-[#085041] text-white' : 'bg-gray-100 text-[#5F5E5A] hover:bg-gray-200'}`}
              >
                {l}
              </button>
            ))}

            <button
              onClick={handlePublish}
              disabled={publishing || fields.length === 0 || !title.trim()}
              className="ml-4 bg-[#1D9E75] text-white px-5 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-[#085041] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {publishing ? (
                <span className="material-symbols-outlined animate-spin">refresh</span>
              ) : (
                <span className="material-symbols-outlined">send</span>
              )}
              Publish to All Workers
            </button>
          </div>
        </div>

        {/* Fields */}
        {fields.length === 0 ? (
          <div className="border-2 border-dashed border-[#D3D1C7] rounded-2xl p-12 text-center text-[#5F5E5A]">
            <span className="material-symbols-outlined text-4xl mb-3 block">add_circle</span>
            <p className="font-medium">Click a field type on the left to add your first question</p>
          </div>
        ) : (
          <div className="space-y-3">
            {fields.map((field, i) => {
              const isExpanded = expandedField === field.id;
              const ft = FIELD_TYPES.find(t => t.type === field.type) || FIELD_TYPES[0];
              return (
                <div
                  key={field.id}
                  className={`bg-white border rounded-2xl p-4 transition-all ${isExpanded ? 'border-[#1D9E75] shadow-md' : 'border-[#D3D1C7] shadow-sm'}`}
                >
                  <div className="flex items-center gap-3">
                    {/* Drag handle */}
                    <div className="flex flex-col gap-1">
                      <button onClick={() => moveField(field.id, -1)} disabled={i === 0} className="text-[#D3D1C7] hover:text-[#5F5E5A] disabled:opacity-30"><span className="material-symbols-outlined text-sm">arrow_upward</span></button>
                      <button onClick={() => moveField(field.id, 1)} disabled={i === fields.length - 1} className="text-[#D3D1C7] hover:text-[#5F5E5A] disabled:opacity-30"><span className="material-symbols-outlined text-sm">arrow_downward</span></button>
                    </div>

                    <div className="w-9 h-9 rounded-xl bg-[#EAF3DE] flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-lg text-[#1D9E75]">{ft.icon}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{getLabel(field)}</p>
                      <p className="text-xs text-[#5F5E5A]">{ft.label}{field.required ? ' · Required' : ''}</p>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => setExpandedField(isExpanded ? null : field.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isExpanded ? 'bg-[#EAF3DE] text-[#085041]' : 'bg-gray-100 text-[#5F5E5A] hover:bg-gray-200'}`}
                      >
                        {isExpanded ? 'Close ▲' : 'Edit ▼'}
                      </button>
                      <button onClick={() => deleteField(field.id)} className="p-2 rounded-lg text-[#E24B4A] hover:bg-[#FCEBEB] transition-colors">
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </div>
                  </div>

                  {isExpanded && <FieldConfig field={field} />}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right Preview Panel */}
      <div className="w-56 flex-shrink-0 hidden xl:block bg-[#F1EFE8] border-l border-[#D3D1C7] p-4 overflow-y-auto">
        <h3 className="text-xs font-bold text-[#5F5E5A] uppercase tracking-wide mb-3">Preview</h3>
        <div className="bg-white rounded-xl p-3 shadow-sm border border-[#D3D1C7]">
          {title ? <p className="font-bold text-sm mb-3 text-[#085041]">{title}</p> : <p className="text-xs text-gray-400 mb-3 italic">No title yet</p>}
          {fields.map(f => (
            <div key={f.id} className="mb-3">
              <p className="text-xs font-medium text-[#1A1A18]">{getLabel(f)}{f.required && <span className="text-[#E24B4A] ml-0.5">*</span>}</p>
              {f.type === 'text' && <div className="mt-1 h-7 bg-gray-100 rounded-lg text-[9px] text-gray-400 flex items-center px-2">Type here…</div>}
              {f.type === 'number' && <div className="mt-1 h-7 bg-gray-100 rounded-lg text-[9px] text-gray-400 flex items-center px-2">0 {f.unit}</div>}
              {f.type === 'boolean' && <div className="mt-1 flex gap-2"><span className="text-[9px] bg-[#EAF3DE] text-[#085041] px-2 py-1 rounded">Yes</span><span className="text-[9px] bg-gray-100 text-gray-500 px-2 py-1 rounded">No</span></div>}
              {f.type === 'select' && <div className="mt-1 h-7 bg-gray-100 rounded-lg text-[9px] text-gray-400 flex items-center px-2">Select…</div>}
              {f.type === 'date' && <div className="mt-1 h-7 bg-gray-100 rounded-lg text-[9px] text-gray-400 flex items-center px-2">📅 Pick date</div>}
              {f.type === 'gps' && <div className="mt-1 h-7 bg-gray-100 rounded-lg text-[9px] text-gray-400 flex items-center px-2">📍 Capture location</div>}
              {f.type === 'photo' && <div className="mt-1 h-7 bg-gray-100 rounded-lg text-[9px] text-gray-400 flex items-center px-2">📷 Take photo</div>}
            </div>
          ))}
          {fields.length === 0 && <p className="text-[10px] text-gray-400">Add fields to preview</p>}
        </div>
        <div className="mt-4 text-[10px] text-[#5F5E5A] bg-[#EAF3DE] rounded-lg p-3 border border-[#1D9E75]">
          <p className="font-bold text-[#085041] mb-1">📌 Publish Info</p>
          <p>This survey will be auto-assigned to <strong>all ASHA workers</strong> under your account.</p>
        </div>
      </div>
    </div>
  );
}
