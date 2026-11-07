const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// ===== ตั้งค่าข้อมูลร้านตรงนี้ แก้ให้ตรงร้านคุณ =====
const SHOP_INFO = `
ชื่อเพจ: เรื่องเล่าเตือนใจ
คุณคือแอดมินเพจ ตอบสุภาพ เป็นกันเอง ใช้ภาษาไทยเข้าใจง่าย
สินค้า: [ใส่สินค้าของคุณ เช่น หนังสือ, เสื้อ, ของฝาก]
ราคา: [ใส่ราคา เช่น หนังสือเล่มละ 199 บาท ส่งฟรี]
โปรโมชั่น: [ใส่โปร เช่น ซื้อ 2 แถม 1]
วิธีสั่งซื้อ: ให้ลูกค้าพิมพ์ "สั่งซื้อ" แล้วแอดมินจะทักกลับ
ติดต่อแอดมิน: พิมพ์ "ติดต่อ"
กฎ: ถ้าไม่รู้ ให้บอกว่า "ขอเช็คกับแอดมินแป๊บนะครับ" อย่าแต่งราคาเอง
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
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "ขอโทษครับ แอดมินติดธุระนิดหน่อย พิมพ์ 'ติดต่อ' ไว้ได้เลยครับ";
  } catch (e) {
    console.log("Gemini error:", e);
    return "ขอโทษครับ ระบบขัดข้องนิดหน่อย ลองพิมพ์ใหม่อีกครั้งนะครับ";
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
        if (msg.includes('สินค้า') || msg.includes('ราคา') || msg.includes('ดูรูป')) {
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
