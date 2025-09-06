"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  Dotprompt: () => Dotprompt,
  PicoschemaParser: () => PicoschemaParser,
  picoschema: () => picoschema
});
module.exports = __toCommonJS(index_exports);

// src/dotprompt.ts
var Handlebars = __toESM(require("handlebars"));

// src/helpers.ts
var helpers_exports = {};
__export(helpers_exports, {
  history: () => history,
  ifEquals: () => ifEquals,
  json: () => json,
  media: () => media,
  role: () => role,
  section: () => section,
  unlessEquals: () => unlessEquals
});
var import_handlebars = require("handlebars");
function json(serializable, options) {
  return new import_handlebars.SafeString(
    JSON.stringify(serializable, null, options.hash.indent || 0)
  );
}
function role(role2) {
  return new import_handlebars.SafeString(`<<<dotprompt:role:${role2}>>>`);
}
function history() {
  return new import_handlebars.SafeString("<<<dotprompt:history>>>");
}
function section(name) {
  return new import_handlebars.SafeString(`<<<dotprompt:section ${name}>>>`);
}
function media(options) {
  return new import_handlebars.SafeString(
    `<<<dotprompt:media:url ${options.hash.url}${options.hash.contentType ? ` ${options.hash.contentType}` : ""}>>>`
  );
}
function ifEquals(arg1, arg2, options) {
  return arg1 === arg2 ? options.fn(this) : options.inverse(this);
}
function unlessEquals(arg1, arg2, options) {
  return arg1 !== arg2 ? options.fn(this) : options.inverse(this);
}

