const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const dotenv = require("dotenv");
const morgan = require("morgan");
const { marked } = require("marked");
const { OpenAI } = require("openai");

dotenv.config();

const app = express();
app.use(express.json());
app.use(morgan("dev"));
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --- SEO Analysis Agent ---
app.post("/analysis/analyze-seo", async (req, res) => {
  const { url, responseType = "json" } = req.body;

  if (!url) return res.status(400).json({ error: "URL is required" });

  try {
    const { data: html } = await axios.get(url);
    const $ = cheerio.load(html);

    // Extract head content
    const title = $("head > title").text();
    const metaDescription = $('meta[name="description"]').attr("content") || "";
    const metaKeywords = $('meta[name="keywords"]').attr("content") || "";
    const ogTitle = $('meta[property="og:title"]').attr("content") || "";
    const ogDescription =
      $('meta[property="og:description"]').attr("content") || "";
    const canonical = $('link[rel="canonical"]').attr("href") || "";

    // Extract body content
    const bodyText = $("body").text().replace(/\s+/g, " ").trim();

    const prompt = `
You are an expert SEO analyst for a broadband/ISP company.

Analyze the SEO performance of the following ACT Fibernet webpage. The focus is on how well it performs for the topic of the page.

Please assess:
1. How effectively does the page use the following important keywords:
   - Broadband
   - ISP
   - Smart WiFi
   - Fiber

2. Whether the meta tags (title, description, keywords) are optimized for these keywords.

3. Whether the content aligns with what users are searching for related to Smart WiFi.

4. Is the structure SEO-friendly (headings, relevance, keyword distribution)?

5. What’s missing? For example, should it include FAQs or comparisons like:
   - “Is WiFi 6 better than WiFi 5?”
   - “Smart WiFi vs Traditional WiFi”
   - “AirFiber vs Fiber: Pros and Cons”

Finally, suggest:
- Weak areas in content or metadata.
- Better keywords (based on user interest/search trends).
- Topics for new blog posts or FAQ pages.
- A short summary of what content should be created next.

Here is the webpage content and metadata:
---
Title: ${title}
Meta Description: ${metaDescription}
Meta Keywords: ${metaKeywords}
OG Title: ${ogTitle}
OG Description: ${ogDescription}
Canonical URL: ${canonical}
Page Content:
${bodyText}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });
    const response = completion.choices[0]?.message.content;
    let body;
    if (responseType === "json") {
      body = { analysis: response };
    } else {
      res.setHeader("Content-Type", "text/html");
      body = marked(response);
    }
    res.send(body);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: `Failed to analyze SEO: ${err}` });
  }
});

// --- Content Generation Agent ---
app.post("/analysis/generate-content", async (req, res) => {
  const { suggestions, responseType = "json" } = req.body;

  if (!suggestions) {
    return res.status(400).json({ error: "suggestions are required" });
  }
  // for the topic: "${topic}"
  const prompt = `
You are a content strategist for a broadband/ISP company.

Use the following SEO insights and keyword suggestions to create a new content piece that fills the identified gaps.

Requirements:
- Create an SEO-optimized article (or FAQ page if recommended).
- Include a compelling title and a clear introduction.
- Organize into main sections and sub-sections using H2/H3 tags.
- Include FAQs if suggested.
- Naturally use these focus keywords: Broadband, ISP, Smart WiFi, Fiber.
- Make it readable and useful for a general internet consumer.

Here are the SEO insights and content suggestions:

${suggestions}

`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });
    const response = completion.choices[0].message.content;
    let body;
    if (responseType === "json") {
      body = { content: response };
    } else {
      res.setHeader("Content-Type", "text/html");
      body = marked(response);
    }
    res.send(body);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: `Failed to generate content: ${err}` });
  }
});

// Start server
const PORT = process.env.PORT || 3500;
app.listen(PORT, () => {
  console.log(`Server is running on PORT ${PORT}`);
});
