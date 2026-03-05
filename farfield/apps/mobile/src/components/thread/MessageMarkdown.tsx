import { useMemo, useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";

type InlineToken =
  | { kind: "text"; value: string }
  | { kind: "code"; value: string };

type MarkdownBlock =
  | { kind: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; inline: InlineToken[] }
  | { kind: "paragraph"; inline: InlineToken[] }
  | { kind: "unordered-list"; items: InlineToken[][] }
  | { kind: "ordered-list"; start: number; items: InlineToken[][] }
  | { kind: "blockquote"; inline: InlineToken[] }
  | { kind: "code"; language: string | null; content: string };

interface MessageMarkdownProps {
  text: string;
}

function parseInlineTokens(value: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const regex = /`([^`]+)`/g;
  let cursor = 0;
  let match = regex.exec(value);

  while (match) {
    const matchIndex = match.index;
    const fullMatch = match[0];
    const codeValue = match[1];

    if (matchIndex > cursor) {
      tokens.push({ kind: "text", value: value.slice(cursor, matchIndex) });
    }

    tokens.push({ kind: "code", value: codeValue });
    cursor = matchIndex + fullMatch.length;

    match = regex.exec(value);
  }

  if (cursor < value.length) {
    tokens.push({ kind: "text", value: value.slice(cursor) });
  }

  if (tokens.length === 0) {
    tokens.push({ kind: "text", value });
  }

  return tokens;
}

function isBlockStart(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0) return true;
  if (trimmed.startsWith("```")) return true;
  if (/^#{1,6}\s+/.test(trimmed)) return true;
  if (/^[-*]\s+/.test(trimmed)) return true;
  if (/^\d+\.\s+/.test(trimmed)) return true;
  if (/^>\s?/.test(trimmed)) return true;
  return false;
}

function parseMarkdown(text: string): MarkdownBlock[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (trimmed.length === 0) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const languageRaw = trimmed.slice(3).trim();
      const language = languageRaw.length > 0 ? languageRaw : null;
      index += 1;

      const codeLines: string[] = [];
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length && lines[index].trim().startsWith("```")) {
        index += 1;
      }

      blocks.push({
        kind: "code",
        language,
        content: codeLines.join("\n"),
      });
      continue;
    }

    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6;
      blocks.push({
        kind: "heading",
        level,
        inline: parseInlineTokens(headingMatch[2]),
      });
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: InlineToken[][] = [];
      while (index < lines.length) {
        const row = lines[index].trim();
        const listMatch = /^[-*]\s+(.*)$/.exec(row);
        if (!listMatch) break;
        items.push(parseInlineTokens(listMatch[1]));
        index += 1;
      }

      blocks.push({ kind: "unordered-list", items });
      continue;
    }

    const orderedMatch = /^(\d+)\.\s+(.*)$/.exec(trimmed);
    if (orderedMatch) {
      const items: InlineToken[][] = [parseInlineTokens(orderedMatch[2])];
      const start = Number(orderedMatch[1]);
      index += 1;

      while (index < lines.length) {
        const row = lines[index].trim();
        const listMatch = /^(\d+)\.\s+(.*)$/.exec(row);
        if (!listMatch) break;
        items.push(parseInlineTokens(listMatch[2]));
        index += 1;
      }

      blocks.push({ kind: "ordered-list", start, items });
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines: string[] = [];
      while (index < lines.length) {
        const row = lines[index].trim();
        const quoteMatch = /^>\s?(.*)$/.exec(row);
        if (!quoteMatch) break;
        quoteLines.push(quoteMatch[1]);
        index += 1;
      }

      blocks.push({
        kind: "blockquote",
        inline: parseInlineTokens(quoteLines.join(" ")),
      });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const row = lines[index];
      if (row.trim().length === 0) break;
      if (paragraphLines.length > 0 && isBlockStart(row)) break;
      paragraphLines.push(row.trim());
      index += 1;
    }

    blocks.push({
      kind: "paragraph",
      inline: parseInlineTokens(paragraphLines.join(" ")),
    });
  }

  return blocks;
}

function headingStyle(level: 1 | 2 | 3 | 4 | 5 | 6) {
  switch (level) {
    case 1:
      return styles.h1;
    case 2:
      return styles.h2;
    case 3:
      return styles.h3;
    case 4:
      return styles.h4;
    case 5:
      return styles.h5;
    case 6:
      return styles.h6;
  }
}

function renderInline(tokens: InlineToken[]) {
  return tokens.map((token, tokenIndex) => {
    if (token.kind === "code") {
      return (
        <Text key={`inline-code-${tokenIndex}`} style={styles.inlineCode}>
          {token.value}
        </Text>
      );
    }

    return <Text key={`inline-text-${tokenIndex}`}>{token.value}</Text>;
  });
}

