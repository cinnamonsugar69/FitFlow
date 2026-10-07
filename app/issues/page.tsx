"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useStaff } from "../components/staff-access";
import { canManage } from "@/lib/staff";
import Link from "next/link";
type Issue = {
  id: string;
  memberName: string;
  phone: string;
  category: string;
  priority: "Normal" | "Urgent";
  assignedTo: string;
  description: string;
  status: string;
  createdAt: string;
  createdBy: string;
};

export default function IssuesPage() {
  const staff = useStaff();
  const isManager = canManage(staff);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [updating, setUpdating] = useState(false);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    let active = true;
    async function loadIssues() {
      try {
        const { data, error } = await supabase
          .from("Issues").select("*").order("created_at", { ascending: false });
        if (!active) return;
        if (error) {
          setErrorMessage("Could not load issues. Check your connection and staff access, then refresh.");
          return;
        }
        const formattedIssues: Issue[] = (data || []).map((issue) => ({
          id: issue.id,
          memberName: issue.member_name,
          phone: issue.phone,
          category: issue.category,
          priority: issue.priority,
          assignedTo: issue.assigned_to,
          description: issue.description,
          status: issue.status,
          createdAt: issue.created_at,
          createdBy: issue.created_by,
        }));
        setIssues(formattedIssues);
        setSelectedIssue(formattedIssues[0] ?? null);
      } catch {
        if (active) setErrorMessage("Unable to connect. Please refresh to try again.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadIssues();
    return () => { active = false; };
  }, []);

  async function updateStatus(issueId: string, newStatus: string) {
    await updateIssue(issueId, { status: newStatus });
  }

  async function updateIssue(issueId: string, changes: { status?: string; assigned_to?: string }) {
    if (!isManager || updating) return;
    setUpdating(true);
    setErrorMessage("");
    try {
      const { data, error } = await supabase
        .from("Issues").update(changes).eq("id", issueId)
        .select("status, assigned_to").single();
      if (error) {
        setErrorMessage("Could not update the issue. Check your connection and manager access, then try again.");
        return;
      }
      const updatedIssues = issues.map((issue) => issue.id === issueId
        ? { ...issue, status: data.status, assignedTo: data.assigned_to } : issue);
      setIssues(updatedIssues);
      setSelectedIssue(updatedIssues.find(issue => issue.id === issueId) ?? null);
    } catch {
      setErrorMessage("Unable to connect. Please try again.");
    } finally {
      setUpdating(false);
    }
  }

  function getAge(createdAt: string) {
    const created = new Date(createdAt).getTime();
    const now = Date.now();
    const minutes = Math.max(
      0,
      Math.floor((now - created) / 60000)
    );

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} min`;

    const hours = Math.floor(minutes / 60);

    if (hours < 24) return `${hours} hr`;

    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? "" : "s"}`;
  }

  const filteredIssues = issues.filter((issue) => {
    if (filter === "All") return true;
    if (filter === "Urgent") return issue.priority === "Urgent";
    if (filter === "Unassigned")
      return issue.assignedTo === "Unassigned";

    return issue.status === filter;
  });

  const openCount = issues.filter(
    (issue) => issue.status === "Open"
  ).length;

  const urgentCount = issues.filter(
    (issue) =>
      issue.priority === "Urgent" &&
      issue.status !== "Resolved"
  ).length;

  const inProgressCount = issues.filter(
    (issue) => issue.status === "In Progress"
  ).length;

  const resolvedCount = issues.filter(
    (issue) => issue.status === "Resolved"
  ).length;

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">

        {/* Sidebar */}
        <aside className="hidden w-64 border-r border-slate-200 bg-white p-6 md:block">
          <div className="mb-10">
            <div className="text-2xl font-bold text-blue-600">
              FitFlow
            </div>
            <div className="text-sm text-slate-500">
              Gym Operations
            </div>
          </div>

          <nav className="space-y-2">
            <Link
              href="/"
              className="block w-full rounded-xl px-4 py-3 text-slate-600 hover:bg-slate-50"
            >
              + New Issue
            </Link>

            <Link
              href="/issues"
              className="block w-full rounded-xl bg-blue-50 px-4 py-3 font-semibold text-blue-600"
            >
              Issues
            </Link>

            <button className="w-full rounded-xl px-4 py-3 text-left text-slate-600">
              Members
            </button>

            <button className="w-full rounded-xl px-4 py-3 text-left text-slate-600">
              Inventory
            </button>

            <button className="w-full rounded-xl px-4 py-3 text-left text-slate-600">
              Reports
            </button>
          </nav>

          <div className="mt-12 border-t border-slate-200 pt-6">
            <p className="text-sm font-semibold">
              {staff.display_name}
            </p>
            <p className="text-xs text-slate-500">
              FitFlow Demo Gym
            </p>
          </div>
        </aside>

        {/* Main Dashboard */}
        <section className="flex-1 p-5 md:p-8">
          <div className="mx-auto max-w-[1500px]">

            <div className="mb-7">
              <p className="text-sm font-semibold text-blue-600">
                MEMBER SUPPORT
              </p>

              <h1 className="mt-1 text-3xl font-bold">
                {isManager ? "Member Issue Dashboard" : "My Submitted Issues"}
              </h1>

              <p className="mt-2 text-slate-500">
                Track, assign, and resolve member issues in real time.
              </p>
            </div>

            {/* Summary Cards */}
            <div className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                number={openCount}
                label="Open Issues"
                accent="blue"
              />

              <SummaryCard
                number={urgentCount}
                label="Urgent"
                accent="red"
              />

              <SummaryCard
                number={inProgressCount}
                label="In Progress"
                accent="amber"
              />

              <SummaryCard
                number={resolvedCount}
                label="Resolved"
                accent="green"
              />
            </div>

            {/* Filters */}
            <div className="mb-5 flex flex-wrap gap-2">
              {[
                "All",
                "Open",
                "Urgent",
                "Unassigned",
                "In Progress",
                "Resolved",
              ].map((item) => (
                <button
                  key={item}
                  onClick={() => setFilter(item)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                    filter === item
                      ? "bg-blue-600 text-white"
                      : "border border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-[1fr_340px]">

              {errorMessage && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700 xl:col-span-2">{errorMessage}</p>}
              {/* Issue Grid */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[850px] text-left">
                    <thead className="border-b border-slate-200 bg-slate-50 text-sm text-slate-500">
                      <tr>
                        <th className="px-5 py-4">
                          Member
                        </th>
                        <th className="px-5 py-4">
                          Issue
                        </th>
                        <th className="px-5 py-4">
                          Priority
                        </th>
                        <th className="px-5 py-4">
                          Assigned To
                        </th>
                        <th className="px-5 py-4">
                          Status
                        </th>
                        <th className="px-5 py-4">
                          Age
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredIssues.map((issue) => (
                        <tr
                          key={issue.id}
                          onClick={() => setSelectedIssue(issue)}
                          className={`cursor-pointer border-b border-slate-100 transition hover:bg-blue-50 ${
                            selectedIssue?.id === issue.id
                              ? "bg-blue-50"
                              : ""
                          }`}
                        >
                          <td className="px-5 py-4">
                            <div className="font-semibold">
                              {issue.memberName}
                            </div>

                            <div className="text-sm text-slate-500">
                              {issue.phone}
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            {issue.category}
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`rounded-full px-3 py-1 text-sm font-semibold ${
                                issue.priority === "Urgent"
                                  ? "bg-red-50 text-red-700"
                                  : "bg-blue-50 text-blue-700"
                              }`}
                            >
                              {issue.priority}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            {issue.assignedTo}
                          </td>

                          <td className="px-5 py-4">
                            <StatusBadge status={issue.status} />
                          </td>

                          <td className="px-5 py-4 text-slate-500">
                            {getAge(issue.createdAt)}
                          </td>
                        </tr>
                      ))}

                      {filteredIssues.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-5 py-16 text-center text-slate-400"
                          >
                            {loading ? "Loading issues…" : errorMessage ? "Issues are unavailable." : "No issues found."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Issue Details */}
              <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                {selectedIssue ? (
                  <>
                    <p className="mb-5 text-sm font-semibold text-slate-400">
                      ISSUE DETAILS
                    </p>

                    <h2 className="text-2xl font-bold">
                      {selectedIssue.memberName}
                    </h2>

                    <p className="mt-1 text-slate-500">
                      {selectedIssue.phone}
                    </p>

                    <div className="my-6 border-t border-slate-200" />

                    <Detail
                      label="Category"
                      value={selectedIssue.category}
                    />

                    <Detail
                      label="Priority"
                      value={selectedIssue.priority}
                    />

                    <Detail
                      label="Assigned To"
                      value={selectedIssue.assignedTo}
                    />

                    <Detail
                      label="Status"
                      value={selectedIssue.status}
                    />
                    <Detail label="Submitted By" value={selectedIssue.createdBy} />
                    {isManager && <label className="block text-sm font-semibold">Assign issue
                      <select aria-label="Assign issue" disabled={updating} value={selectedIssue.assignedTo}
                        onChange={e => void updateIssue(selectedIssue.id, { assigned_to: e.target.value })}
                        className="mt-2 w-full rounded-xl border p-3">
                        <option>Unassigned</option><option>General Manager</option><option>Assistant Manager</option>
                        {!["Unassigned", "General Manager", "Assistant Manager"].includes(selectedIssue.assignedTo) && <option>{selectedIssue.assignedTo}</option>}
                      </select>
                    </label>}

                    <div className="mt-6">
                      <p className="text-sm font-semibold text-slate-500">
                        Problem / Issue
                      </p>

                      <p className="mt-2 leading-6 text-slate-700">
                        {selectedIssue.description}
                      </p>
                    </div>

                    <div className="mt-8 space-y-3">
                      {isManager && selectedIssue.status === "Open" && (
                        <button
                          disabled={updating}
                          onClick={() =>
                            updateStatus(
                              selectedIssue.id,
                              "In Progress"
                            )
                          }
                          className="w-full rounded-xl border border-blue-600 px-4 py-3 font-semibold text-blue-600"
                        >
                          Mark In Progress
                        </button>
                      )}

                      {isManager && selectedIssue.status !== "Resolved" && (
                        <button
                          disabled={updating}
                          onClick={() =>
                            updateStatus(
                              selectedIssue.id,
                              "Resolved"
                            )
                          }
                          className="w-full rounded-xl bg-green-600 px-4 py-3 font-semibold text-white"
                        >
                          Resolve Issue
                        </button>
                      )}

                      {selectedIssue.status === "Resolved" && (
                        <div className="rounded-xl bg-green-50 p-4 text-center font-semibold text-green-700">
                          ✓ Issue Resolved
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="py-16 text-center text-slate-400">
                    Select an issue to view details.
                  </div>
                )}
              </aside>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function SummaryCard({
  number,
  label,
  accent,
}: {
  number: number;
  label: string;
  accent: string;
}) {
  const styles: Record<string, string> = {
    blue: "text-blue-600",
    red: "text-red-600",
    amber: "text-amber-600",
    green: "text-green-600",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`text-3xl font-bold ${styles[accent]}`}>
        {number}
      </div>
      <div className="mt-1 text-sm text-slate-500">
        {label}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "Resolved") {
    return (
      <span className="rounded-full bg-green-50 px-3 py-1 text-sm font-semibold text-green-700">
        Resolved
      </span>
    );
  }

  if (status === "In Progress") {
    return (
      <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700">
        In Progress
      </span>
    );
  }

  return (
    <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
      Open
    </span>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}
