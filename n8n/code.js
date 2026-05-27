const GROQ_API_KEY = $env.GROQ_API_KEY;
const GROQ_MODEL = $env.GROQ_MODEL || "openai/gpt-oss-120b";
const CEFIS_API_BASE = "https://api-v3.cefis.com.br";

function normalizeInput(input) {
    let body = input.body || input;

    if (typeof body === "string") {
        body = JSON.parse(body);
    }

    return {
        sessionId: body.sessionId || "",
        message: body.message || "",
        student: body.student || {},
        realtime: body.realtime || {},
        context: body.context || {},
        history: body.history || [],
        onboarding: body.onboarding || body.student?.onboarding || {},
        pedagogicalProfile: body.pedagogicalProfile || body.memory || {},
        memory: body.memory || {},
        timestamp: body.timestamp || new Date().toISOString()
    };
}

function getLoggedStudent(input) {
    const student = input.student || {};
    const me = input.realtime?.me || {};

    return {
        id: student.cefis_user_id || student.id || me.id || null,
        name: student.name || me.name || null,
        first_name: student.first_name || me.first_name || null,
        email: student.email || me.email || null,
        occupation: student.occupation || me.occupation || null,
        nivel: student.nivel || me.nivel || null,
        is_premium: student.is_premium ?? me.is_premium ?? null
    };
}

function isIdentityQuestion(message) {
    const text = String(message || "").toLowerCase();

    return (
        text.includes("quem sou eu") ||
        text.includes("qual meu nome") ||
        text.includes("qual é meu nome") ||
        text.includes("meu nome") ||
        text.includes("o que sabe sobre mim") ||
        text.includes("o que você sabe sobre mim") ||
        text.includes("estou logado como quem") ||
        text.includes("meu perfil") ||
        text.includes("meus dados") ||
        text.includes("lembra de mim")
    );
}

function buildIdentityResponse(input) {
    const aluno = getLoggedStudent(input);
    const onboarding = input.onboarding || {};
    const memory = input.memory || input.pedagogicalProfile || {};

    const gaps = memory.gaps || memory.difficulties || [];
    const strengths = memory.strengths || [];

    function list(values) {
        if (!Array.isArray(values) || values.length === 0) return "ainda não identificado";

        return values
            .map(v => typeof v === "string" ? v : v.value || v.key || "")
            .filter(Boolean)
            .slice(0, 5)
            .join(", ") || "ainda não identificado";
    }

    const nome = aluno.first_name || aluno.name || "aluno";

    return {
        answer: `Você está logado como ${nome}.

O que sei sobre você até agora:
- Nome: ${aluno.name || aluno.first_name || "não informado"}
- E-mail: ${aluno.email || "não informado"}
- Ocupação: ${aluno.occupation || "não informada"}
- Objetivo atual: ${onboarding.goal || "não definido ainda"}
- Nível: ${onboarding.level || "não informado"}
- Tempo disponível: ${onboarding.daily_time || "não informado"}
- Estilo de aprendizagem: ${onboarding.learning_style || "não informado"}
- Lacunas percebidas: ${list(gaps)}
- Pontos fortes percebidos: ${list(strengths)}`,
        goal: onboarding.goal || "",
        gaps,
        recommended_courses: [],
        next_step: "Posso usar essas informações para adaptar seu próximo plano de estudo."
    };
}

async function httpGetJson(url, headers = {}) {
    return await this.helpers.httpRequest({
        method: "GET",
        url,
        headers,
        json: true
    });
}

async function httpPostJson(url, body, headers = {}) {
    return await this.helpers.httpRequest({
        method: "POST",
        url,
        headers,
        body,
        json: true
    });
}

