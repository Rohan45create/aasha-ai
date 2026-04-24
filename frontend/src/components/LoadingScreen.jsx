export default function LoadingScreen({ message = "Loading..." }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <span className="material-symbols-outlined text-4xl text-[#1D9E75] animate-spin">refresh</span>
      <p className="text-sm text-[#5F5E5A]">{message}</p>
    </div>
  );
}
