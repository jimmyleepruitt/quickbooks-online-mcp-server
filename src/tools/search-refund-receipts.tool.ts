import { searchQuickbooksRefundReceipts } from "../handlers/search-quickbooks-refund-receipts.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";

const toolName = "search_refund_receipts";
const toolDescription = "Search refund receipts in QuickBooks Online that match given criteria.";

// A subset of commonly-used RefundReceipt fields that can be filtered on.
const refundReceiptFieldEnum = z.enum([
  "Id",
  "SyncToken",
  "MetaData.CreateTime",
  "MetaData.LastUpdatedTime",
  "TxnDate",
  "TotalAmt",
  "CustomerRef",
  "DepositToAccountRef",
  "PaymentMethodRef",
  "DocNumber",
  "PrivateNote",
  "DepartmentRef",
  "CurrencyRef"
]).describe(
  "Field to filter on – must be a property of the QuickBooks Online RefundReceipt entity."
);

const criterionSchema = z.object({
  key: z.string().describe("Simple key (legacy) – any RefundReceipt property name."),
  value: z.union([z.string(), z.boolean()]),
});

// Advanced criterion schema with operator support.
const advancedCriterionSchema = z.object({
  field: refundReceiptFieldEnum,
  value: z.union([z.string(), z.boolean()]),
  operator: z
    .enum(["=", "<", ">", "<=", ">=", "LIKE", "IN"])
    .optional()
    .describe("Comparison operator. Defaults to '=' if omitted."),
});

const toolSchema = z.object({
  // Allow advanced criteria array like [{field,value,operator}]
  criteria: z
    .array(advancedCriterionSchema.or(criterionSchema))
    .optional()
    .describe(
      "Filters to apply. Use the advanced form {field,value,operator?} for operators or the simple {key,value} pairs."
    ),

  limit: z.number().optional(),
  offset: z.number().optional(),
  asc: z.string().optional(),
  desc: z.string().optional(),
  fetchAll: z.boolean().optional(),
  count: z.boolean().optional(),
});

export const SearchRefundReceiptsTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: async (args) => {
    const { criteria = [], ...options } = (args.params ?? {}) as z.infer<typeof toolSchema>;

    // build criteria to pass to SDK, supporting advanced operator syntax
    let criteriaToSend: any;
    if (Array.isArray(criteria) && criteria.length > 0) {
      const first = criteria[0] as any;
      if (typeof first === "object" && "field" in first) {
        criteriaToSend = [...criteria, ...Object.entries(options).map(([key, value]) => ({ field: key, value }))];
      } else {
        criteriaToSend = (criteria as Array<{ key: string; value: any }>).reduce<Record<string, any>>((acc, { key, value }) => {
          if (value !== undefined && value !== null) acc[key] = value;
          return acc;
        }, { ...options });
      }
    } else {
      criteriaToSend = { ...options };
    }

    const response = await searchQuickbooksRefundReceipts(criteriaToSend);
    if (response.isError) {
      return {
        content: [{ type: "text" as const, text: `Error searching refund receipts: ${response.error}` }],
      };
    }
    return {
      content: [
        { type: "text" as const, text: Array.isArray(response.result) ? `Found ${response.result.length} refund receipts:` : `Count: ${response.result}` },
        ...(Array.isArray(response.result)
          ? response.result.map((r) => ({ type: "text" as const, text: JSON.stringify(r) }))
          : []),
      ],
    };
  },
};
