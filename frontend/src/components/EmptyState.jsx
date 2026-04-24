const icons = {
  family_survey: "family_restroom",
  priority_list: "priority_high",
  anc: "pregnant_woman",
  child_growth: "child_care",
  vaccination: "vaccines",
  default: "inbox"
};

const messages = {
  family_survey: "No families registered yet. Start by adding your first family.",
  priority_list: "No priority cases right now. All families are healthy!",
  anc: "No ANC registrations yet.",
  child_growth: "No child growth records yet.",
  vaccination: "No vaccination records yet.",
  default: "No data yet. Records will appear here once added."
};

export default function EmptyState({ module = "default", message }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-center px-6">
      <div className="w-16 h-16 bg-[#EAF3DE] rounded-full flex items-center justify-center">
        <span className="material-symbols-outlined text-3xl text-[#1D9E75]">{icons[module] || icons.default}</span>
      </div>
      <p className="text-sm text-[#5F5E5A]">{message || messages[module] || messages.default}</p>
    </div>
  );
}
