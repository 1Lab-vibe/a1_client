import { getSession } from "../session";
import { requestWebhook, sendIntakeMessage } from "../api/n8n";
import type { N8nAttachment } from "../types";

export interface N8nResponse {
  text?: string;
  attachments?: N8nAttachment[];
  message_id?: string;
}
export async function waitForIntake(
  requestId: string,
  signal?: AbortSignal,
): Promise<N8nResponse> {
  const session = getSession();
  for (let n = 0; n < 60; n++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    if (
      signal?.aborted ||
      getSession()?.company_id !== session?.company_id ||
      getSession()?.user_id !== session?.user_id
    )
      throw new Error("Просмотр запроса завершён");
    const r = await requestWebhook<
      N8nResponse & { status: string; request_id: string }
    >({ ...session, action: "getIntakeResult", request_id: requestId });
    if (r.request_id !== requestId)
      throw new Error("Сервер вернул ответ на другой запрос");
    if (r.status === "ready" && (r.text || r.attachments?.length)) return r;
    if (r.status !== "processing")
      throw new Error("Не удалось получить результат");
  }
  throw new Error("Ответ ещё не получен. Проверьте результат позже.");
}
export function useN8n() {
  async function sendToN8n(message: string): Promise<N8nResponse> {
    const r = await sendIntakeMessage(message);
    if (
      r.request_id &&
      ["processing", "pending", "queued", "accepted"].includes(r.status || "")
    )
      return waitForIntake(r.request_id);
    if ((r.text || r.attachments?.length) && !["failed", "error"].includes(r.status || ""))
      return { text: r.text, attachments: r.attachments };
    throw new Error(r.text || "Сервер не подтвердил приём сообщения");
  }
  return { sendToN8n };
}
