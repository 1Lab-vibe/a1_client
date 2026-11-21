import {MessageList} from './MessageList';
import type {N8nAttachment} from '../types';
import { useEffect, useMemo, useState, useRef } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Play, X } from "lucide-react";
import { getOpsDepartment, opsWorkspace, runAction, sendIntakeMessage } from "../api/n8n";
import { crm, type Card } from "../api/crm";
import { waitForIntake } from "../hooks/useN8n";
import { CrmLookup } from "./CrmLookup";
import {
  DEPARTMENT_MODES,
  GROUP_LABELS,
  type DeptMode,
} from "../config/departmentModes";
import { HANDLER_SCENARIOS } from "../config/handlerScenarios";
import styles from "./ActionModes.module.css";

interface Note {
  reply?: boolean;
  ok: boolean;
  text: string;
  paymentUrl?: string;
  attachments?: N8nAttachment[];
  cardUrl?: string;
  report?: { columns: string[]; rows: string[][] };
}

/** Отделы без курируемого каталога — берём автокаталог: без полей, шлём канонический текст как есть. */
function fallbackModes(domain: string): DeptMode[] {
  return HANDLER_SCENARIOS.filter((h) => h.domain === domain).map((h) => ({
    id: h.action_key,
    label: h.action_name,
    description: h.examples[0] ?? "",
    group: "ops" as const,
    fields: [],
    request: () => h.examples[0] ?? h.action_name,
  }));
}

const needsWriteReceipt = (mode: DeptMode) =>
  ["meeting_result","follow_up","email_send","create_obligation","mark_obligation_paid","billing_event","deal_create"].includes(mode.id);

