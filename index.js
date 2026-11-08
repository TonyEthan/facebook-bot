const express = require('express');
const app = express();
app.use(express.json());

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'MyBotToken2024';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PORT = process.env.PORT || 10000;

const processedMids = new Set();
// จำว่าใครทักมาแล้วบ้าง จะได้ไม่ส่งข้อความต้อนรับซ้ำ
const userState = new Map(); // senderId -> { lastTime: number }

// ===== ข้อความตอนลูกค้าทักครั้งแรก =====
const MSG1 = `ชุดนอนแขนระบาย ✅
ผ้านิ่มใส่สบาย สีไม่ตก 

▶ มีกระเป๋า 2 ข้างใส่ของได้จริง
▶ อกฟรีไซส์ 34 ยืดได้ถึง 52 นิ้ว
▶ ความยาว 42 นิ้ว 

2 ชุด 69×2=138 +ค่าส่ง 50.-
4 ชุด 69×4=276.- ส่งฟรี💥
10 ชุด 69×10=690.-ส่งฟรี💥(ขายดี)

ปลายทางไม่บวกเพิ่ม ❗❗
ด่วน❗❗สินค้ามีจำนวนจำกัด`;

const MSG2 = `คละรวมกันได้นะจ้ะ❤❤
▶ ชุดกระโจมอก 60.-
▶ ชุดเดสคอกลม 89.-

4 ชุดขึ้นไปส่งฟรี ✅💥`;

const MSG3 = `คุณพี่รับกี่ชุดดีจ้ะ😘`;

// ===== ข้อมูลร้านให้ Gemini ใช้ตอบต่อ =====
const SHOP_INFO = `
คุณคือแอดมินเพจ "เรื่องเล่าเตือนใจ" ตอบสุภาพมาก ใช้คำลงท้าย ค่ะ / นะคะ / จ้ะ เป็นกันเองเหมือนพี่สาวใจดี
ลูกค้าเพิ่งได้รับข้อความต้อนรับ + รูปสินค้าทั้งหมดไปแล้ว ตอนนี้คือการคุยต่อ
สินค้าหลัก: ชุดนอนแขนระบาย ผ้านิ่มใส่สบาย สีไม่ตก มีกระเป๋า 2 ข้าง ใส่ของได้จริง อกฟรีไซส์ 34 ยืดได้ถึง 52 นิ้ว ความยาว 42 นิ้ว
ราคาชุดนอนแขนระบาย ชุดละ 69 บาท
- 2 ชุด = 138 + ค่าส่ง 50 = 188 บาท
- 4 ชุด = 276 บาท ส่งฟรี
- 10 ชุด = 690 บาท ส่งฟรี (ขายดี)
สินค้าอื่น คละรวมกันได้:
- ชุดกระโจมอก ชุดละ 60 บาท
- ชุดเดรสคอกลม ชุดละ 89 บาท
- คละกันครบ 4 ชุดขึ้นไป ส่งฟรี
เก็บเงินปลายทางได้ ไม่บวกเพิ่ม สินค้ามีจำนวนจำกัด
ถ้าถามสี/ลาย ให้ตอบว่ามีหลายลายให้เลือก เดี๋ยวส่งรูปให้ดู อย่าแต่งสีเอง
ถ้าลูกค้าจะสั่ง ให้ถาม รับกี่ชุด, แบบไหน, ชื่อ, เบอร์โทร, ที่อยู่จัดส่ง ทีละอย่าง อย่าถามรวดเดียว
ถ้าไม่รู้ ให้ตอบว่า ขอเช็คกับแอดมินแป๊บนะคะ
ห้ามลดราคาเอง ห้ามแต่งโปรเอง
ตอบสั้น กระชับ เป็นกันเอง
`;

// ===== รูป =====
function makeImageList(prefix, count) {
  const list = [];
  for (let i = 1; i <= count; i++) {
    list.push(`https://raw.githubusercontent.com/TonyEthan/facebook-bot/main/${prefix}${i}.jpg`);
  }
  return list;
}
const IMAGES_CHUDNON = makeImageList('chudnon', 17);
const IMAGES_DRESS = makeImageList('dress', 22);
const IMAGES_DRESSMIX = ['https://raw.githubusercontent.com/TonyEthan/facebook-bot/main/dressmix.jpg'];
const IMAGES_KRAJOM = ['https://raw.githubusercontent.com/TonyEthan/facebook-bot/main/krajom1.jpg'];
const IMAGES_REVIEW = makeImageList('review', 4);
const ALL_IMAGES = [...IMAGES_CHUDNON, ...IMAGES_DRESS, ...IMAGES_DRESSMIX, ...IMAGES_KRAJOM, ...IMAGES_REVIEW];

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function sendMessage(senderId, text) {
  try {
    const res = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { id: senderId }, message: { text: text } })
    });
    const data = await res.json();
    console.log("SendMessage result:", JSON.stringify(data));
    return data;
  } catch (e) { console.log("SendMessage error:", e.message); }
}

