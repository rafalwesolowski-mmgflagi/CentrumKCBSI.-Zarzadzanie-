import { FormEvent, useState } from "react";
import { Check, Download, Pencil, Plus, X } from "lucide-react";
import type { AppContextValue } from "../lib/appContext";
import { exportCsv } from "../lib/exportCsv";
import type { Project } from "../lib/types";

interface FinancePageProps {
  context: AppContextValue;
}

interface EditForm {
  budget: string;
  invoiced: string;
  paid: string;
  cost: string;
  currency: string;
}

interface NewProjectForm extends EditForm {
  name: string;
  color: string;
}

const CURRENCIES = ["PLN", "EUR", "USD", "GBP", "CHF", "NOK"];

// Approximate rates: 1 unit of currency = X PLN
const RATES_TO_PLN: Record<string, number> = {
  PLN: 1,
  EUR: 4.25,
  USD: 3.95,
  GBP: 5.02,
  CHF: 4.37,
  NOK: 0.375,
};

function convert(amount: number, from: string, to: string): number {
  if (from === to) return amount;
  const fromRate = RATES_TO_PLN[from] ?? 1;
  const toRate = RATES_TO_PLN[to] ?? 1;
  return (amount * fromRate) / toRate;
}

function nullableFloat(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = parseFloat(trimmed.replace(",", "."));
  return Number.isFinite(num) ? num : null;
}

