'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

// Парсить [текст](/шлях) у тексті повідомлення і рендерить як клікабельні посилання.
// Прибирає маркери **...** (жирний текст із markdown), залишаючи чистий текст.
function renderInline(text: string, keyPrefix: string) {
  const cleaned = text.replace(/\*\*/g, '');

  const linkRegex = /\[([^\]]+)\]\((\/[^\)]+)\)/g;
  const parts: (string | { label: string; href: string })[] = [];
  let lastIndex = 0;
  let match;

  while ((match = linkRegex.exec(cleaned)) !== null) {
    if (match.index > lastIndex) {
      parts.push(cleaned.slice(lastIndex, match.index));
    }
    parts.push({ label: match[1], href: match[2] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < cleaned.length) {
    parts.push(cleaned.slice(lastIndex));
  }

  return parts.map((part, i) =>
    typeof part === 'string' ? (
      <span key={`${keyPrefix}-${i}`}>{part}</span>
    ) : (
      <Link
        key={`${keyPrefix}-${i}`}
        href={part.href}
        style={{ color: '#ffd9a8', fontWeight: 600, textDecoration: 'underline' }}
      >
        {part.label}
      </Link>
    )
  );
}

// Парсить текст повідомлення: підтримує [текст](/шлях) посилання
// та рядки-марковані списки, що починаються з "* "
function renderMessageText(text: string) {
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let listBuffer: string[] = [];

  const flushList = (key: string) => {
    if (listBuffer.length > 0) {
      blocks.push(
        <ul key={`list-${key}`} style={{ margin: '4px 0', paddingLeft: '20px' }}>
          {listBuffer.map((item, idx) => (
            <li key={`list-${key}-item-${idx}`} style={{ marginBottom: '4px' }}>
              {renderInline(item, `list-${key}-${idx}`)}
            </li>
          ))}
        </ul>
      );
      listBuffer = [];
    }
  };

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    const isListItem = /^\*\s+(.*)/.test(line);

    if (isListItem) {
      const itemText = line.replace(/^\*\s+/, '');
      listBuffer.push(itemText);
      return;
    }

    flushList(String(idx));

    if (line.length === 0) {
      blocks.push(<div key={`br-${idx}`} style={{ height: '6px' }} />);
    } else {
      blocks.push(
        <div key={`line-${idx}`}>{renderInline(rawLine, `line-${idx}`)}</div>
      );
    }
  });

  flushList('end');

  return <>{blocks}</>;
}

const suggestedPrompts = [
  '📚 Порадь щось фентезійне',
  '🕵️ Що у вас є з детективів?',
  '💭 Хочу щось незвичне',
];

