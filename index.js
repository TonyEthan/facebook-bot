const express = require('express');
const app = express();
app.use(express.json());

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'MyBotToken2024';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PORT = process.env.PORT || 10000;

// กันข้อความซ้ำจาก 【entity-Facebook¦canonical_name=Facebook】
const processedMids = new Set();

// ===== ข้อมูลร้าน =====
const SHOP_INFO = `
คุณคือแอดมินเพจ "เรื่องเล่าเตือนใจ" ตอบสุภาพมาก ใช้คำลงท้าย ค่ะ / นะคะ เป็นกันเองเหมือนพี่สาวใจดี
สินค้าหลัก: ชุดนอนแขนระบาย ผ้านิ่มใส่สบาย สีไม่ตก มีกระเป๋า 2 ข้าง ใส่ของได้จริง อกฟรีไซส์ 34 ยืดได้ถึง 52 นิ้ว ความยาว 42 นิ้ว
ราคาชุดนอนแขนระบาย ชุดละ 69 บาท
- 2 ชุด = 138 บาท + ค่าส่ง 50 บาท = 188 บาท
- 4 ชุด = 276 บาท ส่งฟรี
- 10 ชุด = 690 บาท ส่งฟรี (ขายดี)
สินค้าอื่น คละรวมกันได้:
- ชุดกระโจมอก ชุดละ 60 บาท
- ชุดเดรสคอกลม ชุดละ 89 บาท
- คละกันครบ 4 ชุดขึ้นไป ส่งฟรี
เก็บเงินปลายทางได้ ไม่บวกเพิ่ม สินค้ามีจำนวนจำกัด
ถ้าถามสี/ลาย ให้ตอบว่ามีหลายลายให้เลือก เดี๋ยวส่งรูปให้ดู อย่าแต่งสีเอง
ถ้าจะสั่ง ให้ถาม รับกี่ชุด, แบบไหน, ชื่อ, เบอร์โทร, ที่อยู่จัดส่ง
ถ้าไม่รู้ ให้ตอบว่า ขอเช็คกับแอดมินแป๊บนะคะ
ห้ามลดราคาเอง ห้ามแต่งโปรเอง
ตอบสั้น กระชับ เป็นกันเอง ไม่ตอบยาวเกินไป
`;

// ===== สร้างลิสต์รูป =====
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

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ===== ส่งข้อความ =====
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
  } catch (e) {
    console.log("SendMessage error:", e.message);
  }
}

// ===== ส่งรูป =====
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
  } catch (e) {
    console.log("SendImage error:", e.message);
    return null;
  }
}

async function sendMultipleImages(senderId, images) {
  for (const url of images) {
    try {
      await sendImage(senderId, url);
      await delay(300);
    } catch (e) {
      console.log("sendMultipleImages error:", e.message);
    }
  }
}

// ===== ถาม Gemini =====
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
  } catch (e) {
    console.log("Gemini error:", e.message);
    return null;
  }
}

// ===== หน้าแรก / Privacy =====
app.get('/', (req, res) => res.send('Bot ทำงานอยู่ครับ'));
app.get('/privacy', (req, res) => {
  res.send(`<h1>Privacy Policy - เพจเรื่องเล่าเตือนใจ</h1><p>เราเก็บข้อมูลแชทเพื่อตอบคำถามและจัดส่งสินค้าเท่านั้น ไม่ขายข้อมูลให้ใคร หากต้องการลบข้อมูล กรุณาทักแชทเพจ เรื่องเล่าเตือนใจ</p>`);
});

// ===== Webhook Verify =====
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// ===== Webhook รับข้อความ =====
app.post('/webhook', (req, res) => {
  res.sendStatus(200); // ตอบ 200 ทันที กัน Facebook ส่งซ้ำ
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
  const lower = msg.toLowerCase();
  console.log("Received:", msg);

  try {
    // ส่งรูปตามคีย์เวิร์ดก่อน
    if (lower.includes('ชุดนอน') || lower.includes('สินค้า') || lower.includes('ราคา') || lower.includes('ดูรูป') || lower.includes('ขอดู')) {
      await sendMultipleImages(senderId, IMAGES_CHUDNON);
    } else if (lower.includes('เดรส') || lower.includes('dress')) {
      await sendMultipleImages(senderId, IMAGES_DRESS);
      await sendMultipleImages(senderId, IMAGES_DRESSMIX);
    } else if (lower.includes('กระโจม') || lower.includes('กระโจมอก')) {
      await sendMultipleImages(senderId, IMAGES_KRAJOM);
    } else if (lower.includes('รีวิว')) {
      await sendMultipleImages(senderId, IMAGES_REVIEW);
    }

    // ถาม Gemini
    let reply = await getAIReply(msg);
    if (!reply) {
      // Fallback ถ้า Gemini พัง
      if (lower.includes('ชุดนอน') || lower.includes('ราคา') || lower.includes('สินค้า')) {
        reply = "สวัสดีค่ะ ชุดนอนแขนระบายชุดละ 69 บาทนะคะ 2 ชุด 188 บาทรวมส่ง 4 ชุด 276 บาทส่งฟรีค่ะ รับกี่ชุดดีคะ?";
      } else {
        reply = "สวัสดีค่ะ สนใจชุดนอนแขนระบายไหมคะ ชุดละ 69 บาท 2 ชุด 188 บาทรวมส่ง 4 ชุด 276 บาทส่งฟรีค่ะ";
      }
    }
    await sendMessage(senderId, reply);

    // ถ้าถามรีวิว ส่งรีวิวตามหลังด้วย
    if (lower.includes('รีวิว')) {
      await sendMultipleImages(senderId, IMAGES_REVIEW);
    }
  } catch (e) {
    console.log("handleEvent inner error:", e.message);
    await sendMessage(senderId, "ขอโทษนะคะ แอดมินติดธุระนิดหน่อย พิมพ์ 'ติดต่อ' ไว้ได้เลยนะคะ");
  }
}

app.listen(PORT, () => console.log(`Bot running on port ${PORT}`));
