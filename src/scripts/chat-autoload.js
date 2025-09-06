import { useEffect, useState } from 'react';
import {
  doc,
  getDoc
} from 'firebase/firestore';
import { ref, get, set } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth, realtimeDb } from "./firebase-init.js";



export function useChatAutoload(appendMessage, redirect = '/login') {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [chatRef, setChatRef] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        alert('⛔ אין משתמש מחובר – הפנייה להתחברות');
        window.location.href = redirect;
        return;
      }

      setUser(user);
      const userId = user.uid;

      try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          console.warn('⚠️ משתמש לא קיים במסד');
          return;
        }

        const data = userSnap.data();
        const mentorName = data.mentorName || 'המנטור שלך';
        const mentorImg = data.mentorImg || '/image/robot.png';
        const profile = data.profile || {};
        const fullName = data.fullName || 'משתמש';

        localStorage.setItem('mentorName', mentorName);
        localStorage.setItem('mentorImg', mentorImg);
        localStorage.setItem('userName', fullName);
        localStorage.setItem('userProfile', JSON.stringify(profile));

        // Use Realtime Database for chat with user-specific path
        const chatRef = ref(realtimeDb, `users/${userId}/chatRooms/main`);
        setChatRef(chatRef);

        let chatHistory = [];
        const chatSnap = await get(chatRef);

        if (chatSnap.exists()) {
          const chatData = chatSnap.val();
          chatHistory = chatData.messages || [];
          chatHistory.forEach((msg) => {
            const label = msg.role === 'user' ? '🟢 אתה' : `🤖 ${mentorName}`;
            appendMessage(label, msg.content, msg.role);
          });
        } else {
          const systemPrompt = `אתה "מנטור הקריפטו" - מנטור מקצועי מומחה בסחר במטבעות דיגיטליים וקריפטו מ-TradeMind. 

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

**פרופיל המשתמש:**
- שם: ${profile.q1 || 'משתמש אנונימי'}
- תדירות סחר: ${profile.q2 || 'לא ידוע'}
- נקודת חוזק: ${profile.q3 || 'לא צוין'}
- יעד לשנה הקרובה: ${profile.q4 || 'לא ידוע'}
- סגנון למידה מועדף: ${profile.q5 || 'לא נבחר'}

התחל עם הודעת ברכה אישית וחמה שמציגה את עצמך כמנטור הקריפטו ושואל איך אתה יכול לעזור היום.`;

          chatHistory.push({ role: 'system', content: systemPrompt });

          // Use direct OpenAI integration for development
          const { callOpenAIDirect } = await import('./openai-direct.js');
          const resData = await callOpenAIDirect(chatHistory);
          const reply = resData.reply || '⚠️ לא התקבלה תשובה מהשרת';
          chatHistory.push({ role: 'assistant', content: reply });
          appendMessage(`🤖 ${mentorName}`, reply, 'bot');
          await set(chatRef, { messages: chatHistory });
        }

        localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
        window.chatHistory = chatHistory;
        window.chatRef = chatRef;
        setLoading(false);
      } catch (err) {
        console.error('❌ שגיאה בטעינת צ\'אט:', err);
        alert('שגיאה בטעינת נתוני המשתמש');
      }
    });

    return () => unsubscribe();
  }, [appendMessage, redirect]);

  return { loading, user, chatRef };
}
