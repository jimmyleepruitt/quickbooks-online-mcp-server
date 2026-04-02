import { getQuickbooksRefundReceipt } from "../handlers/get-quickbooks-refund-receipt.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";

const toolName = "get_refund_receipt";
const toolDescription = "Get a refund receipt by ID from QuickBooks Online.";
const toolSchema = z.object({
  id: z.string(),
});

const toolHandler = async (args: { [x: string]: any }) => {
  const response = await getQuickbooksRefundReceipt(args.id);

  if (response.isError) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error getting refund receipt: ${response.error}`,
        },
      ],
    };
  }

  const refundReceipt = response.result;

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(refundReceipt),
      }
    ],
  };
};

export const GetRefundReceiptTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
