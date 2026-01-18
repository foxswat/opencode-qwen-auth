/* eslint-disable @typescript-eslint/no-explicit-any */
type JsonValue = any;

function asImageUrlObject(part: JsonValue): { url: string } | null {
  const imageUrl = part?.image_url ?? part?.url;
  if (typeof imageUrl === "string") return { url: imageUrl };
  if (
    imageUrl &&
    typeof imageUrl === "object" &&
    typeof imageUrl.url === "string"
  ) {
    return { url: imageUrl.url };
  }
  return null;
}

function mapContentPart(part: JsonValue): JsonValue | null {
  if (!part || typeof part !== "object") return part;

  switch (part.type) {
    case "input_text":
    case "output_text":
      return { type: "text", text: String(part.text ?? "") };

    case "input_image": {
      const urlObj = asImageUrlObject(part);
      if (!urlObj) return null;
      return { type: "image_url", image_url: urlObj };
    }

    case "input_audio":
      return {
        type: "text",
        text: "[audio omitted: provider does not support input_audio]",
      };

    default:
      return part;
  }
}

function mapMessage(msg: JsonValue): JsonValue {
  const role = msg.role === "developer" ? "system" : msg.role;

  if (typeof msg.content === "string") {
    return { ...msg, role };
  }

  if (Array.isArray(msg.content)) {
    const mapped = msg.content.map(mapContentPart).filter(Boolean);
    return { ...msg, role, content: mapped.length ? mapped : "" };
  }

  return { ...msg, role };
}

export function transformResponsesToChatCompletions(
  body: JsonValue,
): JsonValue {
  const result = { ...body };

  if (result.input && !result.messages) {
    result.messages = result.input;
    delete result.input;
  }

  if (typeof result.messages === "string") {
    result.messages = [{ role: "user", content: result.messages }];
  }

  if (result.instructions) {
    result.messages = [
      { role: "system", content: String(result.instructions) },
      ...(Array.isArray(result.messages) ? result.messages : []),
    ];
    delete result.instructions;
  }

  if (Array.isArray(result.messages)) {
    result.messages = result.messages.flatMap((item: JsonValue) => {
      if (item && typeof item === "object" && "role" in item) {
        return [mapMessage(item)];
      }
      if (item?.type === "function_call_output") {
        return [
          {
            role: "tool",
            tool_call_id: item.call_id ?? item.id ?? "unknown",
            content:
              typeof item.output === "string"
                ? item.output
                : JSON.stringify(item.output ?? {}),
          },
        ];
      }
      return [];
    });
  }

  if (result.max_output_tokens && !result.max_tokens) {
    result.max_tokens = result.max_output_tokens;
    delete result.max_output_tokens;
  }

  if (result.text?.format && !result.response_format) {
    result.response_format = result.text.format;
    delete result.text;
  }

  if (Array.isArray(result.tools)) {
    result.tools = result.tools.map((tool: JsonValue) => {
      if (tool.type === "function" && tool.name && !tool.function) {
        const { type, name, description, parameters, strict, ...rest } = tool;
        return {
          type: "function",
          function: { name, description, parameters, strict },
          ...rest,
        };
      }
      return tool;
    });
  }

  delete result.store;
  delete result.include;
  delete result.previous_response_id;

  return result;
}
