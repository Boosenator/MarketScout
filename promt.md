# Sluice — AI Market Intelligence System

## Що це
Автоматизована система, яка щодня сканує 12 ринків, 
генерує ідеї/ніші, жорстко їх валідує і постить 
результати у Telegram-бот команди з кнопками голосування.

## Стек
- Next.js 14 (App Router, тільки API routes — без UI)
- TypeScript (strict mode)
- Vercel (деплой + Cron Jobs)
- Supabase (Postgres — дані, результати, голосування)
- Anthropic API (різні моделі — деталі нижче)
- Telegram Bot API (через telegraf)

## Структура проєкту
sluice/
├── app/
│   └── api/
│       ├── cron/
│       │   └── scout/route.ts      # Vercel Cron endpoint
│       └── telegram/
│           └── route.ts            # Webhook від Telegram
├── lib/
│   ├── scout/
│   │   ├── markets.ts              # Список ринків + конфіги
│   │   ├── phase1-search.ts        # Сканування (Haiku)
│   │   ├── phase2-generate.ts      # Генерація ідей (Haiku)
│   │   ├── phase2-filter.ts        # Kill criteria + Scoring (Haiku)
│   │   └── phase3-deepdive.ts      # Deep dive топ-5 (Sonnet)
│   ├── telegram/
│   │   ├── bot.ts                  # Telegraf instance
│   │   ├── post-idea.ts            # Форматування + відправка поста
│   │   └── handlers.ts             # Callback handlers (голосування)
│   └── supabase/
│       ├── client.ts               # Supabase client
│       └── queries.ts              # Всі DB операції
├── vercel.json                     # Cron config
└── .env.local                      # Секрети

## Моделі Anthropic (стратегія вартості)
- Phase 1 (пошук сигналів): claude-haiku-4-5-20251001
- Phase 2 (генерація + фільтрація): claude-haiku-4-5-20251001
- Phase 3 (deep dive топ-5 ідей): claude-sonnet-4-6
Інструмент web_search_20250305 підключається до Haiku в Phase 1.

## 12 ринків (markets.ts)
Масив об'єктів з полями id, name, searchAngles[]:
1.  poverty          — Рынок бедности
2.  connection       — Рынок коннекта
3.  aging            — Рынок старости
4.  fuel             — Рынок топлива
5.  better_life      — Рынок мечтаний о лучшей жизни
6.  freedom          — Рынок свободы
7.  media            — Рынок медиа
8.  education        — Рынок обучения
9.  fashion          — Рынок fashion
10. entertainment    — Рынок развлечений
11. beauty           — Рынок бьюти
12. lifestyle        — Рынок лайфстайла

Для кожного ринку — 4 пошукові кути:
["emerging niches 2025", "underserved pain points", 
 "fastest growing sub-segments", "new monetization models"]

## Phase 1 — Scout (Haiku + web_search)
- Для кожного ринку виконати 4 web-пошуки
- З результатів витягнути 10-15 сигналів
- Сигнал = {title, source, relevance_note}
- Зберігати сирі сигнали в Supabase

## Phase 2 — Generate & Filter (Haiku)

### 2a. Генерація ідей
З сигналів генерувати 5-8 ідей на ринок.
Формат ідеї (TypeScript interface):
interface RawIdea {
  market_id: string
  title: string
  description: string        // 2 речення
  target_audience: string
  monetization: string
  why_now: string
  signals_used: string[]
}

### 2b. Kill Criteria (Пас 1 — автоматичне відсіювання)
Вбивати ідею одразу якщо будь-що з цього true:
- Ринок повністю commoditized (потрібен $10M+ capex)
- Регуляторний ад без обходу
- Домінантний гравець з 70%+ ринку + network effect
- TAM < $100M
- Нереалістично для команди 1-3 людей за 6 місяців
Зберігати killed_at_pass=1, kill_reason.

