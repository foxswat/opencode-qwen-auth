import { z } from "zod";
import {
  QWEN_DEFAULT_API_BASE_URL,
  QWEN_DEFAULT_CLIENT_ID,
  QWEN_OAUTH_BASE_URL,
} from "../../constants";

export const QwenConfigSchema = z.object({
  client_id: z.string().default(QWEN_DEFAULT_CLIENT_ID),
  oauth_base_url: z.string().default(QWEN_OAUTH_BASE_URL),
  base_url: z.string().default(QWEN_DEFAULT_API_BASE_URL),
  rotation_strategy: z
    .enum(["round-robin", "sequential"])
    .default("round-robin"),
  proactive_refresh: z.boolean().default(true),
  refresh_window_seconds: z.number().min(0).default(300),
  max_rate_limit_wait_seconds: z.number().min(0).default(300),
  quiet_mode: z.boolean().default(false),
});

export type QwenPluginConfig = z.infer<typeof QwenConfigSchema>;
