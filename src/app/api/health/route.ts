import { appConfig } from '@/config/app.config';

export const runtime = 'nodejs';

/** GET /api/health — LLM provider/models + app metadata for the UI header. */
export async function GET() {
  const live = appConfig.llm.provider === 'vultr';
  return Response.json({
    provider: appConfig.llm.provider,
    model: live ? appConfig.llm.vultr.model : 'scripted-mock',
    skepticModel: live ? appConfig.llm.vultr.skepticModel : 'scripted-mock',
    triageModel: live ? appConfig.llm.vultr.triageModel : 'scripted-mock',
    retrievalModel:
      appConfig.retrieval.provider === 'vultron' ? appConfig.retrieval.rerankModel : 'keyword-bm25-local',
    keyPresent: Boolean(appConfig.llm.vultr.apiKey),
    app: appConfig.app,
    covenants: appConfig.demo.covenants,
    scenarios: appConfig.demo.scenarios,
  });
}
