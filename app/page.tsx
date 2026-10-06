"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

type Priority = "Normal" | "Urgent";

export default function Home() {
  const [memberName, setMemberName] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState<Priority>("Normal");
  const [assignedTo, setAssignedTo] = useState("Unassigned");
  const [description, setDescription] = useState("");
  const [saved, setSaved] = useState(false);

 async function saveIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!memberName.trim() || !phone.trim() || !category || !description.trim()) {
      alert("Please fill out the member name, phone number, category, and issue.");
      return;
    }

  const { error } = await supabase.from("Issues").insert({
  member_name: memberName,
  phone,
  category,
  priority,
  assigned_to: assignedTo,
  description,
  status: "Open",
  created_by: "Front Desk Staff",
});

if (error) {
  alert (error.message);
  return;
}
    setSaved(true);

    setMemberName("");
    setPhone("");
    setCategory("");
    setPriority("Normal");
    setAssignedTo("Unassigned");
    setDescription("");

    setTimeout(() => setSaved(false), 4000);
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden w-64 border-r border-slate-200 bg-white p-6 md:block">
          <div className="mb-10">
            <div className="text-2xl font-bold text-blue-600">FitFlow</div>
            <div className="text-sm text-slate-500">Gym Operations</div>
          </div>

          <nav className="space-y-2">
            <button className="w-full rounded-xl bg-blue-50 px-4 py-3 text-left font-semibold text-blue-600">
              + New Issue
            </button>

            <button className="w-full rounded-xl px-4 py-3 text-left text-slate-600 hover:bg-slate-50">
              Issues
            </button>

            <button className="w-full rounded-xl px-4 py-3 text-left text-slate-600 hover:bg-slate-50">
              Members
            </button>

            <button className="w-full rounded-xl px-4 py-3 text-left text-slate-600 hover:bg-slate-50">
              Inventory
            </button>

            <button className="w-full rounded-xl px-4 py-3 text-left text-slate-600 hover:bg-slate-50">
              Reports
            </button>
          </nav>

          <div className="mt-12 border-t border-slate-200 pt-6">
            <p className="text-sm font-semibold text-slate-700">
              Front Desk Staff
            </p>
            <p className="text-xs text-slate-500">FitFlow Demo Gym</p>
          </div>
        </aside>

        {/* Main content */}
        <section className="flex-1 p-5 md:p-10">
          <div className="mx-auto max-w-6xl">
            <div className="mb-8 flex items-start justify-between">
              <div>
                <p className="mb-2 text-sm font-semibold text-blue-600">
                  MEMBER SUPPORT
                </p>

                <h1 className="text-3xl font-bold md:text-4xl">
                  New Member Issue
                </h1>

                <p className="mt-2 text-slate-500">
                  Create and assign a member issue so it can be resolved quickly.
                </p>
              </div>

              <div className="hidden rounded-xl border border-slate-200 bg-white px-4 py-3 text-right shadow-sm sm:block">
                <p className="text-sm font-semibold">Front Desk</p>
                <p className="text-xs text-slate-500">
                  {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>

            {saved && (
              <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-5 py-4 font-medium text-green-700">
                ✓ Issue saved successfully. Management can now see it.
              </div>
            )}

            <form
              onSubmit={saveIssue}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8"
            >
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold">
                    Member Name *
                  </label>

                  <input
                    value={memberName}
                    onChange={(e) => setMemberName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    placeholder="Search or enter member name"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold">
                    Phone Number *
                  </label>

                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    placeholder="(505) 555-0182"
                  />
                </div>
              </div>

              <div className="mt-6 grid gap-6 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold">
                    Category *
                  </label>

                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="">Select category</option>
                    <option>Billing</option>
                    <option>Membership</option>
                    <option>Cancellation</option>
                    <option>Sales / New Membership</option>
                    <option>Personal Training</option>
                    <option>Facility / Equipment</option>
                    <option>Staff Complaint</option>
                    <option>Other</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold">
                    Assigned To
                  </label>

                  <select
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  >
                    <option>Unassigned</option>
                    <option>General Manager</option>
                    <option>Assistant Manager</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold">
                    Priority
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPriority("Normal")}
                      className={`rounded-xl border px-4 py-3 font-semibold ${
                        priority === "Normal"
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-slate-300 bg-white text-slate-600"
                      }`}
                    >
                      Normal
                    </button>

                    <button
                      type="button"
                      onClick={() => setPriority("Urgent")}
                      className={`rounded-xl border px-4 py-3 font-semibold ${
                        priority === "Urgent"
                          ? "border-red-500 bg-red-50 text-red-700"
                          : "border-slate-300 bg-white text-slate-600"
                      }`}
                    >
                      Urgent
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-semibold">
                    Problem / Issue *
                  </label>

                  <span className="text-xs text-slate-400">
                    {description.length} / 2000
                  </span>
                </div>

                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
                  className="min-h-72 w-full resize-none rounded-xl border border-slate-300 px-4 py-4 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  placeholder="Describe the member problem in detail..."
                />
              </div>

              <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-6">
                <p className="hidden text-sm text-slate-400 sm:block">
                  Date and staff identity are recorded automatically.
                </p>

                <div className="ml-auto flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setMemberName("");
                      setPhone("");
                      setCategory("");
                      setPriority("Normal");
                      setAssignedTo("Unassigned");
                      setDescription("");
                    }}
                    className="rounded-xl border border-slate-300 px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Clear
                  </button>

                  <button
                    type="submit"
                    className="rounded-xl bg-blue-600 px-7 py-3 font-semibold text-white shadow-sm transition hover:bg-blue-700"
                  >
                    Save Issue
                  </button>
                </div>
              </div>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}