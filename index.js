// server.js
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");
const { OpenAI } = require("openai");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 6500;

// Middleware
app.use(cors());
app.use(express.json());

// Utility function to clean JSON response
function cleanHtmlResponse(responseText) {
  let cleaned = responseText.trim();

  if (cleaned.startsWith("```html")) {
    cleaned = cleaned.replace("```html", "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replaceAll("```", "");
  }

  if (cleaned.endsWith("```")) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }

  cleaned = cleaned.replace(/^\s*html\s*/i, "");
  return cleaned.trim();
}

// Function to generate type-specific prompts
const generatePrompt = (type, topic, keywords, improvements) => {
  const keywordText = keywords.join(", ") || "none provided";
  const improvementText =
    improvements.length > 0
      ? `Apply the following enhancements to improve the quality of the content: ${improvements.join(
          ", "
        )}.`
      : "";

  const baseInstructions = `
⚠️ Output the response as raw HTML only. Do **not** include any <html>, <head>, or <body> tags. Wrap the entire content inside a single <div> element.
✅ Use Tailwind CSS utility classes for styling headings, paragraphs, lists, and other elements.
Ensure the HTML structure is clean, semantic, and visually appealing using Tailwind conventions.
`;

  switch (type) {
    case "FAQ":
      return `
You are an expert content writer specializing in FAQ creation and customer support content.

Create a comprehensive FAQ section for the topic: "${topic}".

Requirements:
- Generate 8-12 frequently asked questions with detailed, helpful answers
- Each question should address common user concerns, problems, or inquiries
- Arrange questions from most basic to more specific/advanced
- Use a conversational, helpful tone that builds trust
- Include practical examples, tips, or step-by-step guidance where appropriate
- Structure each Q&A pair clearly with proper HTML semantics

Incorporate these SEO keywords naturally: ${keywordText}

${improvementText}

Format Guidelines:
- Use <h2> for the main "Frequently Asked Questions" heading
- Use <h3> for each individual question
- Use <p> tags for answers with proper paragraph breaks
- Include <ul> or <ol> lists where helpful for step-by-step instructions
- Add emphasis with <strong> or <em> tags where appropriate

${baseInstructions}
`;

    case "Blog Post":
      return `
You are an expert blog writer and content strategist who creates engaging, informative blog posts.

Write a comprehensive blog post about: "${topic}".

Requirements:
- Create an engaging, SEO-optimized blog post of 800-1200 words
- Include a compelling introduction that hooks the reader
- Organize content with clear headings and subheadings (H2, H3)
- Use storytelling elements, examples, and practical insights
- Include actionable tips, strategies, or takeaways
- Add a strong conclusion that summarizes key points
- Write in a conversational, engaging tone that keeps readers interested
- Include relevant statistics, facts, or expert insights where appropriate

Incorporate these SEO keywords naturally: ${keywordText}

${improvementText}

Structure Guidelines:
- Use <h1> for the main title
- Use <h2> for major sections
- Use <h3> for subsections
- Include <p> tags for paragraphs with proper spacing
- Use <ul> or <ol> for lists and bullet points
- Add <blockquote> for important quotes or statistics
- Use <strong> and <em> for emphasis

${baseInstructions}
`;

    case "Product Description":
      return `
You are an expert e-commerce copywriter specializing in product descriptions that convert visitors into customers.

Create a compelling product description for: "${topic}".

Requirements:
- Write a persuasive product description that highlights key features and benefits
- Focus on how the product solves customer problems or improves their life
- Include specific product details, specifications, and unique selling points
- Use persuasive language that creates urgency and desire
- Address potential customer objections or concerns
- Include social proof elements if applicable
- Write in a sales-focused, benefit-driven tone
- Keep description scannable with bullet points and short paragraphs

Incorporate these SEO keywords naturally: ${keywordText}

${improvementText}

Format Guidelines:
- Use <h2> for the product name/title
- Use <h3> for sections like "Key Features", "Benefits", "Specifications"
- Use <p> tags for descriptive paragraphs
- Use <ul> for feature lists and bullet points
- Use <strong> for highlighting important benefits or features
- Include call-to-action language naturally within the content

${baseInstructions}
`;

    case "Landing Page Content":
      return `
You are an expert conversion copywriter specializing in high-converting landing page content.

Create compelling landing page content for: "${topic}".

Requirements:
- Write conversion-focused content that drives action
- Include a powerful headline that captures attention immediately
- Create a clear value proposition that explains benefits
- Address visitor pain points and present solutions
- Include social proof, testimonials, or credibility indicators
- Build urgency and scarcity where appropriate
- Include multiple compelling calls-to-action throughout
- Use persuasive copywriting techniques and emotional triggers
- Structure content to guide visitors toward conversion
- Keep sections concise and scannable for quick reading

Incorporate these SEO keywords naturally: ${keywordText}

${improvementText}

Structure Guidelines:
- Use <h1> for the main headline
- Use <h2> for major sections like "Benefits", "How It Works", "Why Choose Us"
- Use <h3> for subsections and feature highlights
- Use <p> tags for benefit statements and descriptions
- Use <ul> for benefit lists and feature highlights
- Include <div> with appropriate classes for call-to-action sections
- Use <strong> and <em> for emphasis on key benefits

${baseInstructions}
`;

    default:
      return `
You are an expert content writer and SEO strategist.

Write comprehensive content for the topic: "${topic}".

Incorporate the following SEO keywords naturally: ${keywordText}

${improvementText}

Ensure the content is clear, engaging, informative, and appropriately structured.
Use a tone and format that aligns with best SEO practices and user experience expectations.

${baseInstructions}
`;
  }
};

// Website scraping endpoint
app.post("/api/scrape", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    const { data: html } = await axios.get(url);

    const $ = cheerio.load(html);
    const texts = [];

    // Extract content from semantic tags
    ["main", "section", "article"].forEach((tag) => {
      $(tag).each((i, element) => {
        const text = $(element).text().trim().replace(/\s+/g, " ");
        if (text) {
          texts.push(text);
        }
      });
    });

    // Extract from content divs
    $("div").each((i, element) => {
      const className = $(element).attr("class") || "";
      if (
        className.includes("content") ||
        className.includes("main") ||
        className.includes("text")
      ) {
        const text = $(element).text().trim().replace(/\s+/g, " ");
        if (text) {
          texts.push(text);
        }
      }
    });

    // Fallback to body content
    if (texts.length === 0) {
      const bodyText = $("body").text().trim().replace(/\s+/g, " ");
      if (bodyText) {
        texts.push(bodyText);
      }
    }

    // Remove duplicates and limit content
    const uniqueTexts = [...new Set(texts)];
    const fullText = uniqueTexts.join("\n").substring(0, 10000);

    res.json({
      content: fullText,
      wordCount: fullText.split(/\s+/).length,
      characterCount: fullText.length,
      sentenceCount: fullText.split(".").length,
    });
  } catch (error) {
    console.error("Scraping error:", error.message);
    res.status(500).json({
      error: "Failed to scrape website",
      details: error.message,
    });
  }
});

