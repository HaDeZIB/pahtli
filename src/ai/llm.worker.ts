/** Worker de WebLLM: el modelo corre fuera del hilo de la UI. */
import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm';

const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (msg: MessageEvent) => {
  handler.onmessage(msg);
};