### 2c. Scoring (Пас 2 — для тих що вижили)
Оцінювати по 6 критеріях (0-100):
- urgency_score (20%) — люди вже платять за погані рішення?
- timing_score (20%) — є ринковий tailwind?
- advantage_score (15%) — хто має unfair advantage?
- monetization_score (15%) — чіткий шлях до $?
- competition_score (15%) — є реальний gap?
- mvp_speed_score (15%) — можна перевірити за 4-8 тижнів?
Фінальний score = зважена сума.
Прохід у Phase 3: score >= 65.

## Phase 3 — Deep Dive (Sonnet, тільки топ-5 по score)
Для кожної ідеї що пройшла:
interface DeepDive {
  analogues: string[]          // хто вже заробляє і скільки
  entry_bootstrap: string      // варіант входу без інвестицій
  entry_vc: string             // варіант з залученням капіталу
  entry_lifestyle: string      // lifestyle бізнес варіант
  main_risks: string[]         // топ-3 ризики
  risk_mitigations: string[]   // як мітигувати
  first_validation_step: string // перший крок MVP (конкретний)
  team_fit_score: number       // 0-10, наскільки підходить малій команді
}

## Supabase схема (створити міграцію)

-- Сесії сканування
CREATE TABLE scout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  markets_scanned int DEFAULT 0,
  ideas_generated int DEFAULT 0,
  ideas_killed_p1 int DEFAULT 0,
  ideas_killed_p2 int DEFAULT 0,
  survivors int DEFAULT 0,
  status text DEFAULT 'running', -- running | done | failed
  created_at timestamptz DEFAULT now()
);

-- Всі ідеї
CREATE TABLE scout_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES scout_sessions(id),
  market_id text NOT NULL,
  title text NOT NULL,
  description text,
  target_audience text,
  monetization text,
  why_now text,
  killed_at_pass int,          -- 1, 2, або null
  kill_reason text,
  urgency_score int,
  timing_score int,
  advantage_score int,
  monetization_score int,
  competition_score int,
  mvp_speed_score int,
  total_score int,
  deep_dive jsonb,
  telegram_message_id bigint,  -- ID повідомлення в TG після публікації
  created_at timestamptz DEFAULT now()
);

-- Голосування команди
CREATE TABLE idea_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id uuid REFERENCES scout_ideas(id),
  telegram_user_id bigint NOT NULL,
  telegram_username text,
  vote text NOT NULL,          -- 'fire' | 'maybe' | 'skip'
  voted_at timestamptz DEFAULT now(),
  UNIQUE(idea_id, telegram_user_id)  -- один голос на людину
);

## Telegram Bot

### Формат поста (одна ідея = один пост)
─────────────────────
🔍 [MARKET NAME] · score: 74/100

💡 *[Назва ідеї]*

[Опис — 2 речення]

👥 *Аудиторія:* ...
💰 *Монетизація:* ...
⚡️ *Чому зараз:* ...

🏆 *Аналоги:* ...
🚀 *Перший крок:* ...
⚠️ *Головний ризик:* ...
─────────────────────
[🔥 0]  [🤔 0]  [👎 0]

### Кнопки (InlineKeyboard)
Три кнопки під кожним постом:
- 🔥 Годнота  → callback_data: vote_fire_{idea_id}
- 🤔 Може бути → callback_data: vote_maybe_{idea_id}
- 👎 Скіп      → callback_data: vote_skip_{idea_id}

При натисканні:
1. Зберегти голос у idea_votes (upsert)
2. Оновити лічильники на кнопках
3. Відповісти callback query "Голос прийнято ✓"

### Дайджест-повідомлення (перед постами)
Щодня першим іде summary:
─────────────────────
🗓 Sluice · [дата]

Проскановано ринків: 12
Ідей згенеровано: [N]
Відсіяно: [N]
*Годнота сьогодні: [N]*
─────────────────────

## Vercel Cron (vercel.json)
{
  "crons": [{
    "path": "/api/cron/scout",
    "schedule": "0 7 * * *"
  }]
}
Захист endpoint: перевірка header CRON_SECRET.

## Telegram Webhook
POST /api/telegram
Telegraf handleUpdate() обробляє всі апдейти.
Webhook реєструється один раз через 
https://api.telegram.org/bot{TOKEN}/setWebhook

## Environment Variables
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=          # ID чату/каналу команди
CRON_SECRET=               # для захисту cron endpoint

