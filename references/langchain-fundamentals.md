<overview>

LangGraph agents build on LangChain primitives. This reference covers essential LangChain concepts: messages, chat models, structured output, retrieval, and guardrails.

</overview>

<messages>

## Message Types

LangChain provides four core message types:

```typescript
import {
  SystemMessage,
  HumanMessage,
  AIMessage,
  ToolMessage,
} from "@langchain/core/messages";

// System: Sets model behavior
new SystemMessage("You are a helpful assistant.");

// Human: User input
new HumanMessage("What is machine learning?");

// AI: Model response
new AIMessage("Machine learning is...");

// Tool: Tool execution result
new ToolMessage({
  content: "Search result: ...",
  tool_call_id: "call_123",
});
```

### Message Properties

| Property | Description |
|----------|-------------|
| `content` | Text or content blocks |
| `name` | Optional identifier |
| `id` | Unique message ID |
| `tool_calls` | Array of tool invocations (AIMessage) |
| `usage_metadata` | Token counts |
| `response_metadata` | Provider-specific info |

### With Metadata

```typescript
new HumanMessage({
  content: "Hello!",
  name: "alice",
  id: "msg_123",
});
```

### Accessing Tool Calls

```typescript
const response = await model.invoke(messages);

if (response.tool_calls?.length) {
  for (const call of response.tool_calls) {
    console.log(`Tool: ${call.name}`);
    console.log(`Args: ${JSON.stringify(call.args)}`);
    console.log(`ID: ${call.id}`);
  }
}
```

### Content Blocks (Multimodal)

```typescript
// Text + Image
new HumanMessage({
  content: [
    { type: "text", text: "What's in this image?" },
    { type: "image_url", image_url: { url: "data:image/png;base64,..." } },
  ],
});
```

</messages>

<chat_models>

## Chat Models

### Provider Setup

**Anthropic:**
```typescript
import { ChatAnthropic } from "@langchain/anthropic";

const model = new ChatAnthropic({
  model: "claude-sonnet-4-5-20250929",
  temperature: 0,
  // apiKey: process.env.ANTHROPIC_API_KEY (auto-detected)
});
```

**OpenAI:**
```typescript
import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
  model: "gpt-4o",
  temperature: 0,
});
```

**Google Gemini:**
```typescript
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

const model = new ChatGoogleGenerativeAI({
  model: "gemini-1.5-pro",
});
```

**Generic (auto-detect provider):**
```typescript
import { initChatModel } from "langchain";

const model = await initChatModel("claude-sonnet-4-5-20250929");
```

### Core Methods

```typescript
// Invoke: complete response
const response = await model.invoke([
  new SystemMessage("You are helpful."),
  new HumanMessage("Hello!"),
]);

// Stream: token by token
for await (const chunk of await model.stream(messages)) {
  process.stdout.write(chunk.content);
}

// Batch: parallel requests
const responses = await model.batch([
  [new HumanMessage("Q1")],
  [new HumanMessage("Q2")],
]);
```

### Configuration Options

```typescript
const model = new ChatAnthropic({
  model: "claude-sonnet-4-5-20250929",
  temperature: 0.7,      // Creativity (0-1)
  maxTokens: 1000,       // Response limit
  timeout: 30,           // Seconds
  maxRetries: 2,         // Retry attempts
});
```

### Binding Tools

```typescript
const modelWithTools = model.bindTools([searchTool, calculatorTool]);

// Model can now generate tool calls
const response = await modelWithTools.invoke(messages);
```

</chat_models>

<structured_output>

## Structured Output

Get typed responses instead of free text.

### With Zod Schema

```typescript
import * as z from "zod";

const PersonSchema = z.object({
  name: z.string().describe("Person's full name"),
  age: z.number().describe("Age in years"),
  occupation: z.string().optional(),
});

const structuredModel = model.withStructuredOutput(PersonSchema);

const result = await structuredModel.invoke(
  "Extract: John Smith is a 35 year old engineer"
);
// result: { name: "John Smith", age: 35, occupation: "engineer" }
```

### In LangGraph Agents

```typescript
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { providerStrategy, toolStrategy } from "@langchain/langgraph";

// For models with native support (OpenAI, Anthropic)
const agent = createReactAgent({
  llm: model,
  tools,
  responseFormat: providerStrategy(OutputSchema),
});

// For models without native support
const agent = createReactAgent({
  llm: model,
  tools,
  responseFormat: toolStrategy(OutputSchema),
});

// Access structured response
const result = await agent.invoke({ messages });
console.log(result.structuredResponse);
```

</structured_output>

<retrieval>

## Retrieval (RAG)

