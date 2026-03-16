import DriverNav from "@/components/DriverNav";

export default function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <DriverNav />
      <main className="max-w-lg mx-auto px-4 py-4">{children}</main>
    </div>
  );
}