async function interpretSearchIntent(input) {
    const student = input.student || {};
    const realtime = input.realtime || {};

    const system = `
Você transforma frases humanas em buscas objetivas para catálogo de cursos CEFIS.

Sua tarefa:
- entender a intenção real do aluno;
- extrair tema principal;
- gerar termos curtos de busca;
- gerar sinônimos úteis;
- inferir área provável.

Regras:
- Não responda ao aluno.
- Não seja genérico.
- Gere termos que provavelmente aparecem em títulos, subtítulos ou keywords de cursos.
- Responda somente JSON válido.
`;

    const payload = {
        aluno: student,
        pagina_atual: realtime.currentTitle || "",
        texto_da_pagina: (realtime.pageText || "").slice(0, 1200),
        mensagem: input.message,
        historico_conversas: input.history || [],
        perfil_pedagogico: input.pedagogicalProfile || {},
        onboarding: input.onboarding || {},
        formato: {
            intent: "intenção interpretada",
            topic: "tema principal",
            search_terms: ["termo 1", "termo 2", "termo 3", "termo 4"],
            fallback_terms: ["termo extra 1", "termo extra 2"],
            humanized_context: "interpretação curta da necessidade do aluno"
        }
    };

    const json = await httpPostJson.call(
        this,
        "https://api.groq.com/openai/v1/chat/completions",
        {
            model: GROQ_MODEL,
            temperature: 0.1,
            max_tokens: 500,
            messages: [
                { role: "system", content: system },
                { role: "user", content: JSON.stringify(payload) }
            ],
            response_format: { type: "json_object" }
        },
        {
            Authorization: `Bearer ${GROQ_API_KEY}`,
            "Content-Type": "application/json"
        }
    );

    const content = json.choices?.[0]?.message?.content || "{}";

    try {
        return JSON.parse(content);
    } catch {
        return {
            intent: input.message,
            topic: input.message,
            search_terms: [input.message],
            fallback_terms: [],
            humanized_context: input.message
        };
    }
}

async function fetchCefisCourses(search) {
    const encodedSearch = encodeURIComponent(search);
    const url = `${CEFIS_API_BASE}/courses?search=${encodedSearch}&count=10&page=1`;

    try {
        const json = await httpGetJson.call(this, url, {
            Accept: "application/json"
        });

        return json.data || [];
    } catch {
        return [];
    }
}

function compactCourse(course) {
    return {
        id: course.id,
        title: course.title,
        url: course.id ? `https://cefis.com.br/portal/cursos/${course.id}` : null,
        subtitle: course.subtitle,
        summary: course.summary,
        keywords: course.keywords,
        duration: course.duration,
        lessonCount: course.lessonCount,
        materialCount: course.materialCount,
        averageRating: course.averageRating,
        practiceAverage: course.practiceAverage,
        teacher: course.teacher?.name || null,
        categories: course.categories || []
    };
}

async function searchCourses(input) {
    const interpretation = await interpretSearchIntent.call(this, input);

    const terms = [
        ...(interpretation.search_terms || []),
        ...(interpretation.fallback_terms || []),
        interpretation.topic,
        input.realtime?.possibleCourseTitle,
        input.message
    ]
        .filter(Boolean)
        .map(t => String(t).trim())
        .filter(Boolean);

    const uniqueTerms = [...new Set(terms)].slice(0, 10);
    const all = [];

    for (const term of uniqueTerms) {
        const courses = await fetchCefisCourses.call(this, term);
        all.push(...courses);
    }

    const unique = new Map();

    for (const course of all) {
        if (!course.id) continue;
        unique.set(course.id, compactCourse(course));
    }

    return {
        interpretation,
        terms: uniqueTerms,
        courses: Array.from(unique.values()).slice(0, 15)
    };
}

