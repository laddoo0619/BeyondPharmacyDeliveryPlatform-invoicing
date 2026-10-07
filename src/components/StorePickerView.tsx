import Link from "next/link";

// The admin's store picker. Presentational, so the dev-only style guide can
// render it from fixtures.
export default function StorePickerView({
  stores,
}: {
  stores: { id: string; slug: string; name: string }[];
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-6 p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Beyond Pharmacy</h1>
          <p className="mt-2 text-sm text-gray-600">Select a store to manage</p>
        </div>

        <div className="space-y-3">
          {stores.map((store) => (
            <Link
              key={store.id}
              href={`/${store.slug}/dashboard`}
              className="block w-full p-4 bg-white rounded-xl shadow-sm border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all"
            >
              <h2 className="text-lg font-semibold text-gray-900">{store.name}</h2>
              <p className="text-sm text-gray-500 mt-1">View dashboard &rarr;</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
