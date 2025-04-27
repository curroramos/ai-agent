import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  trimMessages,
} from "@langchain/core/messages";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatCohere } from "@langchain/cohere";
import {
  END,
  MessagesAnnotation,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph";
// import { ToolNode } from "@langchain/langgraph/prebuilt";
// import wxflows from "@wxflows/sdk/langchain";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import SYSTEM_MESSAGE from "@/constants/systemMessage";

// Trim the messages to manage conversation history
const trimmer = trimMessages({
  maxTokens: 10,
  strategy: "last",
  tokenCounter: (msgs) => msgs.length,
  includeSystem: true,
  allowPartial: false,
  startOn: "human",
});

// Commented out wxflows tool connection
/*
const toolClient = new wxflows({
  endpoint: process.env.WXFLOWS_ENDPOINT || "",
  apikey: process.env.WXFLOWS_APIKEY,
});
const tools = await toolClient.lcTools;
const toolNode = new ToolNode(tools);
*/

// Connect to the LLM provider
// const initialiseModel = () => {
//   const model = new ChatAnthropic({
//     modelName: "claude-3-5-sonnet-20241022",
//     anthropicApiKey: process.env.ANTHROPIC_API_KEY,
//     temperature: 0.7,
//     maxTokens: 4096,
//     streaming: true,
//     clientOptions: {
//       defaultHeaders: {
//         "anthropic-beta": "prompt-caching-2024-07-31",
//       },
//     },
//     callbacks: [
//       {
//         handleLLMStart: async () => {
//           // console.log("🤖 Starting LLM call");
//         },
//         handleLLMEnd: async (output) => {
//           console.log("🤖 End LLM call", output);
//           const usage = output.llmOutput?.usage;
//           if (usage) {
//             // console.log("📊 Token Usage:", { ... });
//           }
//         },
//         // handleLLMNewToken: async (token: string) => {},
//       },
//     ],
//   });

//   // .bindTools(tools) is removed because no tools
//   return model;
// };

const initialiseModel = () => {
  const model = new ChatCohere({
    apiKey: process.env.COHERE_API_KEY,   // NEW – env-var name
    model: "command-r-plus",              // e.g. "command-r" | "command-r-plus"
    temperature: 0.7,
    streaming: true,                      // token-level streaming supported ✔
    // Cohere-specific call options can be passed per-call or here via
    // `defaultOptions`, e.g. { max_tokens: 4096, connectors: ["web-search"] }
    callbacks: [
      {
        handleLLMStart: async () => {/* … */},
        handleLLMEnd: async (output) => {
          console.log("🤖 End LLM call", output);
          // token usage is in `output.llmOutput?.estimatedTokenUsage`
        },
      },
    ],
  });

  return model;
};



// Define the function that determines whether to continue or not
function shouldContinue(state: typeof MessagesAnnotation.State) {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1] as AIMessage;

  // Pure LLM: no tool routing
  // if (lastMessage.tool_calls?.length) {
  //   return "tools";
  // }
  if (lastMessage.content && lastMessage._getType() === "tool") {
    return "agent";
  }

  return END;
}

// Define a new graph
const createWorkflow = () => {
  const model = initialiseModel();

  return new StateGraph(MessagesAnnotation)
    .addNode("agent", async (state) => {
      const systemContent = SYSTEM_MESSAGE;

      const promptTemplate = ChatPromptTemplate.fromMessages([
        new SystemMessage(systemContent, {
          cache_control: { type: "ephemeral" },
        }),
        new MessagesPlaceholder("messages"),
      ]);

      const trimmedMessages = await trimmer.invoke(state.messages);
      const prompt = await promptTemplate.invoke({ messages: trimmedMessages });

      const response = await model.invoke(prompt);

      return { messages: [response] };
    })
    // .addNode("tools", toolNode)  // removed tool node
    .addEdge(START, "agent")
    .addConditionalEdges("agent", shouldContinue);
    // .addEdge("tools", "agent"); // no tool backedge
};

function addCachingHeaders(messages: BaseMessage[]): BaseMessage[] {
  if (!messages.length) return messages;
  const cachedMessages = [...messages];

  const addCache = (message: BaseMessage) => {
    message.content = [
      {
        type: "text",
        text: message.content as string,
        cache_control: { type: "ephemeral" },
      },
    ];
  };

  addCache(cachedMessages.at(-1)!);

  let humanCount = 0;
  for (let i = cachedMessages.length - 1; i >= 0; i--) {
    if (cachedMessages[i] instanceof HumanMessage) {
      humanCount++;
      if (humanCount === 2) {
        addCache(cachedMessages[i]);
        break;
      }
    }
  }

  return cachedMessages;
}

export async function submitQuestion(messages: BaseMessage[], chatId: string) {
  const cachedMessages = addCachingHeaders(messages);

  const workflow = createWorkflow();
  const checkpointer = new MemorySaver();
  const app = workflow.compile({ checkpointer });

  const stream = await app.streamEvents(
    { messages: cachedMessages },
    {
      version: "v2",
      configurable: { thread_id: chatId },
      streamMode: "messages",
      runId: chatId,
    }
  );
  return stream;
}
