import { getQuickbooksTransfer } from "../handlers/get-quickbooks-transfers.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";

// Define the tool metadata
const toolName = "get_transfer";
const toolDescription = "Get a transfer by Id from QuickBooks Online.";

// Define the expected input schema for getting a transfer
const toolSchema = z.object({
  id: z.string(),
});

type ToolParams = z.infer<typeof toolSchema>;

// Define the tool handler
const toolHandler = async (args: any) => {
  const response = await getQuickbooksTransfer(args.params.id);

  if (response.isError) {
    return {
      content: [
        { type: "text" as const, text: `Error getting transfer: ${response.error}` },
      ],
    };
  }

  return {
    content: [
      { type: "text" as const, text: `Transfer retrieved:` },
      { type: "text" as const, text: JSON.stringify(response.result) },
    ],
  };
};

export const GetTransferTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
