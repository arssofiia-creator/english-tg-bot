import express from "express";
import { Telegraf, Markup } from "telegraf";
import dotenv from "dotenv";
// import OpenAI from "openai"; // отключено пока не нужно

dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

const bot = new Telegraf(TOKEN);

// -------------------- EXPRESS --------------------
const app = express();
app.use(express.json());

// Подключаем Telegram webhook
app.use(bot.webhookCallback("/webhook"));

app.get("/", (req, res) => {
  res.send("Bot is running");
});

// -------------------- ТВОЙ КОД БОТА --------------------

const userLevels = new Map();
const userWords = new Map();
const chatModeUsers = new Set(); 

const wordsByLevel = { /* твой словарь сюда */ };

// /start
bot.start(async (ctx) => {
  await ctx.reply(
    `Привет, ${ctx.from.first_name}!\nВыбери уровень:`,
    Markup.inlineKeyboard([
      [Markup.button.callback("A1", "level_A1"), Markup.button.callback("A2", "level_A2")],
      [Markup.button.callback("B1", "level_B1"), Markup.button.callback("B2", "level_B2")],
      [Markup.button.callback("C1", "level_C1"), Markup.button.callback("C2", "level_C2")],
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

function sendNextWord(ctx, level) {
  const words = wordsByLevel[level];
  const random = words[Math.floor(Math.random() * words.length)];

  ctx.reply(
    `Новое слово:\n🇬🇧 *${random.en}* — 🇷🇺 *${random.ru}*`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback("Добавить", `add_${random.en}`),
          Markup.button.callback("Пропустить", `skip_${random.en}`),
        ],
        [Markup.button.callback("Словарь", "show_dictionary")]
      ])
    }
  );
}

bot.action(/add_(.+)/, async (ctx) => {
  const word = ctx.match[1];
  const userId = ctx.from.id;

  if (!userWords.has(userId)) userWords.set(userId, []);
  const dict = userWords.get(userId);

  if (!dict.includes(word)) dict.push(word);

  await ctx.editMessageText(`Добавлено: *${word}*`, { parse_mode: "Markdown" });

  setTimeout(() => sendNextWord(ctx, userLevels.get(userId)), 300);
});

bot.action(/skip_(.+)/, async (ctx) => {
  await ctx.editMessageText("Ок, пропускаем.");
  const level = userLevels.get(ctx.from.id);

  setTimeout(() => sendNextWord(ctx, level), 300);
});

bot.action("show_dictionary", (ctx) => {
  const dict = userWords.get(ctx.from.id) || [];
  if (dict.length === 0) return ctx.reply("Словарь пуст.");

  ctx.reply(`Твой словарь:\n${dict.map((w) => "• " + w).join("\n")}`);
});

// -------------------- СТАРТ СЕРВЕРА --------------------
const PORT = process.env.PORT || 10000;

app.listen(PORT, async () => {
  console.log("Server started on port", PORT);

  // Устанавливаем webhook
  await bot.telegram.setWebhook(`${WEBHOOK_URL}/webhook`);

  console.log("Webhook set:", `${WEBHOOK_URL}/webhook`);
});
