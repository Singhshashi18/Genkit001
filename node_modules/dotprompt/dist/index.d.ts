import * as Handlebars from 'handlebars';

/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
type Schema = Record<string, any>;
interface ToolDefinition {
    name: string;
    description?: string;
    inputSchema: Schema;
    outputSchema?: Schema;
}
type ToolArgument = string | ToolDefinition;
interface HasMetadata {
    /** Arbitrary metadata to be used by tooling or for informational purposes. */
    metadata?: Record<string, any>;
}
interface PromptRef {
    name: string;
    variant?: string;
    version?: string;
}
interface PromptData extends PromptRef {
    source: string;
}
interface PromptMetadata<ModelConfig = Record<string, any>> extends HasMetadata {
    /** The name of the prompt. */
    name?: string;
    /** The variant name for the prompt. */
    variant?: string;
    /** The version of the prompt. */
    version?: string;
    /** A description of the prompt. */
    description?: string;
    /** The name of the model to use for this prompt, e.g.
     * `vertexai/gemini-1.0-pro` */
    model?: string;
    /** Names of tools (registered separately) to allow use of in this prompt. */
    tools?: string[];
    /** Definitions of tools to allow use of in this prompt. */
    toolDefs?: ToolDefinition[];
    /** Model configuration. Not all models support all options. */
    config?: ModelConfig;
    /** Configuration for input variables. */
    input?: {
        /** Defines the default input variable values to use if none are provided. */
        default?: Record<string, any>;
        /** Schema definition for input variables. */
        schema?: Schema;
    };
    /** Defines the expected model output format. */
    output?: {
        /** Desired output format for this prompt. */
        format?: string | 'json' | 'text';
        /** Schema defining the output structure. */
        schema?: Schema;
    };
    /**
     * This field will contain the raw frontmatter as parsed with no additional
     * processing or substitutions. If your implementation requires custom fields
     * they will be available here.
     */
    raw?: Record<string, any>;
    /**
     * Fields that contain a period will be considered "extension fields" in the
     * frontmatter and will be gathered by namespace. For example, `myext.foo:
     * 123` would be available at `parsedPrompt.ext.myext.foo`. Nested namespaces
     * will be flattened, so `myext.foo.bar: 123` would be available at
     * `parsedPrompt.ext["myext.foo"].bar`.
     */
    ext?: Record<string, Record<string, any>>;
}
interface ParsedPrompt<ModelConfig = Record<string, any>> extends PromptMetadata<ModelConfig> {
    /** The source of the template with metadata / frontmatter already removed. */
    template: string;
}
interface EmptyPart extends HasMetadata {
    text?: never;
    data?: never;
    media?: never;
    toolRequest?: never;
    toolResponse?: never;
}
type TextPart = Omit<EmptyPart, 'text'> & {
    text: string;
};
type DataPart = Omit<EmptyPart, 'data'> & {
    data: Record<string, any>;
};
type MediaPart = Omit<EmptyPart, 'media'> & {
    media: {
        url: string;
        contentType?: string;
    };
};
type ToolRequestPart<Input = any> = Omit<EmptyPart, 'toolRequest'> & {
    toolRequest: {
        name: string;
        input?: Input;
        ref?: string;
    };
};
type ToolResponsePart<Output = any> = Omit<EmptyPart, 'toolResponse'> & {
    toolResponse: {
        name: string;
        output?: Output;
        ref?: string;
    };
};
type PendingPart = EmptyPart & {
    metadata: {
        pending: true;
        [key: string]: any;
    };
};
type Part = TextPart | DataPart | MediaPart | ToolRequestPart | ToolResponsePart | PendingPart;
type Role = 'user' | 'model' | 'tool' | 'system' | 'assistant';
interface Message extends HasMetadata {
    role: Role;
    content: Part[];
}
interface Document extends HasMetadata {
    content: Part[];
}
/**
 * DataArgument provides all of the information necessary to render a
 * template at runtime.
 **/
