import { searchQuickbooksTransfers } from "../handlers/search-quickbooks-transfers.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";

// Define the tool metadata
const toolName = "search_transfers";
const toolDescription = "Search transfers in QuickBooks Online that match given criteria.";

// Define the expected input schema for searching transfers
const toolSchema = z.object({
  criteria: z.array(z.any()).optional(),
  asc: z.string().optional(),
  desc: z.string().optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
  count: z.boolean().optional(),
  fetchAll: z.boolean().optional(),
});

type ToolParams = z.infer<typeof toolSchema>;

// Define the tool handler
const toolHandler = async (args: any) => {
  const response = await searchQuickbooksTransfers(args.params);

  if (response.isError) {
    return {
      content: [
        { type: "text" as const, text: `Error searching transfers: ${response.error}` },
      ],
    };
  }

  return {
    content: [
      { type: "text" as const, text: `Transfers found:` },
      { type: "text" as const, text: JSON.stringify(response.result) },
    ],
  };
};

export const SearchTransfersTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
