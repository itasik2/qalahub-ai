/**
 * UI grouping only. The API still receives recent turns in their original
 * order, including questions and answers that the user has collapsed.
 */
export type ConversationalMessage = { role: "user" | "assistant"; text: string };
export type ChatTurn<T extends ConversationalMessage> = { question: T; answer?: T };

export function groupChatTurns<T extends ConversationalMessage>(
  messages: readonly T[],
): ChatTurn<T>[] {
  const turns: ChatTurn<T>[] = [];
  for (const message of messages) {
    if (message.role === "user") {
      turns.push({ question: message });
    } else if (turns.length && !turns[turns.length - 1].answer) {
      turns[turns.length - 1].answer = message;
    }
  }
  return turns;
}

export function summarizeQuestion(question: string, limit = 88): string {
  const text = question.replace(/\s+/g, " ").trim();
  if (limit < 2 || text.length <= limit) return text;
  return text.slice(0, limit - 1).trimEnd() + "…";
}
