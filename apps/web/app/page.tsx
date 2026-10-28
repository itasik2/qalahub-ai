"use client";

import { FormEvent, useState } from "react";

type Source = { title: string; url: string };
type ChatMessage = { role: "user" | "assistant"; text: string; sources?: Source[] };
type ChatReply = { answer?: string; sources?: Source[]; error?: string };

const cities = [
  "Астана", "Алматы", "Шымкент", "Павлодар", "Караганда",
  "Актобе", "Атырау", "Актау", "Костанай", "Тараз", "Усть-Каменогорск",
];

const suggestions = [
  {
    icon: "✦", type: "Афиша", text: "Что интересного происходит в городе на этих выходных?",
    style: "mint",
  },
  {
    icon: "◉", type: "Поесть", text: "Посоветуй уютное кафе с хорошими отзывами и средним чеком до 7000 ₸.",
    style: "peach",
  },
  {
    icon: "☼", type: "Досуг", text: "Куда сходить с детьми в субботу, если будет прохладно?",
    style: "lavender",
  },
  {
    icon: "↗", type: "Помощь", text: "Как найти надёжного мастера для ремонта стиральной машины?",
    style: "blue",
  },
];

export default function HomePage() {
  const [city, setCity] = useState("Астана");
  const [accessCode, setAccessCode] = useState("");
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function ask(question: string) {
    const query = question.trim();
    if (pending || !query) return;
    if (!accessCode.trim()) {
      setError("Введите код доступа к пилоту перед первым запросом.");
      return;
    }

    setPending(true);
    setError("");
    setText("");
    const turn: ChatMessage = { role: "user", text: query };
    const next = [...messages, turn];
    setMessages(next);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          city: city.trim(),
          accessCode,
          messages: next.slice(-8).map((message) => ({
            role: message.role,
            content: message.text,
          })),
        }),
      });
      const result = (await response.json()) as ChatReply;
      if (!response.ok || !result.answer) {
        throw new Error(result.error || "Не удалось получить ответ.");
      }
      setMessages((previous) => [...previous, {
        role: "assistant",
        text: result.answer ?? "",
        sources: result.sources ?? [],
      }]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Что-то пошло не так.");
      setText(query);
    } finally {
      setPending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(text);
  }

  return (
    <main className="page">
      <header className="site-header">
        <div className="container header-inner">
          <a className="brand" href="/" aria-label="QalaHub AI, главная">
            <span className="brand-symbol">Q<span className="brand-dot">.</span></span>
            <span>QalaHub <b>AI</b></span>
          </a>
          <div className="header-right">
            <span className="pilot-pill"><span className="live-dot" /> Пилот · Астана</span>
            <label className="city-control">
              <span>Ваш город</span>
              <input
                aria-label="Город Казахстана"
                list="kz-cities"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                maxLength={70}
              />
              <datalist id="kz-cities">
                {cities.map((item) => <option value={item} key={item} />)}
              </datalist>
            </label>
          </div>
        </div>
      </header>

      <div className="container main-content">
        <section className="intro" aria-labelledby="hero-title">
          <div className="intro-eyebrow"><span className="spark">✳</span> Твой город. Твои возможности.</div>
          <h1 id="hero-title">Все интересное <br /><em>рядом с тобой.</em></h1>
          <p className="intro-text">
            Куда сходить, где поесть, как провести выходные или решить бытовую задачу?
            Спроси QalaHub. Мы ищем свежую информацию и показываем источники.
          </p>
          <div className="feature-row">
            <span>↗ Актуальный поиск</span>
            <span>✳ Идеи для досуга</span>
            <span>◉ Городские задачи</span>
          </div>

          <div className="discover">
            <div className="discover-heading">
              <h2>С чего начнём?</h2>
              <p>Выбери идею или напиши свой вопрос</p>
            </div>
            <div className="suggestion-grid">
              {suggestions.map((item) => (
                <button
                  key={item.type}
                  className={"suggestion " + item.style}
                  onClick={() => void ask(item.text)}
                  disabled={pending}
                  type="button"
                >
                  <span className="suggestion-top">
                    <span className="suggestion-icon">{item.icon}</span>
                    <span className="suggestion-arrow">↗</span>
                  </span>
                  <strong>{item.type}</strong>
                  <span className="suggestion-text">{item.text}</span>
                </button>
              ))}
            </div>
          </div>
          <p className="intro-note">
            Начинаем с Астаны. Другие города уже можно выбрать для пробного поиска.
          </p>
        </section>

        <section className="chat" aria-label="Диалог с QalaHub AI">
          <div className="chat-header">
            <div className="agent-avatar">✳</div>
            <div className="agent-heading">
              <strong>QalaHub AI</strong>
              <span>Городской помощник</span>
            </div>
            <span className="chat-badge">Веб-поиск</span>
          </div>

          <div className="chat-messages" aria-live="polite" aria-relevant="additions">
            {messages.length === 0 ? (
              <div className="welcome">
                <div className="welcome-icon">✳</div>
                <h2>Сәлем! Привет!</h2>
                <p>Помогу разобраться в городе и найти варианты под твои планы.</p>
                <div className="welcome-example">
                  <span>Например:</span>
                  <span>«Чем заняться в Астане сегодня вечером до 15 000 ₸?»</span>
                </div>
              </div>
            ) : (
              messages.map((message, index) => (
                <div className={"message " + message.role} key={index}>
                  {message.role === "assistant" && <span className="message-avatar">✳</span>}
                  <div className="message-content">
                    <div className="bubble">{message.text}</div>
                    {message.role === "assistant" && message.sources && message.sources.length > 0 && (
                      <div className="source-box">
                        <span className="source-heading">ИСТОЧНИКИ</span>
                        {message.sources.map((source) => (
                          <a
                            key={source.url}
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="source-link"
                          >↗ {source.title}</a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {pending && (
              <div className="message assistant">
                <span className="message-avatar">✳</span>
                <div className="loading-bubble"><span /><span /><span /> Ищу актуальную информацию…</div>
              </div>
            )}
          </div>

          <div className="chat-bottom">
            <label className="code-row">
              <span>Код закрытого пилота</span>
              <input
                type="password"
                value={accessCode}
                autoComplete="off"
                onChange={(event) => setAccessCode(event.target.value)}
                placeholder="Введите код доступа"
                maxLength={200}
                aria-label="Код доступа к пилотному тестированию"
              />
            </label>
            <form className="chat-form" onSubmit={handleSubmit}>
              <textarea
                aria-label="Ваш вопрос городскому помощнику"
                placeholder="Спроси о городе…"
                value={text}
                maxLength={1400}
                rows={2}
                onChange={(event) => setText(event.target.value)}
                disabled={pending}
              />
              <button type="submit" disabled={pending || !text.trim()} aria-label="Отправить сообщение">
                <span aria-hidden="true">↑</span>
              </button>
            </form>
            {error && <p className="error" role="alert">{error}</p>}
            <div className="chat-disclaimer">
              <span>✧ Информация может меняться. Проверяйте детали по ссылкам.</span>
              <span>QalaHub не оформляет бронирования и платежи.</span>
            </div>
          </div>
        </section>
      </div>
      <footer className="site-footer">
        <div className="container footer-inner">
          <span>© QalaHub AI · Сделано для городов Казахстана</span>
          <span>Пилотная версия · Без регистрации и сохранения истории</span>
        </div>
      </footer>
    </main>
  );
}
