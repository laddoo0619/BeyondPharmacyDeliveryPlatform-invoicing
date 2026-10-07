export default function PharmacyLoading() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-green border-r-transparent" />
        <p className="mt-3 text-sm text-muted">Loading...</p>
      </div>
    </div>
  );
}
