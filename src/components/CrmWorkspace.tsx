import { useEffect, useState, useRef, useSyncExternalStore } from "react";
import {
  crm,
  type Value,
  type Card,
  type Entity,
  type Field,
  type Page,
} from "../api/crm";
import { CrmLookup } from "./CrmLookup";
import { getSession } from "../session";
import { ScenarioModes } from "./ScenarioModes";
import { ColumnVisibilityPopover } from "./ColumnVisibilityPopover";
import { useColumnVisibility } from "../hooks/useColumnVisibility";
import styles from "./Clients.module.css";

const names = {
  leads: "Лиды",
  deals: "Сделки",
  clients: "Клиенты",
  invoices: "Счета",
};
const labels: Record<string, string> = {
  new: "Новый",
  in_work: "В работе",
  qualification: "Квалификация",
  discovery: "Выявление потребности",
  outreach: "Первичное обращение",
  manual_research: "Поиск информации",
  offer: "Предложение",
  negotiation: "Переговоры",
  contract: "Договор",
  follow_up: "Повторный контакт",
  won: "Успешно",
  lost: "Проваленные",
  lost_lead: "Проваленные (прежняя стадия)",
  inbound: "Входящее",
  outbound: "Исходящее",
  draft: "Черновик",
  sent: "Выставлен",
  paid: "Оплачен",
  cancelled: "Отменён",
  prospect: "Потенциальный",
  active: "Активный",
  final: "Оформлен",
  succeeded: "Оплачен",
  pending: "Ожидает",
};
const subscribe = (fn: () => void) => {
  window.addEventListener("hashchange", fn);
  return () => window.removeEventListener("hashchange", fn);
};
function urlParams() {
  const params = new URLSearchParams(location.hash.split("?")[1]);
  const legacy = /^#\/crm\/deals\/([\da-f-]{36})$/i.exec(location.hash);
  if (legacy) params.set("card", legacy[1]);
  return params;
}
function change(params: Record<string, string>, replace = false) {
  const q = urlParams();
  for (const [k, v] of Object.entries(params))
    if (v) q.set(k, v);
    else q.delete(k);
  const path = location.hash
    .split("?")[0]
    .replace(/^(#\/crm\/deals)\/[\da-f-]{36}$/i, "$1");
  const hash = path + (q.size ? "?" + q.toString() : "");
  if (replace) {
    history.replaceState(null, "", hash);
    window.dispatchEvent(new Event("hashchange"));
  } else location.hash = hash;
}
const relation: Record<string, Entity> = {
  customer: "clients",
  lead: "leads",
  deal: "deals",
};
const errText = (e: unknown) =>
  e instanceof Error ? e.message : "Не удалось загрузить данные";
function show(v: Value | undefined) {
  if (Array.isArray(v))
    return v.filter((x) => typeof x === "string").join(", ");
  if (v === true) return "Да";
  if (v === false) return "Нет";
  return String(v ?? "");
}
function format(row: Card, f: Field) {
  const v = show(row[f.key]);
  if (relation[f.type]) return show(row[f.key + "_label"]);
  if (f.type === "choice") return labels[v] || v;
  if (f.type === "time" && v) return new Date(v).toLocaleString("ru-RU");
  return v;
}
function Editor({
  entity,
  row,
  fields,
  creating,
  editable,
  onClose,
  onSaved,
}: {
  entity: Entity;
  row: Card;
  fields: Field[];
  creating: boolean;
  editable: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [changes, setChanges] = useState<Record<string, Value>>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const lock = useRef(false),
    dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const readonly =
    !editable ||
    row.source === "payment" ||
    (entity === "invoices" && row.status === "paid");
  const set = (k: string, v: Value) => setChanges((p) => ({ ...p, [k]: v }));
  async function save() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const session = getSession();
    const route = location.hash;
    try {
      const patch = Object.fromEntries(
        Object.entries(changes).filter(
          ([k, v]) => JSON.stringify(v) !== JSON.stringify(row[k]),
        ),
      );
      const response = await crm<{ record: Card }>(
        entity,
        creating ? "create" : "update",
        {
          id: row.id,
          source: row.source,
          version: row.version,
          changes: patch,
        },
      );
      if (response.record?.id !== row.id || !response.record.version)
        throw new Error("Сервер не подтвердил сохранение карточки.");
      if (
        session?.company_id === getSession()?.company_id &&
        location.hash === route
      )
        onSaved();
    } catch (e) {
      setError(errText(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className={styles.crmDialog}
      aria-label="Карточка CRM"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className={styles.modalHead}>
          <h2>
            {creating
              ? "Новая запись"
              : show(row.title || row.name) || "Карточка"}
          </h2>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
        <div className={styles.form}>
          {Array.isArray(row.details) && row.details.length > 0 && (
            <section>
              <strong>
                {entity === "deals" ? "Путь клиента" : "Контакты"}
              </strong>
              {entity === "deals" && (
                <p>{row.details[row.details.length - 1]}</p>
              )}
              <details>
                <summary>
                  {entity === "deals"
                    ? "История действий"
                    : "Показать контакты"}{" "}
                  ({row.details.length})
                </summary>
                <ul>
                  {row.details.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </details>
            </section>
          )}
          {fields.map((f) => {
            const v = f.key in changes ? changes[f.key] : row[f.key];
            const raw = show(v);
            return (
              <label key={f.key}>
                {f.label}
                {readonly ? (
                  <span>{format(row, f) || "—"}</span>
                ) : relation[f.type] ? (
                  <CrmLookup
                    entity={relation[f.type]}
                    label={f.label}
                    initialLabel={show(row[f.key + "_label"])}
                    value={show(v)}
                    onChange={(s) => set(f.key, s)}
                  />
                ) : f.type === "choice" ? (
                  <select
                    required={f.required}
                    value={raw}
                    onChange={(e) => set(f.key, e.target.value)}
                  >
                    <option value="">Выберите</option>
                    {[
                      ...new Set([...(f.options || []), ...(raw ? [raw] : [])]),
                    ].map((o) => (
                      <option key={o} value={o}>
                        {labels[o] || o}
                      </option>
                    ))}
                  </select>
                ) : f.type === "long" ? (
                  <textarea
                    value={raw}
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                ) : f.type === "boolean" ? (
                  <input
                    type="checkbox"
                    checked={v === true}
                    onChange={(e) => set(f.key, e.target.checked)}
                  />
                ) : (
                  <input
                    required={f.required}
                    type={
                      (
                        {
                          number: "number",
                          integer: "number",
                          date: "date",
                          time: "datetime-local",
                          email: "email",
                        } as Record<string, string>
                      )[f.type] || "text"
                    }
                    step={f.type === "integer" ? 1 : "any"}
                    value={f.type === "time" && raw ? localTime(raw) : raw}
                    onChange={(e) =>
                      set(
                        f.key,
                        f.type === "tags"
                          ? e.target.value.split(",").map((x) => x.trim())
                          : f.type === "time" && e.target.value
                            ? new Date(e.target.value).toISOString()
                            : e.target.value,
                      )
                    }
                  />
                )}
              </label>
            );
          })}
        </div>
        {error && <p role="alert">{error}</p>}
        <div className={styles.modalFoot}>
          {!readonly &&
            !creating &&
            ["deals", "leads"].includes(entity) &&
            !["lost", "lost_lead"].includes(show(row.stage)) && (
              <button
                type="button"
                onClick={() => set("stage", "lost")}
                disabled={busy}
              >
                Провалить
              </button>
            )}
          <button type="button" onClick={onClose} disabled={busy}>
            Закрыть
          </button>
          {!readonly && (
            <button
              className={styles.saveBtn}
              disabled={busy || !Object.keys(changes).length}
            >
              {busy ? "Сохраняем…" : "Сохранить"}
            </button>
          )}
        </div>
      </form>
    </dialog>
  );
}
function localTime(raw: string) {
  const d = new Date(raw);
  return Number.isFinite(d.getTime())
    ? new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : "";
}

export function CrmWorkspace({ entity }: { entity: Entity }) {
  useSyncExternalStore(subscribe, () => location.hash);
  const params = urlParams(),
    q = params.get("q") || "",
    page = Number(params.get("page")) || 1,
    card = params.get("card"),
    source = params.get("source") || "document";
  const funnel = ["leads", "deals"].includes(entity),
    stage =
      params.get("stage") ||
      (funnel ? "active" : entity === "clients" && !q ? "@leads" : "all");
  const kanban =
    (params.get("view") || (entity === "clients" ? "list" : "board")) ===
    "board";
  const [data, setData] = useState<Page | null>(null),
    [row, setRow] = useState<Card | null>(null),
    [error, setError] = useState(""),
    [cardError, setCardError] = useState(""),
    [busy, setBusy] = useState(false),
    [rev, reload] = useState(0);
  useEffect(() => {
    let active = true;
    setBusy(true);
    setError("");
    const timer = setTimeout(
      () => {
        crm<Page>(entity, "list", { query: q, page, stage })
          .then((r) => {
            if (active) setData(r);
          })
          .catch((e) => {
            if (active) setError(errText(e));
          })
          .finally(() => {
            if (active) setBusy(false);
          });
      },
      q ? 200 : 0,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [entity, q, page, stage, rev]);
  useEffect(() => {
    let active = true;
    setRow(null);
    setCardError("");
    if (card === "new")
      setRow({
        id: crypto.randomUUID(),
        version: "",
        ...(funnel ? { stage: "new" } : {}),
      });
    else if (card)
      crm<{ record: Card }>(entity, "get", { id: card, source })
        .then((r) => {
          if (active) setRow(r.record);
        })
        .catch((e) => {
          if (active) setCardError(errText(e));
        });
    return () => {
      active = false;
    };
  }, [entity, card, source, rev, funnel]);
  const fields = data?.fields || [],
    keys = fields.map((f) => f.key);
  const { visibleColumns, isVisible, toggle } = useColumnVisibility(
    "workspace-" + entity,
    keys,
    [
      "name",
      "title",
      "stage",
      "customer_stage",
      "status",
      "contact_name",
      "contact_phone",
      "primary_email",
      "primary_phone",
      "customer_id",
      "amount",
      "currency",
    ],
  );
  const stageKey = funnel
    ? "stage"
    : entity === "clients"
      ? "customer_stage"
      : "status";
  const options = fields.find((f) => f.key === stageKey)?.options || [];
  const open = (r: Card) => change({ card: r.id, source: show(r.source) });
  const close = () => change({ card: "", source: "" }, true);
  const list = data?.records || [];
  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <h1>{names[entity]}</h1>
        {data?.editable && entity !== "invoices" && (
          <button onClick={() => change({ card: "new" })}>Создать</button>
        )}
        <ColumnVisibilityPopover
          columns={keys}
          getLabel={(k) => fields.find((f) => f.key === k)?.label || ""}
          isVisible={isVisible}
          onToggle={toggle}
        />
      </header>
      {data?.editable && entity === "invoices" && (
        <ScenarioModes domain="finance" only="issue_invoice" />
      )}
      <div className={styles.filters}>
        <input
          type="search"
          value={q}
          aria-label="Поиск"
          placeholder="Поиск"
          onChange={(e) => change({ q: e.target.value, page: "" }, true)}
        />
        <select
          aria-label="Фильтр по стадии"
          value={stage}
          onChange={(e) => change({ stage: e.target.value, page: "" })}
        >
          {funnel && <option value="active">Все, кроме проваленных</option>}
          {entity === "clients" && (
            <>
              <option value="@leads">С открытым лидом</option>
              <option value="@none">Без стадии</option>
            </>
          )}
          <option value="all">Все стадии</option>
          {[
            ...new Set([
              ...options,
              ...(entity === "invoices"
                ? ["paid", "succeeded", "pending", "final"]
                : []),
            ]),
          ].map((v) => (
            <option key={v} value={v}>
              {labels[v] || v}
            </option>
          ))}
        </select>
        <button onClick={() => change({ view: kanban ? "list" : "board" })}>
          {kanban ? "Список" : "Канбан"}
        </button>
      </div>
      {error || cardError ? (
        <p role="alert">
          {error || cardError}{" "}
          <button onClick={() => reload((n) => n + 1)}>Повторить</button>
          {cardError && <button onClick={close}>К списку</button>}
        </p>
      ) : busy ? (
        <p role="status">Загрузка…</p>
      ) : (
        data && (
          <>
            <p>
              Найдено: {data.total}{" "}
              {data.totals.map((t) => (
                <span key={t.currency}>
                  {" "}
                  · {t.amount || "0"} {t.currency}
                </span>
              ))}
            </p>
            {!list.length ? (
              <p>Нет записей по выбранным условиям</p>
            ) : kanban ? (
              <div className={styles.crmBoard}>
                {[...new Set(list.map((r) => show(r[stageKey])))].map((s) => (
                  <section key={s}>
                    <h3>{labels[s] || s || "Без стадии"}</h3>
                    {list
                      .filter((r) => show(r[stageKey]) === s)
                      .map((r) => (
                        <button
                          key={r.id + show(r.source)}
                          onClick={() => open(r)}
                        >
                          <strong>
                            {show(r.name || r.title) || "Без названия"}
                          </strong>
                          {fields
                            .filter(
                              (f) =>
                                isVisible(f.key) &&
                                !["title", "name", stageKey].includes(f.key) &&
                                format(r, f),
                            )
                            .slice(0, 4)
                            .map((f) => (
                              <span key={f.key}>
                                {f.label}: {format(r, f)}
                              </span>
                            ))}
                        </button>
                      ))}
                  </section>
                ))}
              </div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Карточка</th>
                      {visibleColumns.map((k) => (
                        <th key={k}>
                          {fields.find((f) => f.key === k)?.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((r) => (
                      <tr
                        key={r.id + show(r.source)}
                        className={styles.rowClick}
                        onClick={() => open(r)}
                      >
                        <td>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              open(r);
                            }}
                          >
                            Открыть
                          </button>
                        </td>
                        {visibleColumns.map((k) => (
                          <td key={k}>
                            {format(r, fields.find((f) => f.key === k)!) || "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <nav className={styles.pager}>
              <button
                disabled={data.page <= 1}
                onClick={() => change({ page: String(data.page - 1) })}
              >
                Назад
              </button>{" "}
              {data.page} / {Math.max(1, Math.ceil(data.total / 50))}{" "}
              <button
                disabled={data.page * 50 >= data.total}
                onClick={() => change({ page: String(data.page + 1) })}
              >
                Далее
              </button>
            </nav>
          </>
        )
      )}
      {row && card && fields.length > 0 && (
        <Editor
          key={row.id}
          entity={entity}
          row={row}
          fields={fields}
          creating={card === "new"}
          editable={data?.editable === true}
          onClose={close}
          onSaved={() => {
            close();
            reload((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}
