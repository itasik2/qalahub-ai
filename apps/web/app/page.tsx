"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { getCityProfile, KZ_CITIES } from "../lib/cities";
import { tokenizeAssistantText } from "../lib/answer-format";
import { groupChatTurns, summarizeQuestion } from "../lib/chat-history";

type Source = { title: string; url: string };
type Citation = { startIndex: number; endIndex: number; url: string; title: string };
type ChatMessage = { role: "user" | "assistant"; text: string; sources?: Source[]; citations?: Citation[] };
type ChatReply = { answer?: string; sources?: Source[]; citations?: Citation[]; error?: string };
type FoundPlace = { id: string;name: string;category:string;address:string|null;distanceMeters:number;osmUrl:string };
type PlaceReply = {data?:FoundPlace[];error?:string};

function renderAssistantText(text: string) {
  return tokenizeAssistantText(text).map((part, index) => {
    if (part.type === "link") {
      return <a className="inline-citation" key={index} href={part.url}
        target="_blank" rel="noopener noreferrer">{part.text}</a>;
    }
    if (part.type === "strong") return <strong key={index}>{part.text}</strong>;
    return <span key={index}>{part.text}</span>;
  });
}

function ChatMessageView({ message }: { message: ChatMessage }) {
  return (
    <div className={"message " + message.role}>
      {message.role === "assistant" && <span className="message-avatar">✳</span>}
      <div className="message-content">
        <div className="bubble">
          {message.role === "assistant" ? renderAssistantText(message.text) : message.text}
        </div>
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
        {message.role === "assistant" && (!message.sources || message.sources.length === 0) && (
          <div className="source-warning" role="note">
            Не получены ссылки на подтверждающие источники. Проверяйте даты, адреса и цены самостоятельно.
          </div>
        )}
      </div>
    </div>
  );
}

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
  const [historyOpen, setHistoryOpen] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);
  const chatRef = useRef<HTMLElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);
  const requestControllerRef = useRef<AbortController | null>(null);

  const turns = groupChatTurns(messages);
  const previousTurns = turns.slice(0, -1);
  const currentTurn = turns[turns.length - 1];

  // New questions and answers stay at the start of the visible conversation
  // instead of being pushed out of sight by earlier long answers.
  useEffect(() => {
    if (historyOpen || messages.length === 0) return;
    const frame = requestAnimationFrame(() => {
      if (chatMessagesRef.current) chatMessagesRef.current.scrollTop = 0;
    });
    return () => cancelAnimationFrame(frame);
  }, [messages, pending, historyOpen]);

  useEffect(() => {
    if (!chatExpanded) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setChatExpanded(false);
    };
    window.addEventListener("keydown", onEscape);
    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener("keydown", onEscape);
    };
  }, [chatExpanded]);

  /** Clear this session without changing the selected city or pilot code. */
  function clearChat() {
    requestIdRef.current += 1;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    setPending(false);
    setMessages([]);
    setText("");
    setError("");
    setHistoryOpen(false);
    if (chatMessagesRef.current) chatMessagesRef.current.scrollTop = 0;
  }

  function chooseCity(nextCity: string) {
    clearChat();
    setCity(nextCity);
  }

  function handleSuggestion(question: string) {
    if (pending) return;
    setText(question);
    setError("");
    chatRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (!accessCode.trim()) {
      setError("Введите код пилотного доступа, чтобы запустить выбранный сценарий.");
      codeRef.current?.focus();
      return;
    }
    void ask(question);
  }

  async function findMapPlaces(category: "food" | "culture") {
    if (pending) return;
    if (!accessCode.trim()) {
      setError("Введите код пилота, чтобы найти места на карте.");
      chatRef.current?.scrollIntoView({behavior:"smooth",block:"center"});
      codeRef.current?.focus();
      return;
    }
    const question = category === "food"
      ? "Найди кафе и рестораны рядом с центром города"
      : "Найди музеи и достопримечательности рядом с центром города";
    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    requestControllerRef.current = controller;
    setPending(true);
    setHistoryOpen(false);
    setError("");
    setText("");
    setMessages(prev => [...prev,{role:"user",text:question}]);
    chatRef.current?.scrollIntoView({behavior:"smooth",block:"center"});
    try {
      const response = await fetch("/api/discover/places",{
        method:"POST",headers:{"Content-Type":"application/json"},
        cache:"no-store",signal:controller.signal,
        body:JSON.stringify({city,category,accessCode}),
      });
      const result = await response.json() as PlaceReply;
      if (requestId !== requestIdRef.current) return;
      if (!response.ok || !result.data) throw new Error(result.error || "Поиск мест недоступен.");
      const title = category === "food" ? "Кафе и рестораны" : "Музеи и достопримечательности";
      const entries = result.data.map((place,index) => {
        const distanceKm = (place.distanceMeters / 1000).toFixed(1).replace(".",",");
        const address = place.address ? " · " + place.address : " · адрес не указан";
        const safeName = place.name.replace(/[\\[\\]()*]/g,"");
        return (index + 1) + ". [" + safeName + "](" + place.osmUrl + ")" + address + " · " + distanceKm + " км от центра";
      });
      const lines = [
        "**" + title + ", " + city + " (OpenStreetMap)**",
        result.data.length ? entries.join("\n") : "В доступных картографических данных подходящих мест не найдено.",
        "Поиск относительно центра города, не вашего адреса. Уточняйте режим работы и цены.",
        "Источник: [© OpenStreetMap contributors, ODbL](https://www.openstreetmap.org/copyright).",
      ];
      setMessages(prev => [...prev,{
        role:"assistant",text:lines.join("\n\n"),
        sources:[{title:"OpenStreetMap contributors (ODbL)",url:"https://www.openstreetmap.org/copyright"}],
      }]);
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      setMessages(prev => prev.slice(0,-1));
      setError(error instanceof Error ? error.message : "Не удалось найти места.");
    } finally {
      if (requestId === requestIdRef.current) {
        requestControllerRef.current = null;
        setPending(false);
      }
    }
  }

  async function ask(question: string) {
    const query = question.trim();
    if (pending || !query) return;
    if (!accessCode.trim()) {
      setError("Введите код доступа к пилоту перед первым запросом.");
      return;
    }

    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    requestControllerRef.current = controller;
    setPending(true);
    setHistoryOpen(false);
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
        signal: controller.signal,
        body: JSON.stringify({
          city: city.trim(),
          accessCode,
          messages: next.slice(-8).map((message) => ({
            role: message.role,
            content: message.text.slice(0, message.role === "assistant" ? 3000 : 1400),
          })),
        }),
      });
      const result = (await response.json()) as ChatReply;
      if (requestId !== requestIdRef.current) return;
      if (!response.ok || !result.answer) {
        throw new Error(result.error || "Не удалось получить ответ.");
      }
      setMessages((previous) => [...previous, {
        role: "assistant",
        text: result.answer ?? "",
        sources: result.sources ?? [],
        citations: result.citations ?? [],
      }]);
    } catch (reason) {
      if (requestId !== requestIdRef.current) return;
      setMessages((previous) => previous.slice(0, -1));
      setError(reason instanceof Error ? reason.message : "Что-то пошло не так.");
      setText(query);
    } finally {
      if (requestId === requestIdRef.current) {
        requestControllerRef.current = null;
        setPending(false);
      }
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
            <span className="pilot-pill"><span className="live-dot" /> {getCityProfile(city)?.coverage === "pilot" ? "Пилот" : "Экспериментальный поиск"} · {city}</span>
            <label className="city-control">
              <span>Ваш город</span>
              <select
                aria-label="Выберите город Казахстана"
                value={city}
                onChange={(event) => chooseCity(event.target.value)}
              >
                {KZ_CITIES.map((item) => <option value={item} key={item}>{item}</option>)}
              </select>
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
                  onClick={() => handleSuggestion(item.text)}
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
            <div className="map-search-actions" aria-label="Поиск мест на карте">
              <p>Реальные места из OpenStreetMap</p>
              <div className="map-search-row">
                <button type="button" disabled={pending}
                  onClick={() => void findMapPlaces("food")}>◉ Кафе и рестораны</button>
                <button type="button" disabled={pending}
                  onClick={() => void findMapPlaces("culture")}>✦ Музеи и места</button>
              </div>
              <small>Поиск от центра города. Картографические данные могут быть неполными.</small>
            </div>
          </div>
          <p className="intro-note">
            Первый пилот в Астане. В других городах идёт экспериментальный поиск с проверкой источников.
          </p>
        </section>

        {chatExpanded && (
          <button
            className="chat-backdrop"
            type="button"
            aria-label="Закрыть расширенный чат"
            onClick={() => setChatExpanded(false)}
          />
        )}
        <section className={"chat" + (chatExpanded ? " chat-expanded" : "")}
          ref={chatRef} aria-label="Диалог с QalaHub AI">
          <div className="chat-header">
            <div className="agent-avatar">✳</div>
            <div className="agent-heading">
              <strong>QalaHub AI</strong>
              <span>Городской помощник</span>
            </div>
            <span className="chat-badge">Веб-поиск</span>
            <button
              className="chat-clear-button"
              type="button"
              disabled={messages.length === 0 && !text && !error && !pending}
              aria-label="Очистить переписку"
              title="Удалить все сообщения этого диалога"
              onClick={clearChat}
            >
              <span aria-hidden="true">↺</span> <span className="clear-label">Очистить</span>
            </button>
            <button
              className="chat-expand-button"
              type="button"
              aria-pressed={chatExpanded}
              onClick={() => setChatExpanded((value) => !value)}
            >
              {chatExpanded ? "↙ Свернуть" : "⤢ Развернуть"}
            </button>
          </div>

          <div className="chat-messages" ref={chatMessagesRef} aria-live="polite" aria-relevant="additions">
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
              <>
                {previousTurns.length > 0 && (
                  <div className="chat-history">
                    <button
                      className="chat-history-toggle"
                      type="button"
                      aria-expanded={historyOpen}
                      onClick={() => setHistoryOpen((value) => !value)}
                    >
                      <span>▤ История диалога</span>
                      <span className="history-count">
                        {previousTurns.length} {previousTurns.length === 1 ? "предыдущий запрос" : "предыдущих запросов"}
                        <span aria-hidden="true">{historyOpen ? "⌃" : "⌄"}</span>
                      </span>
                    </button>
                    {historyOpen && (
                      <div className="history-list">
                        {previousTurns.map((turn, index) => (
                          <details className="history-item" key={index}>
                            <summary>
                              <span className="history-number">{index + 1}</span>
                              <span className="history-question">{summarizeQuestion(turn.question.text)}</span>
                              <span className="history-chevron" aria-hidden="true">⌄</span>
                            </summary>
                            <div className="history-turn-messages">
                              <ChatMessageView message={turn.question} />
                              {turn.answer && <ChatMessageView message={turn.answer} />}
                            </div>
                          </details>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {currentTurn && (
                  <div className="current-turn">
                    <div className="current-turn-heading">Последний запрос</div>
                    <ChatMessageView message={currentTurn.question} />
                    {currentTurn.answer && <ChatMessageView message={currentTurn.answer} />}
                    {pending && (
                      <div className="message assistant">
                        <span className="message-avatar">✳</span>
                        <div className="loading-bubble">
                          <span /><span /><span /> Ищу актуальную информацию…
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="chat-bottom">
            <label className="code-row">
              <span>Код закрытого пилота</span>
              <input
                type="password"
                ref={codeRef}
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
