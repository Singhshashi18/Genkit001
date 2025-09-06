import {
  assertUnstable,
  GenkitError,
  isAction,
  runWithContext,
  sentinelNoopStreamingCallback
} from "@genkit-ai/core";
import { Channel } from "@genkit-ai/core/async";
import { Registry } from "@genkit-ai/core/registry";
import { toJsonSchema } from "@genkit-ai/core/schema";
import {
  injectInstructions,
  resolveFormat,
  resolveInstructions
} from "./formats/index.js";
import {
  generateHelper,
  shouldInjectFormatInstructions
} from "./generate/action.js";
import { GenerateResponseChunk } from "./generate/chunk.js";
import { GenerateResponse } from "./generate/response.js";
import { Message } from "./message.js";
import {
  resolveModel
} from "./model.js";
import { isExecutablePrompt } from "./prompt.js";
import { isDynamicResourceAction } from "./resource.js";
import {
  isDynamicTool,
  resolveTools,
  toToolDefinition
} from "./tool.js";
async function toGenerateRequest(registry, options) {
  const messages = [];
  if (options.system) {
    messages.push({
      role: "system",
      content: Message.parseContent(options.system)
    });
  }
  if (options.messages) {
    messages.push(...options.messages.map((m) => Message.parseData(m)));
  }
  if (options.prompt) {
    messages.push({
      role: "user",
      content: Message.parseContent(options.prompt)
    });
  }
  if (messages.length === 0) {
    throw new GenkitError({
      status: "INVALID_ARGUMENT",
      message: "at least one message is required in generate request"
    });
  }
  if (options.resume && !(messages.at(-1)?.role === "model" && messages.at(-1)?.content.find((p) => !!p.toolRequest))) {
    throw new GenkitError({
      status: "FAILED_PRECONDITION",
      message: `Last message must be a 'model' role with at least one tool request to 'resume' generation.`,
      detail: messages.at(-1)
    });
  }
  let tools;
  if (options.tools) {
    tools = await resolveTools(registry, options.tools);
  }
  const resolvedSchema = toJsonSchema({
    schema: options.output?.schema,
    jsonSchema: options.output?.jsonSchema
  });
  const resolvedFormat = await resolveFormat(registry, options.output);
  const instructions = resolveInstructions(
    resolvedFormat,
    resolvedSchema,
    options?.output?.instructions
  );
  const out = {
    messages: shouldInjectFormatInstructions(
      resolvedFormat?.config,
      options.output
    ) ? injectInstructions(messages, instructions) : messages,
    config: options.config,
    docs: options.docs,
    tools: tools?.map(toToolDefinition) || [],
    output: {
      ...resolvedFormat?.config || {},
      ...options.output,
      schema: resolvedSchema
    }
  };
  if (!out?.output?.schema) delete out?.output?.schema;
  return out;
}
class GenerationResponseError extends GenkitError {
  detail;
  constructor(response, message, status, detail) {
    super({
      status: status || "FAILED_PRECONDITION",
      message
    });
    this.detail = { response, ...detail };
  }
}
async function toolsToActionRefs(registry, toolOpt) {
  if (!toolOpt) return;
  const tools = [];
  for (const t of toolOpt) {
    if (typeof t === "string") {
      tools.push(await resolveFullToolName(registry, t));
    } else if (isAction(t) || isDynamicTool(t)) {
      tools.push(`/${t.__action.metadata?.type}/${t.__action.name}`);
    } else if (isExecutablePrompt(t)) {
      const promptToolAction = await t.asTool();
      tools.push(`/prompt/${promptToolAction.__action.name}`);
    } else {
      throw new Error(`Unable to determine type of tool: ${JSON.stringify(t)}`);
    }
  }
  return tools;
}
function messagesFromOptions(options) {
  const messages = [];
  if (options.system) {
    messages.push({
      role: "system",
      content: Message.parseContent(options.system)
    });
  }
  if (options.messages) {
    messages.push(...options.messages);
  }
  if (options.prompt) {
    messages.push({
      role: "user",
      content: Message.parseContent(options.prompt)
    });
  }
  if (messages.length === 0) {
    throw new GenkitError({
      status: "INVALID_ARGUMENT",
      message: "at least one message is required in generate request"
    });
  }
  return messages;
}
class GenerationBlockedError extends GenerationResponseError {
}
async function generate(registry, options) {
  const resolvedOptions = {
    ...await Promise.resolve(options)
  };
  const resolvedFormat = await resolveFormat(registry, resolvedOptions.output);
  registry = maybeRegisterDynamicTools(registry, resolvedOptions);
  registry = maybeRegisterDynamicResources(registry, resolvedOptions);
  const params = await toGenerateActionOptions(registry, resolvedOptions);
  const tools = await toolsToActionRefs(registry, resolvedOptions.tools);
  const streamingCallback = stripNoop(
    resolvedOptions.onChunk ?? resolvedOptions.streamingCallback
  );
  const response = await runWithContext(
    resolvedOptions.context,
    () => generateHelper(registry, {
      rawRequest: params,
      middleware: resolvedOptions.use,
      abortSignal: resolvedOptions.abortSignal,
      streamingCallback
    })
  );
  const request = await toGenerateRequest(registry, {
    ...resolvedOptions,
    tools
  });
  return new GenerateResponse(response, {
    request: response.request ?? request,
    parser: resolvedFormat?.handler(request.output?.schema).parseMessage
  });
}
async function generateOperation(registry, options) {
  assertUnstable(registry, "beta", "generateOperation is a beta feature.");
  options = await options;
  const resolvedModel = await resolveModel(registry, options.model);
  if (!resolvedModel.modelAction.__action.metadata?.model.supports?.longRunning) {
    throw new GenkitError({
      status: "INVALID_ARGUMENT",
      message: `Model '${resolvedModel.modelAction.__action.name}' does not support long running operations.`
    });
  }
  const { operation } = await generate(registry, options);
  if (!operation) {
    throw new GenkitError({
      status: "FAILED_PRECONDITION",
      message: `Model '${resolvedModel.modelAction.__action.name}' did not return an operation.`
    });
  }
  return operation;
}
function maybeRegisterDynamicTools(registry, options) {
  let hasDynamicTools = false;
  options?.tools?.forEach((t) => {
    if (isDynamicTool(t)) {
      if (!hasDynamicTools) {
        hasDynamicTools = true;
        registry = Registry.withParent(registry);
      }
      registry.registerAction("tool", t);
    }
  });
  return registry;
}
function maybeRegisterDynamicResources(registry, options) {
  let hasDynamicResources = false;
  options?.resources?.forEach((r) => {
    if (isDynamicResourceAction(r)) {
      if (!hasDynamicResources) {
        hasDynamicResources = true;
        registry = Registry.withParent(registry);
      }
      registry.registerAction("resource", r);
    }
  });
  return registry;
}
async function toGenerateActionOptions(registry, options) {
  const resolvedModel = await resolveModel(registry, options.model);
  const tools = await toolsToActionRefs(registry, options.tools);
  const messages = messagesFromOptions(options);
  const resolvedSchema = toJsonSchema({
    schema: options.output?.schema,
    jsonSchema: options.output?.jsonSchema
  });
  if ((options.output?.schema || options.output?.jsonSchema) && !options.output?.format) {
    options.output.format = "json";
  }
  const params = {
    model: resolvedModel.modelAction.__action.name,
    docs: options.docs,
    messages,
    tools,
    toolChoice: options.toolChoice,
    config: {
      version: resolvedModel.version,
      ...stripUndefinedOptions(resolvedModel.config),
      ...stripUndefinedOptions(options.config)
    },
    output: options.output && {
      ...options.output,
      format: options.output.format,
      jsonSchema: resolvedSchema
    },
    // coerce reply and restart into arrays for the action schema
    resume: options.resume && {
      respond: [options.resume.respond || []].flat(),
      restart: [options.resume.restart || []].flat(),
      metadata: options.resume.metadata
    },
    returnToolRequests: options.returnToolRequests,
    maxTurns: options.maxTurns,
    stepName: options.stepName
  };
  if (Object.keys(params.config).length === 0 && !options.config) {
    delete params.config;
  }
  return params;
}
function stripNoop(callback) {
  if (callback === sentinelNoopStreamingCallback) {
    return void 0;
  }
  return callback;
}
function stripUndefinedOptions(input) {
  if (!input) return input;
  const copy = { ...input };
  Object.keys(input).forEach((key) => {
    if (copy[key] === void 0) {
      delete copy[key];
    }
  });
  return copy;
}
async function resolveFullToolName(registry, name) {
  if (await registry.lookupAction(`/tool/${name}`)) {
    return `/tool/${name}`;
  } else if (await registry.lookupAction(`/prompt/${name}`)) {
    return `/prompt/${name}`;
  } else {
    throw new Error(`Unable to determine type of of tool: ${name}`);
  }
}
function generateStream(registry, options) {
  const channel = new Channel();
  const generated = Promise.resolve(options).then(
    (resolvedOptions) => generate(registry, {
      ...resolvedOptions,
      onChunk: (chunk) => channel.send(chunk)
    })
  );
  generated.then(
    () => channel.close(),
    (err) => channel.error(err)
  );
  return {
    response: generated,
    stream: channel
  };
}
function tagAsPreamble(msgs) {
  if (!msgs) {
    return void 0;
  }
  return msgs.map((m) => ({
    ...m,
    metadata: {
      ...m.metadata,
      preamble: true
    }
  }));
}
export {
  GenerateResponse,
  GenerateResponseChunk,
  GenerationBlockedError,
  GenerationResponseError,
  generate,
  generateOperation,
  generateStream,
  tagAsPreamble,
  toGenerateActionOptions,
  toGenerateRequest
};
//# sourceMappingURL=generate.mjs.map