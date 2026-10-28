export type ChatTurn = { role: "user" | "assistant"; content: string };
export type ChatPayload = { city: string; accessCode: string; messages: ChatTurn[] };

export class ChatInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChatInputError";
  }
}

export function parseChatPayload(input: unknown): ChatPayload {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new ChatInputError("Неверный формат запроса.");
  }

  const body = input as Record<string, unknown>;
  const city = typeof body.city === "string" ? body.city.trim() : "";
  const accessCode = typeof body.accessCode === "string" ? body.accessCode : "";

  if (!city || city.length > 70 || !/^[\p{L}\s.'-]+$/u.test(city)) {
    throw new ChatInputError("Укажите корректный город Казахстана.");
  }
  if (accessCode.length > 200) {
    throw new ChatInputError("Некорректный код доступа.");
  }
  if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 8) {
    throw new ChatInputError("История диалога должна содержать от 1 до 8 сообщений.");
  }

  let total = 0;
  const messages = body.messages.map((item): ChatTurn => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new ChatInputError("Некорректное сообщение.");
    }
    const value = item as Record<string, unknown>;
    if (value.role !== "user" && value.role !== "assistant") {
      throw new ChatInputError("Некорректная роль сообщения.");
    }
    if (typeof value.content !== "string" || !value.content.trim() || value.content.length > 1400) {
      throw new ChatInputError("Сообщение должно содержать от 1 до 1400 символов.");
    }
    total += value.content.length;
    return { role: value.role, content: value.content.trim() };
  });

  if (total > 6000 || messages[messages.length - 1]?.role !== "user") {
    throw new ChatInputError("Слишком длинный или некорректный диалог.");
  }
  return { city, accessCode, messages };
}