interface DataArgument<Variables = any, State = any> {
    /** Input variables for the prompt template. */
    input?: Variables;
    /** Relevant documents. */
    docs?: Document[];
    /** Previous messages in the history of a multi-turn conversation. */
    messages?: Message[];
    /**
     * Items in the context argument are exposed as `@` variables, e.g.
     * `context: {state: {...}}` is exposed as `@state`.
     **/
    context?: Record<string, any>;
}
type JSONSchema = any;
/**
 * SchemaResolver is a function that can resolve a provided schema name to
 * an underlying JSON schema, utilized for shorthand to a schema library
 * provided by an external tool.
 **/
type SchemaResolver = (schemaName: string) => JSONSchema | null | Promise<JSONSchema | null>;
/**
 * SchemaResolver is a function that can resolve a provided tool name to
 * an underlying ToolDefinition, utilized for shorthand to a tool registry
 * provided by an external library.
 **/
type ToolResolver = (toolName: string) => ToolDefinition | null | Promise<ToolDefinition | null>;
/**
 * RenderedPrompt is the final result of rendering a Dotprompt template.
 * It includes all of the prompt metadata as well as a set of `messages` to
 * be sent to the  model.
 */
interface RenderedPrompt<ModelConfig = Record<string, any>> extends PromptMetadata<ModelConfig> {
    /** The rendered messages of the prompt. */
    messages: Message[];
}
/**
 * PromptFunction is a function that takes runtime data / context and returns
 * a rendered prompt result.
 */
interface PromptFunction<ModelConfig = Record<string, any>> {
    (data: DataArgument, options?: PromptMetadata<ModelConfig>): Promise<RenderedPrompt<ModelConfig>>;
    prompt: ParsedPrompt<ModelConfig>;
}
/**
 * PromptRefFunction is a function that takes runtime data / context and returns
 * a rendered prompt result after loading a prompt via reference.
 */
interface PromptRefFunction<ModelConfig = Record<string, any>> {
    (data: DataArgument, options?: PromptMetadata<ModelConfig>): Promise<RenderedPrompt<ModelConfig>>;
    promptRef: PromptRef;
}
interface PaginatedResponse {
    cursor?: string;
}
interface PartialRef {
    name: string;
    variant?: string;
    version?: string;
}
interface PartialData extends PartialRef {
    source: string;
}
/**
 * Options for listing prompts with pagination.
 */
interface ListPromptsOptions {
    /**
     * The cursor to start listing from.
     */
    cursor?: string;
    /**
     * The maximum number of items to return.
     */
    limit?: number;
}
/**
 * Options for listing partials with pagination.
 */
interface ListPartialsOptions {
    /**
     * The cursor to start listing from.
     */
    cursor?: string;
    /**
     * The maximum number of items to return.
     */
    limit?: number;
}
/**
 * Options for loading a prompt.
 */
interface LoadPromptOptions {
    /**
     * The specific variant identifier of the prompt to load.
     */
    variant?: string;
    /**
     * A specific version hash to load. If provided, an error is thrown if the
     * calculated version of the file content does not match this value.
     */
    version?: string;
}
/**
 * Options for loading a partial.
 */
interface LoadPartialOptions {
    /**
     * The specific variant identifier of the partial to load.
     */
    variant?: string;
    /**
     * A specific version hash to load. If provided, an error is thrown if the
     * calculated version of the file content does not match this value.
     */
    version?: string;
}
/**
 * Options for deleting a prompt or partial.
 */
interface DeletePromptOrPartialOptions {
    /**
     * The specific variant identifier to delete. If omitted, targets the
     * default (no variant) file.
     */
    variant?: string;
}
/**
 * A paginated list of prompts.
 */
interface PaginatedPrompts {
    /**
     * The list of prompts.
     */
    prompts: PromptRef[];
    /**
     * The cursor to start the next page of results.
     */
    cursor?: string;
}
/**
 * A paginated list of partials.
 */
