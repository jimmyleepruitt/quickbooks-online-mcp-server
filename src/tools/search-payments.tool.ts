import { searchQuickbooksPayments } from "../handlers/search-quickbooks-payments.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";

// Define the tool metadata
const toolName = "search_payments";
const toolDescription = "Search customer payments in QuickBooks Online that match given criteria.";

// Define the expected input schema for searching payments
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
  const response = await searchQuickbooksPayments(args.params);

  if (response.isError) {
    return {
      content: [
        { type: "text" as const, text: `Error searching payments: ${response.error}` },
      ],
    };
  }

  return {
    content: [
      { type: "text" as const, text: `Payments found:` },
      { type: "text" as const, text: JSON.stringify(response.result) },
    ],
  };
};

export const SearchPaymentsTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