async function callGroq({ input, interpretation, searchTerms, courses }) {
    const aluno = getLoggedStudent(input);
    const onboarding = input.onboarding || {};
    const pedagogicalProfile = input.pedagogicalProfile || {};
    const studentName = aluno.first_name || aluno.name || "aluno";

    const goals = [
        onboarding.goal,
        ...(pedagogicalProfile.goals || []).map(g => g.value || g)
    ].filter(Boolean).join(", ");

    const difficulties = [
        ...(pedagogicalProfile.gaps || []),
        ...(pedagogicalProfile.difficulties || [])
    ].map(d => d.value || d).filter(Boolean).join(", ");

    const strengths = (pedagogicalProfile.strengths || [])
        .map(s => s.value || s)
        .filter(Boolean)
        .join(", ");

    const system = `
Você é o Tutor IA da CEFIS.

IDENTIDADE:
- Você é o Tutor IA da CEFIS.
- O usuário é o aluno logado.
- first_name, name, email, id e cefis_user_id pertencem ao aluno logado.
- Nunca diga que você se chama pelo nome do aluno.
- Se student.first_name = "Marcio", então o aluno é Marcio. Você não é Marcio.

REGRA MAIS IMPORTANTE:
Responda primeiro exatamente o que o aluno perguntou.
Não mude de assunto.
Não recomende cursos se o aluno não pediu recomendação, plano ou caminho de estudo.

PERGUNTAS SOBRE IDENTIDADE:
Se o aluno perguntar "quem sou eu", "qual meu nome", "o que você sabe sobre mim", "meu perfil", "meus dados" ou "estou logado como quem":
- responda apenas com dados do aluno logado;
- use aluno, realtime.me, onboarding e memória;
- não recomende cursos;
- não crie plano de estudos;
- não invente informações.

ESTILO:
- Respostas concisas.
- Humanas.
- Objetivas.
- Certeiras.
- Sem enrolação.
- Sem marketing.
- Sem emojis, salvo se fizer muito sentido.
- Não escreva texto longo se uma resposta curta resolver.

PRECISÃO:
- Nunca invente dados.
- Se não souber algo, diga "não informado" ou "ainda não identificado".
- Use somente cursos presentes em cursos_reais_encontrados.
- Nunca invente curso, aula, professor ou link.

CURSOS:
Só recomende cursos quando:
- o aluno pedir curso;
- o aluno pedir plano;
- o aluno pedir o que estudar;
- a recomendação for necessária para responder.

Se recomendar cursos:
- recomende no máximo 3;
- use somente cursos presentes em cursos_reais_encontrados;
- mostre sempre o nome e o link real do curso;
- o link deve ser exatamente o campo url recebido no curso;
- se o curso não tiver url ou id, não recomende esse curso;
- nunca invente link;
- nunca invente curso.

LINKS:
Se o aluno pedir links de cursos:
- responda apenas com cursos que estejam em cursos_reais_encontrados;
- use o campo url recebido;
- se não houver cursos disponíveis no contexto atual, diga: "Preciso refazer a busca para recuperar os links corretos.";
- nunca crie link sem id real.

PÁGINA ATUAL:
O campo dados_em_tempo_real_do_aluno representa o que o aluno está vendo agora na plataforma.

Use estes campos:
- currentUrl: URL aberta
- currentTitle: título da aba
- currentPageTitle: título visível detectado
- currentCourseId: ID do curso, se detectado
- currentLessonId: ID da aula, se detectado
- possibleCourseTitle: possível nome do curso/aula
- pageText: texto visível da página

Se o aluno disser:
- "essa aula"
- "esse curso"
- "o que estou vendo?"
- "resume isso"
- "me explica essa tela"
- "qual aula estou?"
- "qual curso está aberto?"

Responda usando primeiro o contexto da tela.

Não peça para o aluno repetir o nome do curso se possibleCourseTitle, currentPageTitle ou pageText já indicarem isso.

Se não tiver certeza, diga:
"Pelo que consigo ver na tela, parece ser..."

Sobre o aluno logado:
- Nome: ${aluno.name || aluno.first_name || "não informado"}
- Primeiro nome: ${aluno.first_name || "não informado"}
- E-mail: ${aluno.email || "não informado"}
- Ocupação: ${aluno.occupation || "não informada"}
- Premium: ${aluno.is_premium === null ? "não informado" : aluno.is_premium}
- Objetivo: ${goals || "ainda não definido"}
- Nível: ${onboarding.level || "não informado"}
- Tempo disponível: ${onboarding.daily_time || "não informado"}
- Estilo de aprendizagem: ${onboarding.learning_style || "não informado"}
- Lacunas/dificuldades: ${difficulties || "ainda não identificadas"}
- Pontos fortes: ${strengths || "ainda não identificados"}

Responda somente JSON válido.

Formato obrigatório:
{
  "answer": "resposta final humanizada para o aluno, incluindo links quando recomendar cursos",
  "goal": "objetivo detectado",
  "gaps": ["lacuna 1"],
  "recommended_courses": ["nome real do curso"],
  "next_step": "próxima ação prática",
  "proactive_suggestion": "sugestão curta"
}
`;

    const payload = {
        identidade_do_assistente: {
            nome: "Tutor IA da CEFIS",
            papel: "mentor de aprendizagem"
        },
        aluno_logado: aluno,
        nome_do_aluno: studentName,
        mensagem_do_aluno: input.message,
        dados_em_tempo_real_do_aluno: input.realtime || {},
        onboarding,
        historico_conversas: input.history || [],
        perfil_pedagogico: pedagogicalProfile,
        termos_de_busca_usados: searchTerms,
        cursos_reais_encontrados: courses.map(c => ({
            id: c.id,
            title: c.title,
            url: c.url || (c.id ? `https://cefis.com.br/portal/cursos/${c.id}` : null),
            subtitle: c.subtitle,
            summary: c.summary,
            duration: c.duration,
            lessonCount: c.lessonCount,
            teacher: c.teacher
        })),
        interpretacao_da_intencao: interpretation
    };

    const json = await httpPostJson.call(
        this,
        "https://api.groq.com/openai/v1/chat/completions",
        {
            model: GROQ_MODEL,
            temperature: 0.15,
            max_tokens: 800,
            messages: [
                { role: "system", content: system },
                { role: "user", content: JSON.stringify(payload) }
            ],
            response_format: { type: "json_object" }
        },
        {
            Authorization: `Bearer ${GROQ_API_KEY}`,
            "Content-Type": "application/json"
        }
    );

    const content = json.choices?.[0]?.message?.content || "{}";

    try {
        return JSON.parse(content);
    } catch {
        return {
            answer: content,
            goal: "",
            gaps: [],
            recommended_courses: [],
            next_step: ""
        };
    }
}