// src/parse.ts
var import_yaml = require("yaml");
var ROLE_MARKER_PREFIX = "<<<dotprompt:role:";
var HISTORY_MARKER_PREFIX = "<<<dotprompt:history";
var MEDIA_MARKER_PREFIX = "<<<dotprompt:media:";
var SECTION_MARKER_PREFIX = "<<<dotprompt:section";
var FRONTMATTER_AND_BODY_REGEX = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
var ROLE_AND_HISTORY_MARKER_REGEX = /(<<<dotprompt:(?:role:[a-z]+|history))>>>/g;
var MEDIA_AND_SECTION_MARKER_REGEX = /(<<<dotprompt:(?:media:url|section).*?)>>>/g;
var RESERVED_METADATA_KEYWORDS = [
  // NOTE: KEEP SORTED
  "config",
  "description",
  "ext",
  "input",
  "model",
  "name",
  "output",
  "raw",
  "toolDefs",
  "tools",
  "variant",
  "version"
];
var BASE_METADATA = {
  ext: {},
  metadata: {},
  config: {}
};
function splitByRegex(source, regex) {
  return source.split(regex).filter((s) => s.trim() !== "");
}
function splitByRoleAndHistoryMarkers(renderedString) {
  return splitByRegex(renderedString, ROLE_AND_HISTORY_MARKER_REGEX);
}
function splitByMediaAndSectionMarkers(source) {
  return splitByRegex(source, MEDIA_AND_SECTION_MARKER_REGEX);
}
function convertNamespacedEntryToNestedObject(key, value, obj = {}) {
  const result = obj || {};
  const lastDotIndex = key.lastIndexOf(".");
  const ns = key.substring(0, lastDotIndex);
  const field = key.substring(lastDotIndex + 1);
  result[ns] = result[ns] || {};
  result[ns][field] = value;
  return result;
}
function extractFrontmatterAndBody(source) {
  const match = source.match(FRONTMATTER_AND_BODY_REGEX);
  if (match) {
    const [, frontmatter, body] = match;
    return { frontmatter, body };
  }
  return { frontmatter: "", body: "" };
}
function parseDocument(source) {
  const { frontmatter, body } = extractFrontmatterAndBody(source);
  if (frontmatter) {
    try {
      const parsedMetadata = (0, import_yaml.parse)(frontmatter);
      const raw = { ...parsedMetadata };
      const pruned = { ...BASE_METADATA };
      const ext = {};
      for (const k in raw) {
        const key = k;
        if (RESERVED_METADATA_KEYWORDS.includes(key)) {
          pruned[key] = raw[key];
        } else if (key.includes(".")) {
          convertNamespacedEntryToNestedObject(key, raw[key], ext);
        }
      }
      return { ...pruned, raw, ext, template: body.trim() };
    } catch (error) {
      console.error("Dotprompt: Error parsing YAML frontmatter:", error);
      return { ...BASE_METADATA, template: source.trim() };
    }
  }
  return { ...BASE_METADATA, template: source };
}
function messageSourcesToMessages(messageSources) {
  return messageSources.filter((ms) => ms.content || ms.source).map((m) => {
    const out = {
      role: m.role,
      content: m.content || toParts(m.source || "")
    };
    if (m.metadata) {
      out.metadata = m.metadata;
    }
    return out;
  });
}
function transformMessagesToHistory(messages) {
  return messages.map((m) => ({
    ...m,
    metadata: { ...m.metadata, purpose: "history" }
  }));
}
function toMessages(renderedString, data) {
  let currentMessage = { role: "user", source: "" };
  const messageSources = [currentMessage];
  for (const piece of splitByRoleAndHistoryMarkers(renderedString)) {
    if (piece.startsWith(ROLE_MARKER_PREFIX)) {
      const role2 = piece.substring(ROLE_MARKER_PREFIX.length);
      if (currentMessage.source?.trim()) {
        currentMessage = { role: role2, source: "" };
        messageSources.push(currentMessage);
      } else {
        currentMessage.role = role2;
      }
    } else if (piece.startsWith(HISTORY_MARKER_PREFIX)) {
      const historyMessages = transformMessagesToHistory(data?.messages ?? []);
      if (historyMessages) {
        messageSources.push(...historyMessages);
      }
      currentMessage = { role: "model", source: "" };
      messageSources.push(currentMessage);
    } else {
      currentMessage.source += piece;
    }
  }
  const messages = messageSourcesToMessages(messageSources);
  return insertHistory(messages, data?.messages);
}
function messagesHaveHistory(messages) {
  return messages.some((m) => m.metadata?.purpose === "history");
}
function insertHistory(messages, history2 = []) {
  if (!history2 || messagesHaveHistory(messages)) {
    return messages;
  }
  if (messages.length === 0) {
    return history2;
  }
  const lastMessage = messages.at(-1);
  if (lastMessage?.role === "user") {
    const messagesWithoutLast = messages.slice(0, -1);
    return [...messagesWithoutLast, ...history2, lastMessage];
  }
  return [...messages, ...history2];
}
function toParts(source) {
  return splitByMediaAndSectionMarkers(source).map(parsePart);
}
function parsePart(piece) {
  if (piece.startsWith(MEDIA_MARKER_PREFIX)) {
    return parseMediaPart(piece);
  } else if (piece.startsWith(SECTION_MARKER_PREFIX)) {
    return parseSectionPart(piece);
  }
  return parseTextPart(piece);
}
function parseMediaPart(piece) {
  if (!piece.startsWith(MEDIA_MARKER_PREFIX)) {
    throw new Error("Invalid media piece");
  }
  const [_, url, contentType] = piece.split(" ");
  const part = { media: { url } };
  if (contentType) {
    part.media.contentType = contentType;
  }
  return part;
}
function parseSectionPart(piece) {
  if (!piece.startsWith(SECTION_MARKER_PREFIX)) {
    throw new Error("Invalid section piece");
  }
  const [_, sectionType] = piece.split(" ");
  return { metadata: { purpose: sectionType, pending: true } };
}
function parseTextPart(piece) {
  return { text: piece };
}

