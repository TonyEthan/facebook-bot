const express = require('express');
const app = express();
app.use(express.json());

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'MyBotToken2024';
const PORT = process.env.PORT || 10000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const processedMids = new Set();
const welcomedUsers = new Map();

async function hasWelcomed(senderId) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return welcomedUsers.has(senderId);
  try {
    const res = await fetch(`${UPSTASH_URL}/get/welcomed:${senderId}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
    });
    const data = await res.json();
    return !!data.result;
  } catch (e) { return welcomedUsers.has(senderId); }
}

async function markWelcomed(senderId) {
  welcomedUsers.set(senderId, Date.now());
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return;
  try {
    await fetch(`${UPSTASH_URL}/set/welcomed:${senderId}/1/EX/3600`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
    });
  } catch (e) { console.log("Upstash set error:", e.message); }
}

function getRuleReply(msg) {
  const t = msg.toLowerCase();
  if (t.includes('เอา 10') || t.includes('10 ชุด')) return `รับ 10 ชุดนะจ้ะคุณพี่ 😘 690.- ส่งฟรีจ้ะ ปลายทางไม่บวกเพิ่มจ้ะ\nคุณพี่แจ้งชื่อ ที่อยู่ เบอร์โทรให้แอดมินหน่อยนะจ้ะ เดี๋ยวแอดมินคอนเฟิร์มออเดอร์ให้จ้ะ`;
  if (t.includes('เอา 4') || t.includes('4 ชุด')) return `รับ 4 ชุดนะจ้ะคุณพี่ 😘 276.- ส่งฟรีจ้ะ ปลายทางไม่บวกเพิ่มจ้ะ\nคุณพี่แจ้งชื่อ ที่อยู่ เบอร์โทรให้แอดมินหน่อยนะจ้ะ เดี๋ยวแอดมินคอนเฟิร์มออเดอร์ให้จ้ะ`;
  if (t.includes('เอา 2') || t.includes('2 ชุด')) return `รับ 2 ชุดนะจ้ะคุณพี่ 😘 138 +ค่าส่ง 50 = 188.- จ้ะ ปลายทางไม่บวกเพิ่มจ้ะ\nคุณพี่แจ้งชื่อ ที่อยู่ เบอร์โทรให้แอดมินหน่อยนะจ้ะ เดี๋ยวแอดมินคอนเฟิร์มออเดอร์ให้จ้ะ`;
  if (t.includes('ราคา') || t.includes('กี่บาท') || t.includes('เท่าไหร่')) return `ราคาจ้ะคุณพี่ 😘\nชุดนอนแขนระบาย 69.-\n2 ชุด 188.- รวมส่ง\n4 ชุด 276.- ส่งฟรี\n10 ชุด 690.- ส่งฟรี\nชุดกระโจมอก 60.- ชุดเดรสคอกลม 89.- คละกันได้ ครบ 4 ชุดส่งฟรีจ้ะ`;
  return null;
}

function buildPrompt(userMessage) {
  return `คุณเป็นแอดมินร้านชุดนอน เพจเรื่องเล่าเตือนใจ / อารมณ์ดี Shop ตอบสุภาพมาก ใช้คำว่า คุณพี่, จ้ะ, นะจ้ะ, มีอีโมจิเล็กน้อย 😘

ข้อมูลสินค้าที่ต้องรู้ (ห้ามแต่งราคาเอง ห้ามแต่งโปรเอง):
- ชุดนอนแขนระบาย 69.- : 2 ชุด 69x2=138 +ค่าส่ง 50 = 188, 4 ชุด 276.- ส่งฟรี, 10 ชุด 690.- ส่งฟรี, ปลายทางไม่บวกเพิ่ม
- ชุดกระโจมอก 60.-, ชุดเดรสคอกลม 89.-
- คละรวมกันได้ ครบ 4 ชุดขึ้นไปส่งฟรี
- อกฟรีไซส์ 34 ยืดได้ถึง 52 นิ้ว, ความยาว 42 นิ้ว, ผ้านิ่มใส่สบาย สีไม่ตก, มีกระเป๋า 2 ข้างใส่ของได้จริง
- สินค้ามีจำนวนจำกัด
- สี: มีหลายสีตามรูปเลย ให้ลูกค้าเลือกจากรูปได้ คละสีได้ ถ้าลูกค้าถามสีไหนมีไหม ให้บอกว่า สีตามรูปเลยจ้ะ คุณพี่ชอบสีไหนแคปมาให้แอดมินดูได้เลยจ้ะ อย่าแต่งว่ามีสีอะไรบ้างถ้าไม่รู้
- การจัดส่ง: แอดมินจัดส่งให้เร็วที่สุด 1-2 วันทำการ
- การสั่ง: ถามลูกค้าว่ารับกี่ชุดดี แล้วให้ลูกค้าแจ้งชื่อ ที่อยู่ เบอร์โทร แล้วบอกว่าเดี๋ยวแอดมินคอนเฟิร์มออเดอร์ให้จ้ะ

กฎ:
- ตอบสั้นๆ กระชับ ไม่เกิน 5 บรรทัด ไม่ต้องส่งรูปซ้ำ ไม่ต้องส่งข้อความโปรโมชั่นซ้ำ
- ถ้าลูกค้าถามนอกเรื่องสินค้า หรือไม่แน่ใจ ให้ตอบว่า "รับทราบจ้ะคุณพี่ เดี๋ยวแอดมินมาตอบนะจ้ะ😘"
- อย่าพูดว่าเป็น AI
- อย่าบอกว่าระบบขัดข้อง

ลูกค้าถามว่า: ${userMessage}

ตอบเป็นภาษาไทยสุภาพ:`;
}

async function askGroq(userMessage) {
  if (!GROQ_API_KEY) { console.log("No GROQ_API_KEY"); return null; }
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: buildPrompt(userMessage) }],
        temperature: 0.7,
        max_tokens: 500
      })
    });
    const data = await res.json();
    if (data.error) { console.log("Groq error:", JSON.stringify(data.error)); return null; }
    const text = data.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch (e) { console.log("Groq fetch error:", e.message); return null; }
}

async function askGroqVision(imageUrls, caption) {
  if (!GROQ_API_KEY) return null;
  try {
    const content = [
      { type: 'text', text: `คุณเป็นแอดมินร้านชุดนอน เพจเรื่องเล่าเตือนใจ / อารมณ์ดี Shop ตอบสุภาพ ใช้คำว่า คุณพี่, จ้ะ, นะจ้ะ มีอีโมจิเล็กน้อย 😘

ลูกค้าส่งรูปมา ${imageUrls.length} รูป และพิมพ์ว่า: "${caption || 'ไม่มีข้อความ'}"

ให้ดูรูปแล้วบอกว่าเห็นชุดแบบไหน สีอะไร ลายอะไร แล้วบอกเราคาให้:
- ถ้าเป็นชุดนอนแขนระบาย 69.- : 2 ชุด 188.- รวมส่ง, 4 ชุด 276.- ส่งฟรี, 10 ชุด 690.- ส่งฟรี
- ถ้าเป็นชุดกระโจมอก 60.-, ชุดเดรสคอกลม 89.-
- คละกันได้ ครบ 4 ชุดส่งฟรี ปลายทางไม่บวกเพิ่ม
- อกฟรีไซส์ 34 ยืดได้ถึง 52 นิ้ว ยาว 42 นิ้ว ผ้านิ่ม สีไม่ตก มีกระเป๋า 2 ข้าง
- ถามลูกค้าว่ารับกี่ชุดดี แล้วให้แจ้งชื่อ ที่อยู่ เบอร์โทร
- ตอบสั้นๆ ไม่เกิน 5 บรรทัด อย่าพูดว่าเป็น AI ถ้าดูรูปไม่ออกให้บอกว่า รับรูปแล้วจ้ะคุณพี่ เดี๋ยวแอดมินมาดูให้นะจ้ะ
ตอบเป็นภาษาไทยสุภาพ:` }
    ];
    for (const url of imageUrls.slice(0, 4)) {
      content.push({ type: 'image_url', image_url: { url: url } });
    }
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [{ role: 'user', content: content }],
        temperature: 0.7,
        max_tokens: 500
      })
    });
    const data = await res.json();
    if (data.error) { console.log("Groq Vision error:", JSON.stringify(data.error)); return null; }
    const text = data.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch (e) { console.log("Groq Vision fetch error:", e.message); return null; }
}

async function askGemini(userMessage) {
  if (!GEMINI_API_KEY) return null;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(userMessage) }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 500 }
      })
    });
    const data = await res.json();
    if (data.error) { console.log("Gemini error:", JSON.stringify(data.error)); return null; }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text || null;
  } catch (e) { console.log("Gemini fetch error:", e.message); return null; }
}

async function askAI(userMessage) {
  console.log("Trying Groq AI...");
  let reply = await askGroq(userMessage);
  if (reply) { console.log("Groq answered"); return reply; }
  console.log("Groq failed, try Gemini...");
  reply = await askGemini(userMessage);
  if (reply) { console.log("Gemini answered"); return reply; }
  return null;
}

const MSG1 = `ชุดนอนแขนระบาย ✅
ผ้านิ่มใส่สบาย สีไม่ตก 
▶ มีกระเป๋า 2 ข้างใส่ของได้จริง
▶ อกฟรีไซส์ 34 ยืดได้ถึง 52 นิ้ว
▶ ความยาว 42 นิ้ว 

2 ชุด 69×2=138 +ค่าส่ง 50.-
4 ชุด 69×4=276.- ส่งฟรี💥
10 ชุด 69×10=690.-ส่งฟรี💥💥
ปลายทางไม่บวกเพิ่ม✅

ด่วน❗❗สินค้ามีจำนวนจำกัด`;

const MSG2 = `คละรวมกันได้นะจ้ะ❤❤
▶ ชุดกระโจมอก 60.-
▶ ชุดเดสคอกลม 89.-
4 ชุดขึ้นไปส่งฟรี ✅💥`;

const MSG3 = `คุณพี่รับกี่ชุดดีจ้ะ😘`;

const BASE_URL = 'https://raw.githubusercontent.com/TonyEthan/facebook-bot/main/';
const CODES_BATCH4 = [
  'a09','a11','a29','a79','a83','a85','a87','a90','a97',
  'a105','a107','a109','a111','a113','a115','a117','a119',
  'b01','b03','b05','b07','b09','b11','b13','b15','b17','b19','b21','b23',
  'd25','d35','d47','d53','d55','d59','d67','d73','d77','d81','d85','d87','d89','d91','d93'
];
const GROUP_BATCH4 = CODES_BATCH4.map(code => `${BASE_URL}${code}.jpg`);
const CODES_SINGLE = ['dressmix','krajom1','review1','review2','review3','review4'];
const GROUP_SINGLE = CODES_SINGLE.map(code => `${BASE_URL}${code}.jpg`);

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function sendMessage(senderId, text) {
  try {
    const res = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { id: senderId }, message: { text: text } })
    });
    const data = await res.json(); console.log("SendMessage result:", JSON.stringify(data)); return data;
  } catch (e) { console.log("SendMessage error:", e.message); }
}

async function sendImage(senderId, imageUrl) {
  try {
    const res = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { id: senderId }, message: { attachment: { type: 'image', payload: { url: imageUrl, is_reusable: true } } } })
    });
    const data = await res.json(); console.log("SendImage result:", JSON.stringify(data)); return data;
  } catch (e) { console.log("SendImage error:", e.message); return null; }
}

async function sendImagesBatch4(senderId, images) {
  for (let i = 0; i < images.length; i += 4) {
    const batch = images.slice(i, i + 4);
    await Promise.all(batch.map(url => sendImage(senderId, url)));
    await delay(1000);
  }
}
async function sendImagesSingle(senderId, images) {
  for (const url of images) { await sendImage(senderId, url); await delay(600); }
}
async function sendAllImages(senderId) {
  await sendImagesBatch4(senderId, GROUP_BATCH4);
  await sendImagesSingle(senderId, GROUP_SINGLE);
}

app.get('/', (req, res) => res.send('Bot ทำงานอยู่ครับ'));
app.get('/privacy', (req, res) => {
  res.send(`<h1>Privacy Policy - เพจอารมณ์ดี Shop</h1><p>เราเก็บข้อมูลแชทเพื่อตอบคำถามและจัดส่งสินค้าเท่านั้น ไม่ขายข้อมูลให้ใคร หากต้องการลบข้อมูล กรุณาทักแชทเพจ อารมณ์ดี Shop</p>`);
});
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode']; const token = req.query['hub.verify_token']; const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) return res.status(200).send(challenge);
  return res.sendStatus(403);
});
app.post('/webhook', (req, res) => {
  res.sendStatus(200);
  const body = req.body;
  if (body.object !== 'page') return;
  body.entry?.forEach(entry => {
    entry.messaging?.forEach(event => { handleEvent(event).catch(e => console.log("handleEvent error:", e.message)); });
  });
});
async function handleEvent(event) {
  const senderId = event.sender?.id;
  if (!senderId) return;
  if (event.message?.is_echo) return;
  const msg = event.message?.text?.trim() || '';
  const attachments = event.message?.attachments || [];
  const imageUrls = attachments.filter(a => a.type === 'image').map(a => a.payload?.url).filter(Boolean);
  const hasAttachment = attachments.length > 0;
  const mid = event.message?.mid;
  if (mid) { if (processedMids.has(mid)) return; processedMids.add(mid); if (processedMids.size > 500) processedMids.clear(); }
  if (!msg && !hasAttachment) return;
  console.log("Received:", msg || "[ส่งรูปมา]", imageUrls.length ? `images:${imageUrls.length}` : "");
  try {
    const already = await hasWelcomed(senderId);
    if (already) {
      await markWelcomed(senderId);
      if (imageUrls.length > 0) {
        const visionReply = await askGroqVision(imageUrls, msg);
        if (visionReply) { await sendMessage(senderId, visionReply); }
        else { await sendMessage(senderId, "รับรูปแล้วจ้ะคุณพี่ เดี๋ยวแอดมินมาดูให้นะจ้ะ😘"); }
        if (msg) {
          const aiReply = await askAI(msg);
          if (aiReply) await sendMessage(senderId, aiReply);
        }
        console.log("Vision replied");
        return;
      }
      if (msg) {
        const aiReply = await askAI(msg);
        if (aiReply) { await sendMessage(senderId, aiReply); }
        else {
          const ruleReply = getRuleReply(msg);
          if (ruleReply) { await sendMessage(senderId, ruleReply); }
          else { await sendMessage(senderId, "รับทราบจ้ะคุณพี่ เดี๋ยวแอดมินมาตอบนะจ้ะ😘"); }
        }
      } else if (hasAttachment) {
        await sendMessage(senderId, "รับรูปแล้วจ้ะคุณพี่ เดี๋ยวแอดมินมาดูให้นะจ้ะ😘");
      }
      console.log("AI replied to follow-up");
      return;
    }
    await markWelcomed(senderId);
    await sendAllImages(senderId);
    await sendMessage(senderId, MSG1);
    await sendMessage(senderId, MSG2);
    await sendMessage(senderId, MSG3);
    console.log("Welcome sent, waiting for admin");
  } catch (e) { console.log("handleEvent error:", e.message); }
}
app.listen(PORT, () => console.log(`Bot running on port ${PORT}`));