async function main() {
    if (!GROQ_API_KEY) {
        return {
            answer: "A variável GROQ_API_KEY não está configurada no n8n.",
            debug: { missing_env: "GROQ_API_KEY" }
        };
    }

    const input = normalizeInput($json);

    if (!input.message) {
        return {
            answer: "Me diga o que você quer aprender hoje.",
            student: input.student || null
        };
    }

    if (isIdentityQuestion(input.message)) {
        const identity = buildIdentityResponse(input);

        return {
            ...identity,
            student: input.student || null,
            history_count: (input.history || []).length,
            pedagogical_profile_updated: false,
            message_analysis: {
                detected_gaps: [],
                detected_strengths: []
            },
            debug: {
                route: "identity",
                student: input.student,
                realtime_has_me: !!input.realtime?.me,
                current_url: input.realtime?.currentUrl
            }
        };
    }

    const { interpretation, terms, courses } = await searchCourses.call(this, input);

    let ai;

    try {
        ai = await callGroq.call(this, {
            input,
            interpretation,
            searchTerms: terms,
            courses
        });
    } catch (e) {
        ai = {
            answer: "Tive uma instabilidade para responder agora. Tente novamente em alguns segundos.",
            goal: "",
            gaps: [],
            recommended_courses: [],
            next_step: "Tente novamente.",
            error: e.message
        };
    }

    return {
        answer: ai.answer || "Não consegui gerar uma resposta agora.",
        goal: ai.goal || "",
        gaps: ai.gaps || [],
        recommended_courses: ai.recommended_courses || [],
        next_step: ai.next_step || "",
        proactive_suggestion: ai.proactive_suggestion || "",
        student: input.student || null,
        history_count: (input.history || []).length,
        pedagogical_profile_updated: false,
        message_analysis: {
            detected_gaps: ai.detected_gaps || [],
            detected_strengths: ai.detected_strengths || []
        },
        debug: {
            route: "learning",
            student: input.student,
            realtime_has_me: !!input.realtime?.me,
            current_url: input.realtime?.currentUrl,
            current_course_id: input.realtime?.currentCourseId,
            search_terms: terms,
            courses_found: courses.length,
            courses: courses.map(c => ({
                id: c.id,
                title: c.title,
                url: c.url
            })),
            ai_error: ai.error || null
        }
    };
}

let result;

try {
    result = await main.call(this);
} catch (error) {
    result = {
        answer: "Erro no n8n: " + error.message,
        debug: {
            stack: error.stack
        }
    };
}

return [
    {
        json: {
            answer: result.answer || JSON.stringify(result),
            goal: result.goal || "",
            gaps: result.gaps || [],
            recommended_courses: result.recommended_courses || [],
            next_step: result.next_step || "",
            proactive_suggestion: result.proactive_suggestion || "",
            student: result.student || null,
            debug: result.debug || {}
        }
    }
];