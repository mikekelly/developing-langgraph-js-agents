/**
 * Basic ReAct Agent Template
 *
 * A minimal tool-calling agent using the Graph API.
 * Copy this file and customize for your use case.
 */

import { StateGraph, START, END, Annotation, MessagesAnnotation } from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph";
import { ChatAnthropic } from "@langchain/anthropic";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import * as z from "zod";

// ============================================
// 1. DEFINE STATE
// ============================================

const AgentState = Annotation.Root({
  ...MessagesAnnotation.spec,
  // Add custom fields as needed:
  // context: Annotation<string[]>({
  //   reducer: (x, y) => x.concat(y),
  //   default: () => [],
  // }),
});

type AgentStateType = typeof AgentState.State;

// ============================================
// 2. DEFINE TOOLS
// ============================================

const exampleTool = tool(
  async ({ query }) => {
    // TODO: Implement your tool logic
    return `Results for: ${query}`;
  },
  {
    name: "example_tool",
    description: "Describe what this tool does and when to use it. Be specific about trigger conditions.",
    schema: z.object({
      query: z.string().describe("What to search for"),
    }),
  }
);

const tools = [exampleTool];
const toolsByName = Object.fromEntries(tools.map((t) => [t.name, t]));

// ============================================
// 3. CONFIGURE MODEL
// ============================================

const model = new ChatAnthropic({
  model: "claude-sonnet-4-5-20250929",
  temperature: 0,
}).bindTools(tools);

// ============================================
// 4. DEFINE NODES
// ============================================

async function callModel(state: AgentStateType) {
  const response = await model.invoke(state.messages);
  return { messages: [response] };
}

async function callTools(state: AgentStateType) {
  const lastMessage = state.messages.at(-1);

  if (!lastMessage || !AIMessage.isInstance(lastMessage)) {
    return { messages: [] };
  }

  const toolMessages: ToolMessage[] = [];

  for (const toolCall of lastMessage.tool_calls ?? []) {
    const tool = toolsByName[toolCall.name];

    if (!tool) {
      toolMessages.push(
        new ToolMessage({
          content: `Unknown tool: ${toolCall.name}`,
          tool_call_id: toolCall.id,
        })
      );
      continue;
    }

    try {
      const result = await tool.invoke(toolCall);
      toolMessages.push(result);
    } catch (error) {
      toolMessages.push(
        new ToolMessage({
          content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
          tool_call_id: toolCall.id,
        })
      );
    }
  }

  return { messages: toolMessages };
}

// ============================================
// 5. DEFINE ROUTING
// ============================================

function shouldContinue(state: AgentStateType) {
  const lastMessage = state.messages.at(-1);

  if (!lastMessage || !AIMessage.isInstance(lastMessage)) {
    return END;
  }

  if (lastMessage.tool_calls?.length) {
    return "tools";
  }

  return END;
}

// ============================================
// 6. BUILD GRAPH
// ============================================

const workflow = new StateGraph(AgentState)
  .addNode("agent", callModel)
  .addNode("tools", callTools)
  .addEdge(START, "agent")
  .addConditionalEdges("agent", shouldContinue, ["tools", END])
  .addEdge("tools", "agent");

// Compile with checkpointer for persistence
const checkpointer = new MemorySaver();
export const agent = workflow.compile({ checkpointer });

// ============================================
// 7. USAGE EXAMPLE
// ============================================

async function main() {
  const threadId = "example-thread";

  // First message
  const result1 = await agent.invoke(
    { messages: [new HumanMessage("Hello! What can you do?")] },
    { configurable: { thread_id: threadId } }
  );

  console.log("Response:", result1.messages.at(-1)?.content);

  // Continue conversation (same thread)
  const result2 = await agent.invoke(
    { messages: [new HumanMessage("Use the example tool to search for 'test'")] },
    { configurable: { thread_id: threadId } }
  );

  console.log("Response:", result2.messages.at(-1)?.content);
}

// Uncomment to run:
// main().catch(console.error);
