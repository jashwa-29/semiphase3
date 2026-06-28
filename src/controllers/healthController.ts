import { Request, Response } from 'express';
import mongoose from 'mongoose';
import os from 'os';

// Helper to format uptime into a readable string
function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor(seconds % (3600 * 24) / 3600);
  const m = Math.floor(seconds % 3600 / 60);
  const s = Math.floor(seconds % 60);
  
  const dDisplay = d > 0 ? d + (d == 1 ? " day " : " days ") : "";
  const hDisplay = h > 0 ? h + (h == 1 ? " hr " : " hrs ") : "";
  const mDisplay = m > 0 ? m + (m == 1 ? " min " : " mins ") : "";
  const sDisplay = s > 0 ? s + (s == 1 ? " sec" : " secs") : "";
  
  return (dDisplay + hDisplay + mDisplay + sDisplay).trim() || "0 secs";
}

// @desc    Check system health
// @route   GET /api/health
// @access  Public
export const getHealthStatus = async (req: Request, res: Response): Promise<void> => {
  // mongoose readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  const isConnected = mongoose.connection.readyState === 1;
  const dbStatus = isConnected ? 'Connected' : 'Disconnected';
  const dbColor = isConnected ? '#4ade80' : '#f87171';
  const glowColor = isConnected ? '74, 222, 128' : '248, 113, 113';
  const statusMessage = isConnected ? 'All Systems Operational' : 'Service Degraded';

  const uptime = formatUptime(process.uptime());
  const freemem = `${(os.freemem() / 1024 / 1024).toFixed(2)} MB`;
  const totalmem = `${(os.totalmem() / 1024 / 1024).toFixed(2)} MB`;
  const cpuCount = os.cpus().length;
  const loadAvg = os.loadavg().map(n => n.toFixed(2)).join(', ');
  const timestamp = new Date().toLocaleString();

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>System Health Check</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
      <style>
        body {
          font-family: 'Inter', sans-serif;
          background-color: #0f172a;
          color: #e2e8f0;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          margin: 0;
        }
        .container {
          background-color: #1e293b;
          border-radius: 16px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          padding: 40px;
          max-width: 650px;
          width: 90%;
          border: 1px solid #334155;
          position: relative;
          overflow: hidden;
        }
        .container::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 4px;
          background: linear-gradient(90deg, #3b82f6, ${dbColor});
        }
        h1 {
          margin-top: 0;
          color: #f8fafc;
          font-size: 24px;
          display: flex;
          align-items: center;
          gap: 14px;
          border-bottom: 1px solid #334155;
          padding-bottom: 24px;
          margin-bottom: 30px;
          font-weight: 600;
        }
        .status-indicator {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background-color: ${dbColor};
          box-shadow: 0 0 12px ${dbColor};
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(${glowColor}, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(${glowColor}, 0); }
          100% { box-shadow: 0 0 0 0 rgba(${glowColor}, 0); }
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
        }
        .card {
          background-color: #0f172a;
          padding: 24px;
          border-radius: 12px;
          border: 1px solid #334155;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
          border-color: #475569;
        }
        .card-title {
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: #94a3b8;
          margin-bottom: 10px;
          font-weight: 500;
        }
        .card-value {
          font-size: 22px;
          font-weight: 600;
          color: #f1f5f9;
        }
        .footer {
          margin-top: 40px;
          text-align: center;
          font-size: 13px;
          color: #64748b;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
        }
        .status-badge {
          font-size: 13px;
          font-weight: 500;
          color: ${dbColor};
          background-color: rgba(${glowColor}, 0.1);
          padding: 6px 12px;
          border-radius: 20px;
          margin-left: auto;
          border: 1px solid rgba(${glowColor}, 0.2);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>
          <div class="status-indicator"></div>
          System Health
          <div class="status-badge">${statusMessage}</div>
        </h1>
        
        <div class="grid">
          <div class="card">
            <div class="card-title">Database Status</div>
            <div class="card-value" style="color: ${dbColor}">${dbStatus}</div>
          </div>
          <div class="card">
            <div class="card-title">Server Uptime</div>
            <div class="card-value">${uptime}</div>
          </div>
          <div class="card">
            <div class="card-title">Memory Usage</div>
            <div class="card-value">${freemem} free</div>
            <div style="font-size: 13px; color: #64748b; margin-top: 6px;">of ${totalmem} total</div>
          </div>
          <div class="card">
            <div class="card-title">CPU & Load</div>
            <div class="card-value">${cpuCount} Cores</div>
            <div style="font-size: 13px; color: #64748b; margin-top: 6px;">Load: ${loadAvg}</div>
          </div>
        </div>

        <div class="footer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          Last updated: ${timestamp}
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    res.setHeader('Content-Type', 'text/html');
    if (isConnected) {
      res.status(200).send(html);
    } else {
      res.status(503).send(html); // 503 Service Unavailable if DB is down
    }
  } catch (error: any) {
    res.status(500).send('<h1>Server Error</h1>');
  }
};
