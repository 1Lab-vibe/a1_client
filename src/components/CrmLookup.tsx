import { useState, useEffect } from "react";
import { crm, type Entity, type Card, type Page } from "../api/crm";
export function CrmLookup({
  entity,
  label,
  initialLabel,
  value,
  onChange,
  required = false,
}: {
  entity: Entity;
  label: string;
  initialLabel: string;
  value: string;
  required?: boolean;
  onChange: (id: string, label: string, record?: Card) => void;
}) {
  const [q, setQ] = useState(initialLabel),
    [results, setResults] = useState<Card[]>([]),
    [err, setErr] = useState("");
  const [editing, setEditing] = useState(false);
  const [attempt, retry] = useState(0);
  useEffect(() => {
    let active = true;
    if (!editing) return;
    setResults([]);
    const timer = setTimeout(() => {
      crm<Page>(entity, "list", { query: q, stage: "all" })
        .then((r) => {
          if (active) {
            setResults(r.records);
            setErr("");
          }
        })
        .catch((e) => {
          if (active)
            setErr(
              e instanceof Error
                ? e.message
                : "Не удалось загрузить справочник",
            );
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [q, editing, entity, attempt]);
  return (
    <>
      <input
        type="search"
        required={required}
        aria-label={label}
        value={q}
        onFocus={() => setEditing(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setEditing(true);
          onChange("", "");
        }}
      />
      {editing && (
        <select
          required={required || (Boolean(q.trim()) && !value)}
          aria-label={"Выбор: " + label}
          value={value}
          onChange={(e) => {
            const r = results.find((x) => x.id === e.target.value);
            const name = String(r?.name || r?.title || "");
            onChange(r?.id || "", name, r);
            setQ(name);
            setEditing(false);
          }}
        >
          <option value="">Выберите из результатов</option>
          {results.map((r) => (
            <option key={r.id} value={r.id}>
              {String(r.name || r.title || "") || "Без названия"}
            </option>
          ))}
        </select>
      )}
      {err && (
        <small role="alert">
          {err}{" "}
          <button type="button" onClick={() => retry((n) => n + 1)}>
            Повторить
          </button>
        </small>
      )}
      {editing && q && !value && <small>Выберите запись из списка</small>}
    </>
  );
}
