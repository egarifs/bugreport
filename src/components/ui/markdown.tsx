import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

export const headingId = (text: string) =>
  text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/(^-|-$)/g, "");

type HastNode = { type: string; value?: string; children?: HastNode[] };
const hastText = (n?: HastNode): string => (n?.value ?? "") + (n?.children ?? []).map(hastText).join("");

const anchored = (Tag: "h1" | "h2" | "h3"): Components["h1"] =>
  function Heading({ node, children }) {
    return <Tag id={headingId(hastText(node as HastNode))} className="scroll-mt-4">{children}</Tag>;
  };

// Raw HTML in markdown is NOT rendered (react-markdown default), so uploaded docs / AI replies can't inject script.
export function Markdown({ children, className = "", anchors = false }: { children: string; className?: string; anchors?: boolean }) {
  return (
    <div className={`md ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) =>
            href?.startsWith("#") ? <a href={href}>{children}</a> : <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
          ...(anchors && { h1: anchored("h1"), h2: anchored("h2"), h3: anchored("h3") }),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
