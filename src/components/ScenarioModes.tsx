import {MessageList} from './MessageList';
import type {N8nAttachment} from '../types';
import { useEffect, useMemo, useState, useRef } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Play, X } from "lucide-react";
import { getOpsDepartment, opsWorkspace, runAction, sendIntakeMessage } from "../api/n8n";
import { crm, type Card } from "../api/crm";
import { useActionRunner } from '../hooks/useActionRunner';
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

  const {run:runDepartmentAction} = useActionRunner();
  const [draft,setDraft] = useState<{key:string;to:string;subject:string;body:string}|null>(null);
  const [researchRequest,setResearchRequest]=useState<string>();
  const [mailRequest,setMailRequest] = useState<string>();
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
        mode.id === "deal_create"
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
          { id, version: base?.version, changes, ...(mode.id==="deal_create" && values.owner ? {assignee:values.owner} : {}) },
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
      if (mode.id==="proposal_pdf") {
        const amount=Number(values.amount.replace(",","."));
        if(!Number.isFinite(amount) || amount<=0 || !/^\d+(?:[.,]\d{1,2})?$/.test(values.amount.trim())) throw new Error("Укажите положительную сумму с точностью до копеек.");
        const {record:lead}=await crm<{record:Card}>("leads","get",{id:values.lead});
        const recipient=String(lead.company_name || lead.title || "").trim();
        if(!recipient) throw new Error("В карточке лида не заполнено название.");
        const dept=await getOpsDepartment("tasks");
        const handler=(Array.isArray(dept.actions)?dept.actions:[]).find(row=>row.action_key==="ops_documents");
        if(!handler?.workflow_id)throw new Error("В компании не настроена генерация документов.");
        const title="Коммерческое предложение для "+recipient;
        const brief=["Получатель: "+recipient,lead.contact_name?"Контакт: "+lead.contact_name:"","Предмет предложения: внедрение A1.","Стоимость: "+amount.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2})+" ₽."].filter(Boolean).join("\n");
        const result=await runDepartmentAction({action_key:"ops_documents",workflow_id:handler.workflow_id,department:"tasks",confirmed:true,idempotency_key:invoiceId.current,
          params:{title,brief,user_message:brief,doc_type:"commercial_proposal",lead_id:lead.id,amount,currency:"RUB"}},mailRequest);
        setMailRequest(result.status==="processing" || result.status==="error" ? result.request_id : undefined);
        if(result.status!=="done" || !result.attachments?.some(file=>/\.pdf$/i.test(file.filename || file.name || ""))) throw new Error(result.error || "Сервер не подтвердил формирование PDF.");
        setNote({ok:true,text:"Коммерческое предложение готово.",attachments:result.attachments});setActive(null);return;
      }
      if (mode.id==="email_draft" || mode.id==="email_send") {
        const {record:lead}=await crm<{record:Card}>("leads","get",{id:values.lead});
        const to=String(lead.contact_email || "").trim();
        if (mode.id==="email_send" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) throw new Error("Сохраните email в карточке лида.");
        const key=JSON.stringify([values.lead,values.about || "",to]);
        const sending=mode.id==="email_send" && draft?.key===key;
        const action=sending?"send_email":"compose_email";
        const dept=await getOpsDepartment("tasks");
        const handler=(Array.isArray(dept.actions)?dept.actions:[]).find(row=>row.action_key===action);
        if(!handler?.workflow_id)throw new Error("В компании не настроен обработчик письма.");
        const params=sending && draft ? {to,subject:draft.subject,body_text:draft.body,dedupe_key:invoiceId.current}
          : {customer_name:String(lead.company_name || lead.title || ""),contact_name:String(lead.contact_name || ""),
             user_message:values.about?.trim() || "Пригласить клиента обсудить его задачу на встрече."};
        const result=await runDepartmentAction({action_key:action,department:"tasks",workflow_id:handler.workflow_id,confirmed:true,params,
          idempotency_key:sending?invoiceId.current:undefined},mailRequest);
        setMailRequest(result.status==="processing" || result.status==="error" ? result.request_id : undefined);
        if(result.status!=="done")throw new Error(result.error || "Письмо ещё в обработке. Проверьте результат.");
        if(sending) {
          if(!result.result?.external_message_id)throw new Error("Почтовый сервер не подтвердил отправку.");
          setNote({ok:true,text:"Почтовый сервер принял письмо для "+to+"."});setActive(null);return;
        }
        const subject=result.result?.subject,body=result.result?.body_text;
        if(typeof subject!=="string" || !subject.trim() || typeof body!=="string" || !body.trim())throw new Error("Не удалось сформировать тему и текст письма.");
        if(mode.id==="email_send")setDraft({key,to,subject,body});
        else {setNote({ok:true,text:subject+"\n\n"+body});setActive(null)}
        return;
      }
      if (mode.id==="leadgen_launch") {
        const count=Number(values.count || 5);
        if(!Number.isInteger(count) || count<1 || count>500) throw new Error("Укажите от 1 до 500 клиентов.");
        const id=invoiceId.current;
        const read=async()=>(await opsWorkspace<{record:{id:string;status:string;candidates:number;leads:number}|null}>("leadgenResult",{id})).record;
        let record=await read();
        if(!record){
          const dept=await getOpsDepartment("marketing");
          const handler=(Array.isArray(dept.actions)?dept.actions:[]).find(row=>row.action_key==="growth_leadgen");
          if (!handler?.workflow_id)throw new Error("Обработчик подбора клиентов недоступен.");
          const result=await runDepartmentAction({action_key:"growth_leadgen",department:"marketing",workflow_id:handler.workflow_id,idempotency_key:id,params:{
            form:"crm_research",mode:"research",target_count:count,scout_query:values.similar_to || "Компании, похожие на клиентов компании",
            autonomy_level:"research_only",auto_prepare_outreach:false,
          }},researchRequest);
          setResearchRequest(result.status==="processing" || result.status==="error" ? result.request_id : undefined);
          record=await read();
          if(!record)throw new Error(result?.error || "Подбор ещё не подтверждён. Повторите проверку.");
        }
        if(record.status!=="completed") throw new Error("Подбор ещё не завершён.");
        setNote({ok:true,text:"Подбор завершён. Кандидатов: "+record.candidates+", связанных лидов: "+record.leads+"."});setActive(null);return;
      }
      if (mode.id==="billing_event") {
        const dept=await getOpsDepartment("accounting");
        const handler=(Array.isArray(dept.actions)?dept.actions:[]).find(row=>row.action_key==="ops_billing_executor");
        if (!handler?.workflow_id) throw new Error("Обработчик биллинга недоступен.");
        const id=invoiceId.current,amount=Number(values.amount.replace(",","."));
        const result=await runAction({action_key:"ops_billing_executor",workflow_id:handler.workflow_id,department:"accounting",confirmed:true,idempotency_key:id,
          params:{form:"crm_billing",operation:"record_event",customer_id:values.client,amount,external_event_id:id}});
        const saved=result.result?.receipt as {external_event_id?:string;customer_id?:string;amount?:string}|undefined;
        if(result.status!=="done" || saved?.external_event_id!==id || saved.customer_id!==values.client || Number(saved.amount)!==amount)throw new Error(result.error || "Сервер не подтвердил запись события.");
        setNote({ok:true,text:"Событие биллинга зарегистрировано · "+amount.toLocaleString("ru-RU")+" ₽"});setActive(null);return;
      }
      if (mode.id==="dadata") {
        const report=await opsWorkspace<{columns:string[];rows:string[][]}>('lookupInn',{inn:values.inn});
        setNote({ok:true,text:report.rows.length?'Реквизиты из DaData':'По этому ИНН организации не найдены.',report:report.rows.length?report:undefined});
        setActive(null);return;
      }
      if (mode.id==="sales_profile" || mode.id==="next_step") {
        const profile=mode.id==="sales_profile";
        const {record}=await crm<{record:Card}>(profile?"clients":"leads","get",{id:profile?values.client:values.lead});
        const due=String((profile?record.next_followup_at:record.next_follow_up_at) || "");
        const date=due ? new Date(due).toLocaleString("ru-RU") : "";
        let next="Назначить дату следующего контакта.";
        const email=String((profile?record.primary_email:record.contact_email) || "");
        const phone=String((profile?record.primary_phone:record.contact_phone) || "");
        if(!email && !phone) next="Уточнить контактные данные.";
        else if (date) next=(Date.parse(due)<Date.now()?"Связаться по просроченному контакту · ":"Связаться в назначенное время · ")+date;
        if (!profile && record.stage==="lost") next="Лид провален. Уточнить причину перед возвратом в работу.";
        if (!profile && record.stage==="won") next="Лид успешно завершён. Проверить связанную сделку.";
        const rows=profile ? [
          ["Клиент",String(record.name || "")],["Email",email || "Не указан"],["Телефон",phone || "Не указан"],
          ["Подписант",[record.signer_name,record.signer_title].filter(Boolean).join(", ") || "Не указан"],
          ["Что уточнить",[!record.signer_name && "Кто принимает решение",!email && "Email",!phone && "Телефон",!due && "Дата следующего контакта"].filter(Boolean).join(", ") || "Основные поля заполнены"],
          ["Риск",!email && !phone?"Отсутствуют каналы связи":due && Date.parse(due)<Date.now()?"Следующий контакт просрочен":"По контактным данным явных рисков не обнаружено"],
        ] : [["Лид",String(record.title || "")],["Контакт",[record.contact_name,email,phone].filter(Boolean).join(" · ") || "Не указан"]];
        rows.push(["Следующий шаг",next]);
        setNote({ok:true,text:mode.label,report:{columns:["Поле","Значение"],rows}});setActive(null);return;
      }
      if(mode.id==="create_obligation"){
        const cadence=({"разовое":"once","ежемесячно":"monthly","ежеквартально":"quarterly"} as Record<string,string>)[values.recurrence || "разовое"];
        const {record}=await opsWorkspace<{record:{id:string;amount:string;title:string;date:string;cadence:string}}>("create_obligation",{
          id:invoiceId.current,counterparty:values.counterparty,amount:values.amount,date:values.due_date,cadence
        });
        if(record?.id!==invoiceId.current || record.date!==values.due_date || Number(record.amount)!==Number(values.amount.replace(",",".")) || record.cadence!==cadence)
          throw new Error("Сервер не подтвердил создание обязательства.");
        setNote({ok:true,text:"Обязательство сохранено · "+record.title+" · "+record.amount+" ₽"});setActive(null);return;
      }
      if (["follow_up","meeting_result","mark_obligation_paid"].includes(mode.id)) {
        const payment = mode.id === "mark_obligation_paid";
        const params = payment
          ? { obligation:values.obligation, version:values.obligationVersion, account:values.account, date:values.date, amount:values.amount }
          : { lead:values.lead, version:selected.lead?.version, when:new Date(values.when).toISOString(), minutes:Number(values.minutes), owner:values.owner, result:values.result };
        const {record} = await opsWorkspace<{record:{id:string; lead?:string; obligation?:string}}>(mode.id, {id:invoiceId.current,...params});
        if (record?.id!==invoiceId.current || (payment ? record.obligation!==values.obligation : record.lead!==values.lead))
          throw new Error("Сервер не подтвердил сохранение.");
        setNote({ok:true,text:payment ? "Оплата обязательства учтена." : mode.id==="follow_up" ? "Назначен следующий контакт. Создана задача." : "Итог встречи сохранён.",
          cardUrl:payment ? undefined : "#/crm/leads?stage=all&card="+values.lead});
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
                      setDocumentId("");setResearchRequest(undefined);setDraft(null);setMailRequest(undefined);
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
          pending={!!pending.current || !!mailRequest}
          draft={draft}
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

type Choice = {id:string; label:string; version?:string};
function WorkspaceSelect({kind, value, required, onChange}: {
  kind:'account'|'obligation'|'assignee'; value:string; required?:boolean; onChange:(id:string,version?:string)=>void;
}) {
  const [rows,setRows] = useState<Choice[] | null>(null);
  const [error,setError] = useState(false);
  const [attempt,retry] = useState(0);
  useEffect(()=>{
    let active=true;
    setError(false);
    const operation={account:'rubAccounts',obligation:'openObligations',assignee:'assignees'}[kind];
    opsWorkspace<{rows:Choice[]}>(operation).then(r=>{if(active)setRows(r.rows)}).catch(()=>{if(active)setError(true)});
    return ()=>{active=false};
  },[kind,attempt]);
  const prompt={account:'Выберите счёт',obligation:'Выберите обязательство',assignee:'По умолчанию'}[kind];
  return <>
    <select required={required} value={value} disabled={!rows?.length} onChange={e=>onChange(e.target.value,rows?.find(row=>row.id===e.target.value)?.version)}>
      <option value="">{error?'Ошибка загрузки':!rows?'Загрузка…':rows.length?prompt:'Нет доступных записей'}</option>
      {rows?.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}
    </select>
    {error && <button type="button" onClick={()=>retry(n=>n+1)}>Повторить загрузку</button>}
  </>;
}

function ModeForm({
  mode,
  pending,
  busy,
  error,
  reply,
  submittedText,
  draft,
  onClose,
  onSubmit,
}: {
  mode: DeptMode;
  pending: boolean;
  busy: boolean;
  error: string | null;
  reply: string | null;
  submittedText: string;
  draft: {key:string;to:string;subject:string;body:string}|null;
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
  const preview=draft && draft.key===JSON.stringify([values.lead,values.about || "",draft.to]) ? draft : null;
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
              {f.type === "account" || f.type === "obligation" || f.type === "assignee" ? (
                <WorkspaceSelect kind={f.type} required={f.required} value={values[f.name] || ""} onChange={(id,version) => {
                  set(f.name,id);
                  if (f.type==="obligation") set("obligationVersion",version || "");
                }} />
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
        {preview && <section aria-label="Предпросмотр письма"><p>Кому · {preview.to}</p><strong>{preview.subject}</strong><p style={{whiteSpace:"pre-wrap"}}>{preview.body}</p></section>}
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
                : preview ? "Отправить письмо" : ["email_draft","email_send"].includes(mode.id) ? "Составить письмо" : "Отправить"}
          </button>
        </div>
      </div>
    </div>
  );
}