// src/picoschema.ts
var JSON_SCHEMA_SCALAR_TYPES = [
  "string",
  "boolean",
  "null",
  "number",
  "integer",
  "any"
];
var WILDCARD_PROPERTY_NAME = "(*)";
async function picoschema(schema, options) {
  return new PicoschemaParser(options).parse(schema);
}
var PicoschemaParser = class {
  schemaResolver;
  constructor(options) {
    this.schemaResolver = options?.schemaResolver;
  }
  async mustResolveSchema(schemaName) {
    if (!this.schemaResolver) {
      throw new Error(`Picoschema: unsupported scalar type '${schemaName}'.`);
    }
    const val = await this.schemaResolver(schemaName);
    if (!val) {
      throw new Error(
        `Picoschema: could not find schema with name '${schemaName}'`
      );
    }
    return val;
  }
  async parse(schema) {
    if (!schema) return null;
    if (typeof schema === "string") {
      const [type, description] = extractDescription(schema);
      if (JSON_SCHEMA_SCALAR_TYPES.includes(type)) {
        let out = { type };
        if (description) out = { ...out, description };
        return out;
      }
      const resolvedSchema = await this.mustResolveSchema(type);
      return description ? { ...resolvedSchema, description } : resolvedSchema;
    }
    if ([...JSON_SCHEMA_SCALAR_TYPES, "object", "array"].includes(
      schema?.type
    )) {
      return schema;
    }
    if (typeof schema?.properties === "object") {
      return { ...schema, type: "object" };
    }
    return this.parsePico(schema);
  }
  async parsePico(obj, path = []) {
    if (typeof obj === "string") {
      const [type, description] = extractDescription(obj);
      if (!JSON_SCHEMA_SCALAR_TYPES.includes(type)) {
        let resolvedSchema = await this.mustResolveSchema(type);
        if (description) resolvedSchema = { ...resolvedSchema, description };
        return resolvedSchema;
      }
      if (type === "any") {
        return description ? { description } : {};
      }
      return description ? { type, description } : { type };
    } else if (typeof obj !== "object") {
      throw new Error(
        "Picoschema: only consists of objects and strings. Got: " + JSON.stringify(obj)
      );
    }
    const schema = {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false
    };
    for (const key in obj) {
      if (key === WILDCARD_PROPERTY_NAME) {
        schema.additionalProperties = await this.parsePico(obj[key], [
          ...path,
          key
        ]);
        continue;
      }
      const [name, typeInfo] = key.split("(");
      const isOptional = name.endsWith("?");
      const propertyName = isOptional ? name.slice(0, -1) : name;
      if (!isOptional) {
        schema.required.push(propertyName);
      }
      if (!typeInfo) {
        const prop = { ...await this.parsePico(obj[key], [...path, key]) };
        if (isOptional && typeof prop.type === "string") {
          prop.type = [prop.type, "null"];
        }
        schema.properties[propertyName] = prop;
        continue;
      }
      const [type, description] = extractDescription(
        typeInfo.substring(0, typeInfo.length - 1)
      );
      if (type === "array") {
        schema.properties[propertyName] = {
          type: isOptional ? ["array", "null"] : "array",
          items: await this.parsePico(obj[key], [...path, key])
        };
      } else if (type === "object") {
        const prop = await this.parsePico(obj[key], [...path, key]);
        if (isOptional) prop.type = [prop.type, "null"];
        schema.properties[propertyName] = prop;
      } else if (type === "enum") {
        const prop = { enum: obj[key] };
        if (isOptional && !prop.enum.includes(null)) prop.enum.push(null);
        schema.properties[propertyName] = prop;
      } else {
        throw new Error(
          "Picoschema: parenthetical types must be 'object' or 'array', got: " + type
        );
      }
      if (description) {
        schema.properties[propertyName].description = description;
      }
    }
    if (!schema.required.length) delete schema.required;
    return schema;
  }
};
function extractDescription(input) {
  if (!input.includes(",")) return [input, null];
  const match = input.match(/(.*?), *(.*)$/);
  return [match[1], match[2]];
}

// src/util.ts
function removeUndefinedFields(obj) {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => removeUndefinedFields(item));
  }
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== void 0) {
      result[key] = removeUndefinedFields(value);
    }
  }
  return result;
}

