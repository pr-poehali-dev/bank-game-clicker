import { useState, useRef, useCallback, useEffect } from "react";
import Icon from "@/components/ui/icon";

// ============ УТИЛИТЫ КАПЧИ ============
function generateCaptcha() {
  const ops = ["+", "-", "×"] as const;
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a: number, b: number, answer: number;
  if (op === "+") { a = Math.floor(Math.random() * 20) + 1; b = Math.floor(Math.random() * 20) + 1; answer = a + b; }
  else if (op === "-") { a = Math.floor(Math.random() * 20) + 10; b = Math.floor(Math.random() * 10) + 1; answer = a - b; }
  else { a = Math.floor(Math.random() * 9) + 2; b = Math.floor(Math.random() * 9) + 2; answer = a * b; }
  return { question: `${a} ${op} ${b} = ?`, answer };
}

// Простое хеширование пароля (XOR + base64 для браузера)
function hashPassword(password: string): string {
  return btoa(password.split("").map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ (i % 7 + 3))).join(""));
}

// ============ ТИПЫ ============
interface Player {
  id: string;
  name: string;
  balance: number;
  totalEarned: number;
  avatar: string;
}

interface Transaction {
  id: string;
  type: "click" | "transfer_in" | "transfer_out" | "game_win" | "game_lose";
  amount: number;
  description: string;
  timestamp: Date;
}

interface LeaderEntry {
  rank: number;
  name: string;
  balance: number;
  avatar: string;
}

// ============ ДАННЫЕ ============
const AVATARS = ["🦁", "🐯", "🦊", "🐺", "🦝", "🐻", "🐼", "🦄", "🐲", "🦅"];

const INITIAL_PLAYERS: Player[] = [
  { id: "p2", name: "Алексей", balance: 15200, totalEarned: 45000, avatar: "🐯" },
  { id: "p3", name: "Мария", balance: 9800, totalEarned: 28000, avatar: "🦊" },
  { id: "p4", name: "Дмитрий", balance: 7300, totalEarned: 19000, avatar: "🐺" },
  { id: "p5", name: "Анна", balance: 6100, totalEarned: 15000, avatar: "🦝" },
  { id: "p6", name: "Сергей", balance: 4200, totalEarned: 12000, avatar: "🐻" },
];

const SLOT_SYMBOLS = ["💎", "7️⃣", "🍋", "🍒", "⭐", "🔔", "💰", "🎰"];

type Tab = "clicker" | "profile" | "transfer" | "leaders" | "logs" | "games";

