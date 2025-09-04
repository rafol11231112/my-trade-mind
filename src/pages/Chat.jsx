import { useState, useEffect, useRef } from 'react';
import { sendChatMessage } from '../scripts/chat-proxy';
import { useChatAutoload } from '../scripts/chat-autoload';
import { useNavigate } from 'react-router-dom';

export default function ChatPage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const chatboxRef = useRef(null);
  const navigate = useNavigate();

  const { loading, user, chatRef, mentorName = 'המנטור שלך' } = useChatAutoload({
    onMessage: (label, text, cls) => {
      setMessages(prev => [...prev, { label, text, cls }]);
    }
  });

  const lang = localStorage.getItem('lang') || 'he';
  const userLabel = lang === 'he' ? '🟢 אתה' : '🟢 You';
  const botLabel = lang === 'he' ? `🤖 ${mentorName}` : `🤖 ${mentorName}`;

  useEffect(() => {
    if (!user && !loading) {
      navigate('/login');
    }
  }, [user, loading,navigate]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const newMessages = [...messages, { label: userLabel, text: input, cls: 'user' }];
    setMessages(newMessages);
    setInput('');

    const loadingMsg = { label: botLabel, text: '🤔 חושב...', cls: 'bot', isLoading: true };
    setMessages(prev => [...prev, loadingMsg]);

    try {
      let rawHistory = [
        ...newMessages.map(m => ({
          role: m.cls === 'user' ? 'user' : 'assistant',
          content: m.text
        }))
      ];

      // Add system prompt for first message
      if (rawHistory.length === 1) {
        rawHistory.unshift({
          role: "system",
          content: `אתה "מנטור הקריפטו" - מנטור מקצועי מומחה בסחר במטבעות דיגיטליים וקריפטו מ-TradeMind. 

🎯 **התפקיד שלך:**
- מנטור אישי מנוסה עם 10+ שנות ניסיון בשוקי הקריפטו
- מומחה בביטקוין, אתריום, אלטקוינים, DeFi, NFTs וטכנולוגיות בלוקצ'יין
- מתמחה בניתוח טכני מתקדם, ניהול סיכונים וחשיבה אסטרטגית

📊 **התמחויות:**
- ניתוח טכני: תבניות, אינדיקטורים, רמות תמיכה והתנגדות
- ניהול סיכונים: position sizing, stop loss, take profit
- פסיכולוגיית מסחר: שליטה ברגשות, דיסציפלינה, FOMO/FUD
- אסטרטגיות מסחר: scalping, swing trading, hodling, DCA
- ניתוח יסודי: tokenomics, פרויקטים, חדשות שוק

💡 **סגנון התקשורת:**
- תמיד השב בעברית בצורה ידידותית אך מקצועית
- השתמש באמוג'י רלוונטיים (📈📉💎🚀⚡)
- תן דוגמאות קונקרטיות ומעשיות
- הזהר מפני סיכונים והדגש על חשיבות ניהול הסיכונים
- עודד למידה מתמשכת ותרגול

⚠️ **חשוב:** תמיד הדגש שהשוק מסוכן, אל תתן עצות השקעה ספציפיות, ותזכיר לא להשקיע יותר ממה שאפשר להרשות לעצמו להפסיד.`
        });
      }

      // Use direct OpenAI integration for development
      const { callOpenAIDirect } = await import('../scripts/openai-direct.js');
      const result = await callOpenAIDirect(rawHistory);
      const newReply = { label: botLabel, text: result.reply, cls: 'bot' };

      setMessages(prev =>
        prev.filter(m => !m.isLoading).concat(newReply)
      );

      localStorage.setItem('chatHistory', JSON.stringify([...rawHistory, { role: 'assistant', content: result.reply }]));
      if (chatRef) {
        const { set } = await import('firebase/database');
        await set(chatRef, { messages: [...rawHistory, { role: 'assistant', content: result.reply }] });
      }

    } catch (err) {
      console.error('❌ Error:', err);
      setMessages(prev =>
        prev.filter(m => !m.isLoading).concat({
          label: botLabel,
          text: 'מצטער, יש בעיה טכנית זמנית. איך אפשר לעזור?',
          cls: 'bot'
        })
      );
    }
  };

  const toggleLang = () => {
    const next = lang === 'he' ? 'en' : 'he';
    localStorage.setItem('lang', next);
    window.location.reload();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSend();
  };

  return (
    <div className="text-white min-h-screen flex flex-col bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#0f172a] relative">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-black/60 border-b border-gray-700">
        <a href="/" className="flex items-center gap-2">
          <img src="/homepage-media/logo.png" alt="Logo" className="h-8" />
          <img src="/homepage-media/TradeMind.svg" alt="TradeMind" className="h-6" />
        </a>
        <button onClick={toggleLang} className="bg-blue-700 text-sm px-2 py-1 rounded w-12">
          {lang === 'he' ? 'עברית' : 'EN'}
        </button>
      </header>

      {/* Chat Section */}
      <div className="max-w-3xl mx-auto mt-8 px-4 flex flex-col flex-grow">
        <div className="flex items-center gap-4 mb-6">
          <img src="/image/robot.png" className="w-16 h-16 rounded-full border-2 border-blue-500" alt="Mentor" />
          <div>
            <h2 className="text-lg font-bold">{mentorName}</h2>
            <p className="text-gray-300 text-sm">צ'אט עם המנטור שלך</p>
          </div>
        </div>

        <div ref={chatboxRef} className="flex-grow rounded-xl p-5 overflow-y-auto mb-4 space-y-3 border border-blue-900 shadow-inner bg-gray-900/50">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`message ${msg.cls} p-2 rounded bg-gray-800/80 border border-purple-600`}
            >
              <strong>{msg.label}:</strong> {msg.text}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="הקלד הודעה..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-grow p-3 rounded bg-white/10 text-black placeholder-gray-400 border border-gray-500/30"
          />
          <button
            onClick={handleSend}
            className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 px-4 py-2 rounded font-bold shadow-lg"
          >
            שלח
          </button>
        </div>
      </div>
    </div>
  );
}
