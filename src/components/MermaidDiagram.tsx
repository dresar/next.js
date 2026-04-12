import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

let mermaidInitialized = false;

function initMermaid(isDark: boolean) {
  mermaid.initialize({
    startOnLoad: false,
    theme: isDark ? "dark" : "default",
    securityLevel: "loose",
    themeVariables: isDark
      ? {
          primaryColor: "#1e3a5f",
          primaryTextColor: "#e0f2fe",
          primaryBorderColor: "#38bdf8",
          lineColor: "#64748b",
          secondaryColor: "#1e293b",
          tertiaryColor: "#0f172a",
          background: "#0f172a",
          mainBkg: "#1e293b",
          nodeBorder: "#38bdf8",
          clusterBkg: "#1e293b",
          titleColor: "#e0f2fe",
          edgeLabelBackground: "#1e293b",
        }
      : {},
    er: { useMaxWidth: true },
    flowchart: { useMaxWidth: true, htmlLabels: true },
  });
  mermaidInitialized = true;
}

export function MermaidDiagram({
  chart,
  id,
}: {
  chart: string;
  id: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    if (!mermaidInitialized) initMermaid(isDark);

    const render = async () => {
      try {
        // Mermaid v11+ uses render async
        const { svg: renderedSvg } = await mermaid.render(
          `mermaid-${id}`,
          chart.trim()
        );
        setSvg(renderedSvg);
        setError("");
      } catch (err) {
        console.error("Mermaid render error:", err);
        setError(String(err));
      }
    };
    render();
  }, [chart, id]);

  if (error) {
    return (
      <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-xs text-red-400 font-mono whitespace-pre-wrap">
        Mermaid Error: {error}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="mermaid-container overflow-x-auto py-2"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
