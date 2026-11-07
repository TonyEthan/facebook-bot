// บอท Facebook Page - Node.js สำหรับ Render (มือใหม่ ก็อปวางใช้ได้เลย)
const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'MyBotToken2024';
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot ทำงานอยู่ครับ');
});

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  const body = req.body;
  if (body.object === 'page') {
    for (const entry of body.entry || []) {
      for (const event of entry.messaging || []) {
        if (event.message && event.message.text) {
          const senderId = event.sender.id;
          const text = event.message.text.trim();
          await handleMessage(senderId, text);
        }
      }
    }
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

async function handleMessage(senderId, text) {
  const lower = text.toLowerCase();
  let reply;

  if (lower.includes('สวัสดี') || lower.includes('hello') || lower.includes('hi')) {
    reply = { text: 'สวัสดีครับ ยินดีต้อนรับครับ\nพิมพ์ "ราคา" เพื่อดูราคา\nพิมพ์ "สินค้า" เพื่อดูรูปสินค้า\nพิมพ์ "ติดต่อ" เพื่อคุยกับแอดมินครับ' };
  } else if (lower.includes('ราคา') || lower.includes('price') || lower.includes('เท่าไหร่')) {
    await sendMessage(senderId, { text: 'ราคาสินค้าของเราครับ\n- ชิ้นละ 299 บาท\n- ซื้อ 2 ชิ้น 549 บาท (ส่งฟรี)\nพิมพ์ "สั่งซื้อ" เพื่อสั่งได้เลยครับ' });
    await sendMessage(senderId, {
      attachment: { type: 'image', payload: { url: 'https://picsum.photos/800/600', is_reusable: true } }
    });
    return;
  } else if (lower.includes('สินค้า') || lower.includes('รูป') || lower.includes('ดูสินค้า')) {
    await sendMessage(senderId, { text: 'นี่คือรูปสินค้าของเราครับ' });
    await sendMessage(senderId, {
      attachment: { type: 'image', payload: { url: 'https://picsum.photos/800/600', is_reusable: true } }
    });
    return;
  } else if (lower.includes('สั่งซื้อ') || lower.includes('สั่ง') || lower.includes('ซื้อ')) {
    reply = { text: 'รับทราบครับ พิมพ์ชื่อ-ที่อยู่-เบอร์โทรไว้ได้เลยครับ แอดมินจะรีบติดต่อกลับ หรือพิมพ์ "ติดต่อ" เพื่อคุยกับแอดมินโดยตรงครับ' };
  } else if (lower.includes('ติดต่อ') || lower.includes('แอดมิน')) {
    reply = { text: 'กำลังเรียกแอดมินให้ครับ รอสักครู่นะครับ พิมพ์ฝากข้อความไว้ได้เลยครับ' };
  } else {
    reply = { text: 'คุณพิมพ์ว่า: "' + text + '"\n\nพิมพ์ "สวัสดี" เพื่อเริ่มใหม่\nพิมพ์ "ราคา" เพื่อดูราคา\nพิมพ์ "สินค้า" เพื่อดูรูปครับ' };
  }
  await sendMessage(senderId, reply);
}

async function sendMessage(recipientId, message) {
  if (!PAGE_ACCESS_TOKEN) return;
  try {
    await axios.post('https://graph.facebook.com/v21.0/me/messages', {
      recipient: { id: recipientId },
      message: message
    }, { params: { access_token: PAGE_ACCESS_TOKEN } });
  } catch (err) {
    console.log('ส่งไม่สำเร็จ:', err.response?.data || err.message);
  }
}

app.listen(PORT, () => {
  console.log('Server ทำงานที่พอร์ต ' + PORT);
});