async function sendImage(senderId, imageUrl) {
  try {
    const res = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { id: senderId }, message: { attachment: { type: 'image', payload: { url: imageUrl, is_reusable: true } } } })
    });
    const data = await res.json();
    console.log("SendImage result:", JSON.stringify(data));
    return data;
  } catch (e) { console.log("SendImage error:", e.message); return null; }
}

async function sendMultipleImages(senderId, images) {
  for (const url of images) {
    try { await sendImage(senderId, url); await delay(300); }
    catch (e) { console.log("sendMultipleImages error:", e.message); }
  }
}

async function getAIReply(userMsg) {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: SHOP_INFO + "\nลูกค้าพิมพ์ว่า: " + userMsg + "\nตอบลูกค้า:" }] }],
        generationConfig: { temperature: 0.7 }
      })
    });
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) return text;
    console.log("Gemini no text:", JSON.stringify(data));
    return null;
  } catch (e) { console.log("Gemini error:", e.message); return null; }
}

app.get('/', (req, res) => res.send('Bot ทำงานอยู่ครับ'));
app.get('/privacy', (req, res) => {
  res.send(`<h1>Privacy Policy - เพจเรื่องเล่าเตือนใจ</h1><p>เราเก็บข้อมูลแชทเพื่อตอบคำถามและจัดส่งสินค้าเท่านั้น ไม่ขายข้อมูลให้ใคร หากต้องการลบข้อมูล กรุณาทักแชทเพจ เรื่องเล่าเตือนใจ</p>`);
});

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) return res.status(200).send(challenge);
  return res.sendStatus(403);
});

app.post('/webhook', (req, res) => {
  res.sendStatus(200);
  const body = req.body;
  if (body.object !== 'page') return;
  body.entry?.forEach(entry => {
    entry.messaging?.forEach(event => {
      handleEvent(event).catch(e => console.log("handleEvent error:", e.message));
    });
  });
});

async function handleEvent(event) {
  const senderId = event.sender?.id;
  if (!senderId) return;
  if (event.message?.is_echo) return;
  const msg = event.message?.text?.trim() || '';
  const mid = event.message?.mid;
  if (mid) {
    if (processedMids.has(mid)) return;
    processedMids.add(mid);
    if (processedMids.size > 500) processedMids.clear();
  }
  if (!msg) return;
  console.log("Received:", msg);

  try {
    const now = Date.now();
    const last = userState.get(senderId);
    // ถ้ายังไม่เคยทัก หรือห่างกันเกิน 1 ชม. = ถือว่าทักใหม่ ส่งข้อความต้อนรับ
    const isFirst = !last || (now - last.lastTime > 60 * 60 * 1000);

    if (isFirst) {
      userState.set(senderId, { lastTime: now });
      await sendMessage(senderId, MSG1);
      await sendMultipleImages(senderId, ALL_IMAGES);
      await sendMessage(senderId, MSG2);
      await sendMessage(senderId, MSG3);
      return;
    }

    // ===== คุยต่อครั้งที่ 2 ขึ้นไป ใช้ Gemini =====
    userState.set(senderId, { lastTime: now });
    const lower = msg.toLowerCase();

    // ถ้าลูกค้าขอดูรูปอีก ส่งรูปให้ด้วย
    if (lower.includes('รูป') || lower.includes('ดู') || lower.includes('ลาย') || lower.includes('สี')) {
      await sendMultipleImages(senderId, ALL_IMAGES);
    }

    let reply = await getAIReply(msg);
    if (!reply) {
      reply = "รับกี่ชุดดีจ้ะ😘 บอกแอดมินได้เลยนะคะ ชื่อ เบอร์โทร ที่อยู่จัดส่ง เดี๋ยวแอดมินเช็คให้ค่ะ";
    }
    await sendMessage(senderId, reply);

  } catch (e) {
    console.log("handleEvent error:", e.message);
  }
}

app.listen(PORT, () => console.log(`Bot running on port ${PORT}`));
