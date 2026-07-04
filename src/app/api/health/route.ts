import { appConfig } from '@/config/app.config';

export const runtime = 'nodejs';

/** GET /api/health — LLM provider/model + app metadata for the UI header. */
export async function GET() {
  return Response.json({
    provider: appConfig.llm.provider,
    model: appConfig.llm.provider === 'vultr' ? appConfig.llm.vultr.model : 'scripted-mock',
    keyPresent: Boolean(appConfig.llm.vultr.apiKey),
    app: appConfig.app,
    covenants: appConfig.demo.covenants,
    arrivalDocId: appConfig.demo.arrivalDocId,
  });
}