Components for retrieval-augmented generation.

### Document Loaders

```typescript
import { TextLoader } from "langchain/document_loaders/fs/text";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { CheerioWebBaseLoader } from "langchain/document_loaders/web/cheerio";

// Load text file
const textDocs = await new TextLoader("./data.txt").load();

// Load PDF
const pdfDocs = await new PDFLoader("./document.pdf").load();

// Load web page
const webDocs = await new CheerioWebBaseLoader("https://example.com").load();
```

### Text Splitters

```typescript
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});

const chunks = await splitter.splitDocuments(documents);
```

### Embeddings

```typescript
import { OpenAIEmbeddings } from "@langchain/openai";

const embeddings = new OpenAIEmbeddings({
  model: "text-embedding-3-small",
});

const vector = await embeddings.embedQuery("search query");
```

### Vector Stores

```typescript
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { FaissStore } from "@langchain/community/vectorstores/faiss";

// In-memory (dev)
const vectorStore = await MemoryVectorStore.fromDocuments(
  chunks,
  embeddings
);

// Persistent (production)
const faissStore = await FaissStore.fromDocuments(chunks, embeddings);
await faissStore.save("./vector_index");
```

### Retrievers

```typescript
// Create retriever from vector store
const retriever = vectorStore.asRetriever({
  k: 4,  // Number of documents
});

// Use in agent
const docs = await retriever.invoke("user question");
```

### RAG Patterns

| Pattern | Description | Use Case |
|---------|-------------|----------|
| 2-Step RAG | Retrieve → Generate | Simple FAQ, docs |
| Agentic RAG | LLM decides when to retrieve | Research with multiple sources |
| Hybrid RAG | Validation + query refinement | High-quality answers |

</retrieval>

<guardrails>

## Guardrails

Validate inputs and outputs for safety.

### Input Validation

```typescript
// Keyword blocking
function checkBannedKeywords(input: string): boolean {
  const banned = ["ignore previous", "system prompt"];
  return !banned.some(kw => input.toLowerCase().includes(kw));
}

// In LangGraph node
async function validateInput(state: StateType) {
  const userMessage = state.messages.at(-1)?.content;

  if (!checkBannedKeywords(userMessage)) {
    return {
      messages: [new AIMessage("I cannot process that request.")],
      blocked: true,
    };
  }

  return { blocked: false };
}
```

### Output Validation

```typescript
async function validateOutput(state: StateType) {
  const response = state.messages.at(-1)?.content;

  // Check for PII
  if (containsPII(response)) {
    return {
      messages: [new AIMessage("I cannot share personal information.")],
    };
  }

  // Model-based safety check
  const safetyCheck = await safetyModel.invoke(
    `Is this response safe and appropriate? Response: ${response}`
  );

  if (safetyCheck.content.includes("unsafe")) {
    return {
      messages: [new AIMessage("Let me rephrase that...")],
    };
  }

  return {};
}
```

### PII Detection

```typescript
import { PIIMiddleware } from "@langchain/community/middleware";

// Redact sensitive data before processing
const middleware = new PIIMiddleware({
  actions: {
    email: "redact",
    phone: "mask",
    ssn: "block",
  },
});
```

### Human-in-the-Loop for Sensitive Actions

```typescript
import { interrupt } from "@langchain/langgraph";

async function sensitiveAction(state: StateType) {
  if (state.action.type === "delete" || state.action.amount > 1000) {
    const approved = interrupt({
      action: state.action,
      message: "This action requires approval.",
    });

    if (!approved) {
      return { cancelled: true };
    }
  }

  return await executeAction(state.action);
}
```

</guardrails>

<providers>

## Supported Providers

| Provider | Package | Env Variable |
|----------|---------|--------------|
| Anthropic | `@langchain/anthropic` | `ANTHROPIC_API_KEY` |
| OpenAI | `@langchain/openai` | `OPENAI_API_KEY` |
| Google Gemini | `@langchain/google-genai` | `GOOGLE_API_KEY` |
| Google Vertex | `@langchain/google-vertexai` | `GOOGLE_APPLICATION_CREDENTIALS` |
| Mistral | `@langchain/mistralai` | `MISTRAL_API_KEY` |
| Groq | `@langchain/groq` | `GROQ_API_KEY` |
| AWS Bedrock | `@langchain/aws` | AWS credentials |
| Azure OpenAI | `@langchain/openai` | `AZURE_OPENAI_API_KEY` |
| Ollama | `@langchain/ollama` | (local) |

**Full list:** 30+ providers at https://docs.langchain.com/oss/javascript/integrations/providers/all_providers.md

</providers>
