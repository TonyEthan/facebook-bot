const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// ===== ข้อมูลร้าน เรื่องเล่าเตือนใจ - แก้ตรงนี้ได้เลย =====
const SHOP_INFO = `
คุณคือแอดมินเพจ "เรื่องเล่าเตือนใจ" ตอบสุภาพมาก ใช้คำลงท้ายว่า "ค่ะ" "นะคะ" ตลอด เป็นกันเองเหมือนพี่สาวใจดี ไม่พูดห้วน

สินค้าหลัก: ชุดนอนแขนระบาย
- ผ้านิ่มใส่สบาย สีไม่ตก
- มีกระเป๋า 2 ข้าง ใส่ของได้จริง
- อกฟรีไซส์ 34 ยืดได้ถึง 52 นิ้ว
- ความยาว 42 นิ้ว

ราคาชุดนอนแขนระบาย ชุดละ 69 บาท:
- 2 ชุด = 138 บาท + ค่าส่ง 50 บาท = 188 บาท
- 4 ชุด = 276 บาท ส่งฟรี
- 10 ชุด = 690 บาท ส่งฟรี (ขายดีที่สุด)

สินค้าอื่น คละรวมกันได้:
- ชุดกระโจมอก ชุดละ 60 บาท
- ชุดเดรสคอกลม ชุดละ 89 บาท
- คละกันครบ 4 ชุดขึ้นไป ส่งฟรี

การสั่งซื้อ:
- เก็บเงินปลายทางได้ ไม่บวกเพิ่ม
- สินค้ามีจำนวนจำกัด ต้องรีบสั่ง
- ถ้าลูกค้าถามสี/ลาย ให้ตอบว่า "มีหลายลายให้เลือกค่ะ เดี๋ยวส่งรูปให้ดูนะคะ" อย่าแต่งสีเอง เพราะแต่ละล็อตไม่เหมือนกัน
- ถ้าลูกค้าจะสั่ง ให้ถามว่า รับกี่ชุด, แบบไหน, ชื่อ, เบอร์โทร, ที่อยู่สำหรับจัดส่ง
- ถ้าลูกค้าถามเรื่องที่ไม่รู้ อย่าเดา ให้ตอบว่า "ขอเช็คกับแอดมินแป๊บนะคะ" 

ห้ามลดราคาเอง ห้ามแต่งโปรเอง ตอบตามราคาข้างบนเท่านั้น
`;

async function getAIReply(userMessage) {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: SHOP_INFO + "\n\nลูกค้าพิมพ์มา: " + userMessage }] }]
      })
    });
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "ขอโทษนะคะ แอดมินติดธุระนิดหน่อย พิมพ์ 'ติดต่อ' ไว้ได้เลยนะคะ เดี๋ยวแอดมินรีบมาตอบค่ะ";
  } catch (e) {
    console.log("Gemini error:", e);
    return "ขอโทษนะคะ ระบบขัดข้องนิดหน่อย ลองพิมพ์ใหม่อีกครั้งนะคะ";
  }
}

function sendMessage(senderId, text) {
  return fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { id: senderId }, message: { text: text } })
  });
}

function sendImage(senderId, imageUrl) {
  return fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { id: senderId }, message: { attachment: { type: 'image', payload: { url: imageUrl, is_reusable: true } } } })
  });
}

app.get('/', (req, res) => res.send('Bot ทำงานอยู่ครับ'));

app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === VERIFY_TOKEN) {
    res.send(req.query['hub.challenge']);
  } else { res.sendStatus(403); }
});

app.post('/webhook', async (req, res) => {
  const body = req.body;
  if (body.object === 'page') {
    for (const entry of body.entry) {
      const event = entry.messaging[0];
      const senderId = event.sender.id;
      if (event.message && event.message.text) {
        const msg = event.message.text.toLowerCase();
        if (msg.includes('สินค้า') || msg.includes('ราคา') || msg.includes('ดูรูป') || msg.includes('ชุดนอน')) {
          // 👇 แก้ลิงก์รูปนี้เป็นรูปชุดนอนจริงของคุณ
          await sendImage(senderId, 'https://picsum.photos/800/600');
        }
        const aiReply = await getAIReply(event.message.text);
        await sendMessage(senderId, aiReply);
      }
    }
    res.sendStatus(200);
  } else { res.sendStatus(404); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log('Bot running on port ' + PORT));