export function ScenarioModes({
  domain,
  only,
}: {
  domain: string;
  only?: string;
}) {
  const modes = useMemo(
    () =>
      (DEPARTMENT_MODES[domain] ?? fallbackModes(domain)).filter(
        (m) => !only || m.id === only,
      ),
    [domain, only],
  );
  const [active, setActive] = useState<DeptMode | null>(null);
  const [runningKey, setRunningKey] = useState<string | null>(null);
  const [note, setNote] = useState<Note | null>(null);

  const submittedText = useRef("");
  const pending = useRef<{ id: string; mode: string } | null>(null);
  const watch = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      watch.current?.abort();
    },
    [],
  );
  const check = async (id: string, mode: DeptMode) => {
    watch.current?.abort();
    const controller = new AbortController();
    watch.current = controller;
    setRunningKey(mode.id);
    setNote({ ok: true, text: "В обработке…" });
    try {
      const result = await waitForIntake(id, controller.signal);
      if (controller.signal.aborted) return;
      pending.current = null;
      setNote({
        ok: true,
        reply: true,
        text: result.text || "Файлы готовы.",
        attachments:result.attachments,
      });
      if (!needsWriteReceipt(mode)) setActive(null);
    } catch (e) {
      if (!controller.signal.aborted)
        setNote({
          ok: false,
          text:
            e instanceof Error ? e.message : "Не удалось проверить результат",
        });
    } finally {
      if (!controller.signal.aborted) setRunningKey(null);
    }
  };
  const invoiceId = useRef(crypto.randomUUID());
  const [documentId, setDocumentId] = useState("");
  const submit = async (
    mode: DeptMode,
    text: string,
    values: Record<string, string>,
    selected: Record<string, Card>,
  ) => {
    if (runningKey) return;
    if (mode.id === "issue_invoice" && documentId) {
      setActive(null);
      return;
    }
    if (pending.current) {
      await check(pending.current.id, mode);
      return;
    }
    setRunningKey(mode.id);
    setNote(null);
    try {
      if (
        ["lead_create", "lead_stage", "deal_stage", "deal_close"].includes(
          mode.id,
        ) ||
        (mode.id === "deal_create" && !values.owner?.trim())
      ) {
        const creating = mode.id.endsWith("_create");
        const entity = mode.id.startsWith("lead_") ? "leads" : "deals";
        const base =
          entity === "leads" || mode.id === "deal_create"
            ? selected.lead
            : selected.deal;
        const id = creating ? invoiceId.current : base?.id;
        if (!id || (!creating && !base?.version))
          throw new Error("Выберите карточку из справочника.");
        let changes: Record<string, unknown>;
        if (mode.id === "lead_create")
          changes = {
            title: values.company,
            company_name: values.company,
            contact_name: values.contact || null,
            description: values.note || null,
          };
        else if (mode.id === "deal_create")
          changes = {
            title: base?.title || "Сделка",
            lead_id: base?.id,
            customer_id: base?.customer_id || null,
          };
        else {
          const stage =
            mode.id === "deal_close"
              ? values.outcome === "проигранную"
                ? "lost"
                : "won"
              : values.stage;
          changes = { stage };
          const note = values.reason || values.next || values.result;
          if (note) {
            if (stage === "lost")
              changes[entity === "leads" ? "close_reason" : "loss_reason"] =
                note;
            else
              changes.description = [base?.description, note]
                .filter(Boolean)
                .join("\n");
          }
        }
        const response = await crm<{ record: Card }>(
          entity,
          creating ? "create" : "update",
          { id, version: base?.version, changes },
        );
        if (
          response.record?.id !== id ||
          Object.entries(changes).some(
            ([k, v]) => (response.record[k] ?? null) !== (v ?? null),
          )
        )
          throw new Error("Сервер не подтвердил сохранение карточки.");
        setNote({
          ok: true,
          text: "Карточка сохранена в CRM.",
          cardUrl: "#/crm/" + entity + "?stage=all&card=" + id,
        });
        setActive(null);
        return;
      }
      if (mode.id === "record_transaction") {
        const { record } = await opsWorkspace<{ record: { id: string; amount: string; currency: string } }>("recordTransaction", {
          id: invoiceId.current, account: values.account, amount: values.amount, category: values.category, date: values.date,
          direction: values.direction === "расход" ? "expense" : "income",
        });
        if (record?.id !== invoiceId.current || Number(record.amount) !== Number(values.amount.replace(",", ".")))
          throw new Error("Сервер не подтвердил запись операции.");
        setNote({ ok: true, text: "Операция сохранена · " + Number(record.amount).toLocaleString("ru-RU") + " ₽" });
        setActive(null);
        return;
      }
      if (mode.id === "yookassa_payment") {
        const payment = await crm<{ url: string; status: string }>(
          "invoices",
          "createPayment",
          {
            id: invoiceId.current,
            lead: values.lead,
            email: values.email.trim(),
            description: values.description,
            amount: values.amount,
          },
        );
        if (!payment.url || new URL(payment.url).protocol !== "https:")
          throw new Error("Провайдер не вернул ссылку на оплату.");
        setNote({
          ok: true,
          text:
            payment.status === "pending"
              ? "Платёж создан и ожидает оплаты."
              : "Платёж создан.",
          paymentUrl: payment.url,
        });
        setActive(null);
        return;
      }
      if (mode.id === "sales_export") {
        const report = await crm<{ attachments: N8nAttachment[] }>("deals", "scenarioReport", {
          mode: mode.id, period: values.period,
        });
        if (report.attachments?.length !== 2)
          throw new Error("Сервер не вернул оба файла отчёта.");
        setNote({ ok: true, text: "Отчёт по продажам готов.", attachments: report.attachments });
        setActive(null);
        return;
      }
      if (
        mode.id === "erp_reconciliation" ||
        (mode.group === "report" &&
          (domain === "finance" || domain === "sales"))
      ) {
        const report = await crm<{ columns: string[]; rows: string[][] }>(
          domain === "sales" ? "deals" : "invoices",
          "scenarioReport",
          { mode: mode.id, period: values.period, owner: values.owner },
        );
        setNote({ ok: true, text: mode.label, report });
        setActive(null);
        return;
      }
      if (mode.id === "issue_invoice") {
        const department = await getOpsDepartment("finances");
        const handler = (
          Array.isArray(department.actions) ? department.actions : []
        ).find((a) => a.action_key === "issue_invoice");
        if (!handler?.workflow_id)
          throw new Error("Для компании не настроено выставление счетов");
        const id = invoiceId.current;
        const result = await runAction({
          action_key: "issue_invoice",
          department: "finances",
          workflow_id: handler.workflow_id,
          idempotency_key: id,
          params: {
            customer_id: values.client,
            document_id: id,
            amount: Number(values.amount.replace(",", ".")),
            currency: "RUB",
            item_name: values.purpose || "Услуги по счёту",
            due_date: values.due_date || undefined,
            send_now: values.send === "on",
          },
        });
        const doc = await crm<{ record: Card }>("invoices", "get", {
          id,
          source: "document",
        }).catch(() => null);
        if (doc?.record?.id === id) setDocumentId(id);
        if (
          !doc?.record?.issued ||
          doc.record.customer_id !== values.client ||
          Number(doc.record.amount) !== Number(values.amount.replace(",", "."))
        )
          throw new Error(
            "Не удалось подтвердить формирование счёта. Проверьте данные и повторите.",
          );
        if (result.status !== "done")
          throw new Error(
            "Счёт сформирован. " +
              (values.send === "on"
                ? "Отправка письма не подтверждена."
                : "Завершение обработчика не подтверждено."),
          );
        const detail = result.result?.action_result as
          | { ok?: boolean; email_status?: string; document_id?: string }
          | undefined;
        if (
          detail?.ok !== true ||
          detail.document_id !== id ||
          (values.send === "on" && detail.email_status !== "sent")
        )
          throw new Error("Счёт сформирован. Проверьте результат доставки.");
        setActive(null);
        setNote({
          ok: true,
          text:
            values.send === "on"
              ? "Счёт сформирован. Почтовый сервер принял письмо."
              : "Счёт сформирован.",
        });
        return;
      }
      submittedText.current = text;
      const res = await sendIntakeMessage(text);
      if (
        res.status === "error" ||
        res.status === "failed" ||
        (!res.text && !res.request_id && !res.attachments?.length)
      )
        throw new Error(res.text || "Сервер не подтвердил приём запроса");
      if (
        res.request_id &&
        ["processing", "queued", "pending", "accepted"].includes(
          res.status || "",
        )
      ) {
        pending.current = { id: res.request_id, mode: mode.id };
        await check(res.request_id, mode);
      } else if (res.text || res.attachments?.length) {
        if (!needsWriteReceipt(mode)) setActive(null);
        setNote({ ok: true, reply: true, text: res.text || "Файлы готовы.", attachments: res.attachments });
      } else throw new Error("Сервер не подтвердил результат");
    } catch (e) {
      setNote({
        ok: false,
        text: e instanceof Error ? e.message : "Не удалось отправить запрос",
      });
    } finally {
      setRunningKey(null);
    }
  };

  if (modes.length === 0)
    return (
      <div className={styles.noFields}>
        Для этого отдела пока нет настроенных режимов.
      </div>
    );

  const groups = ["ops", "report"].filter((g) =>
    modes.some((m) => m.group === g),
  );

  return (
    <>
      {groups.map((g) => (
        <div key={g}>
          <h3 className={styles.groupTitle}>{GROUP_LABELS[g] ?? g}</h3>
          <section className={styles.grid}>
            {modes
              .filter((m) => m.group === g)
              .map((mode) => (
                <article key={mode.id} className={styles.card}>
                  <div>
                    <strong>{mode.label}</strong>
                    <p>{mode.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNote(null);
                      pending.current = null;
                      invoiceId.current = crypto.randomUUID();
                      setDocumentId("");
                      setActive(mode);
                    }}
                    disabled={runningKey != null}
                  >
                    {runningKey === mode.id ? (
                      <Loader2 className={styles.spin} aria-hidden />
                    ) : (
                      <Play aria-hidden />
                    )}
                    {runningKey === mode.id ? "Отправка…" : "Открыть"}
                  </button>
                </article>
              ))}
          </section>
        </div>
      ))}

      {active && (
        <ModeForm
          mode={active}
          pending={!!pending.current}
          busy={!!runningKey}
          error={note?.ok === false ? note.text : null}
          reply={note?.reply ? note.text : null}
          submittedText={submittedText.current}
          onClose={() => setActive(null)}
          onSubmit={(text, values, selected) =>
            void submit(active, text, values, selected)
          }
        />
      )}

      {note && (
        <div
          className={`${styles.resultPanel} ${note.ok ? styles.resultOk : styles.resultError}`}
          role="status"
        >
          <div className={styles.resultHead}>
            {note.ok ? (
              <CheckCircle2 aria-hidden />
            ) : (
              <AlertTriangle aria-hidden />
            )}
            <strong>
              {runningKey ? "В обработке" : note.reply ? "Ответ А1" : note.ok ? "Готово" : "Ошибка"}
            </strong>
            <button
              type="button"
              onClick={() => setNote(null)}
              aria-label="Закрыть"
            >
              <X aria-hidden />
            </button>
          </div>
          <p>{note.text}</p>
          {!!note.attachments?.length && <MessageList messages={[{id:"result", role:"assistant", content:"",attachments:note.attachments,timestamp:Date.now()}]} isLoading={false}/>}
          {note.cardUrl && <a href={note.cardUrl}>Открыть карточку</a>}
          {note.paymentUrl && (
            <a href={note.paymentUrl} target="_blank" rel="noopener noreferrer">
              Открыть ссылку на оплату
            </a>
          )}
          {note.report &&
            (note.report.rows.length ? (
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      {note.report.columns.map((c) => (
                        <th key={c}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {note.report.rows.map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td key={j}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>За выбранный период данных нет.</p>
            ))}
          {documentId && (
            <a
              href={"#/crm/invoices?source=document&card=" + documentId}
              onClick={() => setActive(null)}
            >
              Открыть счёт
            </a>
          )}
        </div>
      )}
    </>
  );
}

function FinanceAccountSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [accounts, setAccounts] = useState<{ id: string; label: string }[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, retry] = useState(0);
  useEffect(() => {
    let active = true;
    setError(false);
    opsWorkspace<{rows: {id: string; label: string}[]}>("rubAccounts").then(r => {
      if (active) setAccounts(r.rows);
    }).catch(() => { if (active) setError(true) });
    return () => { active = false };
  }, [attempt]);
  return <>
    <select required value={value} disabled={!accounts?.length} onChange={e => onChange(e.target.value)}>
      <option value="">{error ? "Счета недоступны" : !accounts ? "Загрузка…" : accounts.length ? "Выберите счёт" : "Нет активных рублёвых счетов"}</option>
      {accounts?.map(account => <option key={account.id} value={account.id}>{account.label}</option>)}
    </select>
    {error && <button type="button" onClick={() => retry(n => n + 1)}>Повторить загрузку счетов</button>}
  </>;
}

function ModeForm({
  mode,
  pending,
  busy,
  error,
  reply,
  submittedText,
  onClose,
  onSubmit,
}: {
  mode: DeptMode;
  pending: boolean;
  busy: boolean;
  error: string | null;
  reply: string | null;
  submittedText: string;
  onClose: () => void;
  onSubmit: (
    text: string,
    values: Record<string, string>,
    selected: Record<string, Card>,
  ) => void;
}) {
  const initial = useMemo(() => {
    const v: Record<string, string> = {};
    for (const f of mode.fields) v[f.name] = f.default ?? "";
    return v;
  }, [mode]);
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [selected, setSelected] = useState<Record<string, Card>>({});
  const [labels, setLabels] = useState<Record<string, string>>({});
  const set = (name: string, value: string) =>
    setValues((v) => ({ ...v, [name]: value }));
  const missing = mode.fields
    .filter((f) => f.required && !String(values[f.name] ?? "").trim())
    .map((f) => f.label);

  const amountInvalid =
    !!values.amount && !(Number(values.amount.replace(",", ".")) > 0);
  const emailInvalid = mode.fields.some(
    (f) =>
      f.type === "email" &&
      values[f.name] &&
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values[f.name].trim()),
  );
  const sameRequestAnswered = Boolean(reply && mode.request(values, labels).trim() === submittedText);
  const submit = () => {
    if (missing.length || busy || amountInvalid || emailInvalid || sameRequestAnswered) return;
    onSubmit(mode.request(values, labels).trim(), values, selected);
  };

  return (
    <div className={styles.modalOverlay} onClick={busy ? undefined : onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h3>{mode.label}</h3>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            aria-label="Закрыть"
          >
            <X aria-hidden />
          </button>
        </div>
        {mode.description && (
          <p className={styles.modalDesc}>{mode.description}</p>
        )}
        <fieldset disabled={busy || pending} className={styles.formBody}>
          {mode.fields.length === 0 && (
            <div className={styles.noFields}>
              Параметры не нужны — нажмите «Отправить».
            </div>
          )}
          {mode.fields.map((f) => (
            <label key={f.name} className={styles.field}>
              <span>
                {f.label}
                {f.required && <em> *</em>}
              </span>
              {f.type === "account" ? (
                <FinanceAccountSelect value={values[f.name] || ""} onChange={id => set(f.name, id)} />
              ) : f.type === "textarea" ? (
                <textarea
                  rows={3}
                  value={values[f.name] ?? ""}
                  onChange={(e) => set(f.name, e.target.value)}
                  placeholder={f.placeholder}
                />
              ) : f.type === "select" ? (
                <select
                  value={values[f.name] ?? ""}
                  onChange={(e) => set(f.name, e.target.value)}
                >
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === "db-select" ? (
                <CrmLookup
                  entity={f.source!}
                  label={f.label}
                  initialLabel=""
                  value={values[f.name] || ""}
                  required={f.required}
                  onChange={(id, label, record) => {
                    setSelected((r) => {
                      const next = { ...r };
                      if (record) next[f.name] = record;
                      else delete next[f.name];
                      return next;
                    });
                    set(f.name, id);
                    setLabels((l) => ({ ...l, [f.name]: label }));
                  }}
                />
              ) : f.type === "checkbox" ? (
                <input
                  type="checkbox"
                  checked={values[f.name] === "on"}
                  onChange={(e) => set(f.name, e.target.checked ? "on" : "")}
                />
              ) : (
                <input
                  type={f.type}
                  step={f.type === "number" ? "any" : undefined}
                  value={values[f.name] ?? ""}
                  onChange={(e) => set(f.name, e.target.value)}
                  placeholder={f.placeholder}
                />
              )}
              {f.help && <small>{f.help}</small>}
            </label>
          ))}
        </fieldset>
        {emailInvalid && <p role="alert">Проверьте адрес электронной почты.</p>}
        {amountInvalid && <p role="alert">Сумма должна быть больше нуля.</p>}
        {error && <p role="alert">{error}</p>}
        {reply && <div role="status"><strong>Ответ А1</strong><p>{reply}</p></div>}
        <div className={styles.modalActions}>
          <button
            type="button"
            className={styles.btnGhost}
            disabled={busy}
            onClick={onClose}
          >
            {reply ? "Закрыть" : "Отмена"}
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={submit}
            disabled={
              busy || sameRequestAnswered || amountInvalid || emailInvalid || missing.length > 0
            }
            title={missing.length ? `Заполните: ${missing.join(", ")}` : ""}
          >
            {busy
              ? "В обработке…"
              : pending
                ? "Проверить результат"
                : "Отправить"}
          </button>
        </div>
      </div>
    </div>
  );
}