// SEO analysis endpoint
app.post("/api/analyze-seo", async (req, res) => {
  try {
    const { content, apiKey = process.env.OPENAI_API_KEY } = req.body;

    if (!content || !apiKey) {
      return res
        .status(400)
        .json({ error: "Content and API key are required" });
    }

    const openai = new OpenAI({ apiKey });

    const prompt = `
        You are an SEO expert. Analyze the following content about Smart WiFi for SEO performance. Assess:
        1. Does the content use relevant keywords about smart wifi and related topics? Is it likely to rank well for high-volume keywords?
        2. What improvements can be made to increase SEO performance?
        3. Suggest new keywords (with high search volume) that should be targeted, and recommend content topics or sections to add.

        Content:
        ${content}

        Provide the output in JSON format with the following structure:
        {
            "SEOAnalysis": {
                "CurrentKeywords": ["keyword1", "keyword2"],
                "SEOScore": 75,
                "Improvements": ["improvement1", "improvement2"],
                "NewKeywordTargets": {
                    "SuggestedKeywords": ["new_keyword1", "new_keyword2"],
                    "ContentTopicsToAdd": ["topic1", "topic2"]
                }
            }
        }
        `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 800,
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const analysisResult = completion.choices[0].message.content;

    res.json({
      analysis: analysisResult,
      rawAnalysis: analysisResult,
    });
  } catch (error) {
    console.error("SEO analysis error:", error.message);
    res.status(500).json({
      error: "Failed to analyze SEO",
      details: error.message,
    });
  }
});

