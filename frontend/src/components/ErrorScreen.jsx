export default function ErrorScreen({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-center px-6">
      <div className="w-16 h-16 bg-[#FCEBEB] rounded-full flex items-center justify-center">
        <span className="material-symbols-outlined text-3xl text-[#E24B4A]">error</span>
      </div>
      <p className="text-sm text-[#791F1F]">{message || "Something went wrong."}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-sm text-[#1D9E75] font-medium underline hover:text-[#085041] transition-colors">
          Try again
        </button>
      )}
    </div>
  );
}
