"use client";

import { useState } from "react";
import type { CommercialTask } from "@/types/commercial";
import {
  commercialPrimaryButton,
  commercialSecondaryButton,
  fieldClass,
} from "./commercial-ui";

export function PipelineTaskEditor({
  task,
  busy,
  onSave,
}: {
  task: CommercialTask;
  busy: boolean;
  onSave: (
    id: string,
    values: { title: string; dueAt: string | null; priority: string },
  ) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const localDate = task.dueAt
    ? new Date(
        new Date(task.dueAt).getTime() -
          new Date(task.dueAt).getTimezoneOffset() * 60000,
      )
        .toISOString()
        .slice(0, 16)
    : "";
  if (!editing)
    return (
      <button
        type="button"
        disabled={busy}
        className={`${commercialSecondaryButton} mt-2`}
        onClick={() => setEditing(true)}
      >
        Modifier la tâche
      </button>
    );
  return (
    <form
      className="mt-3 grid gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        const form = new FormData(event.currentTarget);
        const dueAt = String(form.get("dueAt") || "");
        if (
          await onSave(task.id, {
            title: String(form.get("title")),
            dueAt: dueAt ? new Date(dueAt).toISOString() : null,
            priority: String(form.get("priority")),
          })
        )
          setEditing(false);
      }}
    >
      <label className="grid gap-1 text-xs">
        Intitulé
        <input
          name="title"
          required
          minLength={2}
          maxLength={180}
          defaultValue={task.title}
          className={fieldClass}
        />
      </label>
      <label className="grid gap-1 text-xs">
        Échéance
        <input
          name="dueAt"
          type="datetime-local"
          defaultValue={localDate}
          className={fieldClass}
        />
      </label>
      <label className="grid gap-1 text-xs">
        Priorité
        <select
          name="priority"
          defaultValue={task.priority}
          className={fieldClass}
        >
          {[
            ["low", "Basse"],
            ["normal", "Normale"],
            ["high", "Haute"],
            ["urgent", "Urgente"],
          ].map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        <button disabled={busy} className={commercialPrimaryButton}>
          Enregistrer la tâche
        </button>
        <button
          type="button"
          disabled={busy}
          className={commercialSecondaryButton}
          onClick={() => setEditing(false)}
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