export function MessageMarkdown({ text }: MessageMarkdownProps) {
  const blocks = useMemo(() => parseMarkdown(text), [text]);
  const [copyMessageLabel, setCopyMessageLabel] = useState("Copy message");

  async function copyText(value: string, doneLabel: string): Promise<void> {
    try {
      await Clipboard.setStringAsync(value);
      setCopyMessageLabel(doneLabel);
      setTimeout(() => {
        setCopyMessageLabel("Copy message");
      }, 1200);
    } catch {
      Alert.alert("Copy failed", "Could not copy text. Try long-press selection.");
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.copyButton}
          onPress={() => {
            void copyText(text, "Copied");
          }}
          accessibilityRole="button"
          accessibilityLabel="Copy full message"
        >
          <Text style={styles.copyButtonText}>{copyMessageLabel}</Text>
        </TouchableOpacity>
      </View>

      {blocks.map((block, blockIndex) => {
        switch (block.kind) {
          case "heading":
            return (
              <Text key={`heading-${blockIndex}`} style={[styles.blockText, headingStyle(block.level)]}>
                {renderInline(block.inline)}
              </Text>
            );
          case "paragraph":
            return (
              <Text key={`paragraph-${blockIndex}`} style={styles.blockText} selectable>
                {renderInline(block.inline)}
              </Text>
            );
          case "blockquote":
            return (
              <View key={`quote-${blockIndex}`} style={styles.quoteBox}>
                <Text style={styles.quoteText} selectable>
                  {renderInline(block.inline)}
                </Text>
              </View>
            );
          case "unordered-list":
            return (
              <View key={`ul-${blockIndex}`} style={styles.listBox}>
                {block.items.map((item, itemIndex) => (
                  <View key={`ul-item-${itemIndex}`} style={styles.listRow}>
                    <Text style={styles.listBullet}>•</Text>
                    <Text style={styles.listText} selectable>
                      {renderInline(item)}
                    </Text>
                  </View>
                ))}
              </View>
            );
          case "ordered-list":
            return (
              <View key={`ol-${blockIndex}`} style={styles.listBox}>
                {block.items.map((item, itemIndex) => (
                  <View key={`ol-item-${itemIndex}`} style={styles.listRow}>
                    <Text style={styles.listBullet}>{`${block.start + itemIndex}.`}</Text>
                    <Text style={styles.listText} selectable>
                      {renderInline(item)}
                    </Text>
                  </View>
                ))}
              </View>
            );
          case "code":
            return (
              <View key={`code-${blockIndex}`} style={styles.codeBox}>
                <View style={styles.codeHeader}>
                  <Text style={styles.codeLanguage}>{block.language ?? "code"}</Text>
                  <TouchableOpacity
                    style={styles.codeCopyButton}
                    onPress={() => {
                      void copyText(block.content, "Code copied");
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Copy code block"
                  >
                    <Text style={styles.codeCopyButtonText}>Copy code</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.codeText} selectable>
                  {block.content}
                </Text>
              </View>
            );
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  copyButton: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#C7D8FF",
    backgroundColor: "#F4F8FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  copyButtonText: {
    fontSize: 12,
    color: "#0052CC",
    fontWeight: "600",
  },
  blockText: {
    fontSize: 14,
    color: "#1C1C1E",
    lineHeight: 21,
  },
  h1: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
  },
  h2: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700",
  },
  h3: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
  },
  h4: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
  },
  h5: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
  },
  h6: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  inlineCode: {
    fontFamily: "monospace",
    backgroundColor: "#EDF0F5",
    color: "#003E73",
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  quoteBox: {
    borderLeftWidth: 3,
    borderLeftColor: "#A4A9B0",
    backgroundColor: "#F8F9FB",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  quoteText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#3A3A3C",
  },
  listBox: {
    gap: 6,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  listBullet: {
    width: 18,
    fontSize: 14,
    lineHeight: 21,
    color: "#3A3A3C",
    fontWeight: "600",
  },
  listText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    color: "#1C1C1E",
  },
  codeBox: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D5DAE1",
    backgroundColor: "#F6F8FA",
    overflow: "hidden",
  },
  codeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#E9EDF2",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  codeLanguage: {
    fontSize: 12,
    color: "#334155",
    fontWeight: "600",
  },
  codeCopyButton: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#C7D8FF",
    backgroundColor: "#F4F8FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  codeCopyButtonText: {
    fontSize: 12,
    color: "#0052CC",
    fontWeight: "600",
  },
  codeText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#0F172A",
    fontFamily: "monospace",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
});
