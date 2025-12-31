/**
 * Multi-Agent Template (Supervisor Pattern)
 *
 * A supervisor agent coordinates specialized worker agents:
 * - Supervisor: Routes tasks to appropriate workers
 * - Researcher: Gathers information
 * - Writer: Creates content
 */

import { StateGraph, START, END, Annotation, MessagesAnnotation } from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph";
import { ChatAnthropic } from "@langchain/anthropic";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";

// ============================================
// 1. DEFINE STATE
// ============================================

const MultiAgentState = Annotation.Root({
  ...MessagesAnnotation.spec,
  task: Annotation<string>({
    default: () => "",
  }),
  currentAgent: Annotation<string>({
    default: () => "supervisor",
  }),
  researchNotes: Annotation<string[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  draft: Annotation<string>({
    default: () => "",
  }),
  iterations: Annotation<number>({
    reducer: (x, y) => x + y,
    default: () => 0,
  }),
});

type MultiAgentStateType = typeof MultiAgentState.State;

// ============================================
// 2. CONFIGURE MODELS
// ============================================

const supervisorModel = new ChatAnthropic({
  model: "claude-sonnet-4-5-20250929",
  temperature: 0,
});

const workerModel = new ChatAnthropic({
  model: "claude-sonnet-4-5-20250929",
  temperature: 0.7,
});

// ============================================
// 3. DEFINE SUPERVISOR NODE
// ============================================

async function supervisor(state: MultiAgentStateType) {
  const lastMessage = state.messages.at(-1);
  const task = lastMessage?.content?.toString() || state.task;

  const systemPrompt = `You are a supervisor coordinating a team of agents.
Your team:
- researcher: Gathers information and facts
- writer: Creates written content

Based on the task and current progress, decide:
1. "researcher" - if more information is needed
2. "writer" - if ready to create content
3. "FINISH" - if the task is complete

Current research notes: ${state.researchNotes.length > 0 ? state.researchNotes.join("\n") : "None yet"}
Current draft: ${state.draft || "None yet"}

Respond with ONLY one word: researcher, writer, or FINISH`;

  const response = await supervisorModel.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(`Task: ${task}`),
  ]);

  const decision = response.content.toString().toLowerCase().trim();

  return {
    task,
    currentAgent: decision,
    iterations: 1,
  };
}

// ============================================
// 4. DEFINE WORKER NODES
// ============================================

async function researcher(state: MultiAgentStateType) {
  const systemPrompt = `You are a research assistant. Given a task, gather relevant information and facts.
Be thorough but concise. Present findings as bullet points.`;

  const context = state.researchNotes.length > 0
    ? `\n\nPrevious research:\n${state.researchNotes.join("\n")}`
    : "";

  const response = await workerModel.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(`Task: ${state.task}${context}\n\nProvide additional research:`),
  ]);

  return {
    researchNotes: [response.content.toString()],
    messages: [new AIMessage(`[Researcher] ${response.content}`)],
  };
}

async function writer(state: MultiAgentStateType) {
  const systemPrompt = `You are a skilled writer. Create or improve content based on the research provided.
Write in a clear, engaging style.`;

  const research = state.researchNotes.join("\n\n");
  const existingDraft = state.draft ? `\n\nExisting draft to improve:\n${state.draft}` : "";

  const response = await workerModel.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(
      `Task: ${state.task}\n\nResearch:\n${research}${existingDraft}\n\nCreate/improve the content:`
    ),
  ]);

  return {
    draft: response.content.toString(),
    messages: [new AIMessage(`[Writer] ${response.content}`)],
  };
}

async function finalize(state: MultiAgentStateType) {
  return {
    messages: [
      new AIMessage(`Task completed!\n\nFinal output:\n${state.draft}`),
    ],
  };
}

// ============================================
// 5. DEFINE ROUTING
// ============================================

function routeFromSupervisor(
  state: MultiAgentStateType
): "researcher" | "writer" | "finalize" {
  const decision = state.currentAgent.toLowerCase();

  // Safety limit
  if (state.iterations > 10) {
    return "finalize";
  }

  if (decision.includes("finish")) {
    return "finalize";
  }

  if (decision.includes("researcher")) {
    return "researcher";
  }

  if (decision.includes("writer")) {
    return "writer";
  }

  // Default to finalize if unclear
  return "finalize";
}

// ============================================
// 6. BUILD GRAPH
// ============================================

const workflow = new StateGraph(MultiAgentState)
  .addNode("supervisor", supervisor)
  .addNode("researcher", researcher)
  .addNode("writer", writer)
  .addNode("finalize", finalize)
  .addEdge(START, "supervisor")
  .addConditionalEdges("supervisor", routeFromSupervisor, [
    "researcher",
    "writer",
    "finalize",
  ])
  .addEdge("researcher", "supervisor") // Return to supervisor
  .addEdge("writer", "supervisor") // Return to supervisor
  .addEdge("finalize", END);

const checkpointer = new MemorySaver();
export const multiAgent = workflow.compile({ checkpointer });

// ============================================
// 7. USAGE EXAMPLE
// ============================================

async function main() {
  // Stream to see agent coordination
  for await (const chunk of await multiAgent.stream(
    {
      messages: [
        new HumanMessage("Write a short blog post about the benefits of TypeScript"),
      ],
    },
    {
      configurable: { thread_id: "multi-agent-example" },
      streamMode: "updates",
    }
  )) {
    console.log("Update:", JSON.stringify(chunk, null, 2));
  }
}

// Uncomment to run:
// main().catch(console.error);
