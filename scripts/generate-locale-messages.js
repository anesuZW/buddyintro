/**
 * Build localized message catalogs from the English master file.
 * Run: node scripts/generate-locale-messages.js
 */
const { readFileSync, writeFileSync } = require("fs");
const { join } = require("path");

const ROOT = join(__dirname, "..");
const en = JSON.parse(readFileSync(join(ROOT, "messages", "en.json"), "utf8"));

const catalogs = {
  es: {
    common: { loading: "Cargando…", save: "Guardar", cancel: "Cancelar", close: "Cerrar", continue: "Continuar", back: "Atrás", or: "O", error: "Algo salió mal", success: "Éxito" },
    nav: { home: "Inicio", discover: "Descubrir", intro: "Presentar", intros: "Presentaciones", me: "Yo", messages: "Mensajes", notifications: "Notificaciones", settings: "Ajustes", admin: "Admin" },
    auth: { signIn: "Iniciar sesión", signingIn: "Iniciando sesión…", signUp: "Registrarse", signOut: "Cerrar sesión", email: "Correo", password: "Contraseña", magicLink: "Enviar enlace mágico", magicLinkSent: "Enlace enviado — revisa tu correo", enterEmailFirst: "Introduce tu correo primero", loginFailed: "Error al iniciar sesión", magicLinkFailed: "No se pudo enviar el enlace", newHere: "¿Nuevo aquí?", startTrustedNetwork: "Comienza a construir tu red de confianza", discoverThroughIntros: "Descubre personas a través de presentaciones" },
    profile: { language: "Idioma", languageHint: "Elige tu idioma preferido para la app, correos y notificaciones.", editProfile: "Editar perfil", notificationPreferences: "Preferencias de notificaciones", privacySettings: "Privacidad y datos", phoneVerification: "Verificación telefónica", trustNetwork: "Red de confianza" },
    language: { label: "Idioma", updated: "Idioma actualizado" },
    cookies: { title: "Preferencias de cookies", description: "Usamos cookies esenciales para ejecutar BuddyIntro.", acceptAll: "Aceptar todo", rejectNonEssential: "Rechazar no esenciales", customize: "Personalizar", analytics: "Analítica", savePreferences: "Guardar preferencias" },
    legal: { privacy: "Política de privacidad", terms: "Términos de servicio", cookies: "Política de cookies" },
    ugc: { translate: "Traducir" },
    notifications: {
      introductionReceivedTitle: "Nueva presentación",
      introductionReceivedMessage: "{authorName} te presentó en {appName}."
    },
    metadata: { description: "Presenta personas en las que confías. Descubre a otros mediante presentaciones mutuas." }
  },
  pt: {
    nav: { home: "Início", discover: "Descobrir", intro: "Apresentar", intros: "Apresentações", me: "Eu" },
    auth: { signIn: "Entrar", signingIn: "Entrando…", email: "E-mail", password: "Senha", startTrustedNetwork: "Comece a construir sua rede de confiança", discoverThroughIntros: "Descubra pessoas por meio de apresentações" },
    profile: { language: "Idioma", languageHint: "Escolha seu idioma preferido para o app, e-mails e notificações." },
    language: { label: "Idioma", updated: "Idioma atualizado" },
    ugc: { translate: "Traduzir" }
  },
  fr: {
    nav: { home: "Accueil", discover: "Découvrir", intro: "Présenter", intros: "Présentations", me: "Moi" },
    auth: { signIn: "Se connecter", signingIn: "Connexion…", email: "E-mail", password: "Mot de passe", startTrustedNetwork: "Commencez à bâtir votre réseau de confiance", discoverThroughIntros: "Découvrez des personnes grâce aux présentations" },
    profile: { language: "Langue", languageHint: "Choisissez votre langue pour l'app, les e-mails et les notifications." },
    language: { label: "Langue", updated: "Langue mise à jour" },
    ugc: { translate: "Traduire" }
  },
  de: {
    nav: { home: "Start", discover: "Entdecken", intro: "Vorstellen", intros: "Vorstellungen", me: "Ich" },
    auth: { signIn: "Anmelden", signingIn: "Anmeldung…", email: "E-Mail", password: "Passwort", startTrustedNetwork: "Bauen Sie Ihr Vertrauensnetzwerk auf", discoverThroughIntros: "Entdecken Sie Menschen durch Vorstellungen" },
    profile: { language: "Sprache", languageHint: "Wählen Sie Ihre bevorzugte Sprache für App, E-Mails und Benachrichtigungen." },
    language: { label: "Sprache", updated: "Sprache aktualisiert" },
    ugc: { translate: "Übersetzen" }
  },
  hi: {
    nav: { home: "होम", discover: "खोजें", intro: "परिचय", intros: "परिचय", me: "मैं" },
    auth: { signIn: "साइन इन", signingIn: "साइन इन हो रहा है…", email: "ईमेल", password: "पासवर्ड", startTrustedNetwork: "अपना विश्वसनीय नेटवर्क बनाना शुरू करें", discoverThroughIntros: "परिचय के माध्यम से लोगों को खोजें" },
    profile: { language: "भाषा", languageHint: "ऐप, ईमेल और सूचनाओं के लिए अपनी पसंदीदा भाषा चुनें।" },
    language: { label: "भाषा", updated: "भाषा अपडेट की गई" },
    ugc: { translate: "अनुवाद करें" }
  },
  ar: {
    nav: { home: "الرئيسية", discover: "استكشاف", intro: "تقديم", intros: "تقديمات", me: "أنا" },
    auth: { signIn: "تسجيل الدخول", signingIn: "جارٍ تسجيل الدخول…", email: "البريد الإلكتروني", password: "كلمة المرور", startTrustedNetwork: "ابدأ ببناء شبكة الثقة الخاصة بك", discoverThroughIntros: "اكتشف людей من خلال التعارف" },
    profile: { language: "اللغة", languageHint: "اختر لغتك المفضلة للتطبيق والبريد والإشعارات." },
    language: { label: "اللغة", updated: "تم تحديث اللغة" },
    ugc: { translate: "ترجمة" }
  },
  zh: {
    nav: { home: "首页", discover: "发现", intro: "介绍", intros: "介绍", me: "我" },
    auth: { signIn: "登录", signingIn: "正在登录…", email: "电子邮件", password: "密码", startTrustedNetwork: "开始建立您的信任网络", discoverThroughIntros: "通过介绍发现新朋友" },
    profile: { language: "语言", languageHint: "选择您偏好的应用、邮件和通知语言。" },
    language: { label: "语言", updated: "语言已更新" },
    ugc: { translate: "翻译" }
  },
  ja: {
    nav: { home: "ホーム", discover: "発見", intro: "紹介", intros: "紹介", me: "自分" },
    auth: { signIn: "ログイン", signingIn: "ログイン中…", email: "メール", password: "パスワード", startTrustedNetwork: "信頼ネットワークを築き始めましょう", discoverThroughIntros: "紹介を通じて人々を見つける" },
    profile: { language: "言語", languageHint: "アプリ、メール、通知の言語を選択してください。" },
    language: { label: "言語", updated: "言語を更新しました" },
    ugc: { translate: "翻訳" }
  },
  ko: {
    nav: { home: "홈", discover: "탐색", intro: "소개", intros: "소개", me: "나" },
    auth: { signIn: "로그인", signingIn: "로그인 중…", email: "이메일", password: "비밀번호", startTrustedNetwork: "신뢰 네트워크 구축을 시작하세요", discoverThroughIntros: "소개를 통해 사람들을 발견하세요" },
    profile: { language: "언어", languageHint: "앱, 이메일 및 알림에 사용할 언어를 선택하세요." },
    language: { label: "언어", updated: "언어가 업데이트되었습니다" },
    ugc: { translate: "번역" }
  }
};

function deepMerge(base, patch) {
  const out = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      out[key] = deepMerge(base[key] || {}, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

for (const [locale, patch] of Object.entries(catalogs)) {
  const merged = deepMerge(en, patch);
  writeFileSync(join(ROOT, "messages", `${locale}.json`), `${JSON.stringify(merged, null, 2)}\n`);
  console.log(`✓ messages/${locale}.json`);
}
