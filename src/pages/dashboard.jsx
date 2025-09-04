import "../styles/dashboard.css";
import React, { useEffect, useState,useRef, } from "react";
import { translatePage } from "../lang/translations.js";
import { auth, db, realtimeDb } from "../scripts/firebase-init.js";
import { onAuthStateChanged } from "firebase/auth";
import { ref, onValue, off } from "firebase/database";
import TradeModal from "../components/TradeModal";
import DailyJournalModal from "../components/DailyJournalModal";
import CalendarWithJournal from "../components/CalendarWithJournal";

import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  Title,
  CategoryScale,
  Tooltip,
  Legend,
} from "chart.js";
import { logout } from "../firebase/firebase-auth.js";

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  Title,
  CategoryScale,
  Tooltip,
  Legend
);

export default function Dashboard() {
  
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [isDailyJournalModalOpen, setIsDailyJournalModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
    const [isOpen, setIsOpen] = useState(false);
  const sidebarRef = useRef(null);
  const [trades, setTrades] = useState([]);
  const [tradesLoading, setTradesLoading] = useState(true);
  const [tradesError, setTradesError] = useState("");

  const currentUser = auth.currentUser;

  const toggleSidebar = () => {
    if (sidebarRef.current) {
      sidebarRef.current.classList.toggle("open");
       setIsOpen(!isOpen);

    }
  };
  const handleDayClick = (date) => {
    console.log(date);
    
    setSelectedDate(date);
    setIsDailyJournalModalOpen(true);
  };
  const currentUserRef = useRef(null); // מחזיק את המשתמש
  const [statusMessage] = useState("טוען...");

  useEffect(
() => {
  // כשיש יוזר – מחוברים לאוסף הטריידים שלו
  const unsub = onAuthStateChanged(auth, (user) => {
    if (!user) {
      setTrades([]);
      setTradesLoading(false);
      return;
    }
    setTradesLoading(true);
    
    // Use Realtime Database with user-specific path
    const tradesRef = ref(realtimeDb, `users/${user.uid}/trades`);
    const stop = onValue(
      tradesRef,
      (snapshot) => {
        const rows = [];
        if (snapshot.exists()) {
          const trades = snapshot.val();
          Object.entries(trades).forEach(([id, trade]) => {
            rows.push({ id, ...trade });
          });
          // Sort by timestamp descending and limit to 5
          rows.sort((a, b) => new Date(b.timestamp || b.createdAt || 0) - new Date(a.timestamp || a.createdAt || 0));
          rows.splice(5); // Keep only first 5
        }
        setTrades(rows);
        setTradesLoading(false);
        setTradesError("");
      },
      (err) => {
        console.error("Trades listener error:", err);
        setTradesError("שגיאה בטעינת העסקאות");
        setTradesLoading(false);
      }
    );
    // ניקוי מאזין קיים כשמשתמש משתנה
    currentUserRef.current = user;
    return () => off(tradesRef);
  });
  return () => unsub();
}, []);


  // פונקציות עזר נוספות יכולות להיות כאן בעתיד

  useEffect(() => {
    // אפשר לשלב כאן את כל לוגיקת הסקריפטים שייבאת
    // מומלץ להעביר פונקציונליות כבדה לקבצים נפרדים (hooks, context וכו')

    const mobileMenuBtn = document.getElementById("mobile-menu-btn");
    const sidebar = document.getElementById("sidebar");

    let currentUser = null;

    const sidebarItems = document.querySelectorAll(".sidebar-item");
    const sections = document.querySelectorAll(".section");

    function showSection(sectionId) {
      sections.forEach((section) => {
        section.classList.add("hidden");
      });

      const targetSection = document.getElementById(sectionId + "-section");
      if (targetSection) {
        targetSection.classList.remove("hidden");
      }

      sidebarItems.forEach((item) => {
        item.classList.remove("active");
      });

      const activeItem = document.querySelector(
        `[data-section="${sectionId}"]`
      );
      if (activeItem) {
        activeItem.classList.add("active");
      }
    }

    sidebarItems.forEach((item) => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        const sectionId = item.getAttribute("data-section");
        if (sectionId) {
          showSection(sectionId);
        }
      });
    });

    showSection("overview");

    const advancedChatInput = document.getElementById("advanced-chat-input");
    const advancedSendChatBtn = document.getElementById(
      "advanced-send-chat-btn"
    );
    const advancedChatMessages = document.getElementById(
      "advanced-chat-messages"
    );
    const clearChatBtn = document.getElementById("clear-chat-btn");
    const exportChatBtn = document.getElementById("export-chat-btn");
    const chatStatus = document.getElementById("chat-status");

    let advancedChatHistory = [];
    let chatDocument = null;
    let typingIndicator = null;

    onAuthStateChanged(auth, (user) => {
      if (user) {
        currentUser = user;
        console.log("✅ User authenticated:", user.email);
        updateChatStatus("מחובר - טוען צ'אט...");
        initializeUserChat();
      } else {
        currentUser = null;
        console.log("❌ User not authenticated");
        updateChatStatus("נדרש לוגין לשמירת צ'אט");
        showLoginMessage();
      }
    });

    async function initializeUserChat() {
      if (!currentUser) {
        console.error("❌ No current user for chat initialization");
        return;
      }

      try {
        console.log("🔄 Initializing chat for user:", currentUser.email);
        const chatRef = doc(db, "userChats", currentUser.uid);
        chatDocument = chatRef;

        const chatSnap = await getDoc(chatRef);

        if (chatSnap.exists()) {
          const data = chatSnap.data();
          advancedChatHistory = data.messages || [];
          console.log(
            "✅ Loaded existing chat from Firebase:",
            advancedChatHistory.length,
            "messages"
          );
          loadChatHistory();
        } else {
          console.log("📝 Creating new chat document...");
          await setDoc(chatRef, {
            userId: currentUser.uid,
            userEmail: currentUser.email,
            messages: [],
            createdAt: serverTimestamp(),
            lastUpdated: serverTimestamp(),
          });
          console.log("✅ Created new chat document successfully");
          advancedChatHistory = [];
          loadChatHistory();
        }

        updateChatStatus(`${advancedChatHistory.length} הודעות נטענו`);

        // const unsubscribe = onSnapshot(chatRef, (doc) => {
        //   if (doc.exists()) {
        //     const data = doc.data();
        //     const newMessages = data.messages || [];

        //     if (newMessages.length !== advancedChatHistory.length) {
        //       console.log('🔄 Real-time update: new messages detected');
        //       advancedChatHistory = newMessages;
        //       loadChatHistory();
        //       updateChatStatus(`${advancedChatHistory.length} הודעות`);
        //     }
        //   }
        // }, (error) => {
        //   console.error('❌ Real-time listener error:', error);
        //   if (error.code === 'permission-denied') {
        //     updateChatStatus('שגיאת הרשאות - עדכן הגדרות Firebase');
        //   } else {
        //     updateChatStatus('שגיאה בסינכרון צ\'אט');
        //   }
        // });
      } catch (error) {
        console.error("❌ Error initializing chat:", error);

        if (error.code === "permission-denied") {
          updateChatStatus("שגיאת הרשאות - נדרש עדכון Firebase");
          showPermissionError();
        } else if (error.code === "unavailable") {
          updateChatStatus("Firebase לא זמין - נסה שוב");
        } else {
          updateChatStatus("שגיאה בטעינת צ'אט");
        }
      }
    }

    function showPermissionError() {
      advancedChatMessages.innerHTML = `
        <div className="chat-bubble bot p-4 rounded-lg bg-red-900/20 border border-red-500/30 text-center">
          <p className="mb-3">🚫 שגיאת הרשאות Firebase</p>
          <p className="text-sm text-gray-400 mb-3">נדרש עדכון הגדרות המסד נתונים</p>
          <p className="text-xs text-gray-500">אנא פנה לאדמין לעדכון firestore.rules</p>
        </div>
      `;
    }

    async function saveMessageToFirebase(message, retryCount = 0) {
      if (!currentUser || !chatDocument) {
        console.error("❌ No user or chat document available");
        return false;
      }

      try {
        await updateDoc(chatDocument, {
          messages: arrayUnion(message),
          lastUpdated: serverTimestamp(),
        });
        console.log("💾 Message saved to Firebase successfully");
        return true;
      } catch (error) {
        console.error("❌ Error saving message:", error);

        if (error.code === "permission-denied") {
          updateChatStatus("שגיאת הרשאות - נדרש עדכון הגדרות Firebase");
          console.error(
            "🚫 Firebase permission denied - need to update Firestore rules"
          );
          return false;
        }

        if (error.code === "unavailable" && retryCount < 3) {
          console.log(`🔄 Retrying save (attempt ${retryCount + 1}/3)...`);
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * (retryCount + 1))
          );
          return await saveMessageToFirebase(message, retryCount + 1);
        }

        updateChatStatus("שגיאה בשמירת הודעה");
        return false;
      }
    }

    function showTypingIndicator() {
      if (typingIndicator) return;

      typingIndicator = document.createElement("div");
      typingIndicator.className = "typing-indicator mb-3";
      typingIndicator.innerHTML = `
        <div className="flex items-start gap-3">
          <i className="fas fa-robot text-purple-400 mt-1"></i>
          <div className="flex-1">
            <div className="flex gap-1">
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
            </div>
            <span className="text-xs text-gray-400 mt-1 block">המנטור כותב...</span>
          </div>
        </div>
      `;

      advancedChatMessages.appendChild(typingIndicator);
      advancedChatMessages.scrollTop = advancedChatMessages.scrollHeight;
    }

    function hideTypingIndicator() {
      if (typingIndicator) {
        typingIndicator.remove();
        typingIndicator = null;
      }
    }

    function addAdvancedMessage(
      content,
      isUser = false,
      timestamp = null,
      saveToFirebase = true
    ) {
      const messageDiv = document.createElement("div");
      messageDiv.className = `chat-bubble ${
        isUser ? "user" : "bot"
      } p-4 rounded-lg mb-3`;

      let msgTime;
      if (timestamp) {
        msgTime = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      } else {
        msgTime = new Date();
      }

      const timeString = msgTime.toLocaleTimeString("he-IL", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const dateString = msgTime.toLocaleDateString("he-IL");

      if (isUser) {
        messageDiv.innerHTML = `
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p>${content}</p>
              <span className="text-xs text-gray-300 mt-1 block">${timeString} - ${dateString}</span>
            </div>
            <i className="fas fa-user text-blue-400 mt-1"></i>
          </div>
        `;
      } else {
        messageDiv.innerHTML = `
          <div className="flex items-start gap-3">
            <i className="fas fa-robot text-purple-400 mt-1"></i>
            <div className="flex-1">
              <p>${content}</p>
              <span className="text-xs text-gray-300 mt-1 block">${timeString} - ${dateString}</span>
            </div>
          </div>
        `;
      }

      advancedChatMessages.appendChild(messageDiv);
      advancedChatMessages.scrollTop = advancedChatMessages.scrollHeight;
    }

    function showLoginMessage() {
      advancedChatMessages.innerHTML = `
        <div className="chat-bubble bot p-4 rounded-lg bg-gray-700/80 text-center">
          <p className="mb-3">🔐 נדרש לוגין לשמירת היסטוריית הצ'אט</p>
          <p className="text-sm text-gray-400">התחבר כדי לשמור את השיחות שלך לצמיתות</p>
          <a href="/register.html" className="inline-block mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            התחבר / הרשם
          </a>
        </div>
      `;
    }

    async function sendAdvancedMessageToAI(message) {
      if (!currentUser) {
        addAdvancedMessage("נדרש לוגין לשליחת הודעות");
        return;
      }

      const currentTime = new Date();

      const userMessage = {
        role: "user",
        content: message,
        timestamp: currentTime,
        userId: currentUser.uid,
      };

      try {
        const savedToFirebase = await saveMessageToFirebase(userMessage);
        advancedChatHistory.push(userMessage);

        if (!savedToFirebase) {
          console.log("📦 Falling back to localStorage");
          localStorage.setItem(
            `tradeMind_chat_${currentUser.uid}`,
            JSON.stringify(advancedChatHistory)
          );
        }

        showTypingIndicator();
        updateChatStatus("המנטור חושב...");

        let messagesToSend = [...advancedChatHistory];

        if (messagesToSend.length === 1) {
          messagesToSend.unshift({
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

⚠️ **חשוב:** תמיד הדגש שהשוק מסוכן, אל תתן עצות השקעה ספציפיות, ותזכיר לא להשקיע יותר ממה שאפשר להרשות לעצמו להפסיד.

משתמש: ${currentUser.email}
תאריך: ${currentTime.toLocaleDateString("he-IL")}`,
          });
        }

        const openAIMessages = messagesToSend.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

        // Import direct OpenAI integration
        const { callOpenAIDirect } = await import('../scripts/openai-direct.js');
        const data = await callOpenAIDirect(openAIMessages);
        const reply = data.reply;

        hideTypingIndicator();

        if (reply) {
          const aiMessage = {
            role: "assistant",
            content: reply,
            timestamp: new Date(),
            userId: currentUser.uid,
          };

          const savedToFirebase = await saveMessageToFirebase(aiMessage);
          advancedChatHistory.push(aiMessage);

          if (!savedToFirebase) {
            console.log("📦 Falling back to localStorage for AI message");
            localStorage.setItem(
              `tradeMind_chat_${currentUser.uid}`,
              JSON.stringify(advancedChatHistory)
            );
          }

          addAdvancedMessage(reply, false, aiMessage.timestamp, false);

          updateChatStatus(`${advancedChatHistory.length} הודעות`);
        } else {
          addAdvancedMessage("מצטער, היתה שגיאה בקבלת התגובה. נסה שוב.");
          updateChatStatus("שגיאה בתגובה");
        }
      } catch (error) {
        hideTypingIndicator();
        console.error("Advanced Chat error:", error);
        addAdvancedMessage("מצטער, לא הצלחתי להתחבר לשרת. נסה שוב מאוחר יותר.");
        updateChatStatus("שגיאה בחיבור");
      }
    }

    advancedSendChatBtn.addEventListener("click", async () => {
      const message = advancedChatInput.value.trim();
      if (message && currentUser) {
        advancedChatInput.disabled = true;
        advancedSendChatBtn.disabled = true;
        advancedSendChatBtn.innerHTML =
          '<i class="fas fa-spinner fa-spin"></i>';
        updateChatStatus("שולח הודעה...");

        const userMessageTime = new Date();
        addAdvancedMessage(message, true, userMessageTime, false);
        advancedChatInput.value = "";

        await sendAdvancedMessageToAI(message);

        advancedChatInput.disabled = false;
        advancedSendChatBtn.disabled = false;
        advancedSendChatBtn.innerHTML =
          '<i className="fas fa-paper-plane"></i>';
        advancedChatInput.focus();
      } else if (!currentUser) {
        updateChatStatus("נדרש לוגין לשליחת הודעות");
      }
    });

    advancedChatInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        advancedSendChatBtn.click();
      }
    });

    function loadChatHistory() {
      console.log("🔄 Loading chat history from Firebase...");

      advancedChatMessages.innerHTML = "";

      if (advancedChatHistory.length > 0) {
        console.log(
          "📚 Found",
          advancedChatHistory.length,
          "messages in history"
        );

        advancedChatHistory.forEach((msg) => {
          if (msg.role !== "system") {
            addAdvancedMessage(
              msg.content,
              msg.role === "user",
              msg.timestamp,
              false
            );
          }
        });

        console.log("✅ Chat history loaded successfully");
      } else {
        advancedChatMessages.innerHTML = `
          <div classNam="chat-bubble bot p-4 rounded-lg bg-gray-700/80">
            <p>שלום! אני המנטור הדיגיטלי שלך מ-TradeMind. איך אוכל לעזור לך היום?</p>
          </div>
        `;
        console.log("💬 No previous chat history found - showing welcome");
      }
    }

    function updateChatStatus(message) {
      if (chatStatus) {
        chatStatus.textContent = message;
      }
    }

    clearChatBtn.addEventListener("click", async () => {
      if (!currentUser) {
        alert("נדרש לוגין למחיקת היסטוריה");
        return;
      }

      if (
        window.confirm(
          "האם אתה בטוח שברצונך למחוק את כל היסטוריית הצ'אט? פעולה זו אינה ניתנת לביטול."
        )
      ) {
        try {
          await updateDoc(chatDocument, {
            messages: [],
            lastUpdated: serverTimestamp(),
          });

          advancedChatHistory = [];

          advancedChatMessages.innerHTML = `
            <div className="chat-bubble bot p-4 rounded-lg bg-gray-700/80">
              <p>שלום! אני המנטור הדיגיטלי שלך מ-TradeMind. איך אוכל לעזור לך היום?</p>
            </div>
          `;

          updateChatStatus("היסטוריה נמחקה - צ'אט מוכן");
          console.log("🗑️ Chat history cleared from Firebase");
        } catch (error) {
          console.error("Error clearing chat:", error);
          updateChatStatus("שגיאה במחיקת היסטוריה");
        }
      }
    });

    exportChatBtn.addEventListener("click", () => {
      if (!currentUser) {
        alert("נדרש לוגין לייצוא היסטוריה");
        return;
      }

      if (advancedChatHistory.length === 0) {
        alert("אין היסטוריית צ'אט לייצוא");
        return;
      }

      const exportData = {
        exportDate: new Date().toISOString(),
        platform: "TradeMind Advanced Dashboard",
        user: currentUser.email,
        userId: currentUser.uid,
        totalMessages: advancedChatHistory.length,
        conversations: advancedChatHistory.map((msg) => ({
          role: msg.role === "user" ? "משתמש" : "מנטור AI",
          content: msg.content,
          timestamp: msg.timestamp
            ? (msg.timestamp.toDate
                ? msg.timestamp.toDate()
                : new Date(msg.timestamp)
              ).toLocaleString("he-IL")
            : "לא זמין",
        })),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json;charset=utf-8",
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trademind-chat-${currentUser.uid}-${
        new Date().toISOString().split("T")[0]
      }.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      updateChatStatus("היסטוריה יוצאה בהצלחה");
      console.log("📥 Chat history exported");
    });

    mobileMenuBtn.addEventListener("click", () => {
      sidebar.classList.toggle("open");
    });

    // const calendarDays = document.querySelectorAll(".calendar-day");
    // calendarDays.forEach((day) => {
    //   day.addEventListener("click", () => {
    //     day.style.transform = "scale(0.95)";
    //     setTimeout(() => {
    //       day.style.transform = "scale(1)";
    //     }, 100);

    //     console.log("Day clicked:", day);
    //   });
    // });

    const tradeItems = document.querySelectorAll(".trade-item");
    tradeItems.forEach((item) => {
      item.addEventListener("click", () => {
        item.style.transform = "scale(0.98)";
        setTimeout(() => {
          item.style.transform = "scale(1)";
        }, 100);

        console.log("Trade clicked:", item);
      });
    });

    const emotions = [
      { emoji: "😊", text: "חיובי", color: "rgba(79, 95, 255, 0.6)" },
      { emoji: "😃", text: "מעולה", color: "rgba(16, 185, 129, 0.6)" },
      { emoji: "😐", text: "ניטרלי", color: "rgba(156, 163, 175, 0.6)" },
      { emoji: "😔", text: "שלילי", color: "rgba(239, 68, 68, 0.6)" },
      { emoji: "🤔", text: "מהרהר", color: "rgba(168, 85, 247, 0.6)" },
    ];

    let currentEmotionIndex = 0;
    const emotionFace = document.querySelector(".emotion-face");
    const emotionText = document.querySelector(
      ".text-lg.font-semibold.text-blue-400"
    );
    const glowFace = document.querySelector(".glow-face");

    function updateEmotion() {
      const emotion = emotions[currentEmotionIndex];

      emotionFace.textContent = emotion.emoji;
      emotionText.textContent = emotion.text;

      glowFace.style.boxShadow = `
        0 0 30px ${emotion.color},
        0 0 60px ${emotion.color.replace("0.6", "0.4")},
        inset 0 0 20px rgba(255, 255, 255, 0.1)
      `;

      currentEmotionIndex = (currentEmotionIndex + 1) % emotions.length;
    }

    setInterval(updateEmotion, 5000);

    glowFace.addEventListener("click", () => {
      updateEmotion();

      glowFace.style.transform = "scale(0.9)";
      setTimeout(() => {
        glowFace.style.transform = "scale(1)";
      }, 100);
    });

    let currentLanguage = "en";
    const languageToggle = document.getElementById("language-toggle");

    function switchLanguage() {
      currentLanguage = currentLanguage === "en" ? "he" : "en";

      translatePage(currentLanguage);

      const elementsWithLang = document.querySelectorAll("[data-en][data-he]");
      elementsWithLang.forEach((element) => {
        const text = element.getAttribute("data-" + currentLanguage);
        if (text) {
          element.textContent = text;
        }
      });

      const inputsWithPlaceholder = document.querySelectorAll(
        "[data-placeholder-en][data-placeholder-he]"
      );
      inputsWithPlaceholder.forEach((input) => {
        const placeholder = input.getAttribute(
          "data-placeholder-" + currentLanguage
        );
        if (placeholder) {
          input.placeholder = placeholder;
        }
      });

      const elementsWithTitle = document.querySelectorAll(
        "[data-title-en][data-title-he]"
      );
      elementsWithTitle.forEach((element) => {
        const title = element.getAttribute("data-title-" + currentLanguage);
        if (title) {
          element.title = title;
        }
      });

      console.log("🌐 Language switched to:", currentLanguage);
    }

    languageToggle.addEventListener("click", switchLanguage);

    console.log("🌐 Language initialized as:", currentLanguage);


    const tradesContainer = document.getElementById("trades-container");
    const noTradesMessage = document.getElementById("no-trades-message");

    function formatCurrency(amount) {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
      }).format(amount);
    }

    function formatDate(dateString) {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    }

    function createTradeElement(trade) {
      const profitClass =
        trade.pnl >= 0 ? "profit-positive" : "profit-negative";
      const profitSign = trade.pnl >= 0 ? "+" : "";
      const typeColor =
        trade.type === "LONG" ? "text-green-400" : "text-red-400";

      return `
        <div className="trade-item p-4 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-3">
              <span className="text-blue-400 font-bold">${trade.symbol}</span>
              <span className="${typeColor} text-sm font-semibold">${
        trade.type
      }</span>
            </div>
            <span className="${profitClass} px-3 py-1 rounded font-bold">
              ${profitSign}${formatCurrency(trade.pnl)}
            </span>
          </div>
          <div className="text-sm text-gray-400">
            Entry: ${formatCurrency(trade.entryPrice)} | Exit: ${formatCurrency(
        trade.exitPrice
      )} | Size: ${trade.quantity}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            ${formatDate(trade.date)} ${trade.notes ? "• " + trade.notes : ""}
          </div>
        </div>
      `;
    }

    async function loadTrades() {
      if (!currentUser) {
        console.log("🚫 No user logged in, cannot load trades");
        return;
      }

      try {
        console.log("📊 Loading trades for user:", currentUser.uid);

        const tradesCollection = collection(db, "userTrades");

        onSnapshot(tradesCollection, (snapshot) => {
          const userTrades = [];

          snapshot.forEach((doc) => {
            const tradeData = doc.data();
            if (tradeData.userId === currentUser.uid) {
              userTrades.push({ id: doc.id, ...tradeData });
            }
          });

          userTrades.sort((a, b) => {
            const aTime =
              a.timestamp?.toDate?.() || new Date(a.timestamp) || new Date();
            const bTime =
              b.timestamp?.toDate?.() || new Date(b.timestamp) || new Date();
            return bTime - aTime;
          });

          console.log("📈 Loaded trades:", userTrades.length);
          displayTrades(userTrades);
        });
      } catch (error) {
        console.error("❌ Error loading trades:", error);
      }
    }

    function displayTrades(trades) {
      if (trades.length === 0) {
        noTradesMessage.style.display = "block";
        tradesContainer.innerHTML = "";
        tradesContainer.appendChild(noTradesMessage);
        return;
      }

      noTradesMessage.style.display = "none";

      const recentTrades = trades.slice(0, 5);

      tradesContainer.innerHTML = recentTrades
        .map((trade) => createTradeElement(trade))
        .join("");

      console.log("✅ Displayed", recentTrades.length, "recent trades");
    }

    onAuthStateChanged(auth, (user) => {
      if (user) {
        currentUser = user;
        loadTrades();
        // updateCalendarWithJournalData();
      } else {
        currentUser = null;
        tradesContainer.innerHTML = "";
        tradesContainer.appendChild(noTradesMessage);
      }
    });

    function initializeAnalyticsCharts() {
      const pnlCanvas = document.getElementById("pnl-chart");
      const distributionCanvas = document.getElementById(
        "trade-distribution-chart"
      );
      const timeCanvas = document.getElementById("time-analysis-chart");

      if (pnlCanvas) {
        const pnlCtx = pnlCanvas.getContext("2d");
        new Chart(pnlCtx, {
          type: "line",
          data: {
            labels: [
              "Jan",
              "Feb",
              "Mar",
              "Apr",
              "May",
              "Jun",
              "Jul",
              "Aug",
              "Sep",
              "Oct",
              "Nov",
              "Dec",
            ],
            datasets: [
              {
                label: "P&L ($)",
                data: [
                  1200, 1900, 3000, 2500, 3800, 4200, 3600, 4800, 5200, 4600,
                  6100, 6800,
                ],
                borderColor: "#3b82f6",
                backgroundColor: "rgba(59, 130, 246, 0.1)",
                tension: 0.4,
                fill: true,
                pointBackgroundColor: "#3b82f6",
                pointBorderColor: "#1d4ed8",
                pointHoverBackgroundColor: "#60a5fa",
                pointHoverBorderColor: "#2563eb",
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                labels: {
                  color: "white",
                  font: { size: 14 },
                },
              },
            },
            scales: {
              x: {
                ticks: { color: "white" },
                grid: { color: "rgba(255, 255, 255, 0.1)" },
              },
              y: {
                ticks: {
                  color: "white",
                  callback: function (value) {
                    return "$" + value.toLocaleString();
                  },
                },
                grid: { color: "rgba(255, 255, 255, 0.1)" },
              },
            },
          },
        });
      }

      if (distributionCanvas) {
        const distributionCtx = distributionCanvas.getContext("2d");
        new Chart(distributionCtx, {
          type: "doughnut",
          data: {
            labels: ["Winning Trades", "Losing Trades", "Break Even"],
            datasets: [
              {
                data: [68, 25, 7],
                backgroundColor: [
                  "rgba(34, 197, 94, 0.8)",
                  "rgba(239, 68, 68, 0.8)",
                  "rgba(156, 163, 175, 0.8)",
                ],
                borderColor: [
                  "rgba(34, 197, 94, 1)",
                  "rgba(239, 68, 68, 1)",
                  "rgba(156, 163, 175, 1)",
                ],
                borderWidth: 3,
                hoverOffset: 10,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: "bottom",
                labels: {
                  color: "white",
                  padding: 20,
                  font: { size: 14 },
                },
              },
            },
          },
        });
      }

      if (timeCanvas) {
        const timeCtx = timeCanvas.getContext("2d");
        new Chart(timeCtx, {
          type: "bar",
          data: {
            labels: ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00"],
            datasets: [
              {
                label: "Success Rate (%)",
                data: [45, 62, 84, 78, 72, 58],
                backgroundColor: [
                  "rgba(34, 211, 238, 0.6)",
                  "rgba(34, 211, 238, 0.7)",
                  "rgba(34, 211, 238, 0.9)",
                  "rgba(34, 211, 238, 0.8)",
                  "rgba(34, 211, 238, 0.7)",
                  "rgba(34, 211, 238, 0.6)",
                ],
                borderColor: "rgba(34, 211, 238, 1)",
                borderWidth: 2,
                borderRadius: 4,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                labels: {
                  color: "white",
                  font: { size: 14 },
                },
              },
            },
            scales: {
              x: {
                ticks: { color: "white" },
                grid: { color: "rgba(255, 255, 255, 0.1)" },
              },
              y: {
                ticks: {
                  color: "white",
                  callback: function (value) {
                    return value + "%";
                  },
                },
                grid: { color: "rgba(255, 255, 255, 0.1)" },
              },
            },
          },
        });
      }
    }

    document.addEventListener("DOMContentLoaded", () => {
      setTimeout(initializeAnalyticsCharts, 1000);
    });

    const analyticsBtn = document.getElementById("analytics-btn");
    if (analyticsBtn) {
      analyticsBtn.addEventListener("click", () => {
        setTimeout(initializeAnalyticsCharts, 200);
      });
    }
  }, []);

  return (
    <div
      className="bg-black text-white min-h-screen animated-bg"
      style={{ position: "relative" }}
    >
      <div className="moving-grid"></div>
      <div className="floating-particles">
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
      </div>

      <button
        id="mobile-menu-btn"
                onClick={toggleSidebar}

        className="mobile-menu-btn fixed top-4 right-4 z-50 md:hidden action-btn p-3 rounded-lg shadow-2xl"
      >
        <i className={`fas ${isOpen ? 'fa-times' : 'fa-bars'} text-white`}></i>
      </button>

      <div
        id="sidebar"
        ref={sidebarRef}
        className="sidebar fixed right-0 top-0 h-full w-64 glass-effect z-40 transition-transform duration-300"
      >
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <img
              src="homepage-media/logo.png"
              alt="Logo"
              className="w-10 h-10"
            />
            <h1 className="text-xl font-bold">TradeMind</h1>
          </div>

          <div className="flex items-center justify-center mb-6">
            <button
              id="language-toggle"
              className="action-btn px-4 py-2 rounded-lg flex items-center gap-2"
            >
              <i className="fas fa-globe text-blue-400"></i>
              <span id="current-lang" data-i18n="langButton">
                English
              </span>
            </button>
          </div>

          <div className="flex items-center gap-3 mb-8 p-4 metric-card rounded-lg">
            <div className="w-12 h-12 bg-gradient-to-r from-gray-700 to-gray-900 rounded-full flex items-center justify-center border-2 border-white border-opacity-20">
              <i className="fas fa-user text-white"></i>
            </div>
            <div>
              <div
                id="user-name"
                className="font-semibold text-white"
                data-en="Pro User"
                data-he="משתמש פרו"
              >
                Pro User
              </div>
              <div
                className="text-sm text-gray-400"
                data-en="Trader"
                data-he="סוחר"
              >
                Trader
              </div>
            </div>
          </div>

          <nav className="space-y-2">
            <a
              href="/"
              className="sidebar-item active flex items-center gap-3 p-3 rounded-lg"
              data-section="overview"
            >
              <i className="fas fa-chart-line w-5"></i>
              <span data-i18n="overview">Overview</span>
            </a>
            <a
              href="/"
              className="sidebar-item flex items-center gap-3 p-3 rounded-lg"
              data-section="trades"
            >
              <i className="fas fa-exchange-alt w-5"></i>
              <span data-i18n="tradeJournal">Trade Journal</span>
            </a>
            <a
              href="/"
              className="sidebar-item flex items-center gap-3 p-3 rounded-lg"
              data-section="analytics"
            >
              <i className="fas fa-chart-bar w-5"></i>
              <span data-i18n="analytics">Analytics</span>
            </a>
            <a
              href="/"
              className="sidebar-item flex items-center gap-3 p-3 rounded-lg"
              data-section="chat"
            >
              <i className="fas fa-comments w-5"></i>
              <span data-i18n="aiMentor">AI Mentor</span>
              <span className="notification-dot w-2 h-2 bg-green-500 rounded-full"></span>
            </a>
            <a
              href="/"
              className="sidebar-item flex items-center gap-3 p-3 rounded-lg"
              data-section="portfolio"
            >
              <i className="fas fa-wallet w-5"></i>
              <span data-i18n="portfolio">Portfolio</span>
            </a>
            <a
              href="/"
              className="sidebar-item flex items-center gap-3 p-3 rounded-lg"
              data-section="education"
            >
              <i className="fas fa-graduation-cap w-5"></i>
              <span data-i18n="education">Education</span>
            </a>
            <a
              href="/"
              className="sidebar-item flex items-center gap-3 p-3 rounded-lg"
              data-section="settings"
            >
              <i className="fas fa-cog w-5"></i>
              <span data-i18n="settings">Settings</span>
            </a>
          </nav>

          <div className="absolute bottom-6 left-6 right-6">
            <button
            onClick={()=> logout()}
              id="logout-btn"
              className="w-full flex items-center gap-3 p-3 text-red-400 hover:bg-red-500/20 rounded-lg transition"
            >
              <i className="fas fa-sign-out-alt w-5"></i>
              <span data-en="Logout" data-he="התנתק">
                Logout
              </span>
            </button>
          </div>
        </div>
      </div>

      <div
        className="main-content mr-0 md:mr-64 min-h-screen transition-all duration-300"
        style={{ position: "relative", zIndex: "2" }}
      >
        <div id="overview-section" className="section p-6">
          <div className="professional-header flex flex-col lg:flex-row justify-between items-start lg:items-center mb-4 md:mb-8 p-4 md:p-6 rounded-xl">
            <div className="mb-4 lg:mb-0">
              <h1
                className="text-2xl md:text-4xl font-bold mb-2 text-white"
                data-i18n="dashboard"
              >
                Dashboard
              </h1>
              <p
                className="text-sm md:text-base text-gray-300"
                data-i18n="detailedTracking"
              >
                Detailed performance tracking
              </p>
            </div>

            <div className="flex gap-2 md:gap-3 w-full lg:w-auto">
              <button
                onClick={() => setIsTradeModalOpen(true)}
                className="action-btn primary px-3 md:px-6 py-2 md:py-3 rounded-lg flex items-center gap-2 flex-1 lg:flex-none justify-center"
              >
                <i className="fas fa-plus"></i>
                <span className="hidden sm:inline" data-i18n="addTradeBtn">
                  Add Trade
                </span>
              </button>
              <button 
                    onClick={() => setIsDailyJournalModalOpen(true)}
              className="action-btn success px-3 md:px-6 py-2 md:py-3 rounded-lg flex items-center gap-2 flex-1 lg:flex-none justify-center">
                <i className="fas fa-calendar-plus"></i>
                <span className="hidden sm:inline" data-i18n="logDay">
                  Log Day
                </span>
              </button>
              <button className="action-btn px-3 md:px-6 py-2 md:py-3 rounded-lg flex items-center gap-2 flex-1 lg:flex-none justify-center">
                <i className="fas fa-download"></i>
                <span className="hidden sm:inline" data-i18n="exportData">
                  Export Data
                </span>
              </button>
            </div>
          </div>

          <div className="mb-4 md:mb-8">
            <div className="flex items-center gap-4 metric-card p-3 md:p-4 rounded-lg w-full md:w-fit cursor-pointer hover:bg-opacity-80 transition-all">
              <i className="fas fa-calendar text-white"></i>
              <span
                className="text-base md:text-lg font-semibold text-white"
                data-en="June 2025 - July 2025"
                data-he="יוני 2025 - יולי 2025"
              >
                June 2025 - July 2025
              </span>
              <i className="fas fa-chevron-down text-gray-300 ml-auto"></i>
            </div>
          </div>
          <div className="p-4 md:p-6">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-8">
              {/* Calendar and Journal */}
              <div className="xl:col-span-2">
                <CalendarWithJournal
                  currentUser={currentUser}
                  currentDate={new Date()}
                  onDayClick={handleDayClick}
                />
              </div>

              {/* Recent Trades */}
<div className="xl:col-span-1">
  <div className="glass-effect p-4 md:p-6 rounded-xl">
    <h3
      className="text-lg md:text-xl font-bold mb-4 md:mb-6 metric-number"
      data-en="Recent Trades"
      data-he="עסקאות אחרונות"
    >
      Recent Trades
    </h3>

    <div className="space-y-3" id="trades-container">
      {tradesLoading && (
        <div className="text-center py-6 text-gray-400">
          טוען עסקאות…
        </div>
      )}

      {!tradesLoading && tradesError && (
        <div className="text-center py-6 text-red-400">
          {tradesError}
        </div>
      )}

      {!tradesLoading && !tradesError && trades.length === 0 && (
        <div id="no-trades-message" className="text-center py-8 text-gray-400">
          <i className="fas fa-chart-line text-4xl mb-4 opacity-50" />
          <p data-i18n="noTradesYet">No trades yet. Add your first trade!</p>
        </div>
      )}

      {!tradesLoading &&
        !tradesError &&
        trades.map((trade) => {
          const pnlPositive = (trade.pnl ?? 0) >= 0;
          const profitClass = pnlPositive ? "profit-positive" : "profit-negative";
          const typeColor = trade.type === "LONG" ? "text-green-400" : "text-red-400";

          const fmt = new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
          });
          const entry = trade.entryPrice != null ? fmt.format(trade.entryPrice) : "-";
          const exit = trade.exitPrice != null ? fmt.format(trade.exitPrice) : "-";
          const pnl = trade.pnl != null ? fmt.format(trade.pnl) : "-";

          let dateLabel = "";
          if (trade.timestamp?.toDate) {
            dateLabel = trade.timestamp.toDate().toLocaleDateString("en-US");
          } else if (trade.timestamp) {
            const d = new Date(trade.timestamp);
            if (!isNaN(d)) dateLabel = d.toLocaleDateString("en-US");
          }

          return (
            <div
              key={trade.id}
              className="trade-item p-4 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
            >
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-blue-400 font-bold">
                    {trade.symbol || "—"}
                  </span>
                  <span className={`${typeColor} text-sm font-semibold`}>
                    {trade.type || ""}
                  </span>
                </div>
                <span className={`${profitClass} px-3 py-1 rounded font-bold`}>
                  {pnlPositive ? "+" : ""}
                  {pnl}
                </span>
              </div>

              <div className="text-sm text-gray-400">
                Entry: {entry} | Exit: {exit} | Size: {trade.quantity ?? "-"}
              </div>

              <div className="text-xs text-gray-500 mt-1">
                {dateLabel} {trade.notes ? `• ${trade.notes}` : ""}
              </div>
            </div>
          );
        })}
    </div>
  </div>


              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mt-4 md:mt-8">
            <div className="metric-card p-4 md:p-6 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <h3
                  className="text-lg font-semibold"
                  data-en="Win Rate"
                  data-he="אחוז זכייה"
                >
                  Win Rate
                </h3>
                <i className="fas fa-trophy text-yellow-400"></i>
              </div>
              <div className="flex flex-col items-center">
                <div className="text-6xl font-bold metric-number mb-2">
                  60.0%
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-green-400">↗</span>
                  <span
                    className="text-gray-400"
                    data-en="+5% this week"
                    data-he="+5% השבוע"
                  >
                    +5% this week
                  </span>
                </div>

                <div className="w-full bg-gray-700 rounded-full h-2 mt-4">
                  <div
                    className="win-rate-progress h-2 rounded-full"
                    style={{ width: "60%" }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="metric-card p-4 md:p-6 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <h3
                  className="text-lg font-semibold"
                  data-en="Avg Win/Loss"
                  data-he="ממוצע רווח/הפסד"
                >
                  Avg Win/Loss
                </h3>
                <i className="fas fa-balance-scale text-purple-400"></i>
              </div>
              <div className="flex flex-col items-center">
                <div className="text-6xl font-bold metric-number mb-2">1.8</div>
                <div className="flex items-center gap-2 text-sm mb-4">
                  <span className="text-blue-400">⚖️</span>
                  <span
                    className="text-gray-400"
                    data-en="Good Ratio"
                    data-he="יחס טוב"
                  >
                    Good Ratio
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 w-full text-xs">
                  <div className="text-center p-2 bg-green-500/20 rounded">
                    <div className="text-green-400 font-bold">$2,840</div>
                    <div
                      className="text-gray-400"
                      data-en="Avg Profit"
                      data-he="רווח ממוצע"
                    >
                      Avg Profit
                    </div>
                  </div>
                  <div className="text-center p-2 bg-red-500/20 rounded">
                    <div className="text-red-400 font-bold">$1,580</div>
                    <div
                      className="text-gray-400"
                      data-en="Avg Loss"
                      data-he="הפסד ממוצע"
                    >
                      Avg Loss
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="metric-card p-4 md:p-8 rounded-xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold metric-number">
                  Tradepath Score
                </h3>
                <i className="fas fa-chart-radar text-blue-400 text-xl"></i>
              </div>
              <div className="radar-chart h-32 md:h-48 rounded-lg flex items-center justify-center relative mb-4 md:mb-6">
                <svg viewBox="0 0 200 200" className="w-full h-full">
                  <polygon
                    points="100,15 160,45 160,155 100,185 40,155 40,45"
                    fill="none"
                    stroke="rgba(59, 130, 246, 0.4)"
                    strokeWidth="2"
                  />
                  <polygon
                    points="100,35 140,55 140,145 100,165 60,145 60,55"
                    fill="none"
                    stroke="rgba(99, 102, 241, 0.3)"
                    strokeWidth="1.5"
                  />
                  <polygon
                    points="100,55 120,70 120,130 100,145 80,130 80,70"
                    fill="none"
                    stroke="rgba(139, 92, 246, 0.2)"
                    strokeWidth="1"
                  />

                  <defs>
                    <linearGradient
                      id="tradepathGradient"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="100%"
                    >
                      <stop
                        offset="0%"
                        style={{ stopColor: "#3b82f6", stopOpacity: "0.5" }}
                      />
                      <stop
                        offset="33%"
                        style={{ stopColor: "#6366f1", stopOpacity: 0.4 }}
                      />
                      <stop
                        offset="66%"
                        style={{ stopColor: "#8b5cf6", stopOpacity: 0.3 }}
                      />
                      <stop
                        offset="100%"
                        style={{ stopColor: "#a855f7", stopOpacity: 0.2 }}
                      />
                    </linearGradient>
                  </defs>
                  <polygon
                    points="100,25 145,50 135,140 100,160 65,135 55,60"
                    fill="url(#tradepathGradient)"
                    stroke="#3b82f6"
                    strokeWidth="3"
                  />

                  <circle
                    cx="100"
                    cy="25"
                    r="4"
                    fill="#3b82f6"
                    style={{ filter: "drop-shadow(0 0 8px #3b82f6)" }}
                  />
                  <text
                    x="100"
                    y="10"
                    textAnchor="middle"
                    fill="#60a5fa"
                    fontSize="9"
                    fontWeight="bold"
                  >
                    Win %
                  </text>

                  <circle
                    cx="145"
                    cy="50"
                    r="4"
                    fill="#6366f1"
                    style={{ filter: "drop-shadow(0 0 8px #6366f1)" }}
                  />
                  <text
                    x="165"
                    y="50"
                    textAnchor="start"
                    fill="#a5b4fc"
                    fontSize="8"
                    fontWeight="bold"
                  >
                    Profit
                  </text>
                  <text
                    x="165"
                    y="60"
                    textAnchor="start"
                    fill="#a5b4fc"
                    fontSize="8"
                    fontWeight="bold"
                  >
                    Factor
                  </text>

                  <circle
                    cx="135"
                    cy="140"
                    r="4"
                    fill="#8b5cf6"
                    style={{ filter: "drop-shadow(0 0 8px #8b5cf6)" }}
                  />
                  <text
                    x="150"
                    y="145"
                    textAnchor="start"
                    fill="#c4b5fd"
                    fontSize="9"
                    fontWeight="bold"
                  >
                    R:R
                  </text>

                  <circle
                    cx="100"
                    cy="160"
                    r="4"
                    fill="#a855f7"
                    style={{ filter: "drop-shadow(0 0 8px #a855f7)" }}
                  />
                  <text
                    x="100"
                    y="180"
                    textAnchor="middle"
                    fill="#d8b4fe"
                    fontSize="8"
                    fontWeight="bold"
                  >
                    Drawdown
                  </text>

                  <circle
                    cx="65"
                    cy="135"
                    r="4"
                    fill="#8b5cf6"
                    style={{ filter: "drop-shadow(0 0 8px #8b5cf6)" }}
                  />
                  <text
                    x="35"
                    y="140"
                    textAnchor="end"
                    fill="#c4b5fd"
                    fontSize="8"
                    fontWeight="bold"
                  >
                    Consistency
                  </text>

                  <circle
                    cx="55"
                    cy="60"
                    r="4"
                    fill="#6366f1"
                    style={{ filter: "drop-shadow(0 0 8px #6366f1)" }}
                  />
                  <text
                    x="25"
                    y="55"
                    textAnchor="end"
                    fill="#a5b4fc"
                    fontSize="8"
                    fontWeight="bold"
                  >
                    Rule
                  </text>
                  <text
                    x="25"
                    y="65"
                    textAnchor="end"
                    fill="#a5b4fc"
                    fontSize="8"
                    fontWeight="bold"
                  >
                    Adherence
                  </text>
                </svg>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold metric-number mb-2">
                  Score: 8.7/10
                </div>
                <div
                  className="text-sm text-gray-300"
                  data-en="Excellent Performance"
                  data-he="ביצועים מצוינים"
                >
                  Excellent Performance
                </div>
              </div>
            </div>

            <div className="metric-card p-4 md:p-6 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <h3
                  className="text-lg font-semibold"
                  data-en="Emotional Average"
                  data-he="ממוצע רגשות"
                >
                  Emotional Average
                </h3>
                <i className="fas fa-info-circle text-blue-400"></i>
              </div>
              <div className="flex items-center justify-center">
                <div className="emotion-indicator w-32 h-32 rounded-xl flex items-center justify-center">
                  <div className="space-stars"></div>

                  <div className="grid-overlay"></div>

                  <div className="corner-glow"></div>

                  <div className="glow-face">
                    <div className="emotion-face">😊</div>
                  </div>
                </div>
              </div>

              <div className="text-center mt-3">
                <div
                  className="text-sm text-gray-400"
                  data-en="Overall Mood"
                  data-he="מצב רוח כללי"
                >
                  Overall Mood
                </div>
                <div
                  className="text-lg font-semibold text-blue-400"
                  data-en="Positive"
                  data-he="חיובי"
                >
                  Positive
                </div>
              </div>
            </div>
          </div>
        </div>

        <div id="trades-section" className="section p-6 hidden">
          <div className="professional-header p-6 rounded-xl mb-8">
            <h1
              className="text-4xl font-bold mb-2 text-white"
              data-en="Trade Journal"
              data-he="יומן עסקאות"
            >
              Trade Journal
            </h1>
            <p
              className="text-gray-300"
              data-en="Detailed tracking of all your trades"
              data-he="מעקב מפורט אחר כל העסקאות שלך"
            >
              Detailed tracking of all your trades
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="metric-card p-6 rounded-xl">
                <h3
                  className="text-xl font-bold mb-6 metric-number"
                  data-i18n="recentTrades"
                >
                  Recent Trades
                </h3>
                <div id="trades-container" className="space-y-4">
                  <div
                    id="no-trades-message"
                    className="text-center py-8 text-gray-400"
                  >
                    <i className="fas fa-chart-line text-4xl mb-4 opacity-50"></i>
                    <p data-i18n="noTradesYet">
                      No trades yet. Add your first trade!
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="metric-card p-6 rounded-xl">
                <h3
                  className="text-xl font-bold mb-6 metric-number"
                  data-i18n="tradeJournal"
                >
                  Trade Journal
                </h3>
                <p
                  className="text-gray-400 mb-6"
                  data-i18n="detailedTradeTracking"
                >
                  Detailed tracking of all your trades
                </p>
                <button
                   onClick={() => setIsTradeModalOpen(true)}
                  id="open-trade-modal"
                  className="action-btn primary w-full py-4 rounded-lg flex items-center justify-center gap-3"
                >
                  <i className="fas fa-plus text-xl"></i>
                  <span data-i18n="addNewTrade">Add New Trade</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div id="analytics-section" className="section p-6 hidden">
          <div className="professional-header p-6 rounded-xl mb-8">
            <h1
              className="text-4xl font-bold mb-2 text-white"
              data-en="Advanced Analytics"
              data-he="אנליטיקה מתקדמת"
            >
              Advanced Analytics
            </h1>
            <p
              className="text-gray-300"
              data-en="In-depth analysis of your performance"
              data-he="ניתוח מעמיק של הביצועים שלך"
            >
              In-depth analysis of your performance
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="metric-card p-6 rounded-xl">
              <h3
                className="text-xl font-bold mb-6 metric-number"
                data-en="P&L Chart"
                data-he="גרף P&L"
              >
                P&L Chart
              </h3>
              <div className="h-64 bg-gray-800/50 rounded-lg flex items-center justify-center">
                <span className="text-gray-500">גרף P&L יוצג כאן</span>
              </div>
            </div>

            <div className="metric-card p-6 rounded-xl">
              <h3 className="text-xl font-bold mb-6 metric-number">
                התפלגות עסקאות
              </h3>
              <div className="h-64 bg-gray-800/50 rounded-lg flex items-center justify-center">
                <span className="text-gray-500">גרף התפלגות יוצג כאן</span>
              </div>
            </div>
          </div>
        </div>

        <div id="chat-section" className="section p-6 hidden">
          <div className="professional-header p-6 rounded-xl mb-8">
            <h1
              className="text-4xl font-bold mb-2 text-white"
              data-en="AI Mentor Chat"
              data-he="צ'אט מנטור"
            >
              AI Mentor Chat
            </h1>
            <p
              className="text-gray-300"
              data-en="Chat with your digital mentor"
              data-he="שוחח עם המנטור הדיגיטלי שלך"
            >
              Chat with your digital mentor
            </p>
          </div>

          <div className="metric-card p-6 rounded-xl max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm text-gray-400" id="chat-status">
              {statusMessage}
              </div>
              <div className="flex gap-2">
                <button
                  id="clear-chat-btn"
                  className="action-btn text-xs px-3 py-1 rounded"
                  title="Clear History"
                  data-title-en="Clear History"
                  data-title-he="נקה היסטוריה"
                >
                  <i className="fas fa-trash text-red-400"></i>
                </button>
                <button
                  id="export-chat-btn"
                  className="action-btn text-xs px-3 py-1 rounded"
                  title="Export Chat"
                  data-title-en="Export Chat"
                  data-title-he="ייצא צ'אט"
                >
                  <i className="fas fa-download text-blue-400"></i>
                </button>
              </div>
            </div>

            <div
              id="advanced-chat-messages"
              className="h-96 overflow-y-auto mb-4 space-y-4"
            >
              <div className="chat-bubble bot p-4 rounded-lg bg-gray-700/80">
                <p>
                  שלום! אני המנטור הדיגיטלי שלך מ-TradeMind. איך אוכל לעזור לך
                  היום?
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <input
                id="advanced-chat-input"
                type="text"
                placeholder="Type a message..."
                data-i18n-placeholder="typeMessage"
                className="flex-1 p-3 bg-gray-700 rounded-lg"
              />
              <button
                id="advanced-send-chat-btn"
                className="action-btn primary px-6 py-3 rounded-lg"
              >
                <i className="fas fa-paper-plane"></i>
              </button>
            </div>
          </div>
        </div>

        <div id="portfolio-section" className="section p-6 hidden">
          <div className="professional-header p-6 rounded-xl mb-8">
            <h1
              className="text-4xl font-bold mb-2 text-white"
              data-en="Portfolio"
              data-he="תיק השקעות"
            >
              Portfolio
            </h1>
            <p
              className="text-gray-300"
              data-en="Overview of your investment portfolio"
              data-he="סקירה של תיק ההשקעות שלך"
            >
              Overview of your investment portfolio
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="metric-card p-6 rounded-xl">
              <h3
                className="text-lg font-semibold mb-4"
                data-en="Total Value"
                data-he="שווי כולל"
              >
                Total Value
              </h3>
              <div className="text-4xl font-bold metric-number">$125,430</div>
              <div
                className="text-green-400 text-sm mt-2"
                data-en="+8.5% this month"
                data-he="+8.5% החודש"
              >
                +8.5% this month
              </div>
            </div>

            <div className="metric-card p-6 rounded-xl">
              <h3
                className="text-lg font-semibold mb-4"
                data-en="Daily P&L"
                data-he="רווח/הפסד יומי"
              >
                Daily P&L
              </h3>
              <div className="text-4xl font-bold text-green-400">+$2,840</div>
              <div
                className="text-gray-400 text-sm mt-2"
                data-en="+2.3% today"
                data-he="+2.3% היום"
              >
                +2.3% today
              </div>
            </div>

            <div className="metric-card p-6 rounded-xl">
              <h3
                className="text-lg font-semibold mb-4"
                data-en="Open Positions"
                data-he="פוזיציות פתוחות"
              >
                Open Positions
              </h3>
              <div className="text-4xl font-bold metric-number">12</div>
              <div
                className="text-blue-400 text-sm mt-2"
                data-en="8 Long, 4 Short"
                data-he="8 Long, 4 Short"
              >
                8 Long, 4 Short
              </div>
            </div>
          </div>
        </div>

        <div id="education-section" className="section p-6 hidden">
          <div className="professional-header p-6 rounded-xl mb-8">
            <h1
              className="text-4xl font-bold mb-2 text-white"
              data-en="Education Center"
              data-he="מרכז למידה"
            >
              Education Center
            </h1>
            <p
              className="text-gray-300"
              data-en="Improve your trading skills"
              data-he="שפר את כישורי המסחר שלך"
            >
              Improve your trading skills
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="metric-card p-6 rounded-xl">
              <h3
                className="text-xl font-bold mb-6 metric-number"
                data-en="Recommended Courses"
                data-he="קורסים מומלצים"
              >
                Recommended Courses
              </h3>
              <div className="space-y-4">
                <div className="p-4 bg-gray-700/50 rounded-lg">
                  <h4
                    className="font-bold text-blue-400"
                    data-en="Technical Analysis"
                    data-he="ניתוח טכני"
                  >
                    Technical Analysis
                  </h4>
                  <p
                    className="text-sm text-gray-400 mt-2"
                    data-en="Learn to identify patterns and trading signals"
                    data-he="למד לזהות דפוסים ואותות מסחר"
                  >
                    Learn to identify patterns and trading signals
                  </p>
                </div>
                <div className="p-4 bg-gray-700/50 rounded-lg">
                  <h4
                    className="font-bold text-purple-400"
                    data-en="Risk Management"
                    data-he="ניהול סיכונים"
                  >
                    Risk Management
                  </h4>
                  <p
                    className="text-sm text-gray-400 mt-2"
                    data-en="Strategies to protect your capital"
                    data-he="אסטרטגיות להגנה על ההון"
                  >
                    Strategies to protect your capital
                  </p>
                </div>
              </div>
            </div>

            <div className="metric-card p-6 rounded-xl">
              <h3
                className="text-xl font-bold mb-6 metric-number"
                data-en="The Winning Circle"
                data-he="המעגל המנצח"
              >
                The Winning Circle
              </h3>
              <div className="h-48 bg-gray-800/50 rounded-lg flex items-center justify-center">
                <span
                  className="text-gray-500"
                  data-en="Educational content will be displayed here"
                  data-he="תוכן חינוכי יוצג כאן"
                >
                  Educational content will be displayed here
                </span>
              </div>
            </div>
          </div>
        </div>

        <div id="settings-section" className="section p-6 hidden">
          <div className="professional-header p-6 rounded-xl mb-8">
            <h1
              className="text-4xl font-bold mb-2 text-white"
              data-i18n="settings"
            >
              Settings
            </h1>
            <p className="text-gray-300" data-i18n="customizePlatform">
              Customize the platform to your needs
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="metric-card p-6 rounded-xl">
              <h3
                className="text-xl font-bold mb-6 metric-number"
                data-i18n="generalSettings"
              >
                General Settings
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span data-i18n="language">Language</span>
                  <select className="bg-gray-700 p-2 rounded">
                    <option data-i18n="hebrew">עברית</option>
                    <option>English</option>
                  </select>
                </div>
                <div className="flex justify-between items-center">
                  <span data-i18n="currency">Currency</span>
                  <select className="bg-gray-700 p-2 rounded">
                    <option>USD</option>
                    <option>EUR</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="metric-card p-6 rounded-xl">
              <h3
                className="text-xl font-bold mb-6 metric-number"
                data-i18n="notifications"
              >
                Notifications
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span data-i18n="emailNotifications">
                    Email Notifications
                  </span>
                  <input type="checkbox"  className="toggle" />
                </div>
                <div className="flex justify-between items-center">
                  <span data-i18n="browserNotifications">
                    Browser Notifications
                  </span>
                  <input type="checkbox" className="toggle" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <DailyJournalModal
        isOpen={isDailyJournalModalOpen}
        onClose={() => setIsDailyJournalModalOpen(false)}
        currentDate={selectedDate} // או תאריך אחר שנבחר
        // refreshCalendar={updateCalendarWithJournalData}
      />
      <TradeModal
        isOpen={isTradeModalOpen}
        onClose={() => setIsTradeModalOpen(false)}
      />
    </div>
  );
}
