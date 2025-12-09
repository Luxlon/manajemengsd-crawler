// ========================================
// SERVER.JS - Direct API Mode
// Simplified: No CSV reading, crawler handles API directly
// ========================================

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { runCrawlPeriod1_20, runCrawlPeriod21_30 } from "./crawler.js";

dotenv.config();

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

// ========== SSE CLIENTS STORAGE ==========
const sseClients = new Map(); // runId -> Set of response objects

// ========== SSE ENDPOINT FOR REAL-TIME LOGS ==========
app.get("/crawler-logs/:runId", (req, res) => {
  const { runId } = req.params;
  
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // Register client
  if (!sseClients.has(runId)) {
    sseClients.set(runId, new Set());
  }
  sseClients.get(runId).add(res);
  
  console.log(`📡 SSE client connected for runId: ${runId}`);
  
  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', runId })}\n\n`);
  
  // Handle client disconnect
  req.on('close', () => {
    const clients = sseClients.get(runId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        sseClients.delete(runId);
      }
    }
    console.log(`📡 SSE client disconnected for runId: ${runId}`);
  });
});

// Helper function to broadcast logs to SSE clients
function broadcastLog(runId, logData) {
  const clients = sseClients.get(runId);
  if (clients) {
    clients.forEach(client => {
      try {
        client.write(`data: ${JSON.stringify(logData)}\n\n`);
      } catch (err) {
        console.error('Error broadcasting to client:', err.message);
      }
    });
  }
}

// Make broadcastLog available globally
global.broadcastLog = broadcastLog;

// ========== ENDPOINT PERIODE 1-20 (Direct API) ==========
app.post("/run-crawler-period-1-20", async (req, res) => {
  const { area = "BANDUNG" } = req.body;
  const runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Send immediate response with runId
  res.json({
    success: true,
    message: "Crawler started",
    runId,
    area,
    logsEndpoint: `/crawler-logs/${runId}`
  });
  
  // Run crawler asynchronously
  (async () => {
    try {
      console.log(`🚀 Starting crawler PERIODE 1-20 for ${area}...`);
      broadcastLog(runId, { type: 'start', area, period: '1-20' });
      
      const result = await runCrawlPeriod1_20(area, runId);
      
      broadcastLog(runId, { 
        type: 'complete', 
        success: true,
        totalCrawled: result.totalCrawled,
        totalSent: result.totalSent,
        totalFailed: result.totalFailed
      });
      
    } catch (err) {
      console.error("❌ Error:", err);
      broadcastLog(runId, { 
        type: 'error', 
        error: err.message 
      });
    }
  })();
});

// ========== ENDPOINT PERIODE 21-30 (Direct API) ==========
app.post("/run-crawler-period-21-30", async (req, res) => {
  try {
    const { area = "BANDUNG", onlyUnapproved = true } = req.body; // Terima parameter onlyUnapproved
    console.log(`🚀 Starting crawler PERIODE 21-30 for ${area}...`);
    console.log(`⚙️  Mode: ${onlyUnapproved ? 'Optimized (only unapproved)' : 'Full (all data)'}`);
    
    const result = await runCrawlPeriod21_30(area, onlyUnapproved); // Pass parameter ke crawler
    
    res.json({
      success: true,
      message: `Crawling periode 21-30 completed for ${area} (${result.mode} mode)`,
      area: area,
      runId: result.runId,
      totalChecked: result.totalChecked,
      totalUpdated: result.totalUpdated,
      totalSkipped: result.totalSkipped,
      mode: result.mode
    });
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ========== ENDPOINT BOTH PERIODS (Sequential) ==========
app.post("/run-crawler-both", async (req, res) => {
  try {
    const { area = "BANDUNG", onlyUnapproved = true } = req.body; // Terima parameter untuk periode 21-30
    
    console.log(`🚀 Starting crawler BOTH PERIODS for ${area}...`);
    
    // Phase 1: Periode 1-20
    console.log("\n📅 PHASE 1: Periode 1-20...");
    const result1_20 = await runCrawlPeriod1_20(area);
    console.log("✅ Periode 1-20 completed!\n");
    
    // Phase 2: Periode 21-30
    console.log("📅 PHASE 2: Periode 21-30...");
    console.log(`⚙️  Mode: ${onlyUnapproved ? 'Optimized (only unapproved)' : 'Full (all data)'}`);
    const result21_30 = await runCrawlPeriod21_30(area, onlyUnapproved); // Pass parameter
    console.log("✅ Periode 21-30 completed!");

    res.json({
      success: true,
      message: `Crawling completed for ${area}`,
      area: area,
      periode_1_20: {
        runId: result1_20.runId,
        totalCrawled: result1_20.totalCrawled,
        totalSent: result1_20.totalSent,
        totalFailed: result1_20.totalFailed,
      },
      periode_21_30: {
        runId: result21_30.runId,
        totalChecked: result21_30.totalChecked,
        totalUpdated: result21_30.totalUpdated,
        totalSkipped: result21_30.totalSkipped,
        mode: result21_30.mode
      }
    });
    
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ 
      success: false, 
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// ========== ENDPOINT ALL AREAS (Periode 1-20) ==========
app.post("/run-crawler-all-areas-period-1-20", async (req, res) => {
  try {
    const areas = ["BANDUNG", "CORPU", "PRIANGAN_BARAT", "PRIANGAN_TIMUR"];
    const results = [];
    
    console.log(`🚀 Starting crawler PERIODE 1-20 for all areas...`);
    
    for (const area of areas) {
      console.log(`\n📍 Area: ${area}`);
      const result = await runCrawlPeriod1_20(area);
      results.push({ area, ...result });
      console.log(`✅ ${area} completed!`);
    }
    
    console.log("\n✅ All areas completed!");
    
    res.json({
      success: true,
      message: "Crawling periode 1-20 completed for all areas",
      areas: areas,
      results: results,
    });
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ========== HEALTH CHECK ==========
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    endpoints: [
      "POST /run-crawler-period-1-20",
      "POST /run-crawler-period-21-30",
      "POST /run-crawler-both",
      "POST /run-crawler-all-areas-period-1-20"
    ]
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log("\n📋 Available endpoints:");
  console.log("   POST /run-crawler-period-1-20");
  console.log("   POST /run-crawler-period-21-30");
  console.log("   POST /run-crawler-both");
  console.log("   POST /run-crawler-all-areas-period-1-20");
  console.log("   GET  /health");
  console.log("\n⚙️ Configuration:");
  console.log(`   NEXTJS_API_URL: ${process.env.NEXTJS_API_URL || 'http://localhost:3000'}`);
  console.log(`   CRAWLER_API_KEY: ${process.env.CRAWLER_API_KEY ? '***' + process.env.CRAWLER_API_KEY.slice(-4) : '⚠️ NOT SET'}`);
  console.log("\n✅ Direct API Mode: Crawler sends data directly to database (no CSV intermediary)");
});
