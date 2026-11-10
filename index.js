const express = require('express');
const app = express();
app.use(express.json());

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'MyBotToken2024';
const PORT = process.env.PORT || 10000;

const processedMids = new Set();
const welcomedUsers = new Map();

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

// ===== รหัสใหม่ 45 รูป ส่งทีละ 4 รูป เรียงตามที่พี่ให้มา =====
const CODES_BATCH4 = [
  'a09','a11','a29','a77','a79','a83','a85','a87','a90','a97',
  'a105','a107','a109','a111','a113','a115','a117','a119',
  'b01','b03','b05','b07','b09','b11','b13','b15','b17','b19','b21','b23',
  'd25','d35','d47','d53','d55','d59','d67','d73','d77','d81','d85','d87','d89','d91','d93'
];
const GROUP_BATCH4 = CODES_BATCH4.map(code => `${BASE_URL}${code}.jpg`);

// ===== รูปเดิม 6 รูป ส่งทีละรูป =====
const CODES_SINGLE = ['dressmix','krajom1','review1','review2','review3','review4'];
const GROUP_SINGLE = CODES_SINGLE.map(code => `${BASE_URL}${code}.jpg`);

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

// ส่งทีละ 4 รูปพร้อมกัน
async function sendImagesBatch4(senderId, images) {
  for (let i = 0; i < images.length; i += 4) {
    const batch = images.slice(i, i + 4);
    await Promise.all(batch.map(url => sendImage(senderId, url)));
    await delay(1000);
  }
}

// ส่งทีละ 1 รูป
async function sendImagesSingle(senderId, images) {
  for (const url of images) {
    await sendImage(senderId, url);
    await delay(600);
  }
}

async function sendAllImages(senderId) {
  await sendImagesBatch4(senderId, GROUP_BATCH4);
  await sendImagesSingle(senderId, GROUP_SINGLE);
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
  const hasAttachment = !!event.message?.attachments?.length;
  const mid = event.message?.mid;
  if (mid) {
    if (processedMids.has(mid)) return;
    processedMids.add(mid);
    if (processedMids.size > 500) processedMids.clear();
  }
  if (!msg && !hasAttachment) return;
  console.log("Received:", msg || "[ส่งรูปมา]");

  try {
    const now = Date.now();
    const last = welcomedUsers.get(senderId);

    // นับจากแชทสุดท้ายของลูกค้า ถ้ายังไม่เกิน 1 ชม. = ไม่ส่งซ้ำ ให้แอดมินตอบเอง
    if (last && (now - last < 60 * 60 * 1000)) {
      welcomedUsers.set(senderId, now);
      console.log("Already welcomed, skip - let admin reply");
      return;
    }

    welcomedUsers.set(senderId, now);
    // ลำดับตามที่พี่ให้มา: รูป 4 รูป -> รูปเดี่ยว -> ข้อความ 1,2,3
    await sendAllImages(senderId);
    await sendMessage(senderId, MSG1);
    await sendMessage(senderId, MSG2);
    await sendMessage(senderId, MSG3);
    console.log("Welcome sent, waiting for admin");

  } catch (e) {
    console.log("handleEvent error:", e.message);
  }
}

app.listen(PORT, () => console.log(`Bot running on port ${PORT}`));