// src/dotprompt.ts
var Dotprompt = class {
  handlebars;
  knownHelpers = {};
  defaultModel;
  modelConfigs = {};
  tools = {};
  toolResolver;
  schemas = {};
  schemaResolver;
  partialResolver;
  store;
  constructor(options) {
    this.handlebars = Handlebars.noConflict();
    this.modelConfigs = options?.modelConfigs || this.modelConfigs;
    this.defaultModel = options?.defaultModel;
    this.tools = options?.tools || {};
    this.toolResolver = options?.toolResolver;
    this.schemas = options?.schemas || {};
    this.schemaResolver = options?.schemaResolver;
    this.partialResolver = options?.partialResolver;
    for (const key in helpers_exports) {
      this.defineHelper(key, helpers_exports[key]);
      this.handlebars.registerHelper(key, helpers_exports[key]);
    }
    if (options?.helpers) {
      for (const key in options.helpers) {
        this.defineHelper(key, options.helpers[key]);
      }
    }
    if (options?.partials) {
      for (const key in options.partials) {
        this.definePartial(key, options.partials[key]);
      }
    }
  }
  /**
   * Registers a helper function for use in templates.
   *
   * @param name The name of the helper function to register
   * @param fn The helper function implementation
   * @return This instance for method chaining
   */
  defineHelper(name, fn) {
    this.handlebars.registerHelper(name, fn);
    this.knownHelpers[name] = true;
    return this;
  }
  /**
   * Registers a partial template for use in other templates.
   *
   * @param name The name of the partial to register
   * @param source The template source for the partial
   * @return This instance for method chaining
   */
  definePartial(name, source) {
    this.handlebars.registerPartial(name, source);
    return this;
  }
  /**
   * Registers a tool definition for use in prompts.
   *
   * @param def The tool definition to register
   * @return This instance for method chaining
   */
  defineTool(def) {
    this.tools[def.name] = def;
    return this;
  }
  /**
   * Parses a prompt template string into a structured ParsedPrompt object.
   *
   * @param source The template source string to parse
   * @return A parsed prompt object with extracted metadata and template
   */
  parse(source) {
    return parseDocument(source);
  }
  /**
   * Renders a prompt template with the provided data.
   *
   * @param source The template source string to render
   * @param data The data to use when rendering the template
   * @param options Additional metadata and options for rendering
   * @return A promise resolving to the rendered prompt
   */
  async render(source, data = {}, options) {
    const renderer = await this.compile(source);
    return renderer(data, options);
  }
  /**
   * Processes schema definitions in picoschema format into standard JSON Schema.
   *
   * @param meta The prompt metadata containing schema definitions
   * @return A promise resolving to the processed metadata with expanded schemas
   */
  async renderPicoschema(meta) {
    if (!meta.output?.schema && !meta.input?.schema) {
      return meta;
    }
    const newMeta = { ...meta };
    if (meta.input?.schema) {
      newMeta.input = {
        ...meta.input,
        schema: await picoschema(meta.input.schema, {
          schemaResolver: this.wrappedSchemaResolver.bind(this)
        })
      };
    }
    if (meta.output?.schema) {
      newMeta.output = {
        ...meta.output,
        schema: await picoschema(meta.output.schema, {
          schemaResolver: this.wrappedSchemaResolver.bind(this)
        })
      };
    }
    return newMeta;
  }
  /**
   * Resolves a schema name to its definition, using registered schemas or schema resolver.
   *
   * @param name The name of the schema to resolve
   * @return A promise resolving to the schema definition or null if not found
   */
  async wrappedSchemaResolver(name) {
    if (this.schemas[name]) {
      return this.schemas[name];
    }
    if (this.schemaResolver) {
      return await this.schemaResolver(name);
    }
    return null;
  }
  /**
   * Merges multiple metadata objects together, resolving tools and schemas.
   *
   * @param base The base metadata object
   * @param merges Additional metadata objects to merge into the base
   * @return A promise resolving to the merged and processed metadata
   */
  async resolveMetadata(base, ...merges) {
    let out = { ...base };
    for (let i = 0; i < merges.length; i++) {
      if (!merges[i]) continue;
      const config = out.config || {};
      out = { ...out, ...merges[i] };
      out.config = { ...config, ...merges[i]?.config || {} };
    }
    const { template: _, ...outWithoutTemplate } = out;
    out = outWithoutTemplate;
    out = removeUndefinedFields(out);
    out = await this.resolveTools(out);
    out = await this.renderPicoschema(out);
    return out;
  }
  /**
   * Resolves tool names to their definitions using registered tools or tool resolver.
   *
   * @param base The metadata containing tool references to resolve
   * @return A promise resolving to metadata with resolved tool definitions
   */
  async resolveTools(base) {
    const out = { ...base };
    if (out.tools) {
      const outTools = [];
      out.toolDefs = out.toolDefs || [];
      await Promise.all(
        out.tools.map(async (toolName) => {
          if (this.tools[toolName]) {
            if (out.toolDefs) {
              out.toolDefs.push(this.tools[toolName]);
            }
          } else if (this.toolResolver) {
            const resolvedTool = await this.toolResolver(toolName);
            if (!resolvedTool) {
              throw new Error(
                `Dotprompt: Unable to resolve tool '${toolName}' to a recognized tool definition.`
              );
            }
            if (out.toolDefs) {
              out.toolDefs.push(resolvedTool);
            }
          } else {
            outTools.push(toolName);
          }
        })
      );
      out.tools = outTools;
    }
    return out;
  }
  /**
   * Identifies all partial references in a template.
   *
   * @param template The template to scan for partial references
   * @return A set of partial names referenced in the template
   */
  identifyPartials(template) {
    const ast = this.handlebars.parse(template);
    const partials = /* @__PURE__ */ new Set();
    const visitor = new class extends this.handlebars.Visitor {
      // Visit partial statements and add their names to our set.
      PartialStatement(partial) {
        if (partial && typeof partial === "object" && "name" in partial && partial.name && typeof partial.name === "object" && "original" in partial.name && typeof partial.name.original === "string") {
          partials.add(partial.name.original);
        }
      }
    }();
    visitor.accept(ast);
    return partials;
  }
  /**
   * Resolves and registers all partials referenced in a template.
   *
   * @param template The template containing partial references
   * @return A promise that resolves when all partials are registered
   */
  async resolvePartials(template) {
    if (!this.partialResolver && !this.store) {
      return;
    }
    const partials = this.identifyPartials(template);
    await Promise.all(
      Array.from(partials).map(async (name) => {
        if (!this.handlebars.partials[name]) {
          let content = null;
          if (this.partialResolver) {
            content = await this.partialResolver(name);
          }
          if (!content && this.store) {
            const partial = await this.store.loadPartial(name);
            content = partial?.source;
          }
          if (content) {
            this.definePartial(name, content);
            await this.resolvePartials(content);
          }
        }
      })
    );
  }
  /**
   * Compiles a template into a reusable function for rendering prompts.
   *
   * @param source The template source or parsed prompt to compile
   * @param additionalMetadata Additional metadata to include in the compiled template
   * @return A promise resolving to a function for rendering the template
   */
  async compile(source, additionalMetadata) {
    let parsedSource;
    if (typeof source === "string") {
      parsedSource = this.parse(source);
    } else {
      parsedSource = source;
    }
    if (additionalMetadata) {
      parsedSource = { ...parsedSource, ...additionalMetadata };
    }
    await this.resolvePartials(parsedSource.template);
    const renderString = this.handlebars.compile(
      parsedSource.template,
      {
        knownHelpers: this.knownHelpers,
        knownHelpersOnly: true,
        noEscape: true
      }
    );
    const renderFunc = async (data, options) => {
      const { input, ...mergedMetadata } = await this.renderMetadata(parsedSource);
      const renderedString = renderString(
        { ...options?.input?.default || {}, ...data.input },
        {
          data: {
            metadata: {
              prompt: mergedMetadata,
              docs: data.docs,
              messages: data.messages
            },
            ...data.context || {}
          }
        }
      );
      return {
        ...mergedMetadata,
        messages: toMessages(renderedString, data)
      };
    };
    renderFunc.prompt = parsedSource;
    return renderFunc;
  }
  /**
   * Processes and resolves all metadata for a prompt template.
   *
   * @param source The template source or parsed prompt
   * @param additionalMetadata Additional metadata to include
   * @return A promise resolving to the fully processed metadata
   */
  async renderMetadata(source, additionalMetadata) {
    let parsedSource;
    if (typeof source === "string") {
      parsedSource = this.parse(source);
    } else {
      parsedSource = source;
    }
    const selectedModel = additionalMetadata?.model || parsedSource.model || this.defaultModel;
    let modelConfig;
    if (selectedModel && this.modelConfigs[selectedModel]) {
      modelConfig = this.modelConfigs[selectedModel];
    }
    return this.resolveMetadata(
      modelConfig ? { config: modelConfig } : {},
      parsedSource,
      additionalMetadata
    );
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Dotprompt,
  PicoschemaParser,
  picoschema
});
