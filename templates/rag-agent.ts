/**
 * RAG Agent Template
 *
 * Retrieval-Augmented Generation agent that:
 * 1. Retrieves relevant documents
 * 2. Grades them for relevance
 * 3. Generates answer or rewrites query
 */

import { StateGraph, START, END, Annotation, MessagesAnnotation } from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph";
import { ChatAnthropic } from "@langchain/anthropic";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { Document } from "@langchain/core/documents";

// ============================================
// 1. DEFINE STATE
// ============================================

const RAGState = Annotation.Root({
  ...MessagesAnnotation.spec,
  query: Annotation<string>({
    default: () => "",
  }),
  documents: Annotation<Document[]>({
    reducer: (x, y) => y, // Replace with latest
    default: () => [],
  }),
  generation: Annotation<string>({
    default: () => "",
  }),
  retryCount: Annotation<number>({
    reducer: (x, y) => x + y,
    default: () => 0,
  }),
});

type RAGStateType = typeof RAGState.State;

// ============================================
// 2. CONFIGURE MODELS
// ============================================

const model = new ChatAnthropic({
  model: "claude-sonnet-4-5-20250929",
  temperature: 0,
});

// ============================================
// 3. RETRIEVAL (STUB - REPLACE WITH YOUR VECTOR STORE)
// ============================================

async function retrieveDocuments(query: string): Promise<Document[]> {
  // TODO: Replace with actual vector store retrieval
  // Example with @langchain/community vector stores:
  //
  // const vectorStore = await FaissStore.load("./index", embeddings);
  // return vectorStore.similaritySearch(query, 4);

  return [
    new Document({
      pageContent: `This is a placeholder document about: ${query}`,
      metadata: { source: "example.txt" },
    }),
  ];
}

// ============================================
// 4. DEFINE NODES
// ============================================

async function retrieve(state: RAGStateType) {
  const query = state.query || state.messages.at(-1)?.content?.toString() || "";
  const documents = await retrieveDocuments(query);

  return {
    documents,
    query,
  };
}

async function gradeDocuments(state: RAGStateType) {
  const gradePrompt = `You are a grader assessing relevance of a document to a user question.
If the document contains keywords or meaning related to the question, grade it as relevant.
Give a binary score 'yes' or 'no' to indicate relevance.`;

  const relevantDocs: Document[] = [];

  for (const doc of state.documents) {
    const response = await model.invoke([
      new SystemMessage(gradePrompt),
      new HumanMessage(
        `Document: ${doc.pageContent}\n\nQuestion: ${state.query}\n\nRelevant (yes/no)?`
      ),
    ]);

    const grade = response.content.toString().toLowerCase();
    if (grade.includes("yes")) {
      relevantDocs.push(doc);
    }
  }

  return { documents: relevantDocs };
}

async function generate(state: RAGStateType) {
  const context = state.documents.map((d) => d.pageContent).join("\n\n");

  const response = await model.invoke([
    new SystemMessage(
      `You are an assistant answering questions based on provided context.
Use only the context to answer. If the context doesn't contain the answer, say so.`
    ),
    new HumanMessage(`Context:\n${context}\n\nQuestion: ${state.query}`),
  ]);

  return {
    generation: response.content.toString(),
    messages: [new AIMessage(response.content.toString())],
  };
}

async function rewriteQuery(state: RAGStateType) {
  const response = await model.invoke([
    new SystemMessage(
      `You are a query rewriter. Given a question that didn't return relevant documents,
rewrite it to be more specific or use different terms. Return only the rewritten question.`
    ),
    new HumanMessage(`Original question: ${state.query}`),
  ]);

  return {
    query: response.content.toString(),
    retryCount: 1,
  };
}

// ============================================
// 5. DEFINE ROUTING
// ============================================

function routeAfterGrade(state: RAGStateType): "generate" | "rewrite" {
  // If we have relevant documents, generate answer
  if (state.documents.length > 0) {
    return "generate";
  }

  // If we've retried too many times, generate anyway
  if (state.retryCount >= 2) {
    return "generate";
  }

  // Otherwise, rewrite and try again
  return "rewrite";
}

// ============================================
// 6. BUILD GRAPH
// ============================================

const workflow = new StateGraph(RAGState)
  .addNode("retrieve", retrieve)
  .addNode("grade", gradeDocuments)
  .addNode("generate", generate)
  .addNode("rewrite", rewriteQuery)
  .addEdge(START, "retrieve")
  .addEdge("retrieve", "grade")
  .addConditionalEdges("grade", routeAfterGrade, ["generate", "rewrite"])
  .addEdge("rewrite", "retrieve") // Retry with new query
  .addEdge("generate", END);

const checkpointer = new MemorySaver();
export const ragAgent = workflow.compile({ checkpointer });

// ============================================
// 7. USAGE EXAMPLE
// ============================================

async function main() {
  const result = await ragAgent.invoke(
    {
      messages: [new HumanMessage("What is LangGraph?")],
      query: "What is LangGraph?",
    },
    { configurable: { thread_id: "rag-example" } }
  );

  console.log("Answer:", result.generation);
}

// Uncomment to run:
// main().catch(console.error);
