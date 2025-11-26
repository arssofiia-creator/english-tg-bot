import express from "express";
import { Telegraf, Markup } from "telegraf";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL; // https://english-tg-bot.onrender.com
const NEURO_API_KEY = process.env.NEURO_API_KEY;

if (!TOKEN) {
  console.error("❌ TELEGRAM_BOT_TOKEN не найден");
  process.exit(1);
}

const bot = new Telegraf(TOKEN);

const app = express();
app.use(express.json());

// ------------------------------------------------------------------
// 🚀 ПРАВИЛЬНОЕ ПОДКЛЮЧЕНИЕ ВЕБХУКА
// ------------------------------------------------------------------
app.use("/webhook", bot.webhookCallback("/webhook"));

app.get("/", (req, res) => {
  res.send("Bot is running");
});

// ------------------------------------------------------------------
// 🧠 ФУНКЦИЯ ДЛЯ ГЕНЕРАЦИИ ПРИМЕРА ПРЕДЛОЖЕНИЯ
// ------------------------------------------------------------------
async function generateExampleSentence(word) {
  try {
    const response = await axios.post(
      "https://api.neuroapi.host/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: `Составь предложение на английском с словом "${word}" и переведи на русский`,
          },
        ],
        max_tokens: 150,
      },
      {
        headers: {
          Authorization: `Bearer ${NEURO_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("Ошибка API:", error.response?.data || error.message);
    return "Не удалось сгенерировать пример предложения.";
  }
}

// ------------------------------------------------------------------
// 🟦 ДАННЫЕ
// ------------------------------------------------------------------
const userLevels = new Map();
const userWords = new Map();

const wordsByLevel = {
  A1: [{ en: "apple", ru: "яблоко" }],
  A2: [{ en: "book", ru: "книга" }],
  B1: [{ en: "target", ru: "цель" }],
  B2: [{ en: "effort", ru: "усилие" }],
  C1: [{ en: "consequence", ru: "последствие" }],
  C2: [{ en: "proficiency", ru: "профессионализм" }],
};

// ------------------------------------------------------------------
// 🤖 ТЕЛЕГРАМ БОТ
// ------------------------------------------------------------------
bot.start(async (ctx) => {
  await ctx.reply(
    `Привет, ${ctx.from.first_name}!\nВыбери уровень:`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback("A1", "level_A1"),
        Markup.button.callback("A2", "level_A2"),
      ],
      [
        Markup.button.callback("B1", "level_B1"),
        Markup.button.callback("B2", "level_B2"),
      ],
      [
        Markup.button.callback("C1", "level_C1"),
        Markup.button.callback("C2", "level_C2"),
      ],
    ])
  );
});

bot.action(/level_(A1|A2|B1|B2|C1|C2)/, async (ctx) => {
  const level = ctx.match[1];
  userLevels.set(ctx.from.id, level);

  await ctx.editMessageText(`Уровень установлен: *${level}*`, {
    parse_mode: "Markdown",
  });

  sendNextWord(ctx, level);
});

async function sendNextWord(ctx, level) {
  const words = wordsByLevel[level];
  const random = words[Math.floor(Math.random() * words.length)];

  const exampleSentence = await generateExampleSentence(random.en);

  await ctx.reply(
    `Новое слово:\n\n🇬🇧 *${random.en}* — 🇷🇺 *${random.ru}*\n\nПример: ${exampleSentence}`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback("Добавить", `add_${random.en}`),
          Markup.button.callback("Пропустить", `skip_${random.en}`),
        ],
        [Markup.button.callback("Словарь", "show_dictionary")],
      ]),
    }
  );
}

bot.action(/add_(.+)/, async (ctx) => {
  const word = ctx.match[1];
  const userId = ctx.from.id;

  if (!userWords.has(userId)) userWords.set(userId, []);
  const dict = userWords.get(userId);

  if (!dict.includes(word)) dict.push(word);

  await ctx.editMessageText(`Добавлено: *${word}*`, {
    parse_mode: "Markdown",
  });

  setTimeout(() => sendNextWord(ctx, userLevels.get(userId)), 300);
});

bot.action(/skip_(.+)/, async (ctx) => {
  await ctx.editMessageText("Ок, пропускаем.");
  setTimeout(
    () => sendNextWord(ctx, userLevels.get(ctx.from.id)),
    300
  );
});

bot.action("show_dictionary", (ctx) => {
  const dict = userWords.get(ctx.from.id) || [];
  if (!dict.length) return ctx.reply("Словарь пуст.");

  ctx.reply(`Твой словарь:\n${dict.map((w) => "• " + w).join("\n")}`);
});

// ------------------------------------------------------------------
// 🚀 СТАРТ СЕРВЕРА + УСТАНОВКА WEBHOOK
// ------------------------------------------------------------------
const PORT = process.env.PORT || 10000;

app.listen(PORT, async () => {
  console.log("Server started on port", PORT);

  try {
    await bot.telegram.setWebhook(`${WEBHOOK_URL}/webhook`);
    console.log("Webhook установлен:", `${WEBHOOK_URL}/webhook`);
  } catch (err) {
    console.error("Ошибка установки webhook:", err.message);
  }
});
