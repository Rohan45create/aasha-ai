export default function CloudNotConfigured({ feature }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
      <span className="material-symbols-outlined text-amber-500 mt-0.5 flex-shrink-0">cloud_off</span>
      <div>
        <p className="text-sm font-medium text-amber-800">
          <strong>{feature}</strong> requires Google Cloud setup.
        </p>
        <p className="text-xs text-amber-600 mt-1">See CONFIG_CHECKLIST.md for setup instructions.</p>
      </div>
    </div>
  );
}