interface PaginatedPartials {
    /**
     * The list of partials.
     */
    partials: PartialRef[];
    /**
     * The cursor to start the next page of results.
     */
    cursor?: string;
}
/**
 * PromptStore is a common interface that provides for reading and writing
 * prompts and partials.
 */
interface PromptStore {
    /** Return a list of all prompts in the store (optionally paginated). Some
     * store providers may return limited metadata. */
    list(options?: ListPromptsOptions): Promise<PaginatedPrompts>;
    /** Return a list of partial names available in this store. */
    listPartials(options?: ListPartialsOptions): Promise<PaginatedPartials>;
    /** Retrieve a prompt from the store.  */
    load(name: string, options?: LoadPromptOptions): Promise<PromptData>;
    /** Retrieve a partial from the store. */
    loadPartial(name: string, options?: LoadPartialOptions): Promise<PromptData>;
}
/**
 * PromptStoreWritable is a PromptStore that also has built-in methods for
 * writing prompts in addition to reading them.
 */
interface PromptStoreWritable extends PromptStore {
    /** Save a prompt in the store. May be destructive for prompt stores without
     * versioning. */
    save(prompt: PromptData): Promise<void>;
    /** Delete a prompt from the store. */
    delete(name: string, options?: DeletePromptOrPartialOptions): Promise<void>;
}
/**
 * A bundle of prompts and partials.
 */
interface PromptBundle {
    partials: PartialData[];
    prompts: PromptData[];
}

/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/** Function to resolve partial names to their content */
type PartialResolver = (partialName: string) => string | null | Promise<string | null>;
/** Options for the Dotprompt class. */
interface DotpromptOptions {
    /** A default model to use if none is supplied. */
    defaultModel?: string;
    /** Assign a set of default configuration options to be used with a particular model. */
    modelConfigs?: Record<string, object>;
    /** Helpers to pre-register. */
    helpers?: Record<string, Handlebars.HelperDelegate>;
    /** Partials to pre-register. */
    partials?: Record<string, string>;
    /** Provide a static mapping of tool definitions that should be used when resolving tool names. */
    tools?: Record<string, ToolDefinition>;
    /** Provide a lookup implementation to resolve tool names to definitions. */
    toolResolver?: ToolResolver;
    /** Provide a static mapping of schema names to their JSON Schema definitions. */
    schemas?: Record<string, JSONSchema>;
    /** Provide a lookup implementation to resolve schema names to JSON schema definitions. */
    schemaResolver?: SchemaResolver;
    /** Provide a lookup implementation to resolve partial names to their content. */
    partialResolver?: PartialResolver;
}
/**
 * The main class for the Dotprompt library.
 */