## Порядок розробки
1. Ініціалізація Next.js проєкту + TypeScript
2. Supabase client + міграція (створити таблиці)
3. markets.ts з конфігом всіх 12 ринків
4. Phase 1 (search) — протестувати на 1 ринку
5. Phase 2 (generate + filter) — протестувати ланцюг
6. Phase 3 (deep dive) — протестувати на 1 ідеї
7. Telegram bot — відправка + кнопки + handlers
8. Cron endpoint — зібрати всі фази разом
9. vercel.json + деплой
10. Реєстрація webhook

## Важливо
- Кожна фаза має бути незалежно тестованою
- Логувати початок/кінець кожної фази в scout_sessions
- При помилці в будь-якій фазі — не падати весь pipeline,
  логувати і продовжувати з наступним ринком/ідеєю
- Rate limiting: між API запитами робити затримку 500ms
- Весь код TypeScript strict, без any

## Статус виконання

Оновлено: 2026-05-17.

Зроблено:
- [x] Ініціалізовано Next.js 14 API-only проєкт зі strict TypeScript.
- [x] Додано базову структуру `app/api`, `lib/scout`, `lib/supabase`, `lib/telegram`.
- [x] Додано Supabase client, DB queries і міграцію `supabase/migrations/001_init.sql`.
- [x] Додано `markets.ts` з 12 ринками та пошуковими кутами.
- [x] Реалізовано Phase 1 scout через Anthropic Haiku + web search tool.
- [x] Реалізовано Phase 2 generate/filter/scoring через Anthropic Haiku.
- [x] Реалізовано Phase 3 deep dive для top-5 через Anthropic Sonnet.
- [x] Реалізовано Telegram bot posting, inline buttons і handlers для голосування.
- [x] Реалізовано cron endpoint `/api/cron/scout` із захистом через `CRON_SECRET`.
- [x] Додано `vercel.json`, `.env.example`, `README.md`, `package-lock.json`.
- [x] Пройдено перевірки `npm run typecheck`, `npm run lint`, `npm run build`.
- [x] Зроблено initial commit і push у `Boosenator/MarketScout`.
- [x] Змінні оточення додані користувачем.

Наступне:
- [ ] Застосувати Supabase migration у реальному Supabase project.
- [ ] Протестувати Phase 1 на одному ринку з реальним `ANTHROPIC_API_KEY`.
- [ ] Протестувати повний cron pipeline.
- [ ] Зареєструвати Telegram webhook після deploy.
- [ ] Деплой на Vercel і додавання env vars у Vercel.
- [ ] Окремо розібрати `npm audit` попередження перед продом.

## Статус 2026-05-17 / deploy

Зроблено:
- [x] Supabase migration застосована користувачем.
- [x] Прод-домен Vercel: `https://market-scout-seven.vercel.app/`.
- [x] Telegram webhook зареєстровано користувачем.
- [x] Додано Telegram-команди для тестування фаз по конкретному ринку:
  `/markets`, `/phase1 <market_id>`, `/phase2 <market_id>`, `/phase3 <market_id>`, `/testmarket <market_id>`.

Потрібно для webhook:
- [x] Зареєструвати Telegram webhook на `https://market-scout-seven.vercel.app/api/telegram`.
- [x] Для реєстрації потрібен локальний доступ до `TELEGRAM_BOT_TOKEN` або залінкований Vercel project для `vercel env pull`.
## Статус 2026-05-17 / web-grounded ideas

Зроблено:
- [x] Phase 2 generate тепер використовує web search перед генерацією ідей.
- [x] Phase 3 deep dive тепер використовує web search для перевірки аналогів, ризиків і поточного контексту.
- [x] Промпти уточнені: не вигадувати traction/revenue/аналоги, а спиратися на реальні web-сигнали.
## Статус 2026-05-17 / geography

Зроблено:
- [x] Цільова географія для пошуку ідей уточнена: Україна, Європа, США.
- [x] Phase 1/2/3 промпти оновлені: не використовувати РФ як дефолтний ринок або регуляторний контекст.
- [x] Пошукові кути доповнені гео-фокусом Ukraine / Europe / USA.
## Статус 2026-05-17 / excluded geography

