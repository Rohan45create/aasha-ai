import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';

const FIELD_TYPES = [
  { type: 'text', icon: 'text_fields', label: 'Text' },
  { type: 'number', icon: 'numbers', label: 'Number' },
  { type: 'date', icon: 'calendar_today', label: 'Date' },
  { type: 'select', icon: 'menu', label: 'Dropdown' },
  { type: 'boolean', icon: 'toggle_on', label: 'Yes/No' },
  { type: 'gps', icon: 'location_on', label: 'GPS Location' },
  { type: 'aadhaar', icon: 'fingerprint', label: 'Aadhaar Scan' },
  { type: 'conditional', icon: 'branch', label: 'Conditional Logic' },
];

export default function SurveyBuilder() {
  const [title, setTitle] = useState('');
  const [fields, setFields] = useState([]);
  const [expandedField, setExpandedField] = useState(null);
  const [language, setLanguage] = useState('EN');
  const [assignedWorkers, setAssignedWorkers] = useState([]);
  const [publishing, setPublishing] = useState(false);
  const { user } = useAuthStore();

  const addField = (type) => {
    const newField = {
      id: Date.now(),
      type,
      label_en: 'New Question',
      label_mr: 'नवीन प्रश्न',
      label_hi: 'नया सवाल',
      required: false,
      ...(type === 'conditional' && { condition: { field: '', value: '' } })
    };
    setFields([...fields, newField]);
  };

  const updateField = (id, updates) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const deleteField = (id) => {
    setFields(fields.filter(f => f.id !== id));
  };

  const getLabel = (field) => {
    if (language === 'EN') return field.label_en;
    if (language === 'MR') return field.label_mr;
    if (language === 'HI') return field.label_hi;
    return field.label_en;
  };

  const handlePublish = async () => {
    if (!title.trim() || fields.length === 0) {
      alert('Please enter a title and add at least one field');
      return;
    }

    setPublishing(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/supervisor/surveys/publish`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title,
          fields,
          assignedTo: assignedWorkers,
          createdBy: user.uid
        })
      });

      if (response.ok) {
        alert('✓ Survey published successfully');
        setTitle('');
        setFields([]);
        setAssignedWorkers([]);
      } else {
        alert('Failed to publish survey');
      }
    } catch (err) {
      console.error('Error publishing survey:', err);
      alert('Failed to publish survey');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Dynamic Survey Builder</h1>
        <button onClick={handlePublish} disabled={publishing} className="bg-[#1D9E75] text-white px-6 py-2 rounded-xl font-bold shadow-md hover:bg-[#085041] transition-colors disabled:opacity-50">
          {publishing ? 'Publishing...' : 'Publish Survey'}
        </button>
      </div>

      <div className="flex gap-6">
        {/* Editor */}
        <div className="flex-1 bg-white p-6 rounded-2xl shadow-sm border border-[#D3D1C7]">
          <h2 className="text-lg font-bold mb-4">Survey Details</h2>
          <input
            type="text"
            placeholder="Survey Title"
            className="w-full p-3 border rounded-xl mb-4"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />

          {/* Assigned Workers */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Assign to Workers</label>
            <select multiple className="w-full p-3 border rounded-xl" size="3">
              <option>Worker 1</option>
              <option>Worker 2</option>
              <option>Worker 3</option>
            </select>
          </div>

          {/* Field List */}
          <div className="space-y-2 mb-4">
            {fields.map((f, i) => (
              <div key={f.id} className="flex gap-3 items-center border p-3 rounded-xl bg-gray-50 cursor-pointer hover:bg-gray-100" onClick={() => setExpandedField(f.id)}>
                <span className="material-symbols-outlined text-lg text-[#1D9E75]">
                  {FIELD_TYPES.find(t => t.type === f.type)?.icon || 'help'}
                </span>
                <div className="flex-1">
                  <p className="font-medium">{getLabel(f)}</p>
                  <p className="text-xs text-[#5F5E5A]">{FIELD_TYPES.find(t => t.type === f.type)?.label}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteField(f.id); }}
                  className="text-[#E24B4A] hover:bg-red-100 p-2 rounded"
                >
                  <span className="material-symbols-outlined text-lg">delete</span>
                </button>
              </div>
            ))}
          </div>

          {/* Field Type Buttons */}
          <div className="mb-4">
            <p className="text-sm font-medium mb-2">Add Field Type</p>
            <div className="grid grid-cols-4 gap-2">
              {FIELD_TYPES.map(ft => (
                <button
                  key={ft.type}
                  onClick={() => addField(ft.type)}
                  className="flex flex-col items-center gap-1 p-2 border rounded-lg hover:bg-[#EAF3DE] transition-colors text-center"
                  title={ft.label}
                >
                  <span className="material-symbols-outlined text-lg">{ft.icon}</span>
                  <span className="text-xs font-medium">{ft.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Preview & Details Panel */}
        <div className="w-96 space-y-6">
          {/* Language Toggle */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#D3D1C7]">
            <p className="text-sm font-medium mb-3">Preview Language</p>
            <div className="flex gap-2">
              {[
                { code: 'EN', label: 'English' },
                { code: 'MR', label: 'मराठी' },
                { code: 'HI', label: 'हिंदी' }
              ].map(l => (
                <button
                  key={l.code}
                  onClick={() => setLanguage(l.code)}
                  className={`flex-1 py-2 px-3 rounded-lg font-medium transition-colors ${
                    language === l.code
                      ? 'bg-[#1D9E75] text-white'
                      : 'bg-gray-100 text-[#5F5E5A] hover:bg-gray-200'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#D3D1C7]">
            <p className="text-sm font-medium mb-3">Preview ({language})</p>
            <div className="bg-[#F1EFE8] rounded-xl p-4 shadow-inner min-h-[400px] max-h-[600px] overflow-y-auto border-4 border-gray-400" style={{ width: '375px' }}>
              <h3 className="font-bold text-center mb-4">{title || 'Survey Title'}</h3>
              <div className="space-y-4">
                {fields.map(f => (
                  <div key={f.id} className="bg-white p-3 rounded-xl shadow-sm">
                    <p className="text-xs font-semibold mb-2">{getLabel(f)}</p>
                    <div className="h-8 bg-gray-100 rounded border border-gray-200"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Field Editor */}
          {expandedField && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#1D9E75]">
              <p className="text-sm font-medium mb-3">Edit Field</p>
              {fields.map(f => f.id === expandedField && (
                <div key={f.id} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">English Label</label>
                    <input
                      type="text"
                      value={f.label_en}
                      onChange={(e) => updateField(f.id, { label_en: e.target.value })}
                      className="w-full p-2 border rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Marathi Label</label>
                    <input
                      type="text"
                      value={f.label_mr}
                      onChange={(e) => updateField(f.id, { label_mr: e.target.value })}
                      className="w-full p-2 border rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Hindi Label</label>
                    <input
                      type="text"
                      value={f.label_hi}
                      onChange={(e) => updateField(f.id, { label_hi: e.target.value })}
                      className="w-full p-2 border rounded-lg text-sm"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={f.required}
                      onChange={(e) => updateField(f.id, { required: e.target.checked })}
                    />
                    Required
                  </label>
                  <button
                    onClick={() => setExpandedField(null)}
                    className="w-full py-2 bg-[#1D9E75] text-white rounded-lg font-medium"
                  >
                    Done Editing
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
