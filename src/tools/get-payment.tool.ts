import { getQuickbooksPayment } from "../handlers/get-quickbooks-payment.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";

// Define the tool metadata
const toolName = "get_payment";
const toolDescription = "Get a customer payment by Id from QuickBooks Online.";

// Define the expected input schema for getting a payment
const toolSchema = z.object({
  id: z.string(),
});

type ToolParams = z.infer<typeof toolSchema>;

// Define the tool handler
const toolHandler = async (args: any) => {
  const response = await getQuickbooksPayment(args.params.id);

  if (response.isError) {
    return {
      content: [
        { type: "text" as const, text: `Error getting payment: ${response.error}` },
      ],
    };
  }

  return {
    content: [
      { type: "text" as const, text: `Payment retrieved:` },
      { type: "text" as const, text: JSON.stringify(response.result) },
    ],
  };
};

export const GetPaymentTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