Зроблено:
- [x] РФ, Білорусь і СНД явно виключені з пошуку, аналогів, ризиків, регуляторики, каналів і попиту.
- [x] Додано runtime-фільтр, який відсікає Phase 2 ідеї з виключеною географією.
- [x] Deep dive очищає аналоги/ризики/мітигації, якщо модель все ж протягнула виключену географію.
## Статус 2026-05-17 / rate limits

Зроблено:
- [x] Додано автоматичний retry для Anthropic 429 rate limit із паузою перед повтором.
- [x] Phase 1 зменшено до 10 сигналів для тестових/пайплайн-запусків.
- [x] Phase 2 отримує компактний список сигналів, щоб не витрачати зайві input tokens.
- [x] Зменшено max token budgets у Phase 2/3 без втрати основної структури відповіді.
## Статус 2026-05-18 / atomic phases

Зроблено:
- [x] Phase 2 generate працює атомарно: один сигнал -> один web-grounded запит -> одна ідея.
- [x] Phase 2 filter працює атомарно: одна ідея -> один scoring/kill запит.
- [x] Окрема posting-аналітика мержить survivors, вибирає top-5, робить deep dive і постить результат.
- [x] Це зменшує input-token spikes і робить результати простіше дебажити по конкретному сигналу.
## Статус 2026-05-18 / bot UX

Зроблено:
- [x] Додано головне меню Telegram-бота через `/start`, `/help`, `/menu`.
- [x] Додано кнопки: результати аналізу, тести ринків, список ринків, допомога.
- [x] Результати deep dive можна дивитися по одному з навігацією назад/вперед.
- [x] Callback-и меню відокремлені від callback-ів голосування.
## Статус 2026-05-18 / quick vs full mode

Зроблено:
- [x] `/testmarket` став швидким режимом: 2 сигнали, без додаткового web search у Phase 2/3.
- [x] Додано `/fullmarket <market_id>` для повного web-grounded аналізу.
- [x] Меню тестів оновлено: показує quick/full сценарії.
- [x] Це прибирає накопичення retry-пауз і зменшує ризик Vercel 300s timeout.
## Статус 2026-05-18 / full bot management

Зроблено:
- [x] Нові DB-запити: `getLatestSession`, `getTotalStats`, `getVoteCountsForIdeas` (batch).
- [x] Головне меню переробили: додали "▶️ Запустити аналіз" і "📈 Статус".
- [x] Нова сторінка "📊 Результати" — тепер показує vote counts для кожної ідеї.
- [x] Нова сторінка "🔥 Топ по голосах" — ідеї відсортовані по 🔥 з пагінацією.
- [x] Нова сторінка "📈 Статус" — остання сесія + загальна статистика.
- [x] Нова сторінка підтвердження запуску — перевіряє чи вже running, показує підтвердження.
- [x] Запуск pipeline через кнопку/команду — fire-and-forget HTTP до `/api/cron/scout`.
- [x] Нова команда `/run` — запускає повний pipeline (з перевіркою duplicate run).
- [x] Нова команда `/status` — показує статус останньої сесії.
- [x] URL для trigger: `SITE_URL` env або `VERCEL_URL` auto або `localhost:3000` fallback.
## Статус 2026-05-18 / chunked pipeline

Зроблено:
- [x] Pipeline розбитий на чанки по 4 ринки за invocation (замість 12 за раз).
- [x] Кожен виклик `/api/cron/scout` обробляє наступний чанк і self-trigger-ить наступний виклик.
- [x] Resume: якщо є `running` сесія молодша 2 годин — продовжує з `markets_scanned`.
- [x] Counters (markets_scanned, ideas_generated, killed, survivors) накопичуються між чанками через DB.
- [x] Після всіх 12 ринків — завантажує survivors з DB (score ≥ 65), робить deep dive топ-5, постить.
- [x] `selfTriggerUrl` береться з `request.nextUrl.origin` у route.ts (без env-залежності).
- [x] Нові DB-запити: `findRunningSession` (2h cutoff), `loadSessionSurvivors` (sorted by score).
