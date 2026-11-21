import { useEffect, useRef, useState } from "react";
import { arrayBufferToBase64, opsWorkspace } from "../api/n8n";

const choices: Record<string, "product" | "plan"> = {
  classify_ad_category: "product",
  calculate_media_plan: "product",
  generate_ad_variants: "plan",
  export_yandex_direct_xlsx: "plan",
};
export const hasOpsInputs = (key: string) =>
  Object.prototype.hasOwnProperty.call(choices, key) || ["growth_leadgen_report","yandex_direct_report","landing_watchdog","ops_documents","compose_email","product_packaging","delivery_ops","ops_finance","create_task","ops_legal_lpr","ops_hr_lpr","read_sheet", "send_email", "import_yandex_direct_xlsx"].includes(key);
export function OpsActionInputs({
  action,
  onChange,
}: {
  action: string;
  onChange: (params: Record<string, string> | null) => void;
}) {
  const latestFile = useRef<File | null>(null);
  useEffect(() => () => { latestFile.current = null }, []);
  const [fileError, setFileError] = useState("");
  const [mail, setMail] = useState({ to: "", subject: "", body_text: "" });
  const [templates,setTemplates]=useState<{key:string;name:string;type:string}[]|null>(null);
  const [document,setDocument]=useState({template_key:'',title:'',brief:''});
  const [task,setTask]=useState({title:"",priority:"medium",due:""});
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
  useEffect(()=>{
    let active=true;
    if(action==='ops_documents') opsWorkspace<{rows:{key:string;name:string;type:string}[]}>('documentTemplates')
      .then(r=>{if(active){setTemplates(r.rows);setError('')}}).catch(()=>{if(active)setError('Не удалось получить список шаблонов')});
    return ()=>{active=false};
  },[action,attempt]);
  if (action==='growth_leadgen_report' || action==='yandex_direct_report' || action==='landing_watchdog') {
    return <label>Период<select value={query} onChange={e=>{setQuery(e.target.value);onChange(e.target.value?{period:e.target.value}:null)}}>
      <option value="">Выберите период</option><option value="today">Сегодня</option><option value="7d">7 дней</option><option value="30d">30 дней</option><option value="90d">90 дней</option>
    </select></label>;
  }
  if (action === 'create_task') {
    const change = (key:keyof typeof task,value:string)=>{
      const next={...task,[key]:value};
      setTask(next);onChange(next.title.trim()?next:null);
    };
    return <div>
      <label>Название задачи<input required maxLength={500} value={task.title} onChange={e=>change('title',e.target.value)}/></label>
      <label>Приоритет<select value={task.priority} onChange={e=>change('priority',e.target.value)}>
        <option value="low">Низкий</option><option value="medium">Обычный</option><option value="high">Высокий</option><option value="critical">Критический</option>
      </select></label>
      <label>Срок задачи<input type="datetime-local" value={task.due} onChange={e=>change('due',e.target.value)}/></label>
    </div>;
  }
  if(action==='ops_documents') {
    const update=(key:keyof typeof document,value:string)=>{
      const next={...document,[key]:value};setDocument(next);
      const type=templates?.find(t=>t.key===next.template_key)?.type || 'memo';
      onChange(next.title.trim() && next.brief.trim()?{...next,doc_type:type,user_message:next.brief}:null);
    };
    return <div>
      <label>Шаблон<select value={document.template_key} onChange={e=>update('template_key',e.target.value)}>
        <option value="">Свободная форма</option>{templates?.map(t=><option key={t.key} value={t.key}>{t.name}</option>)}
      </select></label>
      {error && <p role="alert">{error} <button type="button" onClick={()=>retry(n=>n+1)}>Повторить</button></p>}
      <label>Название документа<input required value={document.title} onChange={e=>update('title',e.target.value)}/></label>
      <label>Содержание<textarea required value={document.brief} onChange={e=>update('brief',e.target.value)}/></label>
    </div>;
  }
  if(['compose_email','product_packaging','delivery_ops','ops_finance'].includes(action)){
    const fieldLabels:Record<string,string>={compose_email:'Кому и о чём написать',product_packaging:'Продукт, аудитория и задача',delivery_ops:'Что подготовить по доставке',ops_finance:'Финансовый запрос'};
    return <label>{fieldLabels[action]}<textarea required value={query} onChange={e=>{
      setQuery(e.target.value);onChange(e.target.value.trim()?(action==='product_packaging'?{user_message:e.target.value.trim(),research_mode:'internal'}:{user_message:e.target.value.trim()}):null);
    }}/></label>;
  }
  if (action==='ops_hr_lpr' || action==='ops_legal_lpr') {
    return <label>Вопрос для рассмотрения<textarea required value={query} onChange={e=>{
      setQuery(e.target.value);onChange(e.target.value.trim()?{summary:e.target.value.trim()}:null);
    }}/></label>;
  }
  if (action === "import_yandex_direct_xlsx") {
    const selectFile = async (file: File | null) => {
      latestFile.current = file;
      onChange(null);
      setFileError("");
      if (!file) return;
      if (!file.name.toLowerCase().endsWith(".xlsx") || !file.size) {
        setFileError("Выберите непустой файл XLSX.");
        return;
      }
      if (file.size > 15 * 1024 * 1024) {
        setFileError("Размер файла превышает 15 МБ.");
        return;
      }
      try {
        const bytes = await file.arrayBuffer();
        if (latestFile.current !== file) return;
        onChange({ filename: file.name, content_base64: arrayBufferToBase64(bytes) });
      } catch {
        if (latestFile.current === file) setFileError("Не удалось прочитать файл. Выберите его снова.");
      }
    };
    return <label>Файл кампании XLSX
      <input type="file" accept=".xlsx" onChange={e => void selectFile(e.target.files?.[0] || null)} />
      {fileError && <span role="alert">{fileError}</span>}
    </label>;
  }
  if (action === "send_email") {
    const change = (key: keyof typeof mail, value: string) => {
      const next = { ...mail, [key]: value };
      setMail(next);
      onChange(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(next.to.trim()) && next.subject.trim() && next.body_text.trim()
        ? { to: next.to.trim(), subject: next.subject.trim(), body_text: next.body_text } : null);
    };
    return <div>
      <label>Кому<input type="email" value={mail.to} onChange={e => change("to", e.target.value)} /></label>
      <label>Тема<input value={mail.subject} onChange={e => change("subject", e.target.value)} /></label>
      <label>Текст письма<textarea value={mail.body_text} onChange={e => change("body_text", e.target.value)} /></label>
    </div>;
  }
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
