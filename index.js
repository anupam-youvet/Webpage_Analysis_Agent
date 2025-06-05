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
function cleanJsonResponse(responseText) {
  let cleaned = responseText.trim();

  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.substring(3);
  }

  if (cleaned.endsWith("```")) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }

  cleaned = cleaned.replace(/^\s*json\s*/i, "");
  return cleaned.trim();
}

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
    } = req.body;

    if (!seoData || !contentTopic || !generationType || !apiKey) {
      return res.status(400).json({
        error:
          "SEO data, content topic, generation type, and API key are required",
      });
    }

    const openai = new OpenAI({ apiKey });

    // Parse SEO data
    const cleanedJson = cleanJsonResponse(seoData);
    const seoParsed = JSON.parse(cleanedJson);

    const suggestedKeywords =
      seoParsed.SEOAnalysis.NewKeywordTargets.SuggestedKeywords;
    const contentTopics =
      seoParsed.SEOAnalysis.NewKeywordTargets.ContentTopicsToAdd;

    let outlineText;
    if (generationType === "FAQ") {
      const outline = contentTopics.map((topic) => ({ Question: topic }));
      outlineText = outline.map((item) => `- ${item.Question}`).join("\n");
    } else {
      outlineText = contentTopics.map((topic) => `- ${topic}`).join("\n");
    }

    const prompt = `
        You are an expert content writer and SEO strategist.

        Write a comprehensive ${generationType} for the topic: "${contentTopic}".

        Incorporate the following SEO keywords naturally: ${suggestedKeywords.join(
          ", "
        )}.

        Follow this outline:
        ${outlineText}

        Ensure the content is clear, informative, and incorporates the suggested keywords where relevant.

        Structure your output appropriately for a ${generationType}.
        `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: parseInt(maxTokens),
      temperature: parseFloat(temperature),
    });

    const generatedContent = completion.choices[0].message.content;

    res.json({
      content: generatedContent,
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
