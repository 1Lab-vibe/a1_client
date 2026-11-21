import { useEffect, useState } from "react";
import { opsWorkspace } from "../api/n8n";

const choices: Record<string, "product" | "plan"> = {
  classify_ad_category: "product",
  calculate_media_plan: "product",
  generate_ad_variants: "plan",
  export_yandex_direct_xlsx: "plan",
};
export const hasOpsInputs = (key: string) =>
  Object.prototype.hasOwnProperty.call(choices, key) || key === "read_sheet";
export function OpsActionInputs({
  action,
  onChange,
}: {
  action: string;
  onChange: (params: Record<string, string> | null) => void;
}) {
  const kind = choices[action],
    [query, setQuery] = useState(""),
    [rows, setRows] = useState<{ id: string; label: string }[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [attempt, retry] = useState(0),
    [selected, pick] = useState("");
  useEffect(() => {
    if (!kind) return;
    let current = true;
    setRows([]);
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      opsWorkspace<{ rows: { id: string; label: string }[] }>("options", {
        kind,
        query,
      })
        .then((r) => {
          if (current) setRows(r.rows);
        })
        .catch(() => {
          if (current) setError("Не удалось загрузить варианты");
        })
        .finally(() => {
          if (current) setLoading(false);
        });
    }, 180);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [kind, query, attempt]);
  if (action === "read_sheet")
    return (
      <label>
        Ссылка на Google Таблицу
        <input
          type="url"
          placeholder="https://docs.google.com/spreadsheets/d/…"
          value={query}
          onChange={(e) => {
            const url = e.target.value.trim();
            setQuery(url);
            onChange(
              /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[\w-]+(?:[\/#?]|$)/.test(
                url,
              )
                ? { spreadsheet_url: url }
                : null,
            );
          }}
        />
      </label>
    );
  if (!kind) return null;
  const label = kind === "plan" ? "Медиаплан" : "Продукт";
  return (
    <div>
      <label>
        Поиск · {label}
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            pick("");
            onChange(null);
          }}
        />
      </label>
      <label>
        {label}
        <select
          value={selected}
          disabled={loading}
          onChange={(e) => {
            pick(e.target.value);
            onChange(
              e.target.value
                ? {
                    [kind === "plan" ? "media_plan_run_id" : "product_id"]:
                      e.target.value,
                  }
                : null,
            );
          }}
        >
          <option value="">
            {loading
              ? "Загрузка…"
              : rows.length
                ? "Выберите из списка"
                : "Вариантов нет"}
          </option>
          {rows.map((row) => (
            <option key={row.id} value={row.id}>
              {row.label}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p role="alert">
          {error}{" "}
          <button type="button" onClick={() => retry((n) => n + 1)}>
            Повторить
          </button>
        </p>
      )}
    </div>
  );
}
