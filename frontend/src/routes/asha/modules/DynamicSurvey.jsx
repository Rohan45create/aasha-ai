import EmptyState from '../../../components/EmptyState';

export default function DynamicSurvey() {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#D3D1C7]">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-12 h-12 bg-[#F3E5F5] rounded-full flex items-center justify-center text-[#6A1B9A]">
            <span className="material-symbols-outlined text-2xl">assignment</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#1A1A18]">Dynamic Surveys</h2>
            <p className="text-xs text-[#5F5E5A]">Custom surveys published by your supervisor</p>
          </div>
        </div>
      </div>
      <EmptyState module="default" message="No surveys assigned yet. Your supervisor will publish surveys that will appear here automatically." />
    </div>
  );
}
