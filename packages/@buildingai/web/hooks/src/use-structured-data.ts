import { useEffect } from "react";

function injectScript(data: Record<string, unknown>) {
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
  return () => {
    document.head.removeChild(script);
  };
}

export function useStructuredData(data: Record<string, unknown>): void {
  useEffect(() => {
    return injectScript(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function useOrganizationStructuredData({
  name = "清云AI",
  url = "https://ai.echoflow.cn",
  description = "清云AI 提供 AI 智能对话、智能体、知识库等人工智能服务，让每个人都能轻松使用 AI。",
  logo = "https://ai.echoflow.cn/echoflowai-favicon.ico",
}: {
  name?: string;
  url?: string;
  description?: string;
  logo?: string;
} = {}): void {
  useStructuredData({
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url,
    description,
    logo,
  });
}

export function useWebApplicationStructuredData({
  name = "清云AI",
  url = "https://ai.echoflow.cn",
  description = "AI 智能助手工作台，提供智能对话、智能体、知识库等 AI 服务",
}: {
  name?: string;
  url?: string;
  description?: string;
} = {}): void {
  useStructuredData({
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name,
    url,
    description,
    applicationCategory: "AIApplication",
    operatingSystem: "Web",
  });
}

export function useSoftwareApplicationStructuredData({
  name,
  url,
  description,
  image,
  author,
}: {
  name: string;
  url: string;
  description: string;
  image?: string;
  author?: string;
}): void {
  useStructuredData({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name,
    url,
    description,
    applicationCategory: "AIApplication",
    operatingSystem: "Web",
    ...(image && { image }),
    ...(author && {
      author: {
        "@type": "Organization",
        name: author,
      },
    }),
  });
}

export function useFAQStructuredData({
  questions,
}: {
  questions: { question: string; answer: string }[];
}): void {
  useStructuredData({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: q.answer,
      },
    })),
  });
}

export function useBreadcrumbStructuredData({
  items,
}: {
  items: { name: string; url: string }[];
}): void {
  useStructuredData({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  });
}