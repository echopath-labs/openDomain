import { readFile } from "node:fs/promises";

export async function parseMarkdownFile(file) {
  const content = await readFile(file, "utf8");
  return parseMarkdown(content, file);
}

export function parseMarkdown(content, file = "<memory>") {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match) {
    throw new FrontMatterError(file, "$", "Markdown file is missing YAML front matter.");
  }

  const frontmatter = parseYamlSubset(match[1], file);
  return {
    file,
    frontmatter,
    body: match[2] ?? ""
  };
}

export class FrontMatterError extends Error {
  constructor(file, field, message) {
    super(`${file}: ${field}: ${message}`);
    this.name = "FrontMatterError";
    this.file = file;
    this.field = field;
    this.problem = message;
  }
}

function parseYamlSubset(source, file) {
  const tokens = tokenize(source);
  if (tokens.length === 0) {
    return {};
  }

  const parsed = parseBlock(tokens, 0, tokens[0].indent, file);
  if (parsed.index < tokens.length) {
    const token = tokens[parsed.index];
    throw new FrontMatterError(file, "$", `Unexpected YAML content at line ${token.line}.`);
  }
  return parsed.value;
}

function tokenize(source) {
  return source
    .split(/\r?\n/)
    .map((raw, index) => ({ raw, line: index + 1 }))
    .filter(({ raw }) => raw.trim() !== "" && !raw.trimStart().startsWith("#"))
    .map(({ raw, line }) => {
      const indent = raw.match(/^ */)?.[0].length ?? 0;
      if (raw.slice(0, indent).includes("\t")) {
        throw new Error("Tabs are not supported in OpenDomain front matter.");
      }
      return {
        indent,
        text: raw.trim(),
        line
      };
    });
}

function parseBlock(tokens, index, indent, file) {
  const token = tokens[index];
  if (!token || token.indent < indent) {
    return { value: null, index };
  }
  if (token.text.startsWith("- ")) {
    return parseArray(tokens, index, token.indent, file);
  }
  return parseObject(tokens, index, token.indent, file);
}

function parseObject(tokens, index, indent, file) {
  const value = {};

  while (index < tokens.length) {
    const token = tokens[index];
    if (token.indent < indent || token.text.startsWith("- ")) {
      break;
    }
    if (token.indent > indent) {
      throw new FrontMatterError(file, "$", `Unexpected indentation at line ${token.line}.`);
    }

    const pair = parseKeyValue(token.text, file, token.line);
    index += 1;
    const parsed = parseValueOrChild(pair.rawValue, tokens, index, token.indent, file);
    value[pair.key] = parsed.value;
    index = parsed.index;
  }

  return { value, index };
}

function parseArray(tokens, index, indent, file) {
  const value = [];

  while (index < tokens.length) {
    const token = tokens[index];
    if (token.indent < indent || !token.text.startsWith("- ")) {
      break;
    }
    if (token.indent > indent) {
      throw new FrontMatterError(file, "$", `Unexpected indentation at line ${token.line}.`);
    }

    const rawItem = token.text.slice(2).trim();
    index += 1;

    if (rawItem === "") {
      const child = parseChild(tokens, index, indent, file);
      value.push(child.value);
      index = child.index;
      continue;
    }

    if (isKeyValue(rawItem)) {
      const item = {};
      const firstPair = parseKeyValue(rawItem, file, token.line);
      const firstParsed = parseValueOrChild(firstPair.rawValue, tokens, index, indent, file);
      item[firstPair.key] = firstParsed.value;
      index = firstParsed.index;

      while (index < tokens.length && tokens[index].indent > indent) {
        const property = tokens[index];
        if (property.indent !== indent + 2 || property.text.startsWith("- ")) {
          throw new FrontMatterError(file, "$", `Unexpected array item indentation at line ${property.line}.`);
        }
        const pair = parseKeyValue(property.text, file, property.line);
        index += 1;
        const parsed = parseValueOrChild(pair.rawValue, tokens, index, property.indent, file);
        item[pair.key] = parsed.value;
        index = parsed.index;
      }

      value.push(item);
      continue;
    }

    value.push(parseScalar(rawItem));
  }

  return { value, index };
}

function parseChild(tokens, index, parentIndent, file) {
  if (index >= tokens.length || tokens[index].indent <= parentIndent) {
    return { value: null, index };
  }
  return parseBlock(tokens, index, tokens[index].indent, file);
}

function parseValueOrChild(rawValue, tokens, index, indent, file) {
  if (rawValue !== "") {
    return { value: parseScalar(rawValue), index };
  }
  return parseChild(tokens, index, indent, file);
}

function parseKeyValue(text, file, line) {
  const match = text.match(/^([A-Za-z0-9_-]+):(.*)$/);
  if (!match) {
    throw new FrontMatterError(file, "$", `Expected key/value pair at line ${line}.`);
  }
  return {
    key: match[1],
    rawValue: match[2].trim()
  };
}

function isKeyValue(text) {
  return /^[A-Za-z0-9_-]+:/.test(text);
}

function parseScalar(raw) {
  if (raw === "[]") {
    return [];
  }
  if (raw.startsWith("[") && raw.endsWith("]")) {
    const inner = raw.slice(1, -1).trim();
    if (inner === "") {
      return [];
    }
    return inner.split(",").map((item) => parseScalar(item.trim()));
  }
  if (raw === "true") {
    return true;
  }
  if (raw === "false") {
    return false;
  }
  if (raw === "null" || raw === "~") {
    return null;
  }
  if (/^-?\d+$/.test(raw)) {
    return Number.parseInt(raw, 10);
  }
  if (/^-?\d+\.\d+$/.test(raw)) {
    return Number.parseFloat(raw);
  }
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  return raw;
}
