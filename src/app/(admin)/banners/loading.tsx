export default function BannersLoading() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-white/50">
      <div className="h-10 w-10 animate-spin rounded-full border-t-2 border-b-2 border-[#98E32F]" />
      <p className="text-sm">Loading banners…</p>
    </div>
  );
}