export default function Index() {
  const [currentTab, setCurrentTab] = useState<Tab>("clicker");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  // Регистрация
  const [regName, setRegName] = useState("");
  const [regAvatar, setRegAvatar] = useState("🦁");
  const [regPassword, setRegPassword] = useState("");
  const [regPasswordConfirm, setRegPasswordConfirm] = useState("");
  const [regShowPass, setRegShowPass] = useState(false);
  const [regErrors, setRegErrors] = useState<string[]>([]);

  // Капча
  const [captcha, setCaptcha] = useState(generateCaptcha);
  const [captchaInput, setCaptchaInput] = useState("");
  const [captchaError, setCaptchaError] = useState(false);

  // Вход
  const [loginName, setLoginName] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginShowPass, setLoginShowPass] = useState(false);
  const [loginError, setLoginError] = useState("");

  // База паролей (имя → хэш)
  const [passwordsDb, setPasswordsDb] = useState<Record<string, string>>({});

  const [player, setPlayer] = useState<Player>({
    id: "p1",
    name: "Игрок",
    balance: 1000,
    totalEarned: 1000,
    avatar: "🦁",
  });

  const [allPlayers, setAllPlayers] = useState<Player[]>(INITIAL_PLAYERS);
  const [transactions, setTransactions] = useState<Transaction[]>([
    { id: "t0", type: "click", amount: 1000, description: "Стартовый бонус 🎉", timestamp: new Date() },
  ]);

  // Кликер
  const [clickCount, setClickCount] = useState(0);
  const [coinsPerClick, setCoinsPerClick] = useState(1);
  const [floatingCoins, setFloatingCoins] = useState<{ id: number; x: number; y: number; amount: number }[]>([]);
  const [clickAnim, setClickAnim] = useState(false);
  const coinIdRef = useRef(0);

  // Перевод
  const [transferTo, setTransferTo] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferMsg, setTransferMsg] = useState("");

  // Слоты
  const [slotReels, setSlotReels] = useState(["🎰", "🎰", "🎰"]);
  const [slotSpinning, setSlotSpinning] = useState(false);
  const [slotBet, setSlotBet] = useState(100);
  const [slotResult, setSlotResult] = useState<string | null>(null);

  // Рулетка
  const [rouletteChoice, setRouletteChoice] = useState<"red" | "black" | "green" | null>(null);
  const [rouletteBet, setRouletteBet] = useState(100);
  const [rouletteSpinning, setRouletteSpinning] = useState(false);
  const [rouletteResult, setRouletteResult] = useState<string | null>(null);
  const [rouletteNum, setRouletteNum] = useState<number | null>(null);

  // Угадай число
  const [guessNum, setGuessNum] = useState("");
  const [guessBet, setGuessBet] = useState(100);
  const [guessResult, setGuessResult] = useState<string | null>(null);
  const [guessSecret, setGuessSecret] = useState<number | null>(null);

  const addTransaction = useCallback((tx: Omit<Transaction, "id" | "timestamp">) => {
    const newTx: Transaction = { ...tx, id: `t${Date.now()}`, timestamp: new Date() };
    setTransactions(prev => [newTx, ...prev]);
  }, []);

  // ============ КЛИКЕР ============
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    coinIdRef.current += 1;
    const id = coinIdRef.current;

    setFloatingCoins(prev => [...prev, { id, x, y, amount: coinsPerClick }]);
    setTimeout(() => setFloatingCoins(prev => prev.filter(c => c.id !== id)), 800);
    setClickAnim(true);
    setTimeout(() => setClickAnim(false), 250);

    setClickCount(c => c + 1);
    setPlayer(p => ({ ...p, balance: p.balance + coinsPerClick, totalEarned: p.totalEarned + coinsPerClick }));
    addTransaction({ type: "click", amount: coinsPerClick, description: "Клик по монете" });
  };

  const upgrades = [
    { label: "2x монеты", cost: 500, effect: () => setCoinsPerClick(2), done: coinsPerClick >= 2 },
    { label: "5x монеты", cost: 2000, effect: () => setCoinsPerClick(5), done: coinsPerClick >= 5 },
    { label: "10x монеты", cost: 8000, effect: () => setCoinsPerClick(10), done: coinsPerClick >= 10 },
  ];

  const buyUpgrade = (upgrade: typeof upgrades[0]) => {
    if (upgrade.done || player.balance < upgrade.cost) return;
    setPlayer(p => ({ ...p, balance: p.balance - upgrade.cost }));
    upgrade.effect();
    addTransaction({ type: "game_win", amount: -upgrade.cost, description: `Улучшение: ${upgrade.label}` });
  };

  // ============ РЕГИСТРАЦИЯ ============
  const handleRegister = () => {
    const errors: string[] = [];
    if (!regName.trim()) errors.push("Введи имя");
    if (regPassword.length < 6) errors.push("Пароль минимум 6 символов");
    if (regPassword !== regPasswordConfirm) errors.push("Пароли не совпадают");
    const captchaVal = parseInt(captchaInput);
    if (isNaN(captchaVal) || captchaVal !== captcha.answer) {
      errors.push("Неверный ответ в капче");
      setCaptchaError(true);
      setCaptcha(generateCaptcha());
      setCaptchaInput("");
    } else {
      setCaptchaError(false);
    }
    if (errors.length > 0) { setRegErrors(errors); return; }
    setRegErrors([]);
    const newPlayer: Player = { id: `p${Date.now()}`, name: regName.trim(), balance: 1000, totalEarned: 1000, avatar: regAvatar };
    setPasswordsDb(db => ({ ...db, [regName.trim().toLowerCase()]: hashPassword(regPassword) }));
    setPlayer(newPlayer);
    setIsLoggedIn(true);
    setShowRegister(false);
    addTransaction({ type: "click", amount: 1000, description: "Приветственный бонус 🎉" });
  };

  const handleLogin = () => {
    const found = allPlayers.find(p => p.name.toLowerCase() === loginName.toLowerCase());
    if (!found) { setLoginError("Игрок не найден"); return; }
    const storedHash = passwordsDb[loginName.toLowerCase()];
    if (storedHash && storedHash !== hashPassword(loginPassword)) {
      setLoginError("Неверный пароль");
      return;
    }
    setPlayer(found);
    setIsLoggedIn(true);
    setLoginError("");
  };

  // Сброс капчи при переходе на регистрацию
  useEffect(() => {
    if (showRegister) { setCaptcha(generateCaptcha()); setCaptchaInput(""); setCaptchaError(false); setRegErrors([]); }
  }, [showRegister]);

  // ============ ПЕРЕВОД ============
  const handleTransfer = () => {
    const amount = parseInt(transferAmount);
    if (!transferTo || isNaN(amount) || amount <= 0) { setTransferMsg("❌ Укажи получателя и сумму"); return; }
    if (amount > player.balance) { setTransferMsg("❌ Недостаточно средств"); return; }
    const target = allPlayers.find(p => p.name.toLowerCase() === transferTo.toLowerCase());
    if (!target) { setTransferMsg("❌ Игрок не найден"); return; }
    setPlayer(p => ({ ...p, balance: p.balance - amount }));
    setAllPlayers(prev => prev.map(p => p.id === target.id ? { ...p, balance: p.balance + amount } : p));
    addTransaction({ type: "transfer_out", amount, description: `Перевод → ${target.name}` });
    setTransferMsg(`✅ Отправлено ${amount.toLocaleString()} 💰 игроку ${target.name}`);
    setTransferTo("");
    setTransferAmount("");
  };

  // ============ СЛОТЫ ============
  const spinSlots = () => {
    if (slotSpinning || player.balance < slotBet) return;
    setPlayer(p => ({ ...p, balance: p.balance - slotBet }));
    setSlotSpinning(true);
    setSlotResult(null);

    const duration = 1500;
    const intervals = slotReels.map((_, i) =>
      setInterval(() => {
        setSlotReels(prev => {
          const updated = [...prev];
          updated[i] = SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
          return updated;
        });
      }, 80 + i * 30)
    );

    setTimeout(() => {
      intervals.forEach(clearInterval);
      const final = Array.from({ length: 3 }, () => SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]);
      setSlotReels(final);
      setSlotSpinning(false);

      let win = 0;
      let msg = "";
      if (final[0] === final[1] && final[1] === final[2]) {
        if (final[0] === "💎") { win = slotBet * 20; msg = `🎊 ДЖЕКПОТ! +${win.toLocaleString()} 💰`; }
        else if (final[0] === "7️⃣") { win = slotBet * 10; msg = `🎉 Три семёрки! +${win.toLocaleString()} 💰`; }
        else { win = slotBet * 5; msg = `✨ Три одинаковых! +${win.toLocaleString()} 💰`; }
      } else if (final[0] === final[1] || final[1] === final[2] || final[0] === final[2]) {
        win = slotBet * 2; msg = `👍 Пара! +${win.toLocaleString()} 💰`;
      } else {
        msg = `😔 Не повезло, потеря -${slotBet.toLocaleString()} 💰`;
      }

      if (win > 0) {
        setPlayer(p => ({ ...p, balance: p.balance + win, totalEarned: p.totalEarned + win }));
        addTransaction({ type: "game_win", amount: win, description: `Слоты: ${msg.slice(0, 40)}` });
      } else {
        addTransaction({ type: "game_lose", amount: -slotBet, description: "Слоты: без выигрыша" });
      }
      setSlotResult(msg);
    }, duration);
  };

  // ============ РУЛЕТКА ============
  const spinRoulette = () => {
    if (rouletteSpinning || !rouletteChoice || player.balance < rouletteBet) return;
    setPlayer(p => ({ ...p, balance: p.balance - rouletteBet }));
    setRouletteSpinning(true);
    setRouletteResult(null);

    let spins = 0;
    const interval = setInterval(() => {
      setRouletteNum(Math.floor(Math.random() * 37));
      spins++;
      if (spins > 20) clearInterval(interval);
    }, 80);

    setTimeout(() => {
      clearInterval(interval);
      const num = Math.floor(Math.random() * 37);
      setRouletteNum(num);
      setRouletteSpinning(false);

      let color: "red" | "black" | "green" = "black";
      if (num === 0) color = "green";
      else if ([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(num)) color = "red";

      let win = 0;
      let msg = "";
      if (color === rouletteChoice) {
        if (color === "green") { win = rouletteBet * 14; msg = `🟢 Зеро! +${win.toLocaleString()} 💰`; }
        else { win = rouletteBet * 2; msg = `🎉 Угадал ${color === "red" ? "🔴" : "⚫"} (${num})! +${win.toLocaleString()} 💰`; }
        setPlayer(p => ({ ...p, balance: p.balance + win, totalEarned: p.totalEarned + win }));
        addTransaction({ type: "game_win", amount: win, description: `Рулетка: ${msg.slice(0, 40)}` });
      } else {
        msg = `😔 Выпало ${color === "red" ? "🔴" : color === "green" ? "🟢" : "⚫"} (${num}), потеря -${rouletteBet.toLocaleString()} 💰`;
        addTransaction({ type: "game_lose", amount: -rouletteBet, description: `Рулетка: не угадал (${num})` });
      }
      setRouletteResult(msg);
    }, 1700);
  };

  // ============ УГАДАЙ ЧИСЛО ============
  const startGuess = () => {
    setGuessSecret(Math.floor(Math.random() * 10) + 1);
    setGuessResult(null);
    setGuessNum("");
  };

  const submitGuess = () => {
    if (!guessSecret || !guessNum || player.balance < guessBet) return;
    const num = parseInt(guessNum);
    if (isNaN(num) || num < 1 || num > 10) { setGuessResult("❌ Введи число от 1 до 10"); return; }
    setPlayer(p => ({ ...p, balance: p.balance - guessBet }));
    if (num === guessSecret) {
      const win = guessBet * 8;
      setPlayer(p => ({ ...p, balance: p.balance + win, totalEarned: p.totalEarned + win }));
      addTransaction({ type: "game_win", amount: win, description: `Угадай число: +${win.toLocaleString()} 💰` });
      setGuessResult(`🎯 Угадал! Было ${guessSecret}! +${win.toLocaleString()} 💰`);
    } else {
      addTransaction({ type: "game_lose", amount: -guessBet, description: `Угадай число: было ${guessSecret}` });
      setGuessResult(`😔 Неверно! Было ${guessSecret}. Потеря -${guessBet.toLocaleString()} 💰`);
    }
    setGuessSecret(null);
  };

  // ============ ЛИДЕРЫ ============
  const leaders: LeaderEntry[] = [
    { rank: 1, name: player.name, balance: player.balance, avatar: player.avatar },
    ...allPlayers.map(p => ({ rank: 0, name: p.name, balance: p.balance, avatar: p.avatar })),
  ]
    .sort((a, b) => b.balance - a.balance)
    .map((p, i) => ({ ...p, rank: i + 1 }));

  // ============ ЭКРАН ВХОДА ============
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md animate-bounce-in">
          <div className="text-center mb-8">
            <div className="text-7xl animate-float mb-3">🏦</div>
            <h1 className="font-orbitron text-4xl font-black gold-text mb-2">БАНК ИГРА</h1>
            <p className="text-muted-foreground text-sm">Виртуальный игровой банк</p>
          </div>

          <div className="game-card game-card-gold p-6 space-y-4">
            {!showRegister ? (
              <>
                <h2 className="text-xl font-bold text-center mb-2">Войти в игру</h2>

                {/* Имя */}
                <input
                  className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-yellow-500 transition-colors"
                  placeholder="Твоё имя..."
                  value={loginName}
                  onChange={e => setLoginName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLogin()}
                />

                {/* Пароль */}
                <div className="relative">
                  <input
                    type={loginShowPass ? "text" : "password"}
                    className="w-full bg-muted border border-border rounded-xl px-4 py-3 pr-12 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-yellow-500 transition-colors"
                    placeholder="Пароль..."
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleLogin()}
                  />
                  <button
                    type="button"
                    onClick={() => setLoginShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Icon name={loginShowPass ? "EyeOff" : "Eye"} size={18} />
                  </button>
                </div>

                {loginError && (
                  <div className="flex items-center gap-2 bg-red-900/30 border border-red-700/50 rounded-xl px-4 py-2">
                    <Icon name="AlertCircle" size={16} className="text-red-400 shrink-0" />
                    <p className="text-red-400 text-sm">{loginError}</p>
                  </div>
                )}

                <button onClick={handleLogin} className="btn-gold w-full py-3 rounded-xl text-lg font-orbitron">
                  ВОЙТИ
                </button>
                <div className="text-center">
                  <button onClick={() => setShowRegister(true)} className="text-muted-foreground hover:text-yellow-400 text-sm transition-colors">
                    Нет аккаунта? Зарегистрироваться →
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-center mb-2">Регистрация</h2>

                {/* Имя */}
                <input
                  className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-yellow-500 transition-colors"
                  placeholder="Твоё имя..."
                  value={regName}
                  onChange={e => setRegName(e.target.value)}
                />

                {/* Пароль */}
                <div className="relative">
                  <input
                    type={regShowPass ? "text" : "password"}
                    className="w-full bg-muted border border-border rounded-xl px-4 py-3 pr-12 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-yellow-500 transition-colors"
                    placeholder="Придумай пароль (мин. 6 символов)..."
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setRegShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Icon name={regShowPass ? "EyeOff" : "Eye"} size={18} />
                  </button>
                </div>

                {/* Подтверждение пароля */}
                <div className="relative">
                  <input
                    type={regShowPass ? "text" : "password"}
                    className={`w-full bg-muted border rounded-xl px-4 py-3 pr-12 text-foreground placeholder:text-muted-foreground focus:outline-none transition-colors ${
                      regPasswordConfirm && regPassword !== regPasswordConfirm
                        ? "border-red-500 focus:border-red-400"
                        : regPasswordConfirm && regPassword === regPasswordConfirm
                        ? "border-green-500"
                        : "border-border focus:border-yellow-500"
                    }`}
                    placeholder="Повтори пароль..."
                    value={regPasswordConfirm}
                    onChange={e => setRegPasswordConfirm(e.target.value)}
                  />
                  {regPasswordConfirm && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Icon
                        name={regPassword === regPasswordConfirm ? "CheckCircle" : "XCircle"}
                        size={18}
                        className={regPassword === regPasswordConfirm ? "text-green-400" : "text-red-400"}
                      />
                    </div>
                  )}
                </div>

                {/* Индикатор силы пароля */}
                {regPassword && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[...Array(4)].map((_, i) => {
                        const strength = regPassword.length >= 12 ? 4 : regPassword.length >= 8 ? 3 : regPassword.length >= 6 ? 2 : 1;
                        return (
                          <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i < strength
                            ? strength === 1 ? "bg-red-500" : strength === 2 ? "bg-yellow-500" : strength === 3 ? "bg-blue-400" : "bg-green-400"
                            : "bg-muted"}`}
                          />
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Сложность: {regPassword.length >= 12 ? "🔒 Отличная" : regPassword.length >= 8 ? "🛡️ Хорошая" : regPassword.length >= 6 ? "⚠️ Слабая" : "❌ Слишком короткий"}
                    </p>
                  </div>
                )}

                {/* Аватар */}
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Выбери аватар:</p>
                  <div className="grid grid-cols-5 gap-2">
                    {AVATARS.map(av => (
                      <button
                        key={av}
                        onClick={() => setRegAvatar(av)}
                        className={`text-2xl p-2 rounded-xl border-2 transition-all ${regAvatar === av ? "border-yellow-400 bg-yellow-400/10 scale-110" : "border-border bg-muted hover:border-yellow-600"}`}
                      >
                        {av}
                      </button>
                    ))}
                  </div>
                </div>

                {/* КАПЧА */}
                <div className={`rounded-xl border-2 p-4 space-y-3 transition-all ${captchaError ? "border-red-500 bg-red-900/10" : "border-border bg-muted/50"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Icon name="ShieldCheck" size={16} className="text-yellow-400" />
                    <span className="text-sm font-semibold text-muted-foreground">Проверка — не бот ли ты?</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="font-orbitron text-xl font-black text-yellow-300 bg-muted rounded-xl px-4 py-2 tracking-widest select-none border border-yellow-800/50">
                      {captcha.question}
                    </div>
                    <button
                      type="button"
                      onClick={() => { setCaptcha(generateCaptcha()); setCaptchaInput(""); setCaptchaError(false); }}
                      className="text-muted-foreground hover:text-yellow-400 transition-colors"
                      title="Новый вопрос"
                    >
                      <Icon name="RefreshCw" size={18} />
                    </button>
                  </div>
                  <input
                    type="number"
                    className={`w-full bg-muted border rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none transition-colors ${captchaError ? "border-red-500" : "border-border focus:border-yellow-500"}`}
                    placeholder="Твой ответ..."
                    value={captchaInput}
                    onChange={e => { setCaptchaInput(e.target.value); setCaptchaError(false); }}
                    onKeyDown={e => e.key === "Enter" && handleRegister()}
                  />
                  {captchaError && (
                    <p className="text-red-400 text-xs flex items-center gap-1">
                      <Icon name="X" size={12} /> Неверно! Попробуй ещё раз
                    </p>
                  )}
                </div>

                {/* Ошибки */}
                {regErrors.length > 0 && (
                  <div className="bg-red-900/30 border border-red-700/50 rounded-xl px-4 py-3 space-y-1">
                    {regErrors.map((e, i) => (
                      <p key={i} className="text-red-400 text-sm flex items-center gap-2">
                        <Icon name="AlertCircle" size={14} className="shrink-0" />
                        {e}
                      </p>
                    ))}
                  </div>
                )}

                <button onClick={handleRegister} className="btn-gold w-full py-3 rounded-xl text-lg font-orbitron">
                  НАЧАТЬ ИГРУ +1000 💰
                </button>
                <div className="text-center">
                  <button onClick={() => setShowRegister(false)} className="text-muted-foreground hover:text-yellow-400 text-sm transition-colors">
                    ← Назад
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="mt-4 game-card p-4">
            <p className="text-xs text-muted-foreground text-center mb-3">🟢 Сейчас в игре</p>
            <div className="flex justify-center gap-4">
              {allPlayers.slice(0, 5).map(p => (
                <div key={p.id} className="flex flex-col items-center gap-1">
                  <span className="text-xl">{p.avatar}</span>
                  <span className="text-xs text-muted-foreground">{p.name.slice(0, 6)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============ НАВИГАЦИЯ ============
  const tabs: { id: Tab; icon: string; label: string }[] = [
    { id: "clicker", icon: "MousePointerClick", label: "Кликер" },
    { id: "games", icon: "Dices", label: "Игры" },
    { id: "transfer", icon: "ArrowLeftRight", label: "Перевод" },
    { id: "leaders", icon: "Trophy", label: "Топ" },
    { id: "logs", icon: "ScrollText", label: "Логи" },
    { id: "profile", icon: "User", label: "Профиль" },
  ];

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏦</span>
            <span className="font-orbitron text-lg font-bold gold-text">БАНК</span>
          </div>
          <div className="flex items-center gap-2 game-card game-card-gold px-4 py-2 rounded-xl animate-neon-pulse">
            <span className="text-yellow-400">💰</span>
            <span className="font-orbitron font-bold text-yellow-300">{player.balance.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl">{player.avatar}</span>
            <span className="text-sm font-semibold hidden sm:block">{player.name}</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">

        {/* ====== КЛИКЕР ====== */}
        {currentTab === "clicker" && (
          <div className="space-y-6 animate-fade-up">
            <div className="text-center">
              <h2 className="font-orbitron text-2xl font-bold gold-text mb-1">МОНЕТНЫЙ КЛИКЕР</h2>
              <p className="text-muted-foreground text-sm">+{coinsPerClick} 💰 за клик</p>
            </div>

            <div className="flex justify-center">
              <div className="relative">
                <button
                  className={`clicker-btn ${clickAnim ? "animate-click-burst" : ""}`}
                  onClick={handleClick}
                >
                  💰
                </button>
                {floatingCoins.map(c => (
                  <div
                    key={c.id}
                    className="absolute pointer-events-none font-orbitron font-bold text-yellow-300 animate-money-fly text-sm"
                    style={{ left: c.x, top: c.y, transform: "translate(-50%, -50%)" }}
                  >
                    +{c.amount}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Всего кликов", value: clickCount.toLocaleString(), icon: "MousePointerClick" },
                { label: "Баланс", value: `${player.balance.toLocaleString()} 💰`, icon: "Wallet" },
                { label: "Заработано", value: `${player.totalEarned.toLocaleString()} 💰`, icon: "TrendingUp" },
              ].map(stat => (
                <div key={stat.label} className="game-card p-3 text-center">
                  <Icon name={stat.icon} size={18} className="text-yellow-400 mx-auto mb-1" />
                  <div className="font-orbitron font-bold text-sm text-yellow-300">{stat.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
                </div>
              ))}
            </div>

            <div className="game-card p-4">
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <Icon name="Zap" size={18} className="text-yellow-400" />
                Улучшения
              </h3>
              <div className="space-y-2">
                {upgrades.map(upg => (
                  <div key={upg.label} className="flex items-center justify-between bg-muted rounded-xl px-4 py-3">
                    <div>
                      <span className="font-semibold text-sm">{upg.label}</span>
                      {upg.done && <span className="ml-2 text-xs text-green-400">✓ куплено</span>}
                    </div>
                    <button
                      onClick={() => buyUpgrade(upg)}
                      disabled={upg.done || player.balance < upg.cost}
                      className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                        upg.done
                          ? "bg-green-800/50 text-green-400 cursor-not-allowed"
                          : player.balance < upg.cost
                          ? "bg-muted-foreground/20 text-muted-foreground cursor-not-allowed"
                          : "btn-gold"
                      }`}
                    >
                      {upg.done ? "✓" : `${upg.cost.toLocaleString()} 💰`}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ====== МИНИ-ИГРЫ ====== */}
        {currentTab === "games" && (
          <div className="space-y-5 animate-fade-up">
            <h2 className="font-orbitron text-2xl font-bold gold-text text-center">МИНИ-ИГРЫ</h2>

            {/* СЛОТЫ */}
            <div className="game-card p-5 border neon-border-pink">
              <h3 className="font-orbitron font-bold text-lg mb-4 flex items-center gap-2">
                <span>🎰</span> Слоты
              </h3>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {slotReels.map((sym, i) => (
                  <div key={i} className="slot-reel">
                    <span className={slotSpinning ? "blur-sm" : ""}>{sym}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="text-sm text-muted-foreground">Ставка:</span>
                {[50, 100, 500, 1000].map(b => (
                  <button
                    key={b}
                    onClick={() => setSlotBet(b)}
                    className={`px-3 py-1 rounded-lg text-sm font-bold transition-all ${slotBet === b ? "tab-active" : "bg-muted text-foreground hover:bg-muted/70"}`}
                  >
                    {b}
                  </button>
                ))}
              </div>
              {slotResult && (
                <div className={`text-center py-2 px-4 rounded-xl mb-3 font-bold text-sm ${slotResult.includes("😔") ? "bg-red-900/30 text-red-300" : "bg-green-900/30 text-green-300"}`}>
                  {slotResult}
                </div>
              )}
              <button
                onClick={spinSlots}
                disabled={slotSpinning || player.balance < slotBet}
                className={`btn-purple w-full py-3 rounded-xl font-orbitron text-white ${(slotSpinning || player.balance < slotBet) ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {slotSpinning ? "🎰 Крутится..." : `КРУТИТЬ (${slotBet} 💰)`}
              </button>
            </div>

            {/* РУЛЕТКА */}
            <div className="game-card p-5 border neon-border-green">
              <h3 className="font-orbitron font-bold text-lg mb-4 flex items-center gap-2">
                <span>🎡</span> Рулетка
              </h3>
              {rouletteNum !== null && (
                <div className="text-center text-6xl font-orbitron font-black mb-4 animate-bounce-in">
                  {rouletteNum}
                </div>
              )}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {(["red", "black", "green"] as const).map(color => (
                  <button
                    key={color}
                    onClick={() => setRouletteChoice(color)}
                    className={`py-3 rounded-xl font-bold text-sm transition-all border-2 ${
                      rouletteChoice === color
                        ? color === "red" ? "bg-red-600 border-red-400 text-white scale-105"
                          : color === "black" ? "bg-gray-700 border-gray-400 text-white scale-105"
                          : "bg-green-600 border-green-400 text-white scale-105"
                        : "bg-muted border-border text-muted-foreground hover:border-muted-foreground"
                    }`}
                  >
                    {color === "red" ? "🔴 Красное" : color === "black" ? "⚫ Чёрное" : "🟢 Зеро"}
                    <div className="text-xs font-normal mt-0.5 opacity-70">{color === "green" ? "x14" : "x2"}</div>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="text-sm text-muted-foreground">Ставка:</span>
                {[50, 100, 500, 1000].map(b => (
                  <button
                    key={b}
                    onClick={() => setRouletteBet(b)}
                    className={`px-3 py-1 rounded-lg text-sm font-bold transition-all ${rouletteBet === b ? "tab-active" : "bg-muted text-foreground hover:bg-muted/70"}`}
                  >
                    {b}
                  </button>
                ))}
              </div>
              {rouletteResult && (
                <div className={`text-center py-2 px-4 rounded-xl mb-3 font-bold text-sm ${rouletteResult.includes("😔") ? "bg-red-900/30 text-red-300" : "bg-green-900/30 text-green-300"}`}>
                  {rouletteResult}
                </div>
              )}
              <button
                onClick={spinRoulette}
                disabled={rouletteSpinning || !rouletteChoice || player.balance < rouletteBet}
                className={`btn-green w-full py-3 rounded-xl font-orbitron text-white ${(rouletteSpinning || !rouletteChoice || player.balance < rouletteBet) ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {rouletteSpinning ? "🎡 Крутится..." : !rouletteChoice ? "Выбери цвет" : `ПОСТАВИТЬ (${rouletteBet} 💰)`}
              </button>
            </div>

            {/* УГАДАЙ ЧИСЛО */}
            <div className="game-card p-5 border neon-border-blue">
              <h3 className="font-orbitron font-bold text-lg mb-4 flex items-center gap-2">
                <span>🎯</span> Угадай число (1–10)
                <span className="text-xs text-muted-foreground font-normal ml-auto">x8 при угадывании</span>
              </h3>
              {guessSecret !== null ? (
                <div className="space-y-3">
                  <p className="text-center text-muted-foreground text-sm">Загадал число от 1 до 10. Угадай!</p>
                  <div className="grid grid-cols-5 gap-2">
                    {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                      <button
                        key={n}
                        onClick={() => setGuessNum(String(n))}
                        className={`py-3 rounded-xl font-orbitron font-bold text-lg transition-all border-2 ${
                          guessNum === String(n) ? "tab-active border-yellow-400" : "bg-muted border-border text-foreground hover:border-yellow-600"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-muted-foreground">Ставка:</span>
                    {[50, 100, 500].map(b => (
                      <button key={b} onClick={() => setGuessBet(b)}
                        className={`px-3 py-1 rounded-lg text-sm font-bold transition-all ${guessBet === b ? "tab-active" : "bg-muted text-foreground"}`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={submitGuess}
                    disabled={!guessNum || player.balance < guessBet}
                    className={`btn-gold w-full py-3 rounded-xl font-orbitron ${(!guessNum || player.balance < guessBet) ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {guessNum ? `ПОСТАВИТЬ НА ${guessNum} (${guessBet} 💰)` : "Выбери число"}
                  </button>
                </div>
              ) : (
                <div className="text-center space-y-3">
                  {guessResult && (
                    <div className={`py-3 px-4 rounded-xl font-bold ${guessResult.includes("😔") ? "bg-red-900/30 text-red-300" : "bg-green-900/30 text-green-300"}`}>
                      {guessResult}
                    </div>
                  )}
                  <button onClick={startGuess} className="btn-gold px-8 py-3 rounded-xl font-orbitron">
                    🎯 ЗАГАДАТЬ ЧИСЛО
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ====== ПЕРЕВОД ====== */}
        {currentTab === "transfer" && (
          <div className="space-y-5 animate-fade-up">
            <h2 className="font-orbitron text-2xl font-bold gold-text text-center">ПЕРЕВОД</h2>

            <div className="game-card p-5 space-y-4">
              <div className="flex items-center gap-3 bg-muted rounded-xl px-4 py-3">
                <span className="text-2xl">{player.avatar}</span>
                <div>
                  <div className="text-xs text-muted-foreground">Твой баланс</div>
                  <div className="font-orbitron font-bold text-yellow-300">{player.balance.toLocaleString()} 💰</div>
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Получатель</label>
                <input
                  className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-yellow-500 transition-colors"
                  placeholder="Имя игрока..."
                  value={transferTo}
                  onChange={e => setTransferTo(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Сумма</label>
                <input
                  type="number"
                  className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-yellow-500 transition-colors"
                  placeholder="100"
                  value={transferAmount}
                  onChange={e => setTransferAmount(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                {[100, 500, 1000, 5000].map(amt => (
                  <button
                    key={amt}
                    onClick={() => setTransferAmount(String(amt))}
                    className="flex-1 bg-muted hover:bg-muted/70 rounded-lg py-2 text-sm font-bold transition-all border border-border hover:border-yellow-600 text-foreground"
                  >
                    {amt}
                  </button>
                ))}
              </div>

              {transferMsg && (
                <div className={`py-3 px-4 rounded-xl text-sm font-semibold text-center ${transferMsg.startsWith("✅") ? "bg-green-900/30 text-green-300" : "bg-red-900/30 text-red-300"}`}>
                  {transferMsg}
                </div>
              )}

              <button onClick={handleTransfer} className="btn-gold w-full py-3 rounded-xl font-orbitron text-lg">
                ОТПРАВИТЬ 💸
              </button>
            </div>

            <div className="game-card p-4">
              <h3 className="font-bold mb-3 text-sm text-muted-foreground">Все игроки:</h3>
              <div className="space-y-2">
                {allPlayers.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setTransferTo(p.name)}
                    className={`w-full flex items-center justify-between bg-muted hover:bg-muted/70 rounded-xl px-4 py-3 transition-all border ${transferTo === p.name ? "border-yellow-500" : "border-transparent"}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{p.avatar}</span>
                      <span className="font-semibold text-sm text-foreground">{p.name}</span>
                    </div>
                    <span className="text-yellow-300 font-orbitron text-sm">{p.balance.toLocaleString()} 💰</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ====== ЛИДЕРЫ ====== */}
        {currentTab === "leaders" && (
          <div className="space-y-4 animate-fade-up">
            <h2 className="font-orbitron text-2xl font-bold gold-text text-center">🏆 ТОП ИГРОКОВ</h2>

            <div className="flex gap-3 justify-center mb-6">
              {leaders.slice(0, 3).map((l, i) => (
                <div
                  key={l.name}
                  className={`game-card p-4 text-center flex-1 border ${i === 0 ? "border-yellow-500 game-card-gold" : i === 1 ? "border-gray-400" : "border-orange-700"}`}
                >
                  <div className="text-3xl mb-1">{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</div>
                  <div className="text-2xl mb-1">{l.avatar}</div>
                  <div className="font-bold text-xs">{l.name}</div>
                  <div className="font-orbitron text-xs text-yellow-300 mt-1">{l.balance.toLocaleString()}</div>
                </div>
              ))}
            </div>

            <div className="game-card p-4">
              <div className="space-y-2">
                {leaders.map(l => (
                  <div
                    key={l.name}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 ${l.name === player.name ? "bg-yellow-900/20 border border-yellow-700" : "bg-muted"}`}
                  >
                    <span className="font-orbitron font-bold text-muted-foreground w-6 text-sm">#{l.rank}</span>
                    <span className="text-xl">{l.avatar}</span>
                    <span className="flex-1 font-semibold text-sm text-foreground">
                      {l.name} {l.name === player.name && <span className="text-xs text-yellow-400">(ты)</span>}
                    </span>
                    <span className="font-orbitron text-yellow-300 text-sm">{l.balance.toLocaleString()} 💰</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ====== ЛОГИ ====== */}
        {currentTab === "logs" && (
          <div className="space-y-4 animate-fade-up">
            <h2 className="font-orbitron text-2xl font-bold gold-text text-center">ИСТОРИЯ</h2>

            <div className="game-card p-4">
              {transactions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Пока нет операций</p>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {transactions.map(tx => (
                    <div key={tx.id} className="flex items-center gap-3 bg-muted rounded-xl px-4 py-3">
                      <span className="text-xl">
                        {tx.type === "click" ? "👆" : tx.type === "transfer_out" ? "📤" : tx.type === "transfer_in" ? "📥" : tx.type === "game_win" ? "🎉" : "😔"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate text-foreground">{tx.description}</div>
                        <div className="text-xs text-muted-foreground">
                          {tx.timestamp.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </div>
                      </div>
                      <span className={`font-orbitron font-bold text-sm whitespace-nowrap ${tx.amount > 0 ? "text-green-400" : "text-red-400"}`}>
                        {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString()} 💰
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ====== ПРОФИЛЬ ====== */}
        {currentTab === "profile" && (
          <div className="space-y-5 animate-fade-up">
            <h2 className="font-orbitron text-2xl font-bold gold-text text-center">МОЙ ПРОФИЛЬ</h2>

            <div className="game-card game-card-gold p-6 text-center">
              <div className="text-6xl mb-3">{player.avatar}</div>
              <h3 className="font-orbitron text-2xl font-black mb-1 text-foreground">{player.name}</h3>
              <p className="text-muted-foreground text-sm mb-4">#{leaders.find(l => l.name === player.name)?.rank ?? "?"} в рейтинге</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted rounded-xl p-3">
                  <div className="text-xs text-muted-foreground mb-1">Баланс</div>
                  <div className="font-orbitron font-bold text-yellow-300">{player.balance.toLocaleString()} 💰</div>
                </div>
                <div className="bg-muted rounded-xl p-3">
                  <div className="text-xs text-muted-foreground mb-1">Заработано всего</div>
                  <div className="font-orbitron font-bold text-green-300">{player.totalEarned.toLocaleString()} 💰</div>
                </div>
                <div className="bg-muted rounded-xl p-3">
                  <div className="text-xs text-muted-foreground mb-1">Всего кликов</div>
                  <div className="font-orbitron font-bold text-blue-300">{clickCount.toLocaleString()}</div>
                </div>
                <div className="bg-muted rounded-xl p-3">
                  <div className="text-xs text-muted-foreground mb-1">Монет за клик</div>
                  <div className="font-orbitron font-bold text-purple-300">{coinsPerClick}x</div>
                </div>
              </div>
            </div>

            <button
              onClick={() => { setIsLoggedIn(false); setCurrentTab("clicker"); }}
              className="w-full py-3 rounded-xl border-2 border-red-700 text-red-400 font-bold hover:bg-red-900/20 transition-all"
            >
              Выйти из аккаунта
            </button>
          </div>
        )}
      </main>

      {/* Нижняя навигация */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl bg-background/90 border-t border-border/50">
        <div className="max-w-2xl mx-auto px-2 py-2">
          <div className="grid grid-cols-6 gap-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id)}
                className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-all ${
                  currentTab === tab.id
                    ? "bg-yellow-500/20 text-yellow-300"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Icon name={tab.icon} size={20} />
                <span className="text-xs font-semibold">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>
    </div>
  );
}