// Content generation endpoint
app.post("/api/generate-content", async (req, res) => {
  try {
    const {
      seoData,
      contentTopic,
      generationType,
      apiKey,
      maxTokens = 1500,
      temperature = 0.7,
      selectedImprovements = [],
      selectedKeywords = [],
    } = req.body;

    if (!seoData || !contentTopic || !generationType || !apiKey) {
      return res.status(400).json({
        error:
          "SEO data, content topic, generation type, and API key are required",
      });
    }

    const openai = new OpenAI({ apiKey });

    // Parse SEO data
    const seoParsed = JSON.parse(seoData);
    const suggestedKeywords =
      selectedKeywords?.length > 0
        ? selectedKeywords
        : seoParsed.SEOAnalysis.NewKeywordTargets.SuggestedKeywords;

    const suggestedImprovements =
      selectedImprovements?.length > 0
        ? selectedImprovements
        : seoParsed.SEOAnalysis.Improvements;

    // Generate the appropriate prompt based on generation type
    const prompt = generatePrompt(
      generationType,
      contentTopic,
      suggestedKeywords,
      suggestedImprovements
    );

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: parseInt(maxTokens),
      temperature: parseFloat(temperature),
    });

    const generatedContent = completion.choices[0].message.content;
    const cleanResponse = cleanHtmlResponse(generatedContent);
    res.json({
      content: cleanResponse,
    });
  } catch (error) {
    console.error("Content generation error:", error.message);
    res.status(500).json({
      error: "Failed to generate content",
      details: error.message,
    });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// const express = require("express");
// const axios = require("axios");
// const cheerio = require("cheerio");
// const dotenv = require("dotenv");
// const morgan = require("morgan");
// const { marked } = require("marked");
// const { OpenAI } = require("openai");

// dotenv.config();

// const app = express();
// app.use(express.json());
// app.use(morgan("dev"));
// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// // --- SEO Analysis Agent ---
// app.post("/analysis/analyze-seo", async (req, res) => {
//   const { url, responseType = "json" } = req.body;

//   if (!url) return res.status(400).json({ error: "URL is required" });

//   try {
//     const { data: html } = await axios.get(url);
//     const $ = cheerio.load(html);

//     // Extract head content
//     const title = $("head > title").text();
//     const metaDescription = $('meta[name="description"]').attr("content") || "";
//     const metaKeywords = $('meta[name="keywords"]').attr("content") || "";
//     const ogTitle = $('meta[property="og:title"]').attr("content") || "";
//     const ogDescription =
//       $('meta[property="og:description"]').attr("content") || "";
//     const canonical = $('link[rel="canonical"]').attr("href") || "";

//     // Extract body content
//     const bodyText = $("body").text().replace(/\s+/g, " ").trim();

//     const prompt = `
// You are an expert SEO analyst for a broadband/ISP company.

// Analyze the SEO performance of the following ACT Fibernet webpage. The focus is on how well it performs for the topic of the page.

// Please assess:
// 1. How effectively does the page use the following important keywords:
//    - Broadband
//    - ISP
//    - Smart WiFi
//    - Fiber

// 2. Whether the meta tags (title, description, keywords) are optimized for these keywords.

// 3. Whether the content aligns with what users are searching for related to Smart WiFi.

// 4. Is the structure SEO-friendly (headings, relevance, keyword distribution)?

// 5. What’s missing? For example, should it include FAQs or comparisons like:
//    - “Is WiFi 6 better than WiFi 5?”
//    - “Smart WiFi vs Traditional WiFi”
//    - “AirFiber vs Fiber: Pros and Cons”

// Finally, suggest:
// - Weak areas in content or metadata.
// - Better keywords (based on user interest/search trends).
// - Topics for new blog posts or FAQ pages.
// - A short summary of what content should be created next.

// Here is the webpage content and metadata:
// ---
// Title: ${title}
// Meta Description: ${metaDescription}
// Meta Keywords: ${metaKeywords}
// OG Title: ${ogTitle}
// OG Description: ${ogDescription}
// Canonical URL: ${canonical}
// Page Content:
// ${bodyText}`;

//     const completion = await openai.chat.completions.create({
//       model: "gpt-4o-mini",
//       messages: [{ role: "user", content: prompt }],
//     });
//     const response = completion.choices[0]?.message.content;
//     let body;
//     if (responseType === "json") {
//       body = { analysis: response };
//     } else {
//       res.setHeader("Content-Type", "text/html");
//       body = marked(response);
//     }
//     res.send(body);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: `Failed to analyze SEO: ${err}` });
//   }
// });

// // --- Content Generation Agent ---
// app.post("/analysis/generate-content", async (req, res) => {
//   const { suggestions, responseType = "json" } = req.body;

//   if (!suggestions) {
//     return res.status(400).json({ error: "suggestions are required" });
//   }
//   // for the topic: "${topic}"
//   const prompt = `
// You are a content strategist for a broadband/ISP company.

// Use the following SEO insights and keyword suggestions to create a new content piece that fills the identified gaps.

// Requirements:
// - Create an SEO-optimized article (or FAQ page if recommended).
// - Include a compelling title and a clear introduction.
// - Organize into main sections and sub-sections using H2/H3 tags.
// - Include FAQs if suggested.
// - Naturally use these focus keywords: Broadband, ISP, Smart WiFi, Fiber.
// - Make it readable and useful for a general internet consumer.

// Here are the SEO insights and content suggestions:

// ${suggestions}

// `;

//   try {
//     const completion = await openai.chat.completions.create({
//       model: "gpt-4o-mini",
//       messages: [{ role: "user", content: prompt }],
//     });
//     const response = completion.choices[0].message.content;
//     let body;
//     if (responseType === "json") {
//       body = { content: response };
//     } else {
//       res.setHeader("Content-Type", "text/html");
//       body = marked(response);
//     }
//     res.send(body);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: `Failed to generate content: ${err}` });
//   }
// });

// // Start server
// const PORT = process.env.PORT || 3500;
// app.listen(PORT, () => {
//   console.log(`Server is running on PORT ${PORT}`);
// });
