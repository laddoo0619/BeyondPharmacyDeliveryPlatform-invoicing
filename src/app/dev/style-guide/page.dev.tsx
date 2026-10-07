"use client";

import { useState } from "react";
import PharmacyNav from "@/components/PharmacyNav";
import ConfirmModal from "@/components/ConfirmModal";
import { DriverSelect } from "@/components/DriverSelect";
import PharmacyLoading from "@/app/(pharmacy)/[store]/loading";
import PharmacyError from "@/app/(pharmacy)/[store]/error";
import {
  card,
  cardInteractive,
  dangerButton,
  emptyState,
  input,
  inputReadOnly,
  label,
  mutedText,
  pageTitle,
  portalMain,
  portalShell,
  primaryButton,
  primaryButtonFull,
  secondaryButton,
  sectionTitle,
  softButton,
  statusBadgeClasses,
  tableHeader,
  tableRow,
} from "@/lib/portalStyles";
import { DEV_STORE, drivers } from "../_fixtures";

const STATUSES = [
  "PENDING", "ASSIGNED", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "FAILED",
  "SUBMITTED", "PLAN_CREATED", "STOP_CREATED", "ALLOCATED", "DEPARTED",
  "TRACKING_LINK_ADDED", "DELIVERY_FAILED", "DISPATCH_FAILED", "WEBHOOK_RECEIVED",
  "CANCELLED", "ACTIVE", "INACTIVE", "DRAFT", "FINALIZED", "ADMIN", "DRIVER",
  "HOLD", "SKIPPED",
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className={sectionTitle}>{title}</h2>
      {children}
    </section>
  );
}

// Every shared primitive in one place, inside the real app shell, so the look
// can be screenshotted and compared without credentials.
export default function StyleGuide() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [driverId, setDriverId] = useState("");

  return (
    <div className={portalShell}>
      <PharmacyNav storeSlug={DEV_STORE.slug} storeName={DEV_STORE.name} basePath="/dev" />
      <main className={`${portalMain} space-y-10`}>
        <div>
          <h1 className={pageTitle}>
            Style <span className="italic font-semibold">guide</span>
          </h1>
          <p className={mutedText}>Shared primitives with fixture content.</p>
        </div>

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <button className={primaryButton}>Primary</button>
            <button className={secondaryButton}>Secondary</button>
            <button className={softButton}>Soft</button>
            <button className={dangerButton}>Delete</button>
            <button className={primaryButton} disabled>Disabled</button>
          </div>
          <div className="max-w-sm">
            <button className={primaryButtonFull}>Full-width primary</button>
          </div>
        </Section>

        <Section title="Inputs">
          <div className="grid max-w-2xl grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={label} htmlFor="sg-name">Patient name</label>
              <input id="sg-name" className={input} placeholder="Start typing a name" />
            </div>
            <div>
              <label className={label} htmlFor="sg-ro">Read-only</label>
              <input id="sg-ro" className={`${input} ${inputReadOnly}`} readOnly value="14250 88 Ave" />
            </div>
            <div>
              <label className={label} htmlFor="sg-zone">Delivery Zone</label>
              <select id="sg-zone" className={input} defaultValue="">
                <option value="">Select zone...</option>
                <option>Surrey — $4.25</option>
              </select>
            </div>
            <DriverSelect
              drivers={drivers}
              value={driverId}
              onChange={setDriverId}
              autoFilledFromZone={false}
              required
            />
            <div className="md:col-span-2">
              <label className={label} htmlFor="sg-notes">Delivery Instructions</label>
              <textarea id="sg-notes" rows={3} className={input} placeholder="Leave at door, ring bell, etc." />
            </div>
          </div>
        </Section>

        <Section title="Cards">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className={`${card} p-6`}>
              <h3 className={sectionTitle}>Card</h3>
              <p className={mutedText}>Static container.</p>
            </div>
            <div className={`${cardInteractive} p-6`}>
              <h3 className={sectionTitle}>Interactive card</h3>
              <p className={mutedText}>Hover to lift.</p>
            </div>
            <div className={emptyState}>
              No <span className="italic text-[#1e3a8a]">reminders</span> scheduled
            </div>
          </div>
        </Section>

        <Section title="Status badges">
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <span key={s} className={statusBadgeClasses(s)}>
                {s.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </Section>

        <Section title="Table">
          <div className={`${card} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={tableHeader}>
                  <tr>
                    <th className="px-6 py-3">Patient</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {[
                    ["Avery Sandhu", "ASSIGNED", 4.25],
                    ["Morgan Patel", "FAILED", 4.25],
                    ["Casey Brar", "DELIVERED", 5.25],
                  ].map(([name, status, price]) => (
                    <tr key={name as string} className={tableRow}>
                      <td className="px-6 py-4 text-sm font-semibold text-[#1e3a8a]">{name}</td>
                      <td className="px-6 py-4">
                        <span className={statusBadgeClasses(status as string)}>{status}</span>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-[#1e3a8a]">
                        ${(price as number).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Section>

        <Section title="Dialog">
          <button className={secondaryButton} onClick={() => setConfirmOpen(true)} data-testid="open-confirm">
            Open confirm dialog
          </button>
          <ConfirmModal
            open={confirmOpen}
            title="Delete this reminder?"
            message="This can't be undone."
            confirmLabel="Delete"
            onConfirm={() => setConfirmOpen(false)}
            onCancel={() => setConfirmOpen(false)}
          />
        </Section>

        <Section title="Loading and error states">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className={card}>
              <PharmacyLoading />
            </div>
            <PharmacyError error={new Error("Fixture error")} reset={() => {}} />
          </div>
        </Section>
      </main>
    </div>
  );
}
