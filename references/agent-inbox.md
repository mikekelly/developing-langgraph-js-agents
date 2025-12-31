<overview>

Agent Inbox is an open-source UI for managing human-in-the-loop interactions with LangGraph agents. It provides a web-based inbox where users can respond to agent interrupts - accepting, editing, responding to, or ignoring agent requests.

</overview>

<what_it_does>

## What Agent Inbox Provides

- Web UI for managing interrupted agent workflows
- Support for multiple LangGraph deployments
- Four response types: Accept, Edit, Respond, Ignore
- Markdown-formatted context for each interrupt
- "Open in Studio" debugging integration

**Hosted version:** https://dev.agentinbox.ai

</what_it_does>

<setup>

## Setup

### 1. Start LangGraph Server

```bash
npx @langchain/langgraph-cli dev
```

Runs at `http://localhost:2024` by default.

### 2. Connect Agent Inbox

Visit https://dev.agentinbox.ai and provide:

| Field | Value |
|-------|-------|
| Graph ID | Your graph name from `langgraph.json` (e.g., `"agent"`) |
| Deployment URL | `http://localhost:2024` (local) or deployed URL |
| Name | Optional identifier |

</setup>

<interrupt_schema>

## Interrupt Schema for Agent Inbox

Use structured interrupts compatible with Agent Inbox:

```typescript
import { interrupt } from "@langchain/langgraph";

interface HumanInterrupt {
  action_request: {
    action: string;
    args: Record<string, unknown>;
  };
  config: {
    allow_accept: boolean;
    allow_edit: boolean;
    allow_respond: boolean;
    allow_ignore: boolean;
  };
  description?: string;  // Markdown supported
}

async function humanNode(state: StateType) {
  const interruptData: HumanInterrupt = {
    action_request: {
      action: "send_email",
      args: {
        to: state.recipient,
        subject: state.subject,
        body: state.draft,
      },
    },
    config: {
      allow_accept: true,
      allow_edit: true,
      allow_respond: true,
      allow_ignore: true,
    },
    description: `**Review email before sending:**\n\nTo: ${state.recipient}\nSubject: ${state.subject}`,
  };

  const response = interrupt(interruptData);

  // Handle the response
  if (response.type === "accept") {
    return { approved: true, action: response.args };
  } else if (response.type === "edit") {
    return { approved: true, action: response.args };  // Modified args
  } else if (response.type === "response") {
    return { feedback: response.args };
  } else {
    // ignore
    return { approved: false };
  }
}
```

</interrupt_schema>

<response_handling>

## Handling Responses

```typescript
interface HumanResponse {
  type: "accept" | "edit" | "response" | "ignore";
  args?: Record<string, unknown>;
}

async function processHumanResponse(state: StateType) {
  const response = state.humanResponse;

  switch (response.type) {
    case "accept":
      // User approved as-is
      return await executeAction(state.proposedAction);

    case "edit":
      // User modified the action
      return await executeAction(response.args);

    case "response":
      // User provided custom feedback
      return { feedback: response.args.text };

    case "ignore":
      // User skipped
      return { skipped: true };
  }
}
```

</response_handling>

<use_cases>

## Common Use Cases

**Review before action:**
- Sending emails/messages
- Making API calls with side effects
- Database modifications
- External service interactions

**Request clarification:**
- Ambiguous user intent
- Missing required information
- Multiple valid approaches

**Notify user:**
- Important events detected
- Errors requiring attention
- Progress updates on long tasks

</use_cases>

<ambient_agents>

## Ambient Agents & Scheduled Tasks

LangGraph Platform supports "ambient agents" that run on schedules rather than user triggers.

**Key patterns:**
- **Cron jobs**: Built-in scheduled execution
- **Event monitoring**: Watch for external events
- **Background processing**: Long-running tasks

**Human oversight modes:**
- **Notify**: Alert without acting
- **Question**: Request clarification
- **Review**: Require approval before action

```typescript
// Example: Scheduled agent checks for new items
// Configure via LangGraph Platform cron settings
const ambientAgent = workflow.compile({
  checkpointer,
  // Cron configuration in langgraph.json or platform settings
});
```

**Note:** Cron jobs and scheduled tasks are a LangGraph Platform feature, requiring deployment to LangGraph Cloud or self-hosted LangGraph Platform.

</ambient_agents>