export default function AiWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      text: '👋 Привіт! Я AI-асистент ReadGrid. Яку книгу шукаєш?',
      timestamp: Date.now(),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      inputRef.current?.focus();
    }
  }, [messages, isOpen]);

  const sendMessage = async (text: string) => {
    const trimmedInput = text.trim();
    if (!trimmedInput || isLoading) return;

    const userMsg: Message = {
      role: 'user',
      text: trimmedInput,
      timestamp: Date.now(),
    };

    setInput('');
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    const history = messages.slice(-8).map((m) => ({ role: m.role, text: m.text }));

    try {
      // 🆕 Єдина реальна правка: додаємо токен, якщо він є —
      // бекенд сам перевіряє підпис і визначає роль (admin/superadmin),
      // щоб увімкнути розширений режим з статистикою платформи.
      const token = localStorage.getItem('readgrid_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: trimmedInput, history }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.text || `HTTP ${response.status}`);
      }

      const assistantMsg: Message = {
        role: 'assistant',
        text: data.text,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        role: 'assistant',
        text: err.message || '❌ Помилка з\'єднання. Спробуйте ще раз.',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const theme = {
    warmAccent: '#bf7a52',
    warmAccentHover: '#a16441',
    text: '#e2e8f0',
    cream: '#f4e9d8',
    assistantMsgBg: '#2d2d38',
    darkBg: '#1f1e24',
    borderColor: '#374151',
    inputBg: '#27272a',
    userMsgBg: '#bf7a52',
  };

  return (
    <>
      {/* Кнопка відкриття чату */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          backgroundColor: theme.warmAccent,
          color: theme.cream,
          border: 'none',
          fontSize: '28px',
          cursor: 'pointer',
          boxShadow: `0 4px 20px rgba(191, 122, 82, 0.5)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          transition: 'all 0.3s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.backgroundColor = theme.warmAccentHover;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.backgroundColor = theme.warmAccent;
        }}
        aria-label="Open AI Chat"
      >
        🤖
      </button>

      {/* Вікно чату */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '96px',
            right: '24px',
            width: '380px',
            height: '520px',
            maxWidth: 'calc(100vw - 48px)',
            maxHeight: 'calc(100vh - 120px)',
            background: theme.darkBg,
            color: theme.text,
            borderRadius: '20px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 9999,
            border: `1px solid ${theme.borderColor}`,
          }}
        >
          {/* Шапка чату */}
          <div
            style={{
              background: `linear-gradient(135deg, ${theme.warmAccent}, ${theme.warmAccentHover})`,
              color: theme.cream,
              padding: '16px 20px',
              fontWeight: 600,
              fontSize: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>🤖</span>
              <span>ReadGrid AI</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: theme.cream,
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
            >
              ✕
            </button>
          </div>

          {/* Список повідомлень */}
          <div
            style={{
              flex: 1,
              padding: '16px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              fontSize: '14px',
              lineHeight: '1.5',
            }}
          >
            {messages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  backgroundColor: msg.role === 'user' ? theme.userMsgBg : theme.assistantMsgBg,
                  color: theme.cream,
                  padding: '12px 16px',
                  borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  maxWidth: '85%',
                  wordBreak: 'break-word',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                }}
              >
                {msg.role === 'assistant' ? renderMessageText(msg.text) : msg.text}
              </div>
            ))}

            {/* Кнопки-підказки — тільки поки тільки перше привітальне повідомлення */}
            {messages.length === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                {suggestedPrompts.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(p.replace(/^\S+\s/, ''))}
                    disabled={isLoading}
                    style={{
                      background: 'rgba(191,122,82,0.15)',
                      border: '1px solid rgba(191,122,82,0.4)',
                      borderRadius: '10px',
                      padding: '8px 12px',
                      color: theme.cream,
                      fontSize: '13px',
                      textAlign: 'left',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}

            {/* Анімація завантаження */}
            {isLoading && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  backgroundColor: theme.assistantMsgBg,
                  padding: '12px 16px',
                  borderRadius: '18px 18px 18px 4px',
                  display: 'flex',
                  gap: '6px',
                  alignItems: 'center',
                }}
              >
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: theme.warmAccent,
                  animation: 'bounce 1.4s infinite ease-in-out both',
                }} />
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: theme.warmAccent,
                  animation: 'bounce 1.4s infinite ease-in-out both -0.32s',
                }} />
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: theme.warmAccent,
                  animation: 'bounce 1.4s infinite ease-in-out both -0.64s',
                }} />
                <style>{`
                  @keyframes bounce {
                    0%, 80%, 100% { transform: scale(0); }
                    40% { transform: scale(1); }
                  }
                `}</style>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Форма введення */}
          <form
            onSubmit={handleSend}
            style={{
              padding: '16px',
              borderTop: `1px solid ${theme.borderColor}`,
              display: 'flex',
              gap: '10px',
              background: '#18181b',
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Напишіть повідомлення..."
              disabled={isLoading}
              style={{
                flex: 1,
                background: theme.inputBg,
                border: `1px solid ${theme.borderColor}`,
                borderRadius: '12px',
                padding: '12px 16px',
                color: theme.cream,
                fontSize: '14px',
                outline: 'none',
                transition: 'all 0.2s',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = theme.warmAccent;
                e.currentTarget.style.boxShadow = `0 0 0 3px rgba(191, 122, 82, 0.1)`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = theme.borderColor;
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              style={{
                background: input.trim() && !isLoading ? theme.warmAccent : '#3f3f46',
                color: theme.cream,
                border: 'none',
                borderRadius: '12px',
                padding: '12px 20px',
                cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
                fontWeight: 600,
                fontSize: '18px',
                transition: 'all 0.2s',
                opacity: input.trim() && !isLoading ? 1 : 0.5,
              }}
              onMouseEnter={(e) => {
                if (input.trim() && !isLoading) {
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.background = theme.warmAccentHover;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.background = input.trim() && !isLoading ? theme.warmAccent : '#3f3f46';
              }}
            >
              ➤
            </button>
          </form>
        </div>
      )}
    </>
  );
}
