// src/lib/chat.ts
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  trimMessages,
} from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import {
  END,
  MessagesAnnotation,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { getEncoding } from "js-tiktoken";
import { z } from "zod";
import SYSTEM_MESSAGE from "@/constants/systemMessage";
import { bistroBotTools } from "@/lib/tools";

// ────────────────────────
//  1. ENV validation
// ────────────────────────
const Env = z
  .object({
    OPENAI_API_KEY: z.string().min(20),
  })
  .parse(process.env);

// ────────────────────────
// 2. Accurate token counter
// ────────────────────────
const enc = getEncoding("cl100k_base");
const countTokens = (msgs: BaseMessage[]) =>
  msgs.reduce((sum, m) => sum + enc.encode(String(m.content)).length, 0);

// ────────────────────────
// 3. History trimming  (1 200 tokens ⇒ prompt-cache can trigger)
// ────────────────────────
const trimmer = trimMessages({
  maxTokens: 1200,
  strategy: "last",
  tokenCounter: countTokens,
  includeSystem: true,
  allowPartial: false,
  startOn: "human",
});

// ────────────────────────
// 4. Summariser (stable prefix)
// ────────────────────────
async function summarizeHistory(msgs: BaseMessage[]): Promise<string> {
  const text = msgs
    .filter((m) => m instanceof HumanMessage || m instanceof AIMessage)
    .map((m) => `${m._getType()}: ${m.content}`)
    .join("\n");
  const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 4_096 });
  const chunks = await splitter.createDocuments([text]);
  return chunks.length
    ? `Previous session summary:\n${chunks[0].pageContent}`
    : "";
}

// ────────────────────────
// 5. Local tools
// ────────────────────────
const tools = bistroBotTools;
const toolNode = new ToolNode(tools);

// ────────────────────────
// 6. LLM (with retries / timeout)
// ────────────────────────
const model = new ChatOpenAI({
  model: "gpt-4o-mini-2024-07-18",
  apiKey: Env.OPENAI_API_KEY,
  temperature: 0.7,
  maxTokens: 4096,
  streaming: true,
  timeout: 30_000,
  maxRetries: 3,
})
  .bindTools(tools)
  .withConfig({ runName: "assistant" });

// ────────────────────────
// 7. Graph helpers
// ────────────────────────
function shouldContinue(state: typeof MessagesAnnotation.State) {
  const last = state.messages.at(-1) as AIMessage;
  if (last.tool_calls?.length) return "tools";
  if (last.content && last._getType() === "tool") return "agent";
  return END;
}

// ────────────────────────
// 8. Graph (singleton)
// ────────────────────────
let app: Awaited<ReturnType<typeof compileWorkflow>>;

async function compileWorkflow() {
  const summaryBlock = new SystemMessage(await summarizeHistory([]));

  const graph = new StateGraph(MessagesAnnotation)
    .addNode("agent", async (state) => {
      const trimmed = await trimmer.invoke(state.messages);

      const promptTemplate = ChatPromptTemplate.fromMessages([
        new SystemMessage(SYSTEM_MESSAGE),
        summaryBlock, // stable  block → helps caching
        new MessagesPlaceholder("messages"),
      ]);

      const prompt = await promptTemplate.invoke({ messages: trimmed });
      const response = await model.invoke(prompt);
      return { messages: [response] };
    })
    .addNode("tools", toolNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", shouldContinue)
    .addEdge("tools", "agent");

  return graph.compile({ checkpointer: new MemorySaver() });
}

// ────────────────────────
// 9. Public entry
// ────────────────────────
export async function submitQuestion(
  messages: BaseMessage[],
  chatId: string
) {
  if (!app) app = await compileWorkflow();

  /* ─ Optional: LangChain request-level cache
  import { cache } from "@langchain/core";
  cache.setStore(new InMemoryCache({ ttl: 3600 }));
  */

  return app.streamEvents(
    { messages },
    {
      version: "v2",
      configurable: { thread_id: chatId },
      streamMode: "messages",
      runId: chatId,
    }
  );
}