declare class Dotprompt {
    private handlebars;
    private knownHelpers;
    private defaultModel?;
    private modelConfigs;
    private tools;
    private toolResolver?;
    private schemas;
    private schemaResolver?;
    private partialResolver?;
    private store?;
    constructor(options?: DotpromptOptions);
    /**
     * Registers a helper function for use in templates.
     *
     * @param name The name of the helper function to register
     * @param fn The helper function implementation
     * @return This instance for method chaining
     */
    defineHelper(name: string, fn: Handlebars.HelperDelegate): this;
    /**
     * Registers a partial template for use in other templates.
     *
     * @param name The name of the partial to register
     * @param source The template source for the partial
     * @return This instance for method chaining
     */
    definePartial(name: string, source: string): this;
    /**
     * Registers a tool definition for use in prompts.
     *
     * @param def The tool definition to register
     * @return This instance for method chaining
     */
    defineTool(def: ToolDefinition): this;
    /**
     * Parses a prompt template string into a structured ParsedPrompt object.
     *
     * @param source The template source string to parse
     * @return A parsed prompt object with extracted metadata and template
     */
    parse<ModelConfig = Record<string, unknown>>(source: string): ParsedPrompt<ModelConfig>;
    /**
     * Renders a prompt template with the provided data.
     *
     * @param source The template source string to render
     * @param data The data to use when rendering the template
     * @param options Additional metadata and options for rendering
     * @return A promise resolving to the rendered prompt
     */
    render<Variables = Record<string, unknown>, ModelConfig = Record<string, unknown>>(source: string, data?: DataArgument<Variables>, options?: PromptMetadata<ModelConfig>): Promise<RenderedPrompt<ModelConfig>>;
    /**
     * Processes schema definitions in picoschema format into standard JSON Schema.
     *
     * @param meta The prompt metadata containing schema definitions
     * @return A promise resolving to the processed metadata with expanded schemas
     */
    private renderPicoschema;
    /**
     * Resolves a schema name to its definition, using registered schemas or schema resolver.
     *
     * @param name The name of the schema to resolve
     * @return A promise resolving to the schema definition or null if not found
     */
    private wrappedSchemaResolver;
    /**
     * Merges multiple metadata objects together, resolving tools and schemas.
     *
     * @param base The base metadata object
     * @param merges Additional metadata objects to merge into the base
     * @return A promise resolving to the merged and processed metadata
     */
    private resolveMetadata;
    /**
     * Resolves tool names to their definitions using registered tools or tool resolver.
     *
     * @param base The metadata containing tool references to resolve
     * @return A promise resolving to metadata with resolved tool definitions
     */
    private resolveTools;
    /**
     * Identifies all partial references in a template.
     *
     * @param template The template to scan for partial references
     * @return A set of partial names referenced in the template
     */
    private identifyPartials;
    /**
     * Resolves and registers all partials referenced in a template.
     *
     * @param template The template containing partial references
     * @return A promise that resolves when all partials are registered
     */
    private resolvePartials;
    /**
     * Compiles a template into a reusable function for rendering prompts.
     *
     * @param source The template source or parsed prompt to compile
     * @param additionalMetadata Additional metadata to include in the compiled template
     * @return A promise resolving to a function for rendering the template
     */
    compile<Variables = Record<string, unknown>, ModelConfig = Record<string, unknown>>(source: string | ParsedPrompt<ModelConfig>, additionalMetadata?: PromptMetadata<ModelConfig>): Promise<PromptFunction<ModelConfig>>;
    /**
     * Processes and resolves all metadata for a prompt template.
     *
     * @param source The template source or parsed prompt
     * @param additionalMetadata Additional metadata to include
     * @return A promise resolving to the fully processed metadata
     */
    renderMetadata<ModelConfig>(source: string | ParsedPrompt<ModelConfig>, additionalMetadata?: PromptMetadata<ModelConfig>): Promise<PromptMetadata<ModelConfig>>;
}

/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

interface PicoschemaOptions {
    schemaResolver?: SchemaResolver;
}
declare function picoschema(schema: unknown, options?: PicoschemaOptions): Promise<any>;
declare class PicoschemaParser {
    schemaResolver?: SchemaResolver;
    constructor(options?: PicoschemaOptions);
    private mustResolveSchema;
    parse(schema: unknown): Promise<JSONSchema | null>;
    private parsePico;
}

export { type DataArgument, type DataPart, type DeletePromptOrPartialOptions, type Document, Dotprompt, type DotpromptOptions, type JSONSchema, type ListPartialsOptions, type ListPromptsOptions, type LoadPartialOptions, type LoadPromptOptions, type MediaPart, type Message, type PaginatedPartials, type PaginatedPrompts, type PaginatedResponse, type ParsedPrompt, type Part, type PartialData, type PartialRef, type PendingPart, type PicoschemaOptions, PicoschemaParser, type PromptBundle, type PromptData, type PromptFunction, type PromptMetadata, type PromptRef, type PromptRefFunction, type PromptStore, type PromptStoreWritable, type RenderedPrompt, type Role, type Schema, type SchemaResolver, type TextPart, type ToolArgument, type ToolDefinition, type ToolRequestPart, type ToolResolver, type ToolResponsePart, picoschema };
