import { getQuickbooksCreditMemo } from "../handlers/get-quickbooks-credit-memo.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";

const toolName = "get_credit_memo";
const toolDescription = "Get a credit memo by ID from QuickBooks Online.";
const toolSchema = z.object({
  id: z.string(),
});

const toolHandler = async (args: { [x: string]: any }) => {
  const response = await getQuickbooksCreditMemo(args.id);

  if (response.isError) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error getting credit memo: ${response.error}`,
        },
      ],
    };
  }

  const creditMemo = response.result;

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(creditMemo),
      }
    ],
  };
};

export const GetCreditMemoTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
