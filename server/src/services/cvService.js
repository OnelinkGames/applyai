import OpenAI from 'openai';
import { readResumeContent } from './importService.js';

const LANGUAGE_LABELS = {
  'pt-BR': 'Português (Brasil)',
  'en-US': 'English (US)',
  'es-ES': 'Español',
};

const META_DISCLAIMER_START =
  /^(?:>\s*)?(?:\*{0,2})?(?:Este|This|El)\s+(?:curr[íi]culo|CV|curriculum|resume(?:\s+vitae)?)\s+(?:foi|was|fue|has\s+been)\s+adaptad[oa][\s\S]*?(?:\n\n|$)/im;

const META_DISCLAIMER_END =
  /\n{1,2}(?:>\s*)?(?:\*{0,2})?(?:Este|This|El)\s+(?:curr[íi]culo|CV|curriculum|resume(?:\s+vitae)?)\s+(?:foi|was|fue|has\s+been)\s+adaptad[oa][\s\S]*$/im;

function stripCvMetaCommentary(content) {
  let text = content.trim();
  text = text.replace(META_DISCLAIMER_START, '').trim();
  text = text.replace(META_DISCLAIMER_END, '').trim();
  return text;
}

export async function generateCvForJob(db, job, language) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error('OPENAI_API_KEY não configurada');
    error.status = 503;
    throw error;
  }

  const resumeContent = readResumeContent(db);
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const client = new OpenAI({ apiKey });

  const prompt = `You are a professional resume writer specialized in ATS-optimized resumes. Adapt the candidate's resume for a specific job application.

RULES:
- Write ONLY in ${LANGUAGE_LABELS[language] || language}
- Use ONLY information from the base resume — do NOT invent experience, companies, dates, or skills
- STRICT LENGTH: maximum 2 pages (A4). Recruiters ignore longer CVs — if content exceeds 2 pages, cut the least relevant roles, bullets, or details until it fits
- Target roughly 450–650 words total; prefer fewer strong bullets over exhaustive history
- Output clean Markdown suitable for a job application and ATS parsing
- Output ONLY the resume content — no cover letter, no notes, no disclaimers
- NEVER add meta-commentary such as "This resume was adapted for...", "Este currículo foi adaptado para...", or any explanation about how/why the CV was tailored. Start directly with the candidate's name or first section header and end with the last resume section

ATS OPTIMIZATION (critical):
- Extract keywords, technologies, tools, methodologies, certifications, and role terms from the JOB posting below
- Use the EXACT wording from the job posting when it truthfully matches the candidate's background (e.g. if the ad says "Node.js", write "Node.js" not a synonym)
- Include the job title (or a close, honest variant) naturally in the Summary/Profile
- Add a "Key Skills" or "Technical Skills" section listing relevant ATS keywords as a comma-separated or bullet list — only skills the candidate actually has
- Weave job-posting keywords naturally into experience bullet points; each bullet should highlight measurable impact where possible
- Use standard ATS-friendly section headers: Summary, Key Skills, Professional Experience, Education
- Avoid tables, columns, icons, images, or unusual formatting — plain Markdown only
- Do NOT keyword-stuff: every term must reflect real experience from the base resume

CONTENT PRIORITY:
- Lead with the most relevant experience and skills for this specific job
- Tailor the summary and top bullets to match job requirements and match reasons
- Drop or shorten older/less relevant roles to stay within 2 pages
- Include Education only if present in the base resume

JOB:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location || 'N/A'}
Salary: ${job.salary || 'N/A'}
Description: ${job.description || 'N/A'}
Requirements: ${(job.requirements || []).join(', ')}
Match reasons: ${(job.matchReasons || []).join('; ')}

BASE RESUME:
${resumeContent}`;

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content:
          'You adapt resumes for job applications without fabricating any information. Output Markdown only. Never exceed 2 pages. Prioritize ATS keyword alignment with the job posting using only verified facts from the base resume. Never include meta-commentary, footnotes, or disclaimers about the adaptation process — output the resume document only.',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.35,
    max_tokens: 2200,
  });

  const raw = response.choices[0]?.message?.content?.trim();
  if (!raw) {
    throw new Error('OpenAI retornou resposta vazia');
  }

  const content = stripCvMetaCommentary(raw);

  return {
    content,
    usage: {
      model,
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
      totalTokens: response.usage?.total_tokens ?? 0,
    },
  };
}
