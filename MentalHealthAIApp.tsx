import React, { useState, useEffect, useRef, KeyboardEvent } from "react";

type Message = {
  id: number;
  role: "system" | "assistant" | "user";
  text: string;
  time: string;
};

type Payload = {
  messages: { role: string; text: string }[];
  settings: { tone: string };
  metadata: { userName: string };
};

const CRISIS_KEYWORDS = [
  "suicide",
  "kill myself",
  "end my life",
  "want to die",
  "hurt myself",
  "harm myself",
  "violent",
  "no reason to live",
];

function containsCrisis(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return CRISIS_KEYWORDS.some((kw) => lower.includes(kw));
}

export default function MentalHealthAIApp(): JSX.Element {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: "system",
      text:
        "You are a compassionate, nonjudgmental mental health assistant. Provide psychoeducation, empathic reflections, coping strategies, and encourage users to seek professional help when appropriate. If the user describes imminent danger or self-harm, immediately display crisis resources and encourage contacting local emergency services.",
      time: new Date().toISOString(),
    },
    {
      id: 1,
      role: "assistant",
      text:
        "Hi — I'm here to listen and to help you understand what's going on. You can share whatever you feel comfortable with. If this is an emergency or you're thinking of harming yourself, please tell me and I'll help you find immediate support.",
      time: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [showCrisisModal, setShowCrisisModal] = useState<boolean>(false);
  const [userName, setUserName] = useState<string>("");
  const [consentChecked, setConsentChecked] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [tone, setTone] = useState<string>("compassionate");
  const [error, setError] = useState<string | null>(null);
  const messageId = useRef<number>(2);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, loading]);

  function addMessage(role: Message["role"], text: string): Message {
    const m: Message = { id: messageId.current++, role, text, time: new Date().toISOString() };
    setMessages((prev) => [...prev, m]);
    return m;
  }

  async function handleSend(): Promise<void> {
    if (!input.trim()) return;
    setError(null);

    if (!consentChecked) {
      setError("Please confirm that you consent to have this conversation processed by the assistant.");
      return;
    }

    const userText = input.trim();
    addMessage("user", userText);
    setInput("");

    if (containsCrisis(userText)) {
      setShowCrisisModal(true);
    }

    setLoading(true);
    try {
      const payload: Payload = {
        messages: messages.concat([{ role: "user", text: userText }]).slice(-20),
        settings: { tone },
        metadata: { userName },
      };

      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const data = await res.json();
      if (data.flagged && !showCrisisModal) setShowCrisisModal(true);

      addMessage("assistant", data.reply || "Sorry — I couldn't generate a response.");
    } catch (e) {
      console.error(e);
      setError("Failed to reach the assistant. Try again later.");
      addMessage("assistant", "I'm having trouble right now. Please try again later.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSend();
    }
  }

  function downloadTranscript(): void {
    const txt = messages
      .map((m) => `[${new Date(m.time).toLocaleString()}] ${m.role.toUpperCase()}: ${m.text}`)
      .join("\n\n");
    const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-transcript-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row">
      <aside className="w-full lg:w-1/4 bg-white border-r p-4">
        <h2 className="text-xl font-semibold mb-2">Mindful — AI Mental Health Guide</h2>
        <p className="text-sm text-gray-600 mb-4">A supportive AI to help you understand emotions and learn coping strategies. Not a substitute for professional care.</p>

        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-700">Your name (optional)</label>
          <input value={userName} onChange={(e) => setUserName(e.target.value)} className="mt-1 p-2 border rounded w-full" placeholder="e.g., Alex" />
        </div>

        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-700">Tone</label>
          <select value={tone} onChange={(e) => setTone(e.target.value)} className="mt-1 p-2 border rounded w-full">
            <option value="compassionate">Compassionate (default)</option>
            <option value="practical">Practical / CBT-style</option>
            <option value="curious">Curious / Reflective</option>
          </select>
        </div>

        <div className="mb-4 text-sm">
          <label className="inline-flex items-center">
            <input type="checkbox" checked={consentChecked} onChange={(e) => setConsentChecked(e.target.checked)} className="mr-2" />
            I consent to processing for the purpose of receiving supportive responses.
          </label>
        </div>

        <div className="space-y-2">
          <button onClick={() => setSettingsOpen((s) => !s)} className="w-full p-2 bg-gray-100 rounded">{settingsOpen ? "Close" : "Open"} Settings</button>
          <button onClick={downloadTranscript} className="w-full p-2 bg-gray-100 rounded">Download transcript</button>
        </div>

        {settingsOpen && (
          <div className="mt-4 p-3 bg-gray-50 border rounded text-sm">
            <strong>How it works</strong>
            <p className="mt-2 text-xs text-gray-600">This UI sends recent messages to a backend AI. The backend should apply safety filters and not store personal data without consent.</p>
          </div>
        )}

        <div className="mt-6 text-xs text-gray-600 border-t pt-3">
          <strong>Emergency</strong>
          <p>If you are in immediate danger, call your local emergency number right away. If you're in immediate danger or thinking of harming yourself, please contact emergency services.</p>
        </div>

        <div className="mt-4 text-xs text-gray-600">
          <strong>Quick resources</strong>
          <ul className="list-disc ml-5 mt-2">
            <li><a href="#" onClick={(e)=>e.preventDefault()} className="underline">Crisis hotline list (configure per region)</a></li>
            <li><a href="#" onClick={(e)=>e.preventDefault()} className="underline">Find a therapist</a></li>
          </ul>
        </div>
      </aside>

      <main className="flex-1 p-4 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">Conversation</h3>
          <div className="text-sm text-gray-500">AI persona: <em>{tone}</em></div>
        </div>

        <div ref={listRef} className="flex-1 overflow-auto p-4 bg-white border rounded shadow-sm" style={{ minHeight: 300 }}>
          {messages.map((m) => (
            <div key={m.id} className={`mb-4 ${m.role === "user" ? "text-right" : "text-left"}`}>
              <div className={`inline-block p-3 rounded-lg ${m.role === "user" ? "bg-blue-50" : "bg-gray-100"}`}>
                <div className="text-xs text-gray-500 mb-1">{m.role.toUpperCase()} • {new Date(m.time).toLocaleTimeString()}</div>
                <div className="whitespace-pre-wrap">{m.text}</div>
              </div>
            </div>
          ))}

          {loading && <div className="mt-2 text-sm text-gray-500">Thinking...</div>}
        </div>

        <div className="mt-4 flex items-start gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Share what you're feeling or ask a question. (Press Cmd/Ctrl+Enter to send)"
            className="flex-1 p-3 border rounded resize-none h-24"
          />
          <div className="flex flex-col gap-2">
            <button onClick={handleSend} disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-50">Send</button>
            <button onClick={() => setInput('')} className="px-4 py-2 border rounded">Clear</button>
          </div>
        </div>

        {error && <div className="mt-2 text-sm text-red-600">{error}</div>}

        {showCrisisModal && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4">
            <div className="bg-white p-6 rounded shadow-lg max-w-xl w-full">
              <h4 className="text-lg font-semibold">If you're thinking about harming yourself</h4>
              <p className="mt-2 text-sm text-gray-700">I'm really sorry you're feeling this way. I can't provide emergency services, but I can help you find them. Please consider contacting your local emergency number or a crisis hotline right now.</p>
              <ul className="mt-3 list-disc ml-5 text-sm text-gray-700">
                <li>If you are in the United States, call or text 988 for the Suicide & Crisis Lifeline.</li>
                <li>If you are outside the U.S., please contact local emergency services or your country's crisis hotline. (Configure regionally.)</li>
              </ul>

              <div className="mt-4 flex justify-end gap-2">
                <button className="px-3 py-2 border rounded" onClick={() => setShowCrisisModal(false)}>Close</button>
                <button className="px-3 py-2 bg-red-600 text-white rounded" onClick={() => { window.open('tel:911'); }}>Call Emergency</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
