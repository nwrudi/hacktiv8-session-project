import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { GoogleGenAI } from "@google/genai";
import { KB } from './knowledge.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rentnaturePath = path.join(__dirname, '../rentnature');

const app = express();
const upload = multer();
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});
const model = (process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite').trim();

app.use(cors());
app.use(express.json());

// Serve static frontend files from rentnature
app.use(express.static(rentnaturePath));

app.get('/chat', (req, res) => {
    res.sendFile(path.join(rentnaturePath, 'chatbot.html'));
});

app.post('/generate-text', async (req, res) => {
    try {
        const { prompt } = req.body;

        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
        });
        res.status(200).json({ result: response.text });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: error.message });
    }

});

// Tambahkan tanda koma (,) di antara upload.single('image') dan fungsi asinkron
app.post('/generate-from-image', upload.single('image'), async (req, res) => {
    try {
        const { prompt } = req.body;
        const base64Image = req.file.buffer.toString('base64');

        const response = await ai.models.generateContent({
            model: model,
            contents: [
                { text: prompt, type: 'text' }, // Sesuai gambar referensi
                {
                    inlineData: {
                        data: base64Image,
                        mimeType: req.file.mimetype,
                    },
                },
            ],
        });
        res.status(200).json({ result: response.text });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: error.message });
    }
});

app.post('/api/chat', async (req, res) => {
    try {
        const { conversation } = req.body;

        if (!Array.isArray(conversation) || conversation.length === 0) {
            return res.status(400).json({ message: 'conversation must be a non-empty array' });
        }

        // Mapping data sesuai Google GenAI contents format
        const contents = conversation.map(({ role, text }) => ({
            role: role === 'bot' || role === 'assistant' ? 'model' : role,
            parts: [{ text: String(text || '') }]
        }));

        const systemInstruction = `
KNOWLEDGE BASE UTAMA NATUREBOUND RENTALS:
${KB}

IDENTITAS & PRIORITAS UTAMA LAYANAN:
Kamu adalah AI Expedition Assistant & Customer Service untuk NatureBound Rentals.
1. **LAYANAN PALING UTAMA (CORE FOCUS)**:
   - Rental perlengkapan hiking & camping (tenda ekspedisi, carrier/backpack, sleeping bag, kompor portable, nesting, headlamp, dll.).
   - Jasa Tour Guide & Mountain Guide (pemandu gunung berlisensi, porter logistik, dan trip leader pendakian).
2. **LAYANAN TAMBAHAN (ADD-ON SUPPORT)**:
   - Rental mobil & armada transportasi trip (Innova Zenix, Pajero, Alphard, dll.) khusus untuk antar-jemput basecamp, mobilisasi rombongan, atau overland tour.
   - Posisikan rental mobil sebagai fasilitas pelengkap pendukung trip petualangan.

GAYA KOMUNIKASI & TONE:
1. **Simple, Praktis & Elegan**: Jawaban langsung ke poin utama, ringkas, jelas, dan rapi. Jangan bertele-tele atau membuat paragraf panjang yang membosankan.
2. **Sedikit Gaul untuk Kawula Muda**: Gunakan bahasa yang asyik, santai, dan berjiwa petualang (contoh: "Halo Kak! Siap gaskeun muncak 🏔️", "Gear dijamin bersih & siap tempur!", "Bisa langsung booking ya kak!").
3. **Sopan & Penuh Hormat untuk Orang Tua**: Jika pengguna berbicara formal, sopan, atau lebih dewasa (Bapak/Ibu), gunakan gaya bahasa yang sangat santun, adem, dan beretika tinggi.
4. **Panggilan Fleksibel**: Panggil "Kak" secara umum, atau "Bapak/Ibu" jika mereka menyapa formal.

ATURAN MENAMPILKAN HARGA (MUTLAK WAJIB):
- Setiap kali pengguna menanyakan harga, tarif, atau daftar alat/layanan/mobil, **WAJIB dibuatkan dalam bentuk TABEL MARKDOWN sederhana dan praktis** agar pembaca tidak pusing dengan tumpukan teks.
- Contoh format tabel:
  | Unit / Layanan | Kategori | Spesifikasi / Kapasitas | Tarif / Hari |
  | :--- | :--- | :--- | :--- |
  | 4-Person Waterproof Tent | Tenda Camping | PU 3000mm, 4 Orang | Rp 75.000 |
  | Certified Mountain Guide | Pemandu Gunung | Jalur & Safety Briefing | Rp 300.000 |
- Cukup berikan tabel ringkas + 1-2 kalimat penutup dan Call to Action cepat untuk konsultasi/booking via WhatsApp 085208990812.`;

        let response;
        try {
            response = await ai.models.generateContent({
                model,
                contents,
                config: {
                    systemInstruction
                }
            });
        } catch (apiError) {
            console.warn(`Primary model "${model}" encountered error (${apiError.message}). Attempting fallback to gemini-3.1-flash-lite...`);
            if (model !== 'gemini-3.1-flash-lite') {
                response = await ai.models.generateContent({
                    model: 'gemini-3.1-flash-lite',
                    contents,
                    config: {
                        systemInstruction
                    }
                });
            } else {
                throw apiError;
            }
        }

        res.status(200).json({ result: response.text });
    } catch (error) {
        console.error('Error in /api/chat:', error);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
});


const PORT = 3000;
app.listen(PORT, () => console.log(`Server ready on http://localhost:${PORT}`),
);