function fmt(value: number | null, currency: string) {
  if (value == null) return "—";
  return new Intl.NumberFormat("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value) + " " + currency;
}

function balance(paid: number | null, cost: number | null) {
  if (paid == null && cost == null) return null;
  return (paid ?? 0) - (cost ?? 0);
}

function outstanding(invoiced: number | null, paid: number | null) {
  if (invoiced == null && paid == null) return null;
  return (invoiced ?? 0) - (paid ?? 0);
}

export function FinancePage({ context }: FinancePageProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ budget: "", invoiced: "", paid: "", cost: "", currency: "PLN" });
  const [newProject, setNewProject] = useState<NewProjectForm>({
    name: "",
    color: "#57c7ff",
    budget: "",
    invoiced: "",
    paid: "",
    cost: "",
    currency: "PLN",
  });
  const [viewCurrency, setViewCurrency] = useState("PLN");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit(project: Project) {
    setEditingId(project.id);
    setEditForm({
      budget: project.budget != null ? String(project.budget) : "",
      invoiced: project.invoiced != null ? String(project.invoiced) : "",
      paid: project.paid != null ? String(project.paid) : "",
      cost: project.cost != null ? String(project.cost) : "",
      currency: project.currency || "PLN",
    });
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setError(null);
  }

  async function saveEdit(projectId: string) {
    setSaving(true);
    setError(null);
    try {
      await context.updateProjectFinance(projectId, {
        budget: nullableFloat(editForm.budget),
        invoiced: nullableFloat(editForm.invoiced),
        paid: nullableFloat(editForm.paid),
        cost: nullableFloat(editForm.cost),
        currency: editForm.currency || "PLN",
      });
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zapisać.");
    } finally {
      setSaving(false);
    }
  }

  async function createProject(event: FormEvent) {
    event.preventDefault();
    const name = newProject.name.trim();
    if (!name) {
      setError("Nazwa projektu nie może być pusta.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const createdProject = await context.createProject({
        name,
        color: newProject.color,
        tags: [],
        areas: [],
        parentProjectId: null,
        goal: "",
      });

      const hasFinanceInput = [newProject.budget, newProject.invoiced, newProject.paid, newProject.cost]
        .some((value) => value.trim());
      if (hasFinanceInput || newProject.currency !== "PLN") {
        await context.updateProjectFinance(createdProject.id, {
          budget: nullableFloat(newProject.budget),
          invoiced: nullableFloat(newProject.invoiced),
          paid: nullableFloat(newProject.paid),
          cost: nullableFloat(newProject.cost),
          currency: newProject.currency || "PLN",
        });
      }

      setNewProject({
        name: "",
        color: "#57c7ff",
        budget: "",
        invoiced: "",
        paid: "",
        cost: "",
        currency: "PLN",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się dodać projektu.");
    } finally {
      setSaving(false);
    }
  }

  function exportToCsv() {
    const rows = context.projects.map((p) => {
      const bal = balance(p.paid, p.cost);
      const out = outstanding(p.invoiced, p.paid);
      return {
        "Projekt": p.name,
        "Status": p.status,
        "Waluta": p.currency || "PLN",
        "Wycena (budget)": p.budget ?? "",
        "Wystawiona faktura": p.invoiced ?? "",
        "Wpłynęło": p.paid ?? "",
        "Koszt własny": p.cost ?? "",
        "Saldo (wpłynęło − koszt)": bal ?? "",
        "Do zapłaty (faktura − wpłynęło)": out ?? "",
      };
    });
    exportCsv("finanse-projektow.csv", rows);
  }

  const projects = context.projects;
  const hasMultipleCurrencies = new Set(projects.map((p) => p.currency || "PLN")).size > 1;
  const needsConversion = hasMultipleCurrencies || projects.some((p) => (p.currency || "PLN") !== viewCurrency);

  function projectValue(p: Project, field: number | null): number {
    if (field == null) return 0;
    return convert(field, p.currency || "PLN", viewCurrency);
  }

  const totalBudget = projects.reduce((sum, p) => sum + projectValue(p, p.budget), 0);
  const totalInvoiced = projects.reduce((sum, p) => sum + projectValue(p, p.invoiced), 0);
  const totalPaid = projects.reduce((sum, p) => sum + projectValue(p, p.paid), 0);
  const totalCost = projects.reduce((sum, p) => sum + projectValue(p, p.cost), 0);
  const totalBalance = totalPaid - totalCost;
  const totalOutstanding = totalInvoiced - totalPaid;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Finance</h1>
          <p className="page-subtitle">Przychody i koszty projektów</p>
        </div>
        <button className="secondary-button" onClick={exportToCsv}>
          <Download size={16} />
          Eksportuj CSV
        </button>
      </header>

      <form className="finance-project-form" onSubmit={createProject}>
        <input
          value={newProject.name}
          onChange={(event) => setNewProject((current) => ({ ...current, name: event.target.value }))}
          placeholder="Nazwa nowego projektu"
          required
        />
        <input
          className="finance-color-input"
          type="color"
          value={newProject.color}
          onChange={(event) => setNewProject((current) => ({ ...current, color: event.target.value }))}
          aria-label="Kolor projektu"
        />
        <select value={newProject.currency} onChange={(event) => setNewProject((current) => ({ ...current, currency: event.target.value }))}>
          {CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
        </select>
        <input
          type="number"
          min="0"
          step="0.01"
          value={newProject.budget}
          onChange={(event) => setNewProject((current) => ({ ...current, budget: event.target.value }))}
          placeholder="Wycena"
        />
        <input
          type="number"
          min="0"
          step="0.01"
          value={newProject.invoiced}
          onChange={(event) => setNewProject((current) => ({ ...current, invoiced: event.target.value }))}
          placeholder="Faktura"
        />
        <input
          type="number"
          min="0"
          step="0.01"
          value={newProject.paid}
          onChange={(event) => setNewProject((current) => ({ ...current, paid: event.target.value }))}
          placeholder="Wpłynęło"
        />
        <input
          type="number"
          min="0"
          step="0.01"
          value={newProject.cost}
          onChange={(event) => setNewProject((current) => ({ ...current, cost: event.target.value }))}
          placeholder="Koszt"
        />
        <button className="secondary-button" disabled={saving}>
          <Plus size={16} />
          Dodaj projekt
        </button>
      </form>

      <div className="finance-currency-bar">
        <span className="finance-currency-bar-label">Wyświetlaj w:</span>
        {CURRENCIES.map((c) => (
          <button
            key={c}
            type="button"
            className={`project-chip finance-currency-chip${viewCurrency === c ? " active" : ""}`}
            onClick={() => setViewCurrency(c)}
          >
            {c}
          </button>
        ))}
        {needsConversion && (
          <span className="finance-currency-approx-note">kursy przybliżone</span>
        )}
      </div>

      <div className="finance-summary-grid">
        <div className="finance-summary-card">
          <span className="finance-summary-label">Łączna wycena</span>
          <strong className="finance-summary-value">{fmt(totalBudget, viewCurrency)}</strong>
        </div>
        <div className="finance-summary-card">
          <span className="finance-summary-label">Wystawione faktury</span>
          <strong className="finance-summary-value">{fmt(totalInvoiced, viewCurrency)}</strong>
        </div>
        <div className="finance-summary-card">
          <span className="finance-summary-label">Wpłynęło</span>
          <strong className="finance-summary-value success-text">{fmt(totalPaid, viewCurrency)}</strong>
        </div>
        <div className="finance-summary-card">
          <span className="finance-summary-label">Koszty własne</span>
          <strong className="finance-summary-value danger-text">{fmt(totalCost, viewCurrency)}</strong>
        </div>
        <div className="finance-summary-card">
          <span className="finance-summary-label">Saldo (wpłynęło − koszt)</span>
          <strong className={`finance-summary-value ${totalBalance >= 0 ? "success-text" : "danger-text"}`}>
            {fmt(totalBalance, viewCurrency)}
          </strong>
        </div>
        <div className="finance-summary-card">
          <span className="finance-summary-label">Do zapłaty (faktura − wpłynęło)</span>
          <strong className={`finance-summary-value ${totalOutstanding > 0 ? "warning-text" : ""}`}>
            {fmt(totalOutstanding, viewCurrency)}
          </strong>
        </div>
      </div>

      {error && <div className="inline-error">{error}</div>}

      <div className="finance-table-wrap">
        <table className="finance-table">
          <thead>
            <tr>
              <th>Projekt</th>
              <th>Status</th>
              <th>Waluta</th>
              <th>Wycena</th>
              <th>Faktura</th>
              <th>Wpłynęło</th>
              <th>Koszt</th>
              <th>Saldo</th>
              <th>Do zapłaty</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => {
              const isEditing = editingId === project.id;
              const projCurrency = project.currency || "PLN";
              const converted = projCurrency !== viewCurrency;

              const dispBudget = project.budget != null ? convert(project.budget, projCurrency, viewCurrency) : null;
              const dispInvoiced = project.invoiced != null ? convert(project.invoiced, projCurrency, viewCurrency) : null;
              const dispPaid = project.paid != null ? convert(project.paid, projCurrency, viewCurrency) : null;
              const dispCost = project.cost != null ? convert(project.cost, projCurrency, viewCurrency) : null;
              const bal = balance(dispPaid, dispCost);
              const out = outstanding(dispInvoiced, dispPaid);

              if (isEditing) {
                return (
                  <tr key={project.id} className="finance-row editing">
                    <td>
                      <span className="project-color-dot" style={{ background: project.color }} />
                      {project.name}
                    </td>
                    <td><span className={`status-pill ${project.status}`}>{project.status}</span></td>
                    <td>
                      <select
                        className="table-input"
                        value={editForm.currency}
                        onChange={(e) => setEditForm((f) => ({ ...f, currency: e.target.value }))}
                      >
                        {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td>
                      <input
                        className="table-input"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={editForm.budget}
                        onChange={(e) => setEditForm((f) => ({ ...f, budget: e.target.value }))}
                      />
                    </td>
                    <td>
                      <input
                        className="table-input"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={editForm.invoiced}
                        onChange={(e) => setEditForm((f) => ({ ...f, invoiced: e.target.value }))}
                      />
                    </td>
                    <td>
                      <input
                        className="table-input"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={editForm.paid}
                        onChange={(e) => setEditForm((f) => ({ ...f, paid: e.target.value }))}
                      />
                    </td>
                    <td>
                      <input
                        className="table-input"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={editForm.cost}
                        onChange={(e) => setEditForm((f) => ({ ...f, cost: e.target.value }))}
                      />
                    </td>
                    <td>—</td>
                    <td>—</td>
                    <td className="finance-row-actions">
                      <button
                        className="icon-button"
                        aria-label="Zapisz"
                        disabled={saving}
                        onClick={() => void saveEdit(project.id)}
                      >
                        <Check size={16} />
                      </button>
                      <button className="icon-button" aria-label="Anuluj" onClick={cancelEdit}>
                        <X size={16} />
                      </button>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={project.id} className="finance-row">
                  <td>
                    <span className="project-color-dot" style={{ background: project.color }} />
                    {project.name}
                  </td>
                  <td><span className={`status-pill ${project.status}`}>{project.status}</span></td>
                  <td>
                    <span className={converted ? "finance-currency-tag converted" : "finance-currency-tag"}>
                      {projCurrency}
                    </span>
                  </td>
                  <td>{converted ? <span className="finance-approx">≈</span> : null}{fmt(dispBudget, viewCurrency)}</td>
                  <td>{converted ? <span className="finance-approx">≈</span> : null}{fmt(dispInvoiced, viewCurrency)}</td>
                  <td className={dispPaid != null ? "success-text" : ""}>{converted ? <span className="finance-approx">≈</span> : null}{fmt(dispPaid, viewCurrency)}</td>
                  <td className={dispCost != null ? "danger-text" : ""}>{converted ? <span className="finance-approx">≈</span> : null}{fmt(dispCost, viewCurrency)}</td>
                  <td className={bal != null ? (bal >= 0 ? "success-text" : "danger-text") : ""}>{fmt(bal, viewCurrency)}</td>
                  <td className={out != null && out > 0 ? "warning-text" : ""}>{fmt(out, viewCurrency)}</td>
                  <td className="finance-row-actions">
                    <button
                      className="icon-button"
                      aria-label="Edytuj finanse projektu"
                      onClick={() => startEdit(project)}
                    >
                      <Pencil size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {projects.length === 0 && (
              <tr>
                <td colSpan={10} className="finance-empty">Brak projektów</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
