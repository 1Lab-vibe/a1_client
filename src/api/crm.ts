import { requestWebhook } from "./n8n";
import { getSession } from "../session";
export type Entity = "clients" | "leads" | "deals" | "invoices";
export type Value = string | string[] | boolean | number | null;
export type Card = Record<string, Value> & { id: string; version: string };
export type Field = {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
};
export type Page = {
  fields: Field[];
  records: Card[];
  total: number;
  editable: boolean;
  page: number;
  totals: { currency: string; amount: string }[];
};
export async function crm<T>(
  entity: Entity,
  operation: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const r = await requestWebhook<{ ok?: boolean; data?: T }>({
    ...getSession(),
    action: "crmWorkspace",
    payload: { entity, operation, ...payload },
  });
  if (r?.ok !== true || !r.data)
    throw new Error("Сервер не подтвердил операцию CRM.");
  return r.data;
}
