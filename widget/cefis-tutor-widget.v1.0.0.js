(function () {
    const CONFIG = {
        useLocalServer: false,
        localUrl: "http://localhost:3001/webhook/cefis-tutor-chat",
        webhookUrl: "https://<sua-url>/webhook/cefis-tutor-chat",
        storagePrefix: "cefis_tutor_"
    };

    let student = null;
    let isOpen = false;
    let isLoading = false;

    const $ = (id) => document.getElementById(id);

    const store = {
        get: (k, fb) => {
            try {
                return JSON.parse(localStorage.getItem(CONFIG.storagePrefix + k)) ?? fb;
            } catch {
                return fb;
            }
        },
        set: (k, v) => localStorage.setItem(CONFIG.storagePrefix + k, JSON.stringify(v)),
        remove: (k) => localStorage.removeItem(CONFIG.storagePrefix + k)
    };

    const sessionId =
        localStorage.getItem(CONFIG.storagePrefix + "session_id") ||
        "sess_" + Date.now() + "_" + Math.random().toString(36).slice(2);

    localStorage.setItem(CONFIG.storagePrefix + "session_id", sessionId);

    let history = store.get("history", []);
    let onboarding = store.get("onboarding", {});
    let profile = store.get("profile", {
        goals: [],
        gaps: [],
        strengths: [],
        preferences: {}
    });

    const onboardingQuestions = [
        ["goal", "Qual é seu principal objetivo de aprendizado agora?"],
        ["level", "Você se considera iniciante, intermediário ou avançado nesse tema?"],
        ["daily_time", "Quanto tempo por dia você consegue estudar?"],
        ["learning_style", "Você aprende melhor lendo, vendo exemplos, ouvindo explicações ou praticando?"]
    ];

    function onboardingComplete() {
        return onboardingQuestions.every(([key]) => onboarding[key]);
    }

    function nextOnboardingQuestion() {
        return onboardingQuestions.find(([key]) => !onboarding[key]);
    }

    function getStudentKey() {
        return student?.cefis_user_id || student?.email || sessionId;
    }

    function getPageText() {
        const clone = document.body.cloneNode(true);

        clone
            .querySelectorAll("script,style,noscript,iframe,svg,#cefisTutorRoot")
            .forEach(el => el.remove());

        return clone.innerText.replace(/\s+/g, " ").trim().slice(0, 7000);
    }

    function detectCourseTitleFromText(text, title) {
        const clean = String(text || "").replace(/\s+/g, " ").trim();

        const patterns = [
            /curso\s+(.{3,120}?)(?:\s+professor|\s+professora|\s+aulas|\s+assistir|\s+descrição|\s+$)/i,
            /você está visualizando.*?curso\s+(.{3,120}?)(?:\s+da professora|\s+do professor|\s+com|\s+$)/i,
            /(.{3,100})\s+(?:gravação agendada|aulas|módulos|professor|professora)/i
        ];

        for (const pattern of patterns) {
            const match = clean.match(pattern);
            if (match?.[1]) {
                return match[1].replace(/[*:|]/g, "").trim().slice(0, 120);
            }
        }

        if (title && !/CEFIS|Portal|Cursos/i.test(title)) return title.trim();

        return null;
    }

    function detectIdsFromPage() {
        const url = location.href;
        const title = document.title || "";
        const bodyText = document.body.innerText || "";

        const courseId =
            url.match(/courses?\/(\d+)/i)?.[1] ||
            url.match(/curso[s]?\/(\d+)/i)?.[1] ||
            url.match(/courseId[=/](\d+)/i)?.[1] ||
            url.match(/cursoId[=/](\d+)/i)?.[1] ||
            document.querySelector("[data-course-id]")?.dataset.courseId ||
            document.querySelector("[data-course]")?.dataset.course ||
            document.querySelector("[course-id]")?.getAttribute("course-id") ||
            document.querySelector("a[href*='/courses/']")?.href?.match(/courses?\/(\d+)/i)?.[1] ||
            document.querySelector("a[href*='/curso/']")?.href?.match(/curso[s]?\/(\d+)/i)?.[1] ||
            null;

        const lessonId =
            url.match(/lessons?\/(\d+)/i)?.[1] ||
            url.match(/aulas?\/(\d+)/i)?.[1] ||
            url.match(/lessonId[=/](\d+)/i)?.[1] ||
            url.match(/aulaId[=/](\d+)/i)?.[1] ||
            document.querySelector("[data-lesson-id]")?.dataset.lessonId ||
            document.querySelector("[data-lesson]")?.dataset.lesson ||
            document.querySelector("[lesson-id]")?.getAttribute("lesson-id") ||
            document.querySelector("a[href*='/lessons/']")?.href?.match(/lessons?\/(\d+)/i)?.[1] ||
            document.querySelector("a[href*='/aula/']")?.href?.match(/aulas?\/(\d+)/i)?.[1] ||
            null;

        const visibleTitle =
            document.querySelector("h1")?.innerText?.trim() ||
            document.querySelector("h2")?.innerText?.trim() ||
            document.querySelector("[class*='course'] [class*='title']")?.innerText?.trim() ||
            document.querySelector("[class*='Course'] [class*='Title']")?.innerText?.trim() ||
            document.querySelector("[class*='lesson'] [class*='title']")?.innerText?.trim() ||
            document.querySelector("[class*='Lesson'] [class*='Title']")?.innerText?.trim() ||
            document.querySelector("[class*='title']")?.innerText?.trim() ||
            title;

        const possibleCourseTitle =
            detectCourseTitleFromText(bodyText, title) ||
            visibleTitle;

        return {
            courseId,
            lessonId,
            videoTitle: visibleTitle,
            possibleCourseTitle,
            pageHint: bodyText.slice(0, 2500)
        };
    }

    async function getMe() {
        try {
            const res = await fetch("https://cefis.com.br/api/v1/user/me", {
                credentials: "include",
                headers: { Accept: "application/json" }
            });

            if (!res.ok) return null;

            const json = await res.json();
            return json.data || null;
        } catch {
            return null;
        }
    }

    async function getRealtimeContext() {
        const ids = detectIdsFromPage();
        const me = await getMe();

        if (me) {
            student = {
                cefis_user_id: me.id,
                name: me.name,
                first_name: me.first_name,
                email: me.email,
                occupation: me.occupation,
                nivel: me.nivel,
                is_premium: me.is_premium,
                onboarding
            };
        }

        return {
            me,
            currentUrl: location.href,
            currentPath: location.pathname,
            currentTitle: document.title,
            currentCourseId: ids.courseId,
            currentLessonId: ids.lessonId,
            currentPageTitle: ids.videoTitle,
            possibleCourseTitle: ids.possibleCourseTitle,
            pageText: getPageText(),
            detectedAt: new Date().toISOString()
        };
    }

    function getSafeBrowserContext() {
        return {
            url: location.href,
            title: document.title,
            referrer: document.referrer,
            language: navigator.language,
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            }
        };
    }

    async function callApi(payload) {
        const url = CONFIG.useLocalServer ? CONFIG.localUrl : CONFIG.webhookUrl;

        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "omit",
            body: JSON.stringify(payload)
        });

        const text = await res.text();

        try {
            return JSON.parse(text);
        } catch {
            return { answer: text };
        }
    }

    function addHistory(role, content) {
        history.push({
            role,
            content,
            at: new Date().toISOString()
        });

        history = history.slice(-30);
        store.set("history", history);
    }

    function mergeUnique(arr, values) {
        const set = new Set([...(arr || []), ...(values || [])].filter(Boolean));
        return [...set].slice(-30);
    }

    function updateLocalMemory(data) {
        profile.goals = mergeUnique(profile.goals, [data.goal]);
        profile.gaps = mergeUnique(profile.gaps, data.gaps || []);
        profile.strengths = mergeUnique(profile.strengths, data.strengths || []);
        profile.last_next_step = data.next_step || profile.last_next_step;
        profile.updated_at = new Date().toISOString();
        store.set("profile", profile);
    }

    function injectStyles() {
        if ($("cefisTutorStyles")) return;

        const style = document.createElement("style");
        style.id = "cefisTutorStyles";
        style.textContent = `
      #cefisTutorButton{position:fixed;right:24px;bottom:24px;z-index:2147483647;width:62px;height:62px;border-radius:999px;border:0;background:#111827;color:white;font-size:27px;cursor:pointer;box-shadow:0 16px 40px rgba(0,0,0,.25)}
      #cefisTutorPanel{position:fixed;right:24px;bottom:98px;z-index:2147483647;width:390px;height:600px;max-width:calc(100vw - 32px);max-height:calc(100vh - 120px);background:white;border-radius:22px;box-shadow:0 24px 80px rgba(0,0,0,.28);display:none;flex-direction:column;overflow:hidden;font-family:Arial,sans-serif}
      #cefisTutorHeader{background:#111827;color:white;padding:15px;display:flex;justify-content:space-between;align-items:center}
      #cefisTutorHeader strong{font-size:15px} #cefisTutorHeader span{font-size:12px;opacity:.8}
      #cefisTutorClose{border:0;background:rgba(255,255,255,.15);color:white;width:32px;height:32px;border-radius:10px;cursor:pointer}
      #cefisTutorStatus{padding:9px 14px;background:#f9fafb;border-bottom:1px solid #eee;font-size:12px;color:#4b5563}
      #cefisTutorMessages{flex:1;padding:16px;overflow-y:auto}
      .cefisMsg{margin-bottom:12px;display:flex;flex-direction:column}.cefisMsg.user{align-items:flex-end}.cefisMsg.bot{align-items:flex-start}
      .cefisBubble{max-width:86%;padding:11px 13px;border-radius:16px;font-size:14px;line-height:1.45;white-space:pre-wrap}
      .cefisMsg.user .cefisBubble{background:#2563eb;color:white;border-bottom-right-radius:5px}
      .cefisMsg.bot .cefisBubble{background:#f3f4f6;color:#111827;border-bottom-left-radius:5px}
      #cefisTutorQuick{padding:10px 12px;display:flex;gap:8px;overflow-x:auto;border-top:1px solid #f3f4f6}
      .cefisQuickBtn{border:1px solid #e5e7eb;background:white;color:#111827;border-radius:999px;padding:8px 10px;font-size:12px;cursor:pointer;white-space:nowrap}
      #cefisTutorReset{border-color:#fecaca;color:#991b1b;background:#fff5f5}
      #cefisTutorInputArea{padding:12px;display:flex;gap:8px;border-top:1px solid #eee}
      #cefisTutorInput{flex:1;border:1px solid #d1d5db;border-radius:12px;padding:11px 12px;font-size:14px;outline:none}
      #cefisTutorSend{border:0;background:#111827;color:white;border-radius:12px;padding:0 14px;font-weight:bold;cursor:pointer}
      #cefisTutorSend:disabled{opacity:.5;cursor:not-allowed}
      .cefisDots{display:inline-flex;gap:4px;height:16px;align-items:center}.cefisDots span{width:6px;height:6px;background:#9ca3af;border-radius:999px;animation:cefisDotPulse 1.2s infinite ease-in-out}.cefisDots span:nth-child(2){animation-delay:.15s}.cefisDots span:nth-child(3){animation-delay:.3s}
      @keyframes cefisDotPulse{0%,80%,100%{opacity:.25;transform:scale(.85)}40%{opacity:1;transform:scale(1)}}
    `;
        document.head.appendChild(style);
    }

    function addMessage(text, role) {
        const messages = $("cefisTutorMessages");
        const wrap = document.createElement("div");
        const bubble = document.createElement("div");

        wrap.className = "cefisMsg " + role;
        bubble.className = "cefisBubble";
        bubble.innerText = text;

        wrap.appendChild(bubble);
        messages.appendChild(wrap);
        messages.scrollTop = messages.scrollHeight;

        return bubble;
    }

    function typing(show) {
        const old = $("cefisTypingDots");
        if (old) old.remove();
        if (!show) return;

        const wrap = document.createElement("div");
        wrap.className = "cefisMsg bot";
        wrap.id = "cefisTypingDots";
        wrap.innerHTML = `<div class="cefisBubble"><span class="cefisDots"><span></span><span></span><span></span></span></div>`;
        $("cefisTutorMessages").appendChild(wrap);
        $("cefisTutorMessages").scrollTop = $("cefisTutorMessages").scrollHeight;
    }

    async function typeBot(text) {
        const bubble = addMessage("", "bot");

        for (let i = 0; i < String(text).length; i++) {
            bubble.innerText += text[i];
            $("cefisTutorMessages").scrollTop = $("cefisTutorMessages").scrollHeight;
            await new Promise(r => setTimeout(r, 8));
        }
    }

    function setStatus(text) {
        const el = $("cefisTutorStatus");
        if (el) el.innerText = text;
    }

    async function identifyStudent() {
        const realtime = await getRealtimeContext();

        if (student) {
            setStatus("Aluno: " + (student.first_name || student.name || "identificado"));
        } else {
            student = { onboarding };
            setStatus("Aluno não identificado automaticamente");
        }

        return realtime;
    }

    async function resetOnboarding() {
        onboarding = {};
        profile = {
            goals: [],
            gaps: [],
            strengths: [],
            preferences: {}
        };

        store.set("onboarding", onboarding);
        store.set("profile", profile);

        if (student) {
            student.onboarding = onboarding;
        }

        addHistory("system", "Onboarding redefinido");

        await typeBot("Claro. Vamos redefinir seu foco de estudo.");
        const next = nextOnboardingQuestion();
        if (next) await typeBot(next[1]);
    }

    async function handleOnboarding(message) {
        const next = nextOnboardingQuestion();
        if (!next) return false;

        const [key] = next;
        onboarding[key] = message;
        store.set("onboarding", onboarding);

        if (!student) student = {};
        student.onboarding = onboarding;

        const nextQuestion = nextOnboardingQuestion();

        if (nextQuestion) {
            await typeBot(nextQuestion[1]);
        } else {
            await typeBot(
                `Perfeito. Vou considerar seu objetivo (${onboarding.goal}), nível (${onboarding.level}), tempo disponível (${onboarding.daily_time}) e estilo de aprendizagem (${onboarding.learning_style}) nas próximas respostas.`
            );
        }

        return true;
    }

    async function sendMessage(forcedMessage) {
        if (isLoading) return;

        const input = $("cefisTutorInput");
        const message = (forcedMessage || input.value || "").trim();
        if (!message) return;

        const normalized = message.toLowerCase();

        input.value = "";
        addMessage(message, "user");
        addHistory("user", message);

        if (["reset", "/reset", "redefinir foco", "trocar objetivo", "mudar objetivo"].includes(normalized)) {
            await resetOnboarding();
            return;
        }

        isLoading = true;
        $("cefisTutorSend").disabled = true;

        try {
            if (!onboardingComplete()) {
                await handleOnboarding(message);
                return;
            }

            typing(true);

            const realtime = await identifyStudent();

            const payload = {
                type: "chat",
                sessionId,
                studentKey: getStudentKey(),
                message,
                student: student || { onboarding },
                realtime,
                context: getSafeBrowserContext(),
                history: history.slice(-10),
                memory: profile,
                onboarding,
                timestamp: new Date().toISOString()
            };

            const data = await callApi(payload);

            typing(false);

            const answer = data.answer || "Não consegui responder agora. Tente novamente.";

            addHistory("assistant", answer);
            updateLocalMemory(data);

            await typeBot(answer);
        } catch (err) {
            typing(false);
            await typeBot("Tive um problema ao responder. Pode tentar de novo em alguns segundos?");
            console.error("[CEFIS Tutor]", err);
        } finally {
            isLoading = false;
            $("cefisTutorSend").disabled = false;
            $("cefisTutorInput").focus();
        }
    }

    function createWidget() {
        const old = $("cefisTutorRoot");
        if (old) old.remove();

        const root = document.createElement("div");
        root.id = "cefisTutorRoot";
        root.innerHTML = `
      <button id="cefisTutorButton">🎓</button>

      <div id="cefisTutorPanel">
        <div id="cefisTutorHeader">
          <div>
            <strong>Tutor IA CEFIS</strong><br>
            <span>Seu mentor de aprendizagem</span>
          </div>
          <button id="cefisTutorClose">×</button>
        </div>

        <div id="cefisTutorStatus">Inicializando...</div>
        <div id="cefisTutorMessages"></div>

        <div id="cefisTutorQuick">
          <button class="cefisQuickBtn" data-msg="Me explique esta aula de forma simples.">Explicar esta aula</button>
          <button class="cefisQuickBtn" data-msg="Tenho 15 minutos. O que devo estudar agora?">Plano de 15 min</button>
          <button class="cefisQuickBtn" data-msg="Quais são minhas principais lacunas neste tema?">Diagnóstico</button>
          <button class="cefisQuickBtn" id="cefisTutorReset" type="button">Redefinir foco</button>
        </div>

        <div id="cefisTutorInputArea">
          <input id="cefisTutorInput" placeholder="Digite sua dúvida ou objetivo..." />
          <button id="cefisTutorSend">Enviar</button>
        </div>
      </div>
    `;

        document.body.appendChild(root);

        $("cefisTutorButton").onclick = () => {
            isOpen = !isOpen;
            $("cefisTutorPanel").style.display = isOpen ? "flex" : "none";
            if (isOpen) $("cefisTutorInput").focus();
        };

        $("cefisTutorClose").onclick = () => {
            isOpen = false;
            $("cefisTutorPanel").style.display = "none";
        };

        $("cefisTutorSend").onclick = () => sendMessage();

        $("cefisTutorInput").addEventListener("keydown", e => {
            if (e.key === "Enter") sendMessage();
        });

        document.querySelectorAll(".cefisQuickBtn[data-msg]").forEach(btn => {
            btn.onclick = () => sendMessage(btn.dataset.msg);
        });

        $("cefisTutorReset").onclick = resetOnboarding;

        addMessage(
            "Olá! Sou seu Tutor IA da CEFIS. Consigo considerar a página que você está vendo, seu objetivo e seu histórico de estudo.",
            "bot"
        );

        identifyStudent().then(() => {
            if (!onboardingComplete()) {
                const next = nextOnboardingQuestion();
                if (next) typeBot(next[1]);
            }
        });
    }

    function init() {
        injectStyles();
        createWidget();